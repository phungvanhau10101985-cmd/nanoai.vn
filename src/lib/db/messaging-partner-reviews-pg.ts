import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  PUBLIC_REVIEW_QA_PAGE_SIZE,
  PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
  QA_BUYER_ANSWER_LIMIT,
  clampRating,
  coalesceImportGroup,
  partnerReviewVoterKeys,
  sanitizeReviewImageUrls,
  splitQaReplySlots,
  type PartnerQuestionAnswerRow,
  type PartnerQuestionRow,
  type PartnerQuestionWithAnswers,
  type PartnerRatingSummary,
  type PartnerReviewRow,
  type PartnerReviewSourceFilter,
  type QaReplySlot,
} from '@/lib/partner-website/reviews/partner-review-types'
import type {
  ImportedQuestionDraft,
  ImportedReviewDraft,
} from '@/lib/partner-website/reviews/partner-reviews-qa-excel'

/**
 * W1.5 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): đánh giá + hỏi đáp sản phẩm.
 * Xem docs/188_BEHAVIOR_SPEC.md mục C — làm ĐÚNG các điểm 188 làm sai (rating thật, ảnh hiện công
 * khai, unique review/khách/sản phẩm enforce ở DB).
 */

type ReviewDbRow = {
  id: string
  partner_id: string
  inventory_id: string | null
  order_id: string | null
  order_line_id: string | null
  guest_account_id: string | null
  linked_user_id: string | null
  reviewer_name: string
  rating: number
  title: string
  content: string
  image_urls: unknown
  is_active: boolean
  useful_count: number
  merchant_reply: string
  merchant_reply_by: string
  merchant_reply_at: unknown
  is_imported: boolean
  import_group: number
  created_at: unknown
  updated_at: unknown
}

type QuestionDbRow = {
  id: string
  partner_id: string
  inventory_id: string | null
  guest_account_id: string | null
  linked_user_id: string | null
  asker_name: string
  content: string
  is_active: boolean
  useful_count: number
  is_imported: boolean
  import_group: number
  created_at: unknown
  updated_at: unknown
}

type AnswerDbRow = {
  id: string
  question_id: string
  partner_id: string
  answer_type: 'buyer' | 'admin'
  reply_slot: QaReplySlot | null
  guest_account_id: string | null
  linked_user_id: string | null
  responder_name: string
  content: string
  is_verified: boolean
  is_active: boolean
  created_at: unknown
  updated_at: unknown
}

const REVIEW_SELECT = `id::text, partner_id::text, inventory_id::text, order_id::text, order_line_id::text,
  guest_account_id::text, linked_user_id::text, coalesce(reviewer_name, '') as reviewer_name, rating,
  coalesce(title, '') as title, content, image_urls, is_active, useful_count,
  coalesce(merchant_reply, '') as merchant_reply, coalesce(merchant_reply_by, '') as merchant_reply_by,
  merchant_reply_at, coalesce(is_imported, false) as is_imported, coalesce(import_group, 0) as import_group,
  created_at, updated_at`

const QUESTION_SELECT = `id::text, partner_id::text, inventory_id::text, guest_account_id::text,
  linked_user_id::text, coalesce(asker_name, '') as asker_name, content, is_active,
  coalesce(useful_count, 0) as useful_count, coalesce(is_imported, false) as is_imported,
  coalesce(import_group, 0) as import_group, created_at, updated_at`

const ANSWER_SELECT = `id::text, question_id::text, partner_id::text, answer_type,
  reply_slot, guest_account_id::text,
  linked_user_id::text, coalesce(responder_name, '') as responder_name, content, is_verified, is_active,
  created_at, updated_at`

const ANSWER_SLOT_ORDER = `order by case reply_slot
    when 'admin' then 0 when 'user_one' then 1 when 'user_two' then 2 else 3 end,
    created_at asc, id asc`

function mapReviewRow(r: ReviewDbRow): PartnerReviewRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    inventoryId: r.inventory_id,
    orderId: r.order_id,
    orderLineId: r.order_line_id,
    guestAccountId: r.guest_account_id,
    linkedUserId: r.linked_user_id,
    reviewerName: r.reviewer_name ?? '',
    rating: r.rating,
    title: r.title ?? '',
    content: r.content ?? '',
    imageUrls: sanitizeReviewImageUrls(r.image_urls),
    isActive: r.is_active !== false,
    usefulCount: r.useful_count ?? 0,
    merchantReply: r.merchant_reply ?? '',
    merchantReplyBy: r.merchant_reply_by ?? '',
    merchantReplyAt: r.merchant_reply_at ? String(r.merchant_reply_at) : null,
    isImported: r.is_imported === true,
    importGroup: Number(r.import_group) || 0,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function mapQuestionRow(r: QuestionDbRow): PartnerQuestionRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    inventoryId: r.inventory_id,
    guestAccountId: r.guest_account_id,
    linkedUserId: r.linked_user_id,
    askerName: r.asker_name ?? '',
    content: r.content ?? '',
    isActive: r.is_active !== false,
    usefulCount: r.useful_count ?? 0,
    isImported: r.is_imported === true,
    importGroup: Number(r.import_group) || 0,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

/** Thật theo SP + ảo cùng nhóm (188 group_rating / group_question). */
function publicPoolWhereSql(inventoryParam: number, groupParam: number): string {
  return `(inventory_id = $${inventoryParam}::uuid or (is_imported = true and coalesce(nullif(import_group, 0), 888) = $${groupParam}))`
}

function mapReplySlot(raw: unknown): QaReplySlot | null {
  if (raw === 'admin' || raw === 'user_one' || raw === 'user_two') return raw
  return null
}

function mapAnswerRow(r: AnswerDbRow): PartnerQuestionAnswerRow {
  return {
    id: r.id,
    questionId: r.question_id,
    partnerId: r.partner_id,
    answerType: r.answer_type,
    replySlot: mapReplySlot(r.reply_slot),
    guestAccountId: r.guest_account_id,
    linkedUserId: r.linked_user_id,
    responderName: r.responder_name ?? '',
    content: r.content ?? '',
    isVerified: Boolean(r.is_verified),
    isActive: r.is_active !== false,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  return (e as { code?: string }).code === '23505'
}

const VOTE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function toggleUsefulVoteRow(input: {
  id: string
  voterKey: string
  voterKeys?: string[]
  votesTable: 'messaging_partner_product_review_votes' | 'messaging_partner_product_question_votes'
  countTable: 'messaging_partner_product_reviews' | 'messaging_partner_product_questions'
  idColumn: 'review_id' | 'question_id'
}): Promise<{ ok: true; voted: boolean; usefulCount: number } | { ok: false }> {
  const voterKeys = partnerReviewVoterKeys(...(input.voterKeys ?? []), input.voterKey)
  const voterKey = voterKeys[0] || ''
  const id = input.id.trim()
  if (!voterKey || !VOTE_ID_RE.test(id) || !isPgConfigured()) return { ok: false }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query('set local row_security = off')
    const deleted = await client.query(
      `delete from public.${input.votesTable}
       where ${input.idColumn} = $1::uuid and voter_key = any($2::text[])
       returning 1`,
      [id, voterKeys]
    )
    const removedCount = Number(deleted.rowCount ?? deleted.rows.length) || 0
    if (removedCount > 0) {
      const res = await client.query<{ useful_count: number }>(
        `update public.${input.countTable}
         set useful_count = greatest(0, coalesce(useful_count, 0) - $2::int)
         where id = $1::uuid
         returning useful_count`,
        [id, removedCount]
      )
      if (!res.rows[0]) {
        await client.query('rollback')
        return { ok: false }
      }
      await client.query('commit')
      return { ok: true, voted: false, usefulCount: Math.max(0, Number(res.rows[0].useful_count) || 0) }
    }
    try {
      await client.query(
        `insert into public.${input.votesTable} (${input.idColumn}, voter_key)
         values ($1::uuid, $2)`,
        [id, voterKey]
      )
    } catch (e) {
      if (!isUniqueViolation(e)) throw e
      const res = await client.query<{ useful_count: number }>(
        `select useful_count from public.${input.countTable} where id = $1::uuid`,
        [id]
      )
      await client.query('commit')
      return {
        ok: true,
        voted: true,
        usefulCount: Math.max(0, Number(res.rows[0]?.useful_count) || 0),
      }
    }
    const res = await client.query<{ useful_count: number }>(
      `update public.${input.countTable}
       set useful_count = coalesce(useful_count, 0) + 1
       where id = $1::uuid
       returning useful_count`,
      [id]
    )
    if (!res.rows[0]) {
      await client.query('rollback')
      return { ok: false }
    }
    await client.query('commit')
    return { ok: true, voted: true, usefulCount: Math.max(0, Number(res.rows[0].useful_count) || 0) }
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn(`[toggleUsefulVoteRow ${input.countTable}]`, e)
    return { ok: false }
  } finally {
    client.release()
  }
}

/**
 * Đơn hàng không huỷ + `shipping_status=delivered` chứa đúng `inventoryId`, thuộc về
 * `guestAccountId`/`linkedUserId` — điều kiện được review (verified purchase tự nhiên).
 */
export async function checkDeliveredPurchaseFromPg(input: {
  partnerId: string
  inventoryId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
}): Promise<{ orderId: string; orderLineId: string } | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return null
  try {
    const row = await pgQueryOne<{ order_id: string; order_line_id: string }>(
      `select o.id::text as order_id, l.id::text as order_line_id
       from public.messaging_partner_order_lines l
       join public.messaging_partner_orders o on o.id = l.order_id
       left join public.customer_care_conversations c on c.id = o.conversation_id
       where o.partner_id = $1::uuid
         and l.product_inventory_id = $2::uuid
         and o.status <> 'cancelled'
         and coalesce(o.shipping_status, 'pending') = 'delivered'
         and (
           ($3::uuid is not null and c.guest_account_id = $3::uuid)
           or ($4::uuid is not null and c.linked_user_id = $4::uuid)
         )
       order by o.created_at desc
       limit 1`,
      [input.partnerId, input.inventoryId, guestAccountId, linkedUserId]
    )
    return row ? { orderId: row.order_id, orderLineId: row.order_line_id } : null
  } catch (e) {
    console.warn('[checkDeliveredPurchaseFromPg]', e)
    return null
  }
}

/** Đơn hàng (không huỷ) chứa đúng `inventoryId` — điều kiện trả lời Q&A với tư cách khách mua hàng. */
export async function checkAnyPurchaseFromPg(input: {
  partnerId: string
  inventoryId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return false
  try {
    const row = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1
         from public.messaging_partner_order_lines l
         join public.messaging_partner_orders o on o.id = l.order_id
         left join public.customer_care_conversations c on c.id = o.conversation_id
         where o.partner_id = $1::uuid
           and l.product_inventory_id = $2::uuid
           and o.status <> 'cancelled'
           and (
             ($3::uuid is not null and c.guest_account_id = $3::uuid)
             or ($4::uuid is not null and c.linked_user_id = $4::uuid)
           )
       ) as exists`,
      [input.partnerId, input.inventoryId, guestAccountId, linkedUserId]
    )
    return Boolean(row?.exists)
  } catch (e) {
    console.warn('[checkAnyPurchaseFromPg]', e)
    return false
  }
}

/** `true` nếu shop cấu hình review cần duyệt trước khi hiện công khai (M1.2/M1.3 — mặc định false). */
export async function fetchPartnerReviewRequiresApprovalFromPg(partnerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ review_requires_approval: boolean }>(
      `select coalesce(review_requires_approval, false) as review_requires_approval
       from public.messaging_partners where id = $1::uuid`,
      [partnerId]
    )
    return Boolean(row?.review_requires_approval)
  } catch (e) {
    console.warn('[fetchPartnerReviewRequiresApprovalFromPg]', e)
    return false
  }
}

export type SubmitReviewResult =
  | { ok: true; row: PartnerReviewRow }
  | { ok: false; error: 'not_eligible' | 'already_reviewed' | 'db_error' }

/** Gửi đánh giá — kiểm tra verified purchase THẬT ở backend (không chỉ ẩn UI như 188). */
export async function insertPartnerProductReviewFromPg(input: {
  partnerId: string
  inventoryId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  reviewerName: string
  rating: number
  title: string
  content: string
  imageUrls: string[]
}): Promise<SubmitReviewResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return { ok: false, error: 'not_eligible' }

  const purchase = await checkDeliveredPurchaseFromPg({
    partnerId: input.partnerId,
    inventoryId: input.inventoryId,
    guestAccountId,
    linkedUserId,
  })
  if (!purchase) return { ok: false, error: 'not_eligible' }

  const requiresApproval = await fetchPartnerReviewRequiresApprovalFromPg(input.partnerId)
  const content = input.content.trim().slice(0, 4000)
  if (!content) return { ok: false, error: 'db_error' }

  try {
    const row = await pgQueryOne<ReviewDbRow>(
      `insert into public.messaging_partner_product_reviews (
        partner_id, inventory_id, order_id, order_line_id, guest_account_id, linked_user_id,
        reviewer_name, rating, title, content, image_urls, is_active
      ) values (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7, $8, $9, $10, $11::jsonb, $12
      )
      returning ${REVIEW_SELECT}`,
      [
        input.partnerId,
        input.inventoryId,
        purchase.orderId,
        purchase.orderLineId,
        guestAccountId,
        linkedUserId,
        input.reviewerName.trim().slice(0, 200),
        clampRating(input.rating),
        input.title.trim().slice(0, 200),
        content,
        JSON.stringify(sanitizeReviewImageUrls(input.imageUrls)),
        !requiresApproval,
      ]
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapReviewRow(row) }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'already_reviewed' }
    console.warn('[insertPartnerProductReviewFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

/**
 * Trang review công khai — merge SP thật + pool import cùng nhóm.
 * Sort 188: của tôi → thật → import → hữu ích → ngày.
 */
export async function fetchPartnerProductReviewsPageFromPg(input: {
  partnerId: string
  inventoryId: string
  importGroup?: number
  page?: number
  pageSize?: number
  viewerAccountKey?: string | null
  viewerAccountKeys?: string[] | null
  ratingFilter?: number
}): Promise<{ rows: PartnerReviewRow[]; total: number; hasReviewed: boolean } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(
    PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(input.pageSize ?? PUBLIC_REVIEW_QA_PAGE_SIZE))
  )
  const offset = (page - 1) * pageSize
  const viewerKeys = partnerReviewVoterKeys(...(input.viewerAccountKeys ?? []), input.viewerAccountKey)
  const ratingFilter = input.ratingFilter ? clampRating(input.ratingFilter) : null
  const importGroup = coalesceImportGroup(input.importGroup)

  try {
    const extra = ratingFilter ? 'and rating = $6' : ''
    const rows = await pgQuery<ReviewDbRow>(
      `select ${REVIEW_SELECT}
       from public.messaging_partner_product_reviews
       where partner_id = $1::uuid and is_active = true
         and ${publicPoolWhereSql(2, 5)}
         ${extra}
       order by
         (case when cardinality($3::text[]) > 0 and (
           guest_account_id::text = any($3::text[]) or linked_user_id::text = any($3::text[])
         ) then 0 else 1 end) asc,
         (case when coalesce(is_imported, false) then 1 else 0 end) asc,
         useful_count desc,
         created_at desc
       limit $4 offset ${offset}`,
      ratingFilter
        ? [input.partnerId, input.inventoryId, viewerKeys, pageSize, importGroup, ratingFilter]
        : [input.partnerId, input.inventoryId, viewerKeys, pageSize, importGroup]
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.messaging_partner_product_reviews
       where partner_id = $1::uuid and is_active = true
         and ${publicPoolWhereSql(2, 3)}
         ${ratingFilter ? 'and rating = $4' : ''}`,
      ratingFilter
        ? [input.partnerId, input.inventoryId, importGroup, ratingFilter]
        : [input.partnerId, input.inventoryId, importGroup]
    )
    const mine = viewerKeys.length
      ? await pgQueryOne<{ exists: boolean }>(
          `select exists (
             select 1 from public.messaging_partner_product_reviews
             where partner_id = $1::uuid and inventory_id = $2::uuid
               and coalesce(is_imported, false) = false
               and (guest_account_id::text = any($3::text[]) or linked_user_id::text = any($3::text[]))
           ) as exists`,
          [input.partnerId, input.inventoryId, viewerKeys]
        )
      : null
    const voted = viewerKeys.length && rows.length
      ? await pgQuery<{ review_id: string }>(
          `select review_id::text as review_id
           from public.messaging_partner_product_review_votes
           where voter_key = any($1::text[]) and review_id = any($2::uuid[])`,
          [viewerKeys, rows.map((r) => r.id)]
        )
      : []
    const votedIds = new Set(voted.map((v) => v.review_id))
    const viewerSet = new Set(viewerKeys)
    return {
      rows: rows.map((r) => {
        const mapped = mapReviewRow(r)
        return {
          ...mapped,
          userHasVoted: votedIds.has(r.id),
          isCurrentUser: Boolean(
            (mapped.guestAccountId && viewerSet.has(mapped.guestAccountId)) ||
              (mapped.linkedUserId && viewerSet.has(mapped.linkedUserId))
          ),
        }
      }),
      total: totalRow?.c ?? 0,
      hasReviewed: Boolean(mine?.exists),
    }
  } catch (e) {
    console.warn('[fetchPartnerProductReviewsPageFromPg]', e)
    return null
  }
}

/** Rating trung bình + histogram TÍNH THẬT từ bảng review (khác 188 — field ảo tách biệt review thật). */
export async function fetchPartnerProductRatingSummaryFromPg(
  partnerId: string,
  inventoryId: string,
  importGroup?: number
): Promise<PartnerRatingSummary> {
  const empty: PartnerRatingSummary = {
    average: 0,
    total: 0,
    histogram: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
  }
  if (!isPgConfigured()) return empty
  const group = coalesceImportGroup(importGroup)
  try {
    const rows = await pgQuery<{ rating: number; c: number }>(
      `select rating, count(*)::int as c
       from public.messaging_partner_product_reviews
       where partner_id = $1::uuid and is_active = true
         and ${publicPoolWhereSql(2, 3)}
       group by rating`,
      [partnerId, inventoryId, group]
    )
    const histogram = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } as PartnerRatingSummary['histogram']
    let total = 0
    let sum = 0
    for (const r of rows) {
      const key = String(r.rating) as keyof PartnerRatingSummary['histogram']
      if (key in histogram) histogram[key] = r.c
      total += r.c
      sum += r.rating * r.c
    }
    return { average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0, total, histogram }
  } catch (e) {
    console.warn('[fetchPartnerProductRatingSummaryFromPg]', e)
    return empty
  }
}

/** Toggle vote hữu ích — unique (review_id, voter_key), tăng/giảm useful_count, sàn 0. */
export async function togglePartnerProductReviewVoteFromPg(input: {
  reviewId: string
  voterKey: string
  voterKeys?: string[]
}): Promise<{ ok: true; voted: boolean; usefulCount: number } | { ok: false }> {
  return toggleUsefulVoteRow({
    id: input.reviewId,
    voterKey: input.voterKey,
    voterKeys: input.voterKeys,
    votesTable: 'messaging_partner_product_review_votes',
    countTable: 'messaging_partner_product_reviews',
    idColumn: 'review_id',
  })
}

/** Admin (M1.2) — phân trang 10/dòng, lọc sao / nhóm import / nguồn, gồm cả inactive. */
export async function fetchPartnerProductReviewsForAdminFromPg(input: {
  partnerId: string
  page?: number
  pageSize?: number
  ratingFilter?: number
  inventoryId?: string
  importGroup?: number
  source?: PartnerReviewSourceFilter
}): Promise<{ rows: PartnerReviewRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 10)))
  const offset = (page - 1) * pageSize
  const ratingFilter = input.ratingFilter ? clampRating(input.ratingFilter) : null
  const inventoryId = input.inventoryId ?? null
  const importGroup =
    input.importGroup != null && Number.isFinite(Number(input.importGroup))
      ? Math.max(0, Math.round(Number(input.importGroup)))
      : null
  const source = input.source ?? 'all'

  const conds = ['partner_id = $1::uuid']
  const params: unknown[] = [input.partnerId]
  if (ratingFilter) {
    params.push(ratingFilter)
    conds.push(`rating = $${params.length}`)
  }
  if (inventoryId) {
    params.push(inventoryId)
    conds.push(`inventory_id = $${params.length}::uuid`)
  }
  if (importGroup != null) {
    params.push(importGroup)
    conds.push(`import_group = $${params.length}`)
  }
  if (source === 'imported') conds.push('is_imported = true')
  if (source === 'real') conds.push('is_imported = false')
  const where = conds.join(' and ')

  try {
    params.push(pageSize)
    const limitIdx = params.length
    const rows = await pgQuery<ReviewDbRow>(
      `select ${REVIEW_SELECT}
       from public.messaging_partner_product_reviews
       where ${where}
       order by created_at desc
       limit $${limitIdx} offset ${offset}`,
      params
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_product_reviews where ${where}`,
      params.slice(0, limitIdx - 1)
    )
    return { rows: rows.map(mapReviewRow), total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerProductReviewsForAdminFromPg]', e)
    return null
  }
}

export type AdminReviewPatch = {
  isActive?: boolean
  rating?: number
  title?: string
  content?: string
  merchantReply?: string
  merchantReplyBy?: string
  reviewerName?: string
  usefulCount?: number
  importGroup?: number
}

/** Inline auto-save admin (M1.2/M1.3) — merchant sửa trực tiếp trong bảng, debounce ~0.7s ở client. */
export async function updatePartnerProductReviewFromPg(
  partnerId: string,
  reviewId: string,
  patch: AdminReviewPatch
): Promise<PartnerReviewRow | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = []
  const params: unknown[] = [partnerId, reviewId]
  let p = 3

  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${p++}`)
    params.push(patch.isActive)
  }
  if (patch.rating !== undefined) {
    sets.push(`rating = $${p++}`)
    params.push(clampRating(patch.rating))
  }
  if (patch.title !== undefined) {
    sets.push(`title = $${p++}`)
    params.push(patch.title.trim().slice(0, 200))
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${p++}`)
    params.push(patch.content.trim().slice(0, 4000))
  }
  if (patch.merchantReply !== undefined) {
    sets.push(`merchant_reply = $${p++}`)
    params.push(patch.merchantReply.trim().slice(0, 2000))
    sets.push(`merchant_reply_at = now()`)
  }
  if (patch.merchantReplyBy !== undefined) {
    sets.push(`merchant_reply_by = $${p++}`)
    params.push(patch.merchantReplyBy.trim().slice(0, 200))
  }
  if (patch.reviewerName !== undefined) {
    sets.push(`reviewer_name = $${p++}`)
    params.push(patch.reviewerName.trim().slice(0, 200))
  }
  if (patch.usefulCount !== undefined) {
    sets.push(`useful_count = $${p++}`)
    params.push(Math.max(0, Math.round(Number(patch.usefulCount)) || 0))
  }
  if (patch.importGroup !== undefined) {
    sets.push(`import_group = $${p++}`)
    params.push(Math.max(0, Math.round(Number(patch.importGroup)) || 0))
  }
  if (!sets.length) return null

  try {
    const row = await pgQueryOne<ReviewDbRow>(
      `update public.messaging_partner_product_reviews
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${REVIEW_SELECT}`,
      params
    )
    return row ? mapReviewRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerProductReviewFromPg]', e)
    return null
  }
}

export async function deletePartnerProductReviewFromPg(partnerId: string, reviewId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_product_reviews where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, reviewId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerProductReviewFromPg]', e)
    return false
  }
}

/** W5.3 — tập order_id đã có review (để badge "Đã đánh giá" trên danh sách đơn khách). */
export async function fetchReviewedOrderIdsFromPg(
  partnerId: string,
  orderIds: string[]
): Promise<Set<string>> {
  const out = new Set<string>()
  if (!isPgConfigured() || orderIds.length === 0) return out
  try {
    const rows = await pgQuery<{ order_id: string }>(
      `select distinct order_id::text as order_id
       from public.messaging_partner_product_reviews
       where partner_id = $1::uuid
         and is_active = true
         and order_id is not null
         and order_id = any($2::uuid[])`,
      [partnerId, orderIds]
    )
    for (const row of rows) {
      if (row.order_id) out.add(row.order_id)
    }
  } catch (e) {
    console.warn('[fetchReviewedOrderIdsFromPg]', e)
  }
  return out
}

/** Xoá tất cả review của 1 shop (bulk — M1.2 có tính năng này cho review, KHÔNG có cho Q&A). */
export async function deleteAllPartnerProductReviewsFromPg(
  partnerId: string,
  inventoryId?: string
): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const res = await getPgPool().query(
      inventoryId
        ? `delete from public.messaging_partner_product_reviews where partner_id = $1::uuid and inventory_id = $2::uuid`
        : `delete from public.messaging_partner_product_reviews where partner_id = $1::uuid`,
      inventoryId ? [partnerId, inventoryId] : [partnerId]
    )
    return res.rowCount ?? 0
  } catch (e) {
    console.warn('[deleteAllPartnerProductReviewsFromPg]', e)
    return 0
  }
}

// ---------------------------------------------------------------------------
// Q&A
// ---------------------------------------------------------------------------

/** Hỏi — chỉ cần đăng nhập, không cần mua hàng (hạ rào cản, tăng nội dung SEO tự nhiên cho PDP). */
export async function insertPartnerProductQuestionFromPg(input: {
  partnerId: string
  inventoryId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  askerName: string
  content: string
}): Promise<PartnerQuestionRow | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return null
  const content = input.content.trim().slice(0, 1000)
  if (!content) return null

  try {
    const row = await pgQueryOne<QuestionDbRow>(
      `insert into public.messaging_partner_product_questions (
        partner_id, inventory_id, guest_account_id, linked_user_id, asker_name, content
      ) values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6)
      returning ${QUESTION_SELECT}`,
      [input.partnerId, input.inventoryId, guestAccountId, linkedUserId, input.askerName.trim().slice(0, 200), content]
    )
    return row ? mapQuestionRow(row) : null
  } catch (e) {
    console.warn('[insertPartnerProductQuestionFromPg]', e)
    return null
  }
}

/** Danh sách câu hỏi công khai — merge SP thật + pool import cùng nhóm. */
export async function fetchPartnerProductQuestionsPageFromPg(input: {
  partnerId: string
  inventoryId: string
  importGroup?: number
  page?: number
  pageSize?: number
  viewerAccountKey?: string | null
  viewerAccountKeys?: string[] | null
  highlightQuestionId?: string | null
}): Promise<{ rows: PartnerQuestionWithAnswers[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(
    PUBLIC_REVIEW_QA_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(input.pageSize ?? PUBLIC_REVIEW_QA_PAGE_SIZE))
  )
  const offset = (page - 1) * pageSize
  const importGroup = coalesceImportGroup(input.importGroup)
  const viewerKeys = partnerReviewVoterKeys(...(input.viewerAccountKeys ?? []), input.viewerAccountKey)
  const highlightId = (input.highlightQuestionId ?? '').trim()
  const highlightOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    highlightId
  )

  try {
    const questions = await pgQuery<QuestionDbRow>(
      `select ${QUESTION_SELECT}
       from public.messaging_partner_product_questions
       where partner_id = $1::uuid and is_active = true
         and ${publicPoolWhereSql(2, 5)}
       order by
         (case when $6::uuid is not null and id = $6::uuid then 0 else 1 end) asc,
         (case when cardinality($4::text[]) > 0 and (
           guest_account_id::text = any($4::text[]) or linked_user_id::text = any($4::text[])
         ) then 0 else 1 end) asc,
         (case when coalesce(is_imported, false) then 1 else 0 end) asc,
         useful_count desc,
         created_at desc
       limit $3 offset ${offset}`,
      [input.partnerId, input.inventoryId, pageSize, viewerKeys, importGroup, highlightOk ? highlightId : null]
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_product_questions
       where partner_id = $1::uuid and is_active = true
         and ${publicPoolWhereSql(2, 3)}`,
      [input.partnerId, input.inventoryId, importGroup]
    )
    if (!questions.length) return { rows: [], total: totalRow?.c ?? 0 }

    const ids = questions.map((q) => q.id)
    const answers = await pgQuery<AnswerDbRow>(
      `select ${ANSWER_SELECT}
       from public.messaging_partner_product_question_answers
       where question_id = any($1::uuid[]) and is_active = true
       ${ANSWER_SLOT_ORDER}`,
      [ids]
    )
    const byQuestion = new Map<string, PartnerQuestionAnswerRow[]>()
    for (const a of answers.map(mapAnswerRow)) {
      const list = byQuestion.get(a.questionId) ?? []
      list.push(a)
      byQuestion.set(a.questionId, list)
    }
    const voted = viewerKeys.length
      ? await pgQuery<{ question_id: string }>(
          `select question_id::text as question_id
           from public.messaging_partner_product_question_votes
           where voter_key = any($1::text[]) and question_id = any($2::uuid[])`,
          [viewerKeys, ids]
        )
      : []
    const votedIds = new Set(voted.map((v) => v.question_id))
    const viewerSet = new Set(viewerKeys)
    const rows = questions.map(mapQuestionRow).map((q) => {
      const slots = splitQaReplySlots(byQuestion.get(q.id) ?? [])
      const answers = [slots.admin, slots.userOne, slots.userTwo].filter(
        (a): a is PartnerQuestionAnswerRow => Boolean(a)
      )
      return {
        ...q,
        answers,
        userHasVoted: votedIds.has(q.id),
        isCurrentUser: Boolean(
          (q.guestAccountId && viewerSet.has(q.guestAccountId)) ||
            (q.linkedUserId && viewerSet.has(q.linkedUserId))
        ),
      }
    })
    return { rows, total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerProductQuestionsPageFromPg]', e)
    return null
  }
}

export type SubmitAnswerResult =
  | { ok: true; row: PartnerQuestionAnswerRow }
  | { ok: false; error: 'not_eligible' | 'slot_full' | 'db_error' }

/**
 * Trả lời của khách mua hàng — điều kiện: đăng nhập + có đơn hàng (không huỷ) chứa sản phẩm đó.
 * Giới hạn `QA_BUYER_ANSWER_LIMIT` slot công khai / câu hỏi (tổng quát hoá hardcode "2" của 188).
 */
export async function insertPartnerProductBuyerAnswerFromPg(input: {
  partnerId: string
  questionId: string
  inventoryId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  responderName: string
  content: string
}): Promise<SubmitAnswerResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return { ok: false, error: 'not_eligible' }

  const eligible = await checkAnyPurchaseFromPg({
    partnerId: input.partnerId,
    inventoryId: input.inventoryId,
    guestAccountId,
    linkedUserId,
  })
  if (!eligible) return { ok: false, error: 'not_eligible' }

  try {
    const countRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_product_question_answers
       where question_id = $1::uuid and answer_type = 'buyer' and is_active = true
         and reply_slot in ('user_one', 'user_two')`,
      [input.questionId]
    )
    if ((countRow?.c ?? 0) >= QA_BUYER_ANSWER_LIMIT) return { ok: false, error: 'slot_full' }

    const existingSlots = await pgQuery<{ reply_slot: string | null }>(
      `select reply_slot from public.messaging_partner_product_question_answers
       where question_id = $1::uuid and is_active = true and reply_slot in ('user_one', 'user_two')`,
      [input.questionId]
    )
    const used = new Set(existingSlots.map((r) => r.reply_slot))
    const replySlot: QaReplySlot = used.has('user_one') ? 'user_two' : 'user_one'
    if (used.has('user_one') && used.has('user_two')) return { ok: false, error: 'slot_full' }

    const content = input.content.trim().slice(0, 2000)
    if (!content) return { ok: false, error: 'db_error' }

    const row = await pgQueryOne<AnswerDbRow>(
      `insert into public.messaging_partner_product_question_answers (
        question_id, partner_id, answer_type, reply_slot, guest_account_id, linked_user_id,
        responder_name, content, is_verified
      ) values ($1::uuid, $2::uuid, 'buyer', $3, $4::uuid, $5::uuid, $6, $7, true)
      returning ${ANSWER_SELECT}`,
      [
        input.questionId,
        input.partnerId,
        replySlot,
        guestAccountId,
        linkedUserId,
        input.responderName.trim().slice(0, 200),
        content,
      ]
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapAnswerRow(row) }
  } catch (e) {
    console.warn('[insertPartnerProductBuyerAnswerFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

/** Trả lời của merchant (admin) — một slot `admin` (188), upsert không nhân bản. */
export async function insertPartnerProductAdminAnswerFromPg(input: {
  partnerId: string
  questionId: string
  responderName: string
  content: string
}): Promise<PartnerQuestionAnswerRow | null> {
  const rows = await upsertPartnerQuestionReplySlotsFromPg(input.partnerId, input.questionId, {
    admin: { name: input.responderName, content: input.content },
  })
  return rows?.find((a) => a.replySlot === 'admin') ?? rows?.find((a) => a.answerType === 'admin') ?? null
}

export type QaReplySlotPatch = { name?: string; content?: string }

/** Admin sửa 3 slot 188: xóa khi nội dung trống, upsert khi có chữ. */
export async function upsertPartnerQuestionReplySlotsFromPg(
  partnerId: string,
  questionId: string,
  slots: {
    admin?: QaReplySlotPatch
    userOne?: QaReplySlotPatch
    userTwo?: QaReplySlotPatch
  }
): Promise<PartnerQuestionAnswerRow[] | null> {
  if (!isPgConfigured()) return null
  const client = await getPgPool().connect()
  const items: Array<{ slot: QaReplySlot; type: 'admin' | 'buyer'; patch: QaReplySlotPatch }> = []
  if (slots.admin) items.push({ slot: 'admin', type: 'admin', patch: slots.admin })
  if (slots.userOne) items.push({ slot: 'user_one', type: 'buyer', patch: slots.userOne })
  if (slots.userTwo) items.push({ slot: 'user_two', type: 'buyer', patch: slots.userTwo })
  if (!items.length) return []
  try {
    await client.query('begin')
    const q = await client.query<{ is_imported: boolean }>(
      `select coalesce(is_imported, false) as is_imported
       from public.messaging_partner_product_questions
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, questionId]
    )
    if (!q.rows[0]) {
      await client.query('rollback')
      return null
    }
    const imported = q.rows[0].is_imported === true
    for (const item of items) {
      const hasContent = item.patch.content !== undefined
      const content = String(item.patch.content ?? '').trim().slice(0, 2000)
      const existing = await client.query<{ id: string }>(
        `select id::text from public.messaging_partner_product_question_answers
         where question_id = $1::uuid and reply_slot = $2
         limit 1`,
        [questionId, item.slot]
      )
      if (hasContent && !content) {
        await client.query(
          `delete from public.messaging_partner_product_question_answers
           where partner_id = $1::uuid and question_id = $2::uuid and reply_slot = $3`,
          [partnerId, questionId, item.slot]
        )
        continue
      }
      const defaultName = item.type === 'admin' ? 'Shop' : 'Khách'
      const name =
        item.patch.name !== undefined
          ? String(item.patch.name ?? '').trim().slice(0, 200) || defaultName
          : undefined
      if (!hasContent) {
        if (name !== undefined && existing.rows[0]) {
          await client.query(
            `update public.messaging_partner_product_question_answers
             set responder_name = $1 where id = $2::uuid`,
            [name, existing.rows[0].id]
          )
        }
        continue
      }
      const responderName = name ?? defaultName
      if (existing.rows[0]) {
        const sets = ['content = $1', 'is_active = true', 'answer_type = $2']
        const params: unknown[] = [content, item.type, existing.rows[0].id]
        if (name !== undefined) {
          sets.push('responder_name = $4')
          params.push(name)
        }
        await client.query(
          `update public.messaging_partner_product_question_answers
           set ${sets.join(', ')}
           where id = $3::uuid`,
          params
        )
      } else {
        await client.query(
          `insert into public.messaging_partner_product_question_answers (
            question_id, partner_id, answer_type, reply_slot, responder_name, content, is_verified, is_active
          ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, true)`,
          [questionId, partnerId, item.type, item.slot, responderName, content, item.type === 'buyer' ? imported : false]
        )
      }
    }
    const list = await client.query<AnswerDbRow>(
      `select ${ANSWER_SELECT}
       from public.messaging_partner_product_question_answers
       where question_id = $1::uuid
       ${ANSWER_SLOT_ORDER}`,
      [questionId]
    )
    await client.query('commit')
    return list.rows.map(mapAnswerRow)
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[upsertPartnerQuestionReplySlotsFromPg]', e)
    return null
  } finally {
    client.release()
  }
}

/** Admin (M1.3) — phân trang 10/dòng, gồm cả inactive, kèm câu trả lời. */
export async function fetchPartnerProductQuestionsForAdminFromPg(input: {
  partnerId: string
  page?: number
  pageSize?: number
  inventoryId?: string
  importGroup?: number
  source?: PartnerReviewSourceFilter
}): Promise<{ rows: PartnerQuestionWithAnswers[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 10)))
  const offset = (page - 1) * pageSize
  const inventoryId = input.inventoryId ?? null
  const importGroup =
    input.importGroup != null && Number.isFinite(Number(input.importGroup))
      ? Math.max(0, Math.round(Number(input.importGroup)))
      : null
  const source = input.source ?? 'all'

  const conds = ['partner_id = $1::uuid']
  const params: unknown[] = [input.partnerId]
  if (inventoryId) {
    params.push(inventoryId)
    conds.push(`inventory_id = $${params.length}::uuid`)
  }
  if (importGroup != null) {
    params.push(importGroup)
    conds.push(`import_group = $${params.length}`)
  }
  if (source === 'imported') conds.push('is_imported = true')
  if (source === 'real') conds.push('is_imported = false')
  const where = conds.join(' and ')

  try {
    params.push(pageSize)
    const limitIdx = params.length
    const questions = await pgQuery<QuestionDbRow>(
      `select ${QUESTION_SELECT}
       from public.messaging_partner_product_questions
       where ${where}
       order by created_at desc
       limit $${limitIdx} offset ${offset}`,
      params
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_product_questions where ${where}`,
      params.slice(0, limitIdx - 1)
    )
    if (!questions.length) return { rows: [], total: totalRow?.c ?? 0 }

    const ids = questions.map((q) => q.id)
    const answers = await pgQuery<AnswerDbRow>(
      `select ${ANSWER_SELECT}
       from public.messaging_partner_product_question_answers
       where question_id = any($1::uuid[])
       ${ANSWER_SLOT_ORDER}`,
      [ids]
    )
    const byQuestion = new Map<string, PartnerQuestionAnswerRow[]>()
    for (const a of answers.map(mapAnswerRow)) {
      const list = byQuestion.get(a.questionId) ?? []
      list.push(a)
      byQuestion.set(a.questionId, list)
    }
    const rows = questions.map(mapQuestionRow).map((q) => ({ ...q, answers: byQuestion.get(q.id) ?? [] }))
    return { rows, total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerProductQuestionsForAdminFromPg]', e)
    return null
  }
}

export async function updatePartnerProductQuestionFromPg(
  partnerId: string,
  questionId: string,
  patch: {
    isActive?: boolean
    content?: string
    askerName?: string
    usefulCount?: number
    importGroup?: number
  }
): Promise<PartnerQuestionRow | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = []
  const params: unknown[] = [partnerId, questionId]
  let p = 3
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${p++}`)
    params.push(patch.isActive)
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${p++}`)
    params.push(patch.content.trim().slice(0, 1000))
  }
  if (patch.askerName !== undefined) {
    sets.push(`asker_name = $${p++}`)
    params.push(patch.askerName.trim().slice(0, 200))
  }
  if (patch.usefulCount !== undefined) {
    sets.push(`useful_count = $${p++}`)
    params.push(Math.max(0, Math.round(Number(patch.usefulCount)) || 0))
  }
  if (patch.importGroup !== undefined) {
    sets.push(`import_group = $${p++}`)
    params.push(Math.max(0, Math.round(Number(patch.importGroup)) || 0))
  }
  if (!sets.length) return null
  try {
    const row = await pgQueryOne<QuestionDbRow>(
      `update public.messaging_partner_product_questions
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${QUESTION_SELECT}`,
      params
    )
    return row ? mapQuestionRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerProductQuestionFromPg]', e)
    return null
  }
}

export async function deletePartnerProductQuestionFromPg(partnerId: string, questionId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_product_questions where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, questionId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerProductQuestionFromPg]', e)
    return false
  }
}

export async function updatePartnerProductAnswerFromPg(
  partnerId: string,
  answerId: string,
  patch: { isActive?: boolean; content?: string; responderName?: string }
): Promise<PartnerQuestionAnswerRow | null> {
  if (!isPgConfigured()) return null
  const sets: string[] = []
  const params: unknown[] = [partnerId, answerId]
  let p = 3
  if (patch.isActive !== undefined) {
    sets.push(`is_active = $${p++}`)
    params.push(patch.isActive)
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${p++}`)
    params.push(patch.content.trim().slice(0, 2000))
  }
  if (patch.responderName !== undefined) {
    sets.push(`responder_name = $${p++}`)
    params.push(patch.responderName.trim().slice(0, 200))
  }
  if (!sets.length) return null
  try {
    const row = await pgQueryOne<AnswerDbRow>(
      `update public.messaging_partner_product_question_answers
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${ANSWER_SELECT}`,
      params
    )
    return row ? mapAnswerRow(row) : null
  } catch (e) {
    console.warn('[updatePartnerProductAnswerFromPg]', e)
    return null
  }
}

export async function deletePartnerProductAnswerFromPg(partnerId: string, answerId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_product_question_answers where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, answerId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerProductAnswerFromPg]', e)
    return false
  }
}

/** Import Excel ảo — không check mua hàng, không unique buyer. */
export async function insertImportedPartnerProductReviewsFromPg(
  partnerId: string,
  drafts: ImportedReviewDraft[]
): Promise<number> {
  if (!isPgConfigured() || drafts.length === 0) return 0
  const client = await getPgPool().connect()
  let created = 0
  try {
    await client.query('begin')
    for (const d of drafts) {
      const replyAt = d.merchantReply.trim() ? d.createdAt : null
      await client.query(
        `insert into public.messaging_partner_product_reviews (
          partner_id, inventory_id, reviewer_name, rating, title, content, image_urls,
          is_active, useful_count, merchant_reply, merchant_reply_by, merchant_reply_at,
          is_imported, import_group, created_at
        ) values (
          $1::uuid, null, $2, $3, $4, $5, $6::jsonb, true, $7, $8, $9, $10, true, $11, $12
        )`,
        [
          partnerId,
          d.reviewerName,
          d.rating,
          d.title,
          d.content,
          JSON.stringify(d.imageUrls),
          d.usefulCount,
          d.merchantReply,
          d.merchantReplyBy,
          replyAt,
          d.importGroup,
          d.createdAt,
        ]
      )
      created += 1
    }
    await client.query('commit')
    return created
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[insertImportedPartnerProductReviewsFromPg]', e)
    return created
  } finally {
    client.release()
  }
}

export async function insertImportedPartnerProductQuestionsFromPg(
  partnerId: string,
  drafts: ImportedQuestionDraft[]
): Promise<number> {
  if (!isPgConfigured() || drafts.length === 0) return 0
  const client = await getPgPool().connect()
  let created = 0
  try {
    await client.query('begin')
    for (const d of drafts) {
      const q = await client.query<{ id: string }>(
        `insert into public.messaging_partner_product_questions (
          partner_id, inventory_id, asker_name, content, is_active, useful_count,
          is_imported, import_group, created_at
        ) values ($1::uuid, null, $2, $3, true, $4, true, $5, $6)
        returning id::text`,
        [partnerId, d.askerName, d.content, d.usefulCount, d.importGroup, d.createdAt]
      )
      const questionId = q.rows[0]?.id
      if (!questionId) continue
      if (d.adminReplyContent.trim()) {
        await client.query(
          `insert into public.messaging_partner_product_question_answers (
            question_id, partner_id, answer_type, reply_slot, responder_name, content, is_verified, is_active, created_at
          ) values ($1::uuid, $2::uuid, 'admin', 'admin', $3, $4, false, true, $5)`,
          [
            questionId,
            partnerId,
            d.adminReplyName.trim() || 'Shop',
            d.adminReplyContent,
            d.createdAt,
          ]
        )
      }
      const buyerSlots: QaReplySlot[] = ['user_one', 'user_two']
      for (let i = 0; i < d.buyerReplies.slice(0, QA_BUYER_ANSWER_LIMIT).length; i++) {
        const buyer = d.buyerReplies[i]
        if (!buyer) continue
        await client.query(
          `insert into public.messaging_partner_product_question_answers (
            question_id, partner_id, answer_type, reply_slot, responder_name, content, is_verified, is_active, created_at
          ) values ($1::uuid, $2::uuid, 'buyer', $3, $4, $5, true, true, $6)`,
          [questionId, partnerId, buyerSlots[i], buyer.name, buyer.content, d.createdAt]
        )
      }
      created += 1
    }
    await client.query('commit')
    return created
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[insertImportedPartnerProductQuestionsFromPg]', e)
    return created
  } finally {
    client.release()
  }
}

export async function togglePartnerProductQuestionVoteFromPg(input: {
  questionId: string
  voterKey: string
  voterKeys?: string[]
}): Promise<{ ok: true; voted: boolean; usefulCount: number } | { ok: false }> {
  return toggleUsefulVoteRow({
    id: input.questionId,
    voterKey: input.voterKey,
    voterKeys: input.voterKeys,
    votesTable: 'messaging_partner_product_question_votes',
    countTable: 'messaging_partner_product_questions',
    idColumn: 'question_id',
  })
}

/** Nhóm đánh giá admin đã import Excel (pool ảo). 0/888 = chưa gán, không đưa vào whitelist cào. */
export async function fetchPartnerImportedReviewGroupIdsFromPg(partnerId: string): Promise<number[]> {
  const id = String(partnerId || '').trim()
  if (!id || !isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ gid: number }>(
      `select distinct import_group as gid
       from public.messaging_partner_product_reviews
       where partner_id = $1::uuid
         and is_imported = true
         and is_active = true
         and import_group > 0
         and import_group <> 888
       order by 1`,
      [id]
    )
    return rows
      .map((r) => Math.round(Number(r.gid)))
      .filter((n) => Number.isFinite(n) && n > 0 && n !== 888)
  } catch (e) {
    console.warn('[fetchPartnerImportedReviewGroupIdsFromPg]', e)
    return []
  }
}

/** Nhóm hỏi đáp admin đã import Excel. */
export async function fetchPartnerImportedQuestionGroupIdsFromPg(partnerId: string): Promise<number[]> {
  const id = String(partnerId || '').trim()
  if (!id || !isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ gid: number }>(
      `select distinct import_group as gid
       from public.messaging_partner_product_questions
       where partner_id = $1::uuid
         and is_imported = true
         and is_active = true
         and import_group > 0
         and import_group <> 888
       order by 1`,
      [id]
    )
    return rows
      .map((r) => Math.round(Number(r.gid)))
      .filter((n) => Number.isFinite(n) && n > 0 && n !== 888)
  } catch (e) {
    console.warn('[fetchPartnerImportedQuestionGroupIdsFromPg]', e)
    return []
  }
}

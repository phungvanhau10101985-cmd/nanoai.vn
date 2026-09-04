import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'
import {
  computePromotionDiscountAmount,
  isValidPromotionCode,
  normalizePromotionCode,
  type PartnerPromotionRow,
  type PromotionAutoGrantTrigger,
  type PromotionGrantRow,
  type PromotionGrantSource,
  type PromotionValidateResult,
} from '@/lib/partner-website/promotions/partner-promotion-types'

/**
 * W1.4 + M2.2 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md): khuyến mãi/voucher/ví quà.
 * Xem docs/188_BEHAVIOR_SPEC.md mục D — nguyên tắc bắt buộc: "backend luôn tính lại, không tin
 * client" khi validate/áp dụng voucher.
 */

type PromotionDbRow = {
  id: string
  partner_id: string
  code: string
  name: string
  description: string
  discount_type: 'percent' | 'fixed_amount'
  discount_percent: string | number | null
  discount_amount: string | number | null
  max_discount_amount: string | number | null
  min_subtotal: string | number
  first_order_only: boolean
  category_id: string | null
  inventory_id: string | null
  usage_limit: number | null
  per_user_limit: number
  used_count: number
  valid_from: unknown
  valid_to: unknown
  is_active: boolean
  is_public_redeemable: boolean
  auto_grant_trigger: PromotionAutoGrantTrigger | null
  auto_grant_valid_days: number | null
  exclude_sale_items?: boolean
  trigger_idle_hours?: number | null
  trigger_inactive_days?: number | null
  trigger_cooldown_days?: number | null
  created_at: unknown
  updated_at: unknown
}

type GrantDbRow = {
  id: string
  partner_id: string
  promotion_id: string
  guest_account_id: string | null
  linked_user_id: string | null
  source: PromotionGrantSource
  status: 'active' | 'used' | 'expired'
  granted_at: unknown
  expires_at: unknown
  used_at: unknown
  used_order_id: string | null
}

const PROMOTION_SELECT = `*`

const GRANT_SELECT = `id::text, partner_id::text, promotion_id::text, guest_account_id::text, linked_user_id::text,
  source, status, granted_at, expires_at, used_at, used_order_id::text`

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapPromotionRow(r: PromotionDbRow): PartnerPromotionRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    code: r.code,
    name: r.name ?? '',
    description: r.description ?? '',
    discountType: r.discount_type,
    discountPercent: r.discount_percent != null ? num(r.discount_percent) : null,
    discountAmount: r.discount_amount != null ? num(r.discount_amount) : null,
    maxDiscountAmount: r.max_discount_amount != null ? num(r.max_discount_amount) : null,
    minSubtotal: num(r.min_subtotal, 0),
    firstOrderOnly: Boolean(r.first_order_only),
    categoryId: r.category_id,
    inventoryId: r.inventory_id,
    usageLimit: r.usage_limit,
    perUserLimit: r.per_user_limit ?? 1,
    usedCount: r.used_count ?? 0,
    validFrom: r.valid_from ? String(r.valid_from) : null,
    validTo: r.valid_to ? String(r.valid_to) : null,
    isActive: r.is_active !== false,
    isPublicRedeemable: r.is_public_redeemable !== false,
    autoGrantTrigger: r.auto_grant_trigger,
    autoGrantValidDays: r.auto_grant_valid_days,
    excludeSaleItems: r.exclude_sale_items !== false,
    triggerIdleHours: r.trigger_idle_hours ?? null,
    triggerInactiveDays: r.trigger_inactive_days ?? null,
    triggerCooldownDays: r.trigger_cooldown_days ?? null,
    createdAt: String(r.created_at ?? ''),
    updatedAt: String(r.updated_at ?? ''),
  }
}

function mapGrantRow(r: GrantDbRow): PromotionGrantRow {
  return {
    id: r.id,
    partnerId: r.partner_id,
    promotionId: r.promotion_id,
    guestAccountId: r.guest_account_id,
    linkedUserId: r.linked_user_id,
    source: r.source,
    status: r.status,
    grantedAt: String(r.granted_at ?? ''),
    expiresAt: r.expires_at ? String(r.expires_at) : null,
    usedAt: r.used_at ? String(r.used_at) : null,
    usedOrderId: r.used_order_id,
  }
}

function isUniqueViolation(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  return (e as { code?: string }).code === '23505'
}

function isMissingSaleParityColumn(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false
  const error = e as { code?: string; message?: string }
  return error.code === '42703' && /exclude_sale_items|trigger_(idle|inactive|cooldown)_/i.test(error.message ?? '')
}

export async function fetchPartnerPromotionsForAdminFromPg(input: {
  partnerId: string
  page?: number
  pageSize?: number
}): Promise<{ rows: PartnerPromotionRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(50, Math.max(1, Math.floor(input.pageSize ?? 20)))
  const offset = (page - 1) * pageSize
  try {
    const rows = await pgQuery<PromotionDbRow>(
      `select ${PROMOTION_SELECT} from public.messaging_partner_promotions
       where partner_id = $1::uuid
       order by created_at desc
       limit $2 offset ${offset}`,
      [input.partnerId, pageSize]
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c from public.messaging_partner_promotions where partner_id = $1::uuid`,
      [input.partnerId]
    )
    return { rows: rows.map(mapPromotionRow), total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerPromotionsForAdminFromPg]', e)
    return null
  }
}

export async function fetchPartnerPromotionByIdFromPg(
  partnerId: string,
  promotionId: string
): Promise<PartnerPromotionRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<PromotionDbRow>(
      `select ${PROMOTION_SELECT} from public.messaging_partner_promotions
       where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, promotionId]
    )
    return row ? mapPromotionRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerPromotionByIdFromPg]', e)
    return null
  }
}

export type UpsertPromotionInput = {
  code: string
  name: string
  description?: string
  discountType: 'percent' | 'fixed_amount'
  discountPercent?: number | null
  discountAmount?: number | null
  maxDiscountAmount?: number | null
  minSubtotal?: number
  firstOrderOnly?: boolean
  categoryId?: string | null
  inventoryId?: string | null
  usageLimit?: number | null
  perUserLimit?: number
  validFrom?: string | null
  validTo?: string | null
  isActive?: boolean
  isPublicRedeemable?: boolean
  autoGrantTrigger?: PromotionAutoGrantTrigger | null
  autoGrantValidDays?: number | null
  excludeSaleItems?: boolean
  triggerIdleHours?: number | null
  triggerInactiveDays?: number | null
  triggerCooldownDays?: number | null
}

export type UpsertPromotionResult =
  | { ok: true; row: PartnerPromotionRow }
  | { ok: false; error: 'duplicate_code' | 'invalid_code' | 'invalid_discount' | 'db_error' }

export async function insertPartnerPromotionFromPg(
  partnerId: string,
  input: UpsertPromotionInput
): Promise<UpsertPromotionResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const code = normalizePromotionCode(input.code)
  if (!isValidPromotionCode(code)) return { ok: false, error: 'invalid_code' }
  const name = input.name.trim().slice(0, 200)
  if (!name) return { ok: false, error: 'db_error' }
  if (input.discountType === 'percent' && !(Number(input.discountPercent) > 0)) {
    return { ok: false, error: 'invalid_discount' }
  }
  if (input.discountType === 'fixed_amount' && !(Number(input.discountAmount) >= 0)) {
    return { ok: false, error: 'invalid_discount' }
  }

  try {
    const params = [
      partnerId,
      code,
      name,
      (input.description ?? '').trim().slice(0, 2000),
      input.discountType,
      input.discountType === 'percent' ? input.discountPercent : null,
      input.discountType === 'fixed_amount' ? input.discountAmount : null,
      input.maxDiscountAmount ?? null,
      Math.max(0, input.minSubtotal ?? 0),
      input.firstOrderOnly ?? false,
      input.categoryId ?? null,
      input.inventoryId ?? null,
      input.usageLimit ?? null,
      Math.max(1, input.perUserLimit ?? 1),
      input.validFrom ?? null,
      input.validTo ?? null,
      input.isActive !== false,
      input.isPublicRedeemable !== false,
      input.autoGrantTrigger ?? null,
      input.autoGrantValidDays ?? null,
      input.excludeSaleItems !== false,
      input.triggerIdleHours ?? null,
      input.triggerInactiveDays ?? null,
      input.triggerCooldownDays ?? null,
    ]
    let row: PromotionDbRow | null
    try {
      row = await pgQueryOne<PromotionDbRow>(
      `insert into public.messaging_partner_promotions (
        partner_id, code, name, description, discount_type, discount_percent, discount_amount,
        max_discount_amount, min_subtotal, first_order_only, category_id, inventory_id, usage_limit,
        per_user_limit, valid_from, valid_to, is_active, is_public_redeemable, auto_grant_trigger,
        auto_grant_valid_days, exclude_sale_items, trigger_idle_hours, trigger_inactive_days,
        trigger_cooldown_days
      ) values (
        $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid, $12::uuid, $13, $14, $15::timestamptz,
        $16::timestamptz, $17, $18, $19, $20, $21, $22, $23, $24
      )
      returning ${PROMOTION_SELECT}`,
        params
      )
    } catch (error) {
      if (!isMissingSaleParityColumn(error)) throw error
      row = await pgQueryOne<PromotionDbRow>(
        `insert into public.messaging_partner_promotions (
          partner_id, code, name, description, discount_type, discount_percent, discount_amount,
          max_discount_amount, min_subtotal, first_order_only, category_id, inventory_id, usage_limit,
          per_user_limit, valid_from, valid_to, is_active, is_public_redeemable, auto_grant_trigger,
          auto_grant_valid_days
        ) values (
          $1::uuid,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12::uuid,$13,$14,
          $15::timestamptz,$16::timestamptz,$17,$18,$19,$20
        ) returning *`,
        params.slice(0, 20)
      )
    }
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapPromotionRow(row) }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'duplicate_code' }
    console.warn('[insertPartnerPromotionFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

export async function updatePartnerPromotionFromPg(
  partnerId: string,
  promotionId: string,
  patch: Partial<UpsertPromotionInput>
): Promise<UpsertPromotionResult> {
  if (!isPgConfigured()) return { ok: false, error: 'db_error' }
  const sets: string[] = []
  const params: unknown[] = [partnerId, promotionId]
  let p = 3

  const push = (col: string, value: unknown, cast = '') => {
    sets.push(`${col} = $${p++}${cast}`)
    params.push(value)
  }

  if (patch.code !== undefined) {
    const code = normalizePromotionCode(patch.code)
    if (!isValidPromotionCode(code)) return { ok: false, error: 'invalid_code' }
    push('code', code)
  }
  if (patch.name !== undefined) push('name', patch.name.trim().slice(0, 200))
  if (patch.description !== undefined) push('description', patch.description.trim().slice(0, 2000))
  if (patch.discountType !== undefined) push('discount_type', patch.discountType)
  if (patch.discountPercent !== undefined) push('discount_percent', patch.discountPercent)
  if (patch.discountAmount !== undefined) push('discount_amount', patch.discountAmount)
  if (patch.maxDiscountAmount !== undefined) push('max_discount_amount', patch.maxDiscountAmount)
  if (patch.minSubtotal !== undefined) push('min_subtotal', Math.max(0, patch.minSubtotal))
  if (patch.firstOrderOnly !== undefined) push('first_order_only', patch.firstOrderOnly)
  if (patch.categoryId !== undefined) push('category_id', patch.categoryId, '::uuid')
  if (patch.inventoryId !== undefined) push('inventory_id', patch.inventoryId, '::uuid')
  if (patch.usageLimit !== undefined) push('usage_limit', patch.usageLimit)
  if (patch.perUserLimit !== undefined) push('per_user_limit', Math.max(1, patch.perUserLimit))
  if (patch.validFrom !== undefined) push('valid_from', patch.validFrom, '::timestamptz')
  if (patch.validTo !== undefined) push('valid_to', patch.validTo, '::timestamptz')
  if (patch.isActive !== undefined) push('is_active', patch.isActive)
  if (patch.isPublicRedeemable !== undefined) push('is_public_redeemable', patch.isPublicRedeemable)
  if (patch.autoGrantTrigger !== undefined) push('auto_grant_trigger', patch.autoGrantTrigger)
  if (patch.autoGrantValidDays !== undefined) push('auto_grant_valid_days', patch.autoGrantValidDays)
  if (patch.excludeSaleItems !== undefined) push('exclude_sale_items', patch.excludeSaleItems)
  if (patch.triggerIdleHours !== undefined) push('trigger_idle_hours', patch.triggerIdleHours)
  if (patch.triggerInactiveDays !== undefined) push('trigger_inactive_days', patch.triggerInactiveDays)
  if (patch.triggerCooldownDays !== undefined) push('trigger_cooldown_days', patch.triggerCooldownDays)

  if (!sets.length) {
    const row = await fetchPartnerPromotionByIdFromPg(partnerId, promotionId)
    return row ? { ok: true, row } : { ok: false, error: 'db_error' }
  }

  try {
    const row = await pgQueryOne<PromotionDbRow>(
      `update public.messaging_partner_promotions
       set ${sets.join(', ')}
       where partner_id = $1::uuid and id = $2::uuid
       returning ${PROMOTION_SELECT}`,
      params
    )
    if (!row) return { ok: false, error: 'db_error' }
    return { ok: true, row: mapPromotionRow(row) }
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: 'duplicate_code' }
    if (isMissingSaleParityColumn(e)) {
      const legacyPatch = { ...patch }
      delete legacyPatch.excludeSaleItems
      delete legacyPatch.triggerIdleHours
      delete legacyPatch.triggerInactiveDays
      delete legacyPatch.triggerCooldownDays
      return updatePartnerPromotionFromPg(partnerId, promotionId, legacyPatch)
    }
    console.warn('[updatePartnerPromotionFromPg]', e)
    return { ok: false, error: 'db_error' }
  }
}

export async function deletePartnerPromotionFromPg(partnerId: string, promotionId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `delete from public.messaging_partner_promotions where partner_id = $1::uuid and id = $2::uuid`,
      [partnerId, promotionId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[deletePartnerPromotionFromPg]', e)
    return false
  }
}

/** `true` nếu khách CHƯA từng có đơn nào (mọi trạng thái) tại shop này — điều kiện `first_order_only`. */
export async function checkCustomerHasPriorOrderFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  const email = input.emailNormalized?.trim().toLowerCase() || null
  if (!guestAccountId && !linkedUserId && !email) return false
  try {
    const row = await pgQueryOne<{ exists: boolean }>(
      `select exists (
         select 1
         from public.messaging_partner_orders o
         left join public.customer_care_conversations c on c.id = o.conversation_id
         where o.partner_id = $1::uuid
           and (
             ($2::uuid is not null and c.guest_account_id = $2::uuid)
             or ($3::uuid is not null and c.linked_user_id = $3::uuid)
             or ($4::text is not null and lower(o.customer_email) = $4::text)
           )
       ) as exists`,
      [input.partnerId, guestAccountId, linkedUserId, email]
    )
    return Boolean(row?.exists)
  } catch (e) {
    console.warn('[checkCustomerHasPriorOrderFromPg]', e)
    return false
  }
}

async function fetchActiveGrantForPromotionFromPg(input: {
  promotionId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
}): Promise<PromotionGrantRow | null> {
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return null
  try {
    const row = await pgQueryOne<GrantDbRow>(
      `select ${GRANT_SELECT} from public.messaging_partner_promotion_grants
       where promotion_id = $1::uuid and status = 'active'
         and (expires_at is null or expires_at > now())
         and (
           ($2::uuid is not null and guest_account_id = $2::uuid)
           or ($3::uuid is not null and linked_user_id = $3::uuid)
         )
       order by granted_at asc
       limit 1`,
      [input.promotionId, guestAccountId, linkedUserId]
    )
    return row ? mapGrantRow(row) : null
  } catch (e) {
    console.warn('[fetchActiveGrantForPromotionFromPg]', e)
    return null
  }
}

/**
 * Validate + tính số tiền giảm — nguồn sự thật DUY NHẤT dùng cho cả API `/promotions/validate`
 * (ước tính hiển thị FE) lẫn lúc checkout thật (backend luôn tính lại, không tin client — D.2).
 */
export async function validatePromotionCodeFromPg(input: {
  partnerId: string
  code: string
  subtotal: number
  cartLines: Array<{
    inventoryId: string
    lineSubtotal: number
    listLineSubtotal?: number
    isClearance?: boolean
  }>
  guestAccountId?: string | null
  linkedUserId?: string | null
  emailNormalized?: string | null
}): Promise<PromotionValidateResult> {
  if (!isPgConfigured()) return { ok: false, error: 'not_found' }
  const code = normalizePromotionCode(input.code)
  if (!isValidPromotionCode(code)) return { ok: false, error: 'invalid_code' }

  const row = await pgQueryOne<PromotionDbRow>(
    `select ${PROMOTION_SELECT} from public.messaging_partner_promotions
     where partner_id = $1::uuid and code = $2`,
    [input.partnerId, code]
  ).catch((e) => {
    console.warn('[validatePromotionCodeFromPg:fetch]', e)
    return null
  })
  if (!row) return { ok: false, error: 'not_found' }
  const promotion = mapPromotionRow(row)

  if (!promotion.isActive) return { ok: false, error: 'inactive' }
  const now = Date.now()
  if (promotion.validFrom && new Date(promotion.validFrom).getTime() > now) return { ok: false, error: 'not_started' }
  if (promotion.validTo && new Date(promotion.validTo).getTime() < now) return { ok: false, error: 'expired' }
  if (input.subtotal < promotion.minSubtotal) return { ok: false, error: 'below_min_subtotal' }
  if (promotion.usageLimit != null && promotion.usedCount >= promotion.usageLimit) {
    return { ok: false, error: 'usage_limit_reached' }
  }

  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null

  if (!promotion.isPublicRedeemable) {
    const grant = await fetchActiveGrantForPromotionFromPg({ promotionId: promotion.id, guestAccountId, linkedUserId })
    if (!grant) return { ok: false, error: 'grant_required' }
  }

  if (guestAccountId || linkedUserId) {
    try {
      const usageRow = await pgQueryOne<{ c: number }>(
        `select count(*)::int as c from public.messaging_partner_promotion_usages
         where promotion_id = $1::uuid
           and (
             ($2::uuid is not null and guest_account_id = $2::uuid)
             or ($3::uuid is not null and linked_user_id = $3::uuid)
           )`,
        [promotion.id, guestAccountId, linkedUserId]
      )
      if ((usageRow?.c ?? 0) >= promotion.perUserLimit) return { ok: false, error: 'per_user_limit_reached' }
    } catch (e) {
      console.warn('[validatePromotionCodeFromPg:per-user-limit]', e)
    }
  }

  if (promotion.firstOrderOnly) {
    const hasPrior = await checkCustomerHasPriorOrderFromPg({
      partnerId: input.partnerId,
      guestAccountId,
      linkedUserId,
      emailNormalized: input.emailNormalized,
    })
    if (hasPrior) return { ok: false, error: 'first_order_only' }
  }

  let eligibleLines = promotion.excludeSaleItems
    ? input.cartLines.filter(
        (line) =>
          !line.isClearance &&
          (line.listLineSubtotal == null || line.lineSubtotal >= line.listLineSubtotal)
      )
    : input.cartLines
  let eligibleSubtotal = promotion.excludeSaleItems
    ? eligibleLines.reduce((sum, line) => sum + Math.max(0, line.lineSubtotal), 0)
    : input.subtotal
  if (promotion.categoryId || promotion.inventoryId) {
    const ids = eligibleLines.map((l) => l.inventoryId).filter(Boolean)
    if (!ids.length) return { ok: false, error: 'no_eligible_items' }
    let matchedIds = new Set<string>()
    if (promotion.inventoryId) {
      matchedIds = new Set(ids.filter((id) => id === promotion.inventoryId))
    } else if (promotion.categoryId) {
      try {
        const rows = await pgQuery<{ inventory_id: string }>(
          `select inventory_id::text from public.messaging_partner_inventory_categories
           where category_id = $1::uuid and inventory_id = any($2::uuid[])`,
          [promotion.categoryId, ids]
        )
        matchedIds = new Set(rows.map((r) => r.inventory_id))
      } catch (e) {
        console.warn('[validatePromotionCodeFromPg:category-match]', e)
      }
    }
    eligibleLines = eligibleLines.filter((l) => matchedIds.has(l.inventoryId))
    eligibleSubtotal = eligibleLines
      .reduce((sum, l) => sum + Math.max(0, l.lineSubtotal), 0)
  }
  if (eligibleSubtotal <= 0) return { ok: false, error: 'no_eligible_items' }

  const discountAmount = computePromotionDiscountAmount(promotion, eligibleSubtotal)
  return { ok: true, promotion, discountAmount, eligibleSubtotal }
}

/** Ghi nhận sử dụng THẬT sau khi đơn được tạo thành công — tăng used_count, đánh dấu grant `used`. */
export async function recordPromotionUsageFromPg(input: {
  partnerId: string
  promotionId: string
  orderId: string
  discountAmount: number
  guestAccountId?: string | null
  linkedUserId?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    const grant = guestAccountId || linkedUserId
      ? await client.query<{ id: string }>(
          `select id from public.messaging_partner_promotion_grants
           where promotion_id = $1::uuid and status = 'active'
             and (expires_at is null or expires_at > now())
             and (
               ($2::uuid is not null and guest_account_id = $2::uuid)
               or ($3::uuid is not null and linked_user_id = $3::uuid)
             )
           order by granted_at asc
           limit 1
           for update`,
          [input.promotionId, guestAccountId, linkedUserId]
        )
      : { rows: [] as { id: string }[] }
    const grantId = grant.rows[0]?.id ?? null

    const inserted = await client.query<{ id: string }>(
      `insert into public.messaging_partner_promotion_usages (
        partner_id, promotion_id, grant_id, order_id, guest_account_id, linked_user_id, discount_amount
      ) values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid, $7::numeric)
      on conflict (order_id) do nothing
      returning id::text`,
      [input.partnerId, input.promotionId, grantId, input.orderId, guestAccountId, linkedUserId, input.discountAmount]
    )
    if (!inserted.rows[0]) {
      await client.query('commit')
      return true
    }
    await client.query(
      `update public.messaging_partner_promotions set used_count = used_count + 1 where id = $1::uuid`,
      [input.promotionId]
    )
    if (grantId) {
      await client.query(
        `update public.messaging_partner_promotion_grants
         set status = 'used', used_at = now(), used_order_id = $2::uuid
         where id = $1::uuid`,
        [grantId, input.orderId]
      )
    }
    await client.query('commit')
    void writePartnerSaleAuditFromPg({
      partnerId: input.partnerId,
      eventType: 'promotion_consumed',
      entityType: 'promotion_usage',
      entityId: inserted.rows[0].id,
      detail: {
        promotionId: input.promotionId,
        orderId: input.orderId,
        discountAmount: Math.max(0, Math.round(input.discountAmount)),
      },
    })
    return true
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[recordPromotionUsageFromPg]', e)
    return false
  } finally {
    client.release()
  }
}

/** Cấp voucher vào ví khách — auto-grant theo trigger hoặc admin tặng tay. */
export async function grantPromotionToCustomerFromPg(input: {
  partnerId: string
  promotionId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
  source: PromotionGrantSource
  validDays?: number | null
}): Promise<PromotionGrantRow | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return null
  try {
    const row = await pgQueryOne<GrantDbRow>(
      `insert into public.messaging_partner_promotion_grants (
        partner_id, promotion_id, guest_account_id, linked_user_id, source, expires_at
      ) values (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, $5,
        case when $6::int is not null then now() + ($6::int || ' days')::interval else null end
      )
      returning ${GRANT_SELECT}`,
      [input.partnerId, input.promotionId, guestAccountId, linkedUserId, input.source, input.validDays ?? null]
    )
    return row ? mapGrantRow(row) : null
  } catch (e) {
    console.warn('[grantPromotionToCustomerFromPg]', e)
    return null
  }
}

/** Ví quà hiển thị công khai (W5.4) — voucher active của 1 khách, kèm dữ liệu promotion. */
export async function fetchActivePromotionGrantsForCustomerFromPg(input: {
  partnerId: string
  guestAccountId?: string | null
  linkedUserId?: string | null
}): Promise<Array<{ grant: PromotionGrantRow; promotion: PartnerPromotionRow }> | null> {
  if (!isPgConfigured()) return null
  const guestAccountId = input.guestAccountId ?? null
  const linkedUserId = input.linkedUserId ?? null
  if (!guestAccountId && !linkedUserId) return []
  try {
    const rows = await pgQuery<GrantDbRow & { promo: PromotionDbRow }>(
      `select g.id, g.partner_id, g.promotion_id, g.guest_account_id, g.linked_user_id, g.source, g.status,
              g.granted_at, g.expires_at, g.used_at, g.used_order_id,
              row_to_json(pr.*) as promo
       from public.messaging_partner_promotion_grants g
       join public.messaging_partner_promotions pr on pr.id = g.promotion_id
       where g.partner_id = $1::uuid and g.status = 'active'
         and (g.expires_at is null or g.expires_at > now())
         and (
           ($2::uuid is not null and g.guest_account_id = $2::uuid)
           or ($3::uuid is not null and g.linked_user_id = $3::uuid)
         )
       order by g.granted_at desc`,
      [input.partnerId, guestAccountId, linkedUserId]
    )
    return rows.map((r) => ({
      grant: mapGrantRow(r as unknown as GrantDbRow),
      promotion: mapPromotionRow(r.promo as unknown as PromotionDbRow),
    }))
  } catch (e) {
    console.warn('[fetchActivePromotionGrantsForCustomerFromPg]', e)
    return null
  }
}

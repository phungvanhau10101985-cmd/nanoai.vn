import type { Json } from '@/types/database.types'
import { makeConsultProductScopeKey } from '@/lib/messaging/consult-product-scope-key'
import type { Database } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import { authUserIdExistsInPg } from '@/lib/db/auth-user-email-pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Chỉ trả về id khi có hàng trong `auth.users` — tránh FK 23503 (session/JWT lệch DB local). */
export async function resolveLinkedUserIdForCustomerCarePg(
  linkedUserId?: string | null
): Promise<string | null> {
  if (!isPgConfigured()) return null
  if (linkedUserId == null || linkedUserId === '') return null
  const id = linkedUserId.trim()
  if (!id) return null
  return (await authUserIdExistsInPg(id)) ? id : null
}

export type CustomerCareConversationRow = Database['public']['Tables']['customer_care_conversations']['Row']
export type CustomerCareMessageRow = Database['public']['Tables']['customer_care_messages']['Row']

function isoTimestamp(v: unknown): string | null {
  if (v == null) return null
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'string') return v
  return String(v)
}

function isoTimestampRequired(v: unknown): string {
  return isoTimestamp(v) ?? ''
}

function mapConversationRow(r: Record<string, unknown>): CustomerCareConversationRow {
  const ch = String(r.channel ?? '')
  const st = String(r.status ?? 'open')
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    channel: ch as CustomerCareConversationRow['channel'],
    external_thread_id: String(r.external_thread_id ?? ''),
    channel_external_ref: r.channel_external_ref != null ? String(r.channel_external_ref) : null,
    linked_user_id: r.linked_user_id != null ? String(r.linked_user_id) : null,
    guest_account_id: r.guest_account_id != null ? String(r.guest_account_id) : null,
    customer_name: r.customer_name != null ? String(r.customer_name) : null,
    customer_avatar_url: r.customer_avatar_url != null ? String(r.customer_avatar_url) : null,
    metadata: (r.metadata ?? {}) as Json,
    status: st as CustomerCareConversationRow['status'],
    last_message_at: isoTimestamp(r.last_message_at),
    last_message_preview: r.last_message_preview != null ? String(r.last_message_preview) : null,
    created_at: isoTimestampRequired(r.created_at),
    updated_at: isoTimestampRequired(r.updated_at),
  }
}

function mapMessageRow(r: Record<string, unknown>): CustomerCareMessageRow {
  const dir = String(r.direction ?? 'inbound')
  return {
    id: String(r.id),
    conversation_id: String(r.conversation_id),
    direction: dir as CustomerCareMessageRow['direction'],
    body: String(r.body ?? ''),
    raw_payload: (r.raw_payload ?? null) as Json | null,
    sender_admin_id: r.sender_admin_id != null ? String(r.sender_admin_id) : null,
    read_at: isoTimestamp(r.read_at),
    created_at: isoTimestampRequired(r.created_at),
  }
}

export async function ensureConversationPg(params: {
  partnerId: string
  channel: CustomerCareChannel
  externalThreadId: string
  channelExternalRef?: string | null
  customerName?: string | null
  customerAvatarUrl?: string | null
  linkedUserId?: string | null
  metadata?: Json
}): Promise<{ conversationId: string } | null> {
  if (!isPgConfigured()) return null
  const {
    partnerId,
    channel,
    externalThreadId,
    channelExternalRef,
    customerName,
    customerAvatarUrl,
    linkedUserId,
    metadata,
  } = params

  /** Một lần SELECT auth.users — widget có thể đã resolve sớm cho AI/giới hạn ẩn danh (gọi lại an toàn). */
  const effectiveLinkedUserId = await resolveLinkedUserIdForCustomerCarePg(linkedUserId)

  const existing = await pgQueryOne<{ id: string; linked_user_id: string | null }>(
    `select id::text as id, linked_user_id::text as linked_user_id
     from public.customer_care_conversations
     where partner_id = $1::uuid and channel = $2 and external_thread_id = $3
     limit 1`,
    [partnerId, channel, externalThreadId]
  )

  if (existing?.id) {
    const patch: Record<string, unknown> = {}
    if (customerName != null && customerName !== '') patch.customer_name = customerName
    if (channelExternalRef != null && channelExternalRef !== '') patch.channel_external_ref = channelExternalRef
    if (
      effectiveLinkedUserId != null &&
      (existing.linked_user_id == null || existing.linked_user_id === '')
    ) {
      patch.linked_user_id = effectiveLinkedUserId
    }
    const keys = Object.keys(patch)
    if (keys.length > 0) {
      const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
      await pgQuery(
        `update public.customer_care_conversations set ${sets}, updated_at = now() where id = $1::uuid`,
        [existing.id, ...keys.map((k) => patch[k])]
      )
    }
    return { conversationId: existing.id }
  }

  const inserted = await pgQueryOne<{ id: string }>(
    `insert into public.customer_care_conversations (
       partner_id, channel, external_thread_id, channel_external_ref,
       customer_name, customer_avatar_url, linked_user_id, metadata, status
     ) values (
       $1::uuid, $2, $3, $4, $5, $6, $7::uuid, coalesce($8::jsonb, '{}'::jsonb), 'open'
     )
     returning id::text as id`,
    [
      partnerId,
      channel,
      externalThreadId,
      channelExternalRef ?? null,
      customerName ?? null,
      customerAvatarUrl ?? null,
      effectiveLinkedUserId,
      metadata ?? {},
    ]
  )
  if (!inserted?.id) return null
  return { conversationId: inserted.id }
}

export async function insertMessagePg(params: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  body: string
  rawPayload?: Json | null
  senderAdminId?: string | null
}): Promise<{ ok: true; messageId: string } | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne<{ id: string }>(
    `insert into public.customer_care_messages (
       conversation_id, direction, body, raw_payload, sender_admin_id
     ) values (
       $1::uuid, $2, $3, $4::jsonb, $5::uuid
     )
     returning id::text as id`,
    [
      params.conversationId,
      params.direction,
      params.body,
      params.rawPayload ?? null,
      params.senderAdminId && params.senderAdminId !== '' ? params.senderAdminId : null,
    ]
  )
  if (!row?.id) return null
  return { ok: true as const, messageId: row.id }
}

export type WidgetConvListPgRow = {
  id: string
  partner_id: string
  last_message_at: string | null
  last_message_preview: string | null
}

/**
 * Gắn `linked_user_id` cho hội thoại widget đã có `messaging_guest_accounts` cùng email
 * nhưng chưa gắn user (vd. chat nhúng trên site shop không gửi được cookie đăng nhập).
 */
export async function linkWidgetConversationsByGuestAccountEmailFromPg(
  linkedUserId: string,
  emailNormalized: string
): Promise<number> {
  if (!isPgConfigured()) return 0
  const uid = linkedUserId.trim()
  const em = emailNormalized.trim().toLowerCase()
  if (!uid || !em) return 0
  try {
    const res = await getPgPool().query(
      `update public.customer_care_conversations c
       set linked_user_id = $1::uuid, updated_at = now()
       where c.channel = 'widget'
         and c.linked_user_id is null
         and exists (
           select 1 from public.messaging_guest_accounts ga
           where ga.partner_id = c.partner_id
             and ga.email_normalized = $2
             and (
               ga.id::text = trim(both from c.external_thread_id)
               or (c.guest_account_id is not null and ga.id = c.guest_account_id::uuid)
             )
         )`,
      [uid, em]
    )
    return res.rowCount ?? 0
  } catch (e) {
    console.warn('[customer-care-pg] linkWidgetConversationsByGuestAccountEmailFromPg', e)
    return 0
  }
}

export async function fetchWidgetConversationsForLinkedUserFromPg(
  linkedUserId: string
): Promise<WidgetConvListPgRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text as id, partner_id::text as partner_id,
              last_message_at, last_message_preview
       from public.customer_care_conversations
       where channel = 'widget' and linked_user_id = $1::uuid
       order by last_message_at desc nulls last`,
      [linkedUserId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      partner_id: String(r.partner_id),
      last_message_at: isoTimestamp(r.last_message_at),
      last_message_preview: r.last_message_preview != null ? String(r.last_message_preview) : null,
    }))
  } catch (e) {
    console.error('[customer-care-pg] fetchWidgetConversationsForLinkedUserFromPg', e)
    return null
  }
}

export async function fetchPartnerConversationsFromPg(
  partnerId: string,
  limit = 100
): Promise<CustomerCareConversationRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, channel, external_thread_id, channel_external_ref,
              linked_user_id::text, guest_account_id::text, customer_name, customer_avatar_url,
              metadata, status, last_message_at, last_message_preview, created_at, updated_at
       from public.customer_care_conversations
       where partner_id = $1::uuid
       order by last_message_at desc nulls last
       limit $2`,
      [partnerId, limit]
    )
    return rows.map(mapConversationRow)
  } catch (e) {
    console.error('[customer-care-pg] fetchPartnerConversationsFromPg', e)
    return null
  }
}

export async function fetchConversationFullForPartnerFromPg(
  partnerId: string,
  conversationId: string
): Promise<CustomerCareConversationRow | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, partner_id::text, channel, external_thread_id, channel_external_ref,
              linked_user_id::text, guest_account_id::text, customer_name, customer_avatar_url,
              metadata, status, last_message_at, last_message_preview, created_at, updated_at
       from public.customer_care_conversations
       where id = $1::uuid and partner_id = $2::uuid
       limit 1`,
      [conversationId, partnerId]
    )
    if (!row) return 'not_found'
    return mapConversationRow(row)
  } catch (e) {
    console.error('[customer-care-pg] fetchConversationFullForPartnerFromPg', e)
    return null
  }
}

export async function fetchPartnerMessagesFromPg(
  conversationId: string
): Promise<CustomerCareMessageRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, conversation_id::text, direction, body, raw_payload,
              sender_admin_id::text, read_at, created_at
       from public.customer_care_messages
       where conversation_id = $1::uuid
       order by created_at asc`,
      [conversationId]
    )
    return rows.map(mapMessageRow)
  } catch (e) {
    console.error('[customer-care-pg] fetchPartnerMessagesFromPg', e)
    return null
  }
}

/** Tin nhắn inbox partner: kiểm tra conv thuộc partner + load messages. */
export async function listPartnerMessagesBundleFromPg(
  partnerId: string,
  conversationId: string
): Promise<{ rows: CustomerCareMessageRow[] } | 'not_found' | null> {
  if (!isPgConfigured()) return null
  try {
    const gate = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.customer_care_conversations
       where id = $1::uuid and partner_id = $2::uuid
       limit 1`,
      [conversationId, partnerId]
    )
    if (!gate) return 'not_found'
    const rows = await fetchPartnerMessagesFromPg(conversationId)
    if (rows === null) return null
    return { rows }
  } catch (e) {
    console.error('[customer-care-pg] listPartnerMessagesBundleFromPg', e)
    return null
  }
}

/** Trả về `null` khi không pool, lỗi, hoặc không có hàng. */
export async function fetchGuestWidgetConversationIdFromPg(
  partnerId: string,
  externalThreadId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text as id from public.customer_care_conversations
       where partner_id = $1::uuid and channel = 'widget' and external_thread_id = $2
       limit 1`,
      [partnerId, externalThreadId]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[customer-care-pg] fetchGuestWidgetConversationIdFromPg', e)
    return null
  }
}

export async function fetchGuestWidgetMessagesSubsetFromPg(
  conversationId: string
): Promise<Pick<CustomerCareMessageRow, 'id' | 'direction' | 'body' | 'created_at' | 'raw_payload'>[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text as id, direction, body, created_at, raw_payload
       from public.customer_care_messages
       where conversation_id = $1::uuid
       order by created_at asc`,
      [conversationId]
    )
    return rows.map((r) => ({
      id: String(r.id),
      direction: String(r.direction) as CustomerCareMessageRow['direction'],
      body: String(r.body ?? ''),
      created_at: isoTimestampRequired(r.created_at),
      raw_payload: (r.raw_payload ?? null) as Json | null,
    }))
  } catch (e) {
    console.error('[customer-care-pg] fetchGuestWidgetMessagesSubsetFromPg', e)
    return null
  }
}

const MAX_CONSULTED_PRODUCT_URL_KEY_LEN = 4096

/** Chuỗi composite `messageId\\u001fproductUrlKey` cho client. `null` = lỗi PG. */
/** Khóa URL (đã chuẩn hoá) của lần bấm «Tư vấn» gần nhất — neo đúng mặt hàng với kho. */
export async function fetchLatestConsultedProductUrlKeyForConversationFromPg(
  conversationId: string
): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ product_url_key: string }>(
      `select trim(product_url_key) as product_url_key
       from public.customer_care_consulted_products
       where conversation_id = $1::uuid
       order by consulted_at desc
       limit 1`,
      [conversationId]
    )
    const k = row?.product_url_key?.trim()
    return k || null
  } catch (e) {
    console.error('[customer-care-pg] fetchLatestConsultedProductUrlKeyForConversationFromPg', e)
    return null
  }
}

export async function fetchConsultedProductKeysForConversationFromPg(
  conversationId: string
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ source_message_id: string; product_url_key: string }>(
      `select source_message_id::text as source_message_id, product_url_key
       from public.customer_care_consulted_products
       where conversation_id = $1::uuid
       order by consulted_at asc`,
      [conversationId]
    )
    return rows
      .map((r) => {
        const mid = String(r.source_message_id ?? '').trim()
        const pk = String(r.product_url_key ?? '').trim()
        if (!mid || !pk) return ''
        return makeConsultProductScopeKey(mid, pk)
      })
      .filter(Boolean)
  } catch (e) {
    console.error('[customer-care-pg] fetchConsultedProductKeysForConversationFromPg', e)
    return null
  }
}

export async function customerCareMessageBelongsToConversationFromPg(
  conversationId: string,
  messageId: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  const mid = messageId.trim()
  if (!mid) return false
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.customer_care_messages
       where id = $1::uuid and conversation_id = $2::uuid
       limit 1`,
      [mid, conversationId]
    )
    return row != null
  } catch (e) {
    console.error('[customer-care-pg] customerCareMessageBelongsToConversationFromPg', e)
    return null
  }
}

export async function upsertConsultedProductKeyForConversationFromPg(
  conversationId: string,
  sourceMessageId: string,
  productUrlKey: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const key = productUrlKey.trim()
  const sid = sourceMessageId.trim()
  if (!key || !sid || key.length > MAX_CONSULTED_PRODUCT_URL_KEY_LEN) return false
  const belongs = await customerCareMessageBelongsToConversationFromPg(conversationId, sid)
  if (belongs !== true) return false
  try {
    await pgQuery(
      `insert into public.customer_care_consulted_products (conversation_id, source_message_id, product_url_key)
       values ($1::uuid, $2::uuid, $3)
       on conflict (conversation_id, source_message_id, product_url_key) do nothing`,
      [conversationId, sid, key]
    )
    return true
  } catch (e) {
    console.error('[customer-care-pg] upsertConsultedProductKeyForConversationFromPg', e)
    return false
  }
}

/**
 * Merge session → account cho widget guest. Trả về `true` khi đã xử lý xong (kể cả không có conv cũ);
 * `false` khi lỗi PG (caller có thể báo lỗi / retry).
 */
export async function mergeGuestSessionConversationToAccountPg(
  partnerId: string,
  sessionId: string,
  guestAccountId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    const oldRes = await client.query<{ id: string }>(
      `select id::text as id from public.customer_care_conversations
       where partner_id = $1::uuid and channel = 'widget' and external_thread_id = $2
       limit 1`,
      [partnerId, sessionId]
    )
    if (oldRes.rows.length === 0 || !oldRes.rows[0]?.id) {
      await client.query('commit')
      return true
    }
    const oldId = oldRes.rows[0].id

    const targetRes = await client.query<{ id: string }>(
      `select id::text as id from public.customer_care_conversations
       where partner_id = $1::uuid and channel = 'widget' and external_thread_id = $2
       limit 1`,
      [partnerId, guestAccountId]
    )
    const targetId = targetRes.rows[0]?.id

    if (!targetId) {
      const renamed = await client.query(
        `update public.customer_care_conversations
         set external_thread_id = $1, updated_at = now()
         where id = $2::uuid`,
        [guestAccountId, oldId]
      )
      if ((renamed.rowCount ?? 0) < 1) {
        await client.query('rollback')
        return false
      }
      await client.query('commit')
      return true
    }

    if (targetId === oldId) {
      await client.query('commit')
      return true
    }

    await client.query(
      `update public.customer_care_messages
       set conversation_id = $1::uuid
       where conversation_id = $2::uuid`,
      [targetId, oldId]
    )
    await client.query(`delete from public.customer_care_conversations where id = $1::uuid`, [oldId])
    await client.query('commit')
    return true
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {
      /* ignore */
    }
    console.error('[customer-care-pg] mergeGuestSessionConversationToAccountPg', e)
    return false
  } finally {
    client.release()
  }
}

export async function countInboundMessagesForConversationPg(conversationId: string): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: string }>(
      `select count(*)::text as c from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'inbound'`,
      [conversationId]
    )
    if (row?.c == null || row.c === '') return null
    const n = parseInt(row.c, 10)
    return Number.isFinite(n) ? n : null
  } catch (e) {
    console.error('[customer-care-pg] countInboundMessagesForConversationPg', e)
    return null
  }
}

export async function fetchCustomerCareConversationByIdPg(
  conversationId: string
): Promise<CustomerCareConversationRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, partner_id::text, channel, external_thread_id, channel_external_ref,
              linked_user_id::text, guest_account_id::text, customer_name, customer_avatar_url,
              metadata, status, last_message_at, last_message_preview, created_at, updated_at
       from public.customer_care_conversations
       where id = $1::uuid
       limit 1`,
      [conversationId]
    )
    return row ? mapConversationRow(row) : null
  } catch (e) {
    console.error('[customer-care-pg] fetchCustomerCareConversationByIdPg', e)
    return null
  }
}

export async function fetchCustomerCareMessageByIdForConversationPg(
  messageId: string,
  conversationId: string
): Promise<CustomerCareMessageRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, conversation_id::text, direction, body, raw_payload,
              sender_admin_id::text, read_at, created_at
       from public.customer_care_messages
       where id = $1::uuid and conversation_id = $2::uuid
       limit 1`,
      [messageId, conversationId]
    )
    return row ? mapMessageRow(row) : null
  } catch (e) {
    console.error('[customer-care-pg] fetchCustomerCareMessageByIdForConversationPg', e)
    return null
  }
}

export async function fetchCustomerCareMessageByIdPg(messageId: string): Promise<CustomerCareMessageRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, conversation_id::text, direction, body, raw_payload,
              sender_admin_id::text, read_at, created_at
       from public.customer_care_messages
       where id = $1::uuid
       limit 1`,
      [messageId]
    )
    return row ? mapMessageRow(row) : null
  } catch (e) {
    console.error('[customer-care-pg] fetchCustomerCareMessageByIdPg', e)
    return null
  }
}

export async function updateCustomerCareMessageRawPayloadPg(
  messageId: string,
  rawPayload: Json
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.customer_care_messages set raw_payload = $1::jsonb where id = $2::uuid`,
      [rawPayload, messageId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[customer-care-pg] updateCustomerCareMessageRawPayloadPg', e)
    return false
  }
}

/** Đếm ảnh minh họa mặc/dùng đã gửi trong cuộc chat cho đúng mặt hàng (metadata trên tin outbound). */
export async function countPartnerAiRealUseImagesSentForInventoryInConversationPg(
  conversationId: string,
  inventoryId: string
): Promise<number | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ c: number }>(
      `select count(*)::int as c
       from public.customer_care_messages
       where conversation_id = $1::uuid
         and direction = 'outbound'
         and coalesce(raw_payload->'partner_ai_image_followup'->>'kind','') = 'real_use'
         and coalesce(raw_payload->'partner_ai_image_followup'->>'inventory_id','') = $2`,
      [conversationId, inventoryId]
    )
    return row?.c ?? 0
  } catch (e) {
    console.warn('[customer-care-pg] countPartnerAiRealUseImagesSentForInventoryInConversationPg', e)
    return null
  }
}

/** Tin outbound mới nhất trước — để đọc `ai_product_cards` (mặt hàng vừa tư vấn). */
export async function fetchOutboundRawPayloadsNewestFirstPg(
  conversationId: string,
  limit: number
): Promise<Json[]> {
  if (!isPgConfigured()) return []
  const lim = Math.max(1, Math.min(80, Math.floor(limit)))
  try {
    const rows = await pgQuery<{ raw_payload: unknown }>(
      `select raw_payload
       from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'outbound'
       order by created_at desc
       limit $2`,
      [conversationId, lim]
    )
    return rows
      .map((r) => (r.raw_payload ?? null) as Json)
      .filter((p): p is Json => p !== null && typeof p === 'object' && !Array.isArray(p))
  } catch (e) {
    console.warn('[customer-care-pg] fetchOutboundRawPayloadsNewestFirstPg', e)
    return []
  }
}

/** Giống `fetchOutboundRawPayloadsNewestFirstPg` nhưng kèm `body` — trích mã SP trong nội dung tin khi thẻ không khớp kho. */
export async function fetchOutboundPayloadsAndBodiesNewestFirstPg(
  conversationId: string,
  limit: number
): Promise<Array<{ raw_payload: Json | null; body: string }>> {
  if (!isPgConfigured()) return []
  const lim = Math.max(1, Math.min(80, Math.floor(limit)))
  try {
    const rows = await pgQuery<{ raw_payload: unknown; body: unknown }>(
      `select body, raw_payload
       from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'outbound'
       order by created_at desc
       limit $2`,
      [conversationId, lim]
    )
    return rows.map((r) => ({
      body: typeof r.body === 'string' ? r.body : '',
      raw_payload:
        r.raw_payload !== null && typeof r.raw_payload === 'object' && !Array.isArray(r.raw_payload)
          ? (r.raw_payload as Json)
          : null,
    }))
  } catch (e) {
    console.warn('[customer-care-pg] fetchOutboundPayloadsAndBodiesNewestFirstPg', e)
    return []
  }
}

export async function fetchCustomerCareTranscriptLinesFromPg(
  conversationId: string,
  limit: number
): Promise<{ direction: string; body: string; created_at: string; raw_payload: Json | null }[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select direction, body, created_at, raw_payload
       from public.customer_care_messages
       where conversation_id = $1::uuid
       order by created_at desc
       limit $2`,
      [conversationId, limit]
    )
    const chronological = [...rows].reverse()
    return chronological.map((r) => ({
      direction: String(r.direction ?? ''),
      body: String(r.body ?? ''),
      created_at: isoTimestampRequired(r.created_at),
      raw_payload: (r.raw_payload ?? null) as Json | null,
    }))
  } catch (e) {
    console.error('[customer-care-pg] fetchCustomerCareTranscriptLinesFromPg', e)
    return null
  }
}

export async function hasHumanOutboundAfterTriggerPg(
  conversationId: string,
  triggerAtIso: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'outbound'
         and sender_admin_id is not null and created_at > $2::timestamptz
       limit 1`,
      [conversationId, triggerAtIso]
    )
    return row != null
  } catch (e) {
    console.error('[customer-care-pg] hasHumanOutboundAfterTriggerPg', e)
    return null
  }
}

export async function hasAutoOutboundAfterTriggerPg(
  conversationId: string,
  triggerAtIso: string
): Promise<boolean | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ ok: number }>(
      `select 1 as ok from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'outbound'
         and sender_admin_id is null and created_at > $2::timestamptz
       limit 1`,
      [conversationId, triggerAtIso]
    )
    return row != null
  } catch (e) {
    console.error('[customer-care-pg] hasAutoOutboundAfterTriggerPg', e)
    return null
  }
}

export async function fetchInternalConversationForUserPg(
  partnerId: string,
  externalThreadUserId: string
): Promise<CustomerCareConversationRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select id::text, partner_id::text, channel, external_thread_id, channel_external_ref,
              linked_user_id::text, guest_account_id::text, customer_name, customer_avatar_url,
              metadata, status, last_message_at, last_message_preview, created_at, updated_at
       from public.customer_care_conversations
       where partner_id = $1::uuid and channel = 'internal' and external_thread_id = $2
       limit 1`,
      [partnerId, externalThreadUserId]
    )
    return row ? mapConversationRow(row) : null
  } catch (e) {
    console.error('[customer-care-pg] fetchInternalConversationForUserPg', e)
    return null
  }
}

export async function insertInternalInboundMessagePg(conversationId: string, body: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(
      `insert into public.customer_care_messages (conversation_id, direction, body)
       values ($1::uuid, 'inbound', $2)`,
      [conversationId, body]
    )
    return true
  } catch (e) {
    console.error('[customer-care-pg] insertInternalInboundMessagePg', e)
    return false
  }
}

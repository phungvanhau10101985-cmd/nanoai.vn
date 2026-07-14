import type { Json } from '@/types/database.types'
import { makeConsultProductScopeKey } from '@/lib/messaging/consult-product-scope-key'
import type { Database } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import { authUserIdExistsInPg } from '@/lib/db/auth-user-email-pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  buildGuestConversationCustomerName,
  enrichStoredConversationCustomerName,
  isGenericGuestAccountLabel,
  resolveGuestAccountLabelFromPg,
} from '@/lib/messaging/guest-customer-display-name'

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
  const base: CustomerCareConversationRow = {
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
  if ('resolved_account_label' in r || 'partner_display_name' in r) {
    base.customer_name = enrichStoredConversationCustomerName({
      storedName: base.customer_name,
      resolvedAccountLabel:
        r.resolved_account_label != null ? String(r.resolved_account_label) : null,
      partnerDisplayName: r.partner_display_name != null ? String(r.partner_display_name) : null,
    })
  }
  return base
}

const CONVERSATION_ACCOUNT_RESOLVE_JOINS = `
  left join public.messaging_partners mp on mp.id = c.partner_id
  left join public.messaging_guest_accounts ga on ga.partner_id = c.partner_id
    and (
      ga.id::text = c.external_thread_id
      or (c.guest_account_id is not null and ga.id = c.guest_account_id)
    )
  left join public.messaging_partner_customer_profiles cp on cp.partner_id = c.partner_id
    and cp.email_normalized = ga.email_normalized
  left join public.profiles pr on pr.id = c.linked_user_id
  left join auth.users au on au.id = c.linked_user_id
`

const RESOLVED_ACCOUNT_LABEL_SQL = `
  coalesce(
    nullif(trim(cp.customer_name), ''),
    nullif(trim(pr.full_name), ''),
    nullif(trim(split_part(coalesce(ga.email_raw, au.email, ''), '@', 1)), ''),
    nullif(trim(coalesce(ga.email_raw, au.email)), '')
  )
`

function mapMessageRow(r: Record<string, unknown>): CustomerCareMessageRow {
  const dir = String(r.direction ?? 'inbound')
  return {
    id: String(r.id),
    conversation_id: String(r.conversation_id),
    direction: dir as CustomerCareMessageRow['direction'],
    body: String(r.body ?? ''),
    raw_payload: (r.raw_payload ?? null) as Json | null,
    sender_admin_id: r.sender_admin_id != null ? String(r.sender_admin_id) : null,
    landing_source_url: r.landing_source_url != null ? String(r.landing_source_url) : null,
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
  guestAccountId?: string | null
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
    guestAccountId,
    metadata,
  } = params

  /** Một lần SELECT auth.users — widget có thể đã resolve sớm cho AI/giới hạn ẩn danh (gọi lại an toàn). */
  const effectiveLinkedUserId = await resolveLinkedUserIdForCustomerCarePg(linkedUserId)
  const effectiveGuestAccountId = guestAccountId?.trim() || null

  const existing = await pgQueryOne<{
    id: string
    linked_user_id: string | null
    customer_name: string | null
    guest_account_id: string | null
  }>(
    `select id::text as id, linked_user_id::text as linked_user_id,
            customer_name, guest_account_id::text as guest_account_id
     from public.customer_care_conversations
     where partner_id = $1::uuid and channel = $2 and external_thread_id = $3
     limit 1`,
    [partnerId, channel, externalThreadId]
  )

  if (existing?.id) {
    const patch: Record<string, unknown> = {}
    if (customerName != null && customerName !== '') {
      const storedHead = String(existing.customer_name ?? '').split('·')[0]?.split('-')[0]
      const incomingHead = customerName.split('·')[0]?.split('-')[0]
      const shouldUpdateName =
        !existing.customer_name?.trim() ||
        isGenericGuestAccountLabel(storedHead) ||
        (!isGenericGuestAccountLabel(incomingHead) && incomingHead.trim() !== storedHead.trim())
      if (shouldUpdateName) patch.customer_name = customerName
    }
    if (channelExternalRef != null && channelExternalRef !== '') patch.channel_external_ref = channelExternalRef
    if (
      effectiveLinkedUserId != null &&
      (existing.linked_user_id == null || existing.linked_user_id === '')
    ) {
      patch.linked_user_id = effectiveLinkedUserId
    }
    if (
      effectiveGuestAccountId != null &&
      (existing.guest_account_id == null || existing.guest_account_id === '')
    ) {
      patch.guest_account_id = effectiveGuestAccountId
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
       customer_name, customer_avatar_url, linked_user_id, guest_account_id, metadata, status
     ) values (
       $1::uuid, $2, $3, $4, $5, $6, $7::uuid, $8::uuid, coalesce($9::jsonb, '{}'::jsonb), 'open'
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
      effectiveGuestAccountId,
      metadata ?? {},
    ]
  )
  if (!inserted?.id) return null
  return { conversationId: inserted.id }
}

/** Cập nhật tên inbox sau khi khách đăng nhập web shop / OTP (merge phiên → tài khoản). */
export async function syncGuestConversationCustomerNamesForAccountPg(input: {
  partnerId: string
  guestAccountId: string
  customerNameHint?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const guestAccountId = input.guestAccountId.trim()
  if (!guestAccountId) return
  try {
    const partner = await pgQueryOne<{ display_name: string | null }>(
      `select display_name from public.messaging_partners where id = $1::uuid limit 1`,
      [input.partnerId]
    )
    const shopDisplayName = String(partner?.display_name ?? '').trim() || 'Shop'
    const hint = String(input.customerNameHint ?? '').trim()
    const label =
      hint ||
      (await resolveGuestAccountLabelFromPg({
        partnerId: input.partnerId,
        guestAccountId,
        externalThreadId: guestAccountId,
      }))
    if (!label) return
    const customerName = buildGuestConversationCustomerName(label, shopDisplayName)
    await pgQuery(
      `update public.customer_care_conversations
       set customer_name = $4,
           guest_account_id = coalesce(guest_account_id, $3::uuid),
           updated_at = now()
       where partner_id = $1::uuid
         and channel = 'widget'
         and external_thread_id = $2`,
      [input.partnerId, guestAccountId, guestAccountId, customerName]
    )
  } catch (e) {
    console.warn('[customer-care-pg] syncGuestConversationCustomerNamesForAccountPg', e)
  }
}

export async function insertMessagePg(params: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  body: string
  rawPayload?: Json | null
  senderAdminId?: string | null
  /** Chỉ inbound widget: URL trang (http/https) để gắn nguồn traffic / feed. */
  landingSourceUrl?: string | null
}): Promise<{ ok: true; messageId: string } | null> {
  if (!isPgConfigured()) return null
  let landing: string | null = null
  if (params.direction === 'inbound') {
    const s = params.landingSourceUrl?.trim()
    if (s && /^https?:\/\//i.test(s)) {
      landing = s.slice(0, 4000)
    }
  }
  const row = await pgQueryOne<{ id: string }>(
    `insert into public.customer_care_messages (
       conversation_id, direction, body, raw_payload, sender_admin_id, landing_source_url
     ) values (
       $1::uuid, $2, $3, $4::jsonb, $5::uuid, $6
     )
     returning id::text as id`,
    [
      params.conversationId,
      params.direction,
      params.body,
      params.rawPayload ?? null,
      params.senderAdminId && params.senderAdminId !== '' ? params.senderAdminId : null,
      landing,
    ]
  )
  if (!row?.id) return null
  return { ok: true as const, messageId: row.id }
}

/** Ghi đè / cập nhật `metadata.ui_locale` (ngôn ngữ giao diện khách đang dùng trên trang chat). */
export async function mergeConversationUiLocaleFromPg(conversationId: string, uiLocale: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const id = conversationId.trim()
  const loc = uiLocale.trim().slice(0, 24)
  if (!id || !loc) return false
  try {
    const res = await getPgPool().query(
      `update public.customer_care_conversations
       set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ui_locale', $2::text),
           updated_at = now()
       where id = $1::uuid`,
      [id, loc]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[mergeConversationUiLocaleFromPg]', e)
    return false
  }
}

export async function fetchConversationUiLocaleFromPg(conversationId: string): Promise<string | null> {
  if (!isPgConfigured()) return null
  const id = conversationId.trim()
  if (!id) return null
  try {
    const row = await pgQueryOne<{ ui_locale: string | null }>(
      `select metadata->>'ui_locale' as ui_locale
       from public.customer_care_conversations
       where id = $1::uuid
       limit 1`,
      [id]
    )
    const v = row?.ui_locale?.trim()
    return v || null
  } catch (e) {
    console.warn('[fetchConversationUiLocaleFromPg]', e)
    return null
  }
}

/** Đọc ISO timestamp từ `metadata` hội thoại — trả về epoch ms hoặc null. */
export function readIsoTimestampFromConversationMetadata(
  metadata: Json | null | undefined,
  key: string
): number | null {
  if (metadata == null || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const raw = (metadata as Record<string, unknown>)[key]
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  const ms = Date.parse(t)
  return Number.isFinite(ms) ? ms : null
}

/** Gộp patch string vào `metadata` hội thoại widget (presence, cooldown email, …). */
export async function mergeConversationMetadataPatchFromPg(
  conversationId: string,
  patch: Record<string, string>
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const id = conversationId.trim()
  if (!id || !patch || Object.keys(patch).length === 0) return false
  try {
    const res = await getPgPool().query(
      `update public.customer_care_conversations
       set metadata = coalesce(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       where id = $1::uuid`,
      [id, JSON.stringify(patch)]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[mergeConversationMetadataPatchFromPg]', e)
    return false
  }
}

/** Khách đang mở / poll chat widget — cập nhật heartbeat để shop biết còn live. */
export async function touchGuestViewerLastSeenFromPg(conversationId: string): Promise<void> {
  if (!isPgConfigured()) return
  const id = conversationId.trim()
  if (!id) return
  try {
    await mergeConversationMetadataPatchFromPg(id, {
      guest_viewer_last_seen_at: new Date().toISOString(),
    })
  } catch (e) {
    console.warn('[touchGuestViewerLastSeenFromPg]', e)
  }
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

export async function fetchWidgetConversationPartnerIdsByExternalThreadIdFromPg(
  externalThreadId: string
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  const tid = externalThreadId.trim()
  if (!tid) return []
  try {
    const rows = await pgQuery<{ partner_id: string }>(
      `select distinct partner_id::text as partner_id
       from public.customer_care_conversations
       where channel = 'widget' and external_thread_id = $1`,
      [tid]
    )
    return rows.map((r) => String(r.partner_id ?? '').trim()).filter(Boolean)
  } catch (e) {
    console.error('[customer-care-pg] fetchWidgetConversationPartnerIdsByExternalThreadIdFromPg', e)
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
      `select c.id::text, c.partner_id::text, c.channel, c.external_thread_id, c.channel_external_ref,
              c.linked_user_id::text, c.guest_account_id::text, c.customer_name, c.customer_avatar_url,
              c.metadata, c.status, c.last_message_at, c.last_message_preview, c.created_at, c.updated_at,
              mp.display_name as partner_display_name,
              ${RESOLVED_ACCOUNT_LABEL_SQL} as resolved_account_label
       from public.customer_care_conversations c
       ${CONVERSATION_ACCOUNT_RESOLVE_JOINS}
       where c.partner_id = $1::uuid
         and (
           exists (
             select 1
             from public.customer_care_messages m_keep
             where m_keep.conversation_id = c.id
               and m_keep.direction = 'inbound'
               and coalesce(m_keep.raw_payload ->> 'widget_auto_opening', 'false') <> 'true'
               and nullif(trim(replace(replace(coalesce(m_keep.body, ''), '📷', ''), '📦', '')), '') is not null
           )
           or exists (
             select 1
             from public.messaging_partner_orders o_keep
             where o_keep.conversation_id = c.id
           )
         )
         and not exists (
           select 1
           from (
             select
               count(*) as total_count,
               count(*) filter (where m.direction = 'inbound') as inbound_count,
               count(*) filter (where m.direction = 'outbound') as outbound_count,
               bool_or(coalesce(m.raw_payload ->> 'widget_auto_opening', 'false') = 'true') as has_auto_opening
             from public.customer_care_messages m
             where m.conversation_id = c.id
           ) s
           where s.total_count = 1
             and s.inbound_count = 1
             and s.outbound_count = 0
             and s.has_auto_opening
             and not exists (
               select 1 from public.messaging_partner_orders o_keep where o_keep.conversation_id = c.id
             )
         )
       order by c.last_message_at desc nulls last
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
      `select c.id::text, c.partner_id::text, c.channel, c.external_thread_id, c.channel_external_ref,
              c.linked_user_id::text, c.guest_account_id::text, c.customer_name, c.customer_avatar_url,
              c.metadata, c.status, c.last_message_at, c.last_message_preview, c.created_at, c.updated_at,
              mp.display_name as partner_display_name,
              ${RESOLVED_ACCOUNT_LABEL_SQL} as resolved_account_label
       from public.customer_care_conversations c
       ${CONVERSATION_ACCOUNT_RESOLVE_JOINS}
       where c.id = $1::uuid and c.partner_id = $2::uuid
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

export async function listPartnerConversationsFromPg(
  partnerId: string,
  limit = 50
): Promise<CustomerCareConversationRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(200, Number(limit || 50)))
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, partner_id::text, channel, external_thread_id, channel_external_ref,
              linked_user_id::text, guest_account_id::text, customer_name, customer_avatar_url,
              metadata, status, last_message_at, last_message_preview, created_at, updated_at
       from public.customer_care_conversations
       where partner_id = $1::uuid
         and (
           exists (
             select 1
             from public.customer_care_messages m_keep
             where m_keep.conversation_id = customer_care_conversations.id
               and m_keep.direction = 'inbound'
               and coalesce(m_keep.raw_payload ->> 'widget_auto_opening', 'false') <> 'true'
               and nullif(trim(replace(replace(coalesce(m_keep.body, ''), '📷', ''), '📦', '')), '') is not null
           )
           or exists (
             select 1
             from public.messaging_partner_orders o_keep
             where o_keep.conversation_id = customer_care_conversations.id
           )
         )
       order by coalesce(last_message_at, updated_at) desc, updated_at desc
       limit $2`,
      [partnerId, lim]
    )
    return rows.map(mapConversationRow)
  } catch (e) {
    console.error('[customer-care-pg] listPartnerConversationsFromPg', e)
    return null
  }
}

export async function fetchPartnerMessagesFromPg(
  conversationId: string,
  options?: { limit?: number; sinceCreatedAt?: string | null }
): Promise<CustomerCareMessageRow[] | null> {
  if (!isPgConfigured()) return null
  const rawLimit = Number(options?.limit ?? 0)
  const limit = rawLimit > 0 ? Math.max(1, Math.min(500, rawLimit)) : 0
  const sinceCreatedAt = options?.sinceCreatedAt?.trim()
  try {
    if (sinceCreatedAt) {
      const rows = await pgQuery<Record<string, unknown>>(
        `select id::text, conversation_id::text, direction, body, raw_payload,
                sender_admin_id::text, landing_source_url, read_at, created_at
         from public.customer_care_messages
         where conversation_id = $1::uuid
           and created_at >= $2::timestamptz
         order by created_at asc, id asc
         limit $3`,
        [conversationId, sinceCreatedAt, limit || 100]
      )
      return rows.map(mapMessageRow)
    }

    if (limit > 0) {
      const rows = await pgQuery<Record<string, unknown>>(
        `select * from (
           select id::text, conversation_id::text, direction, body, raw_payload,
                  sender_admin_id::text, landing_source_url, read_at, created_at
           from public.customer_care_messages
           where conversation_id = $1::uuid
           order by created_at desc, id desc
           limit $2
         ) recent
         order by created_at asc, id asc`,
        [conversationId, limit]
      )
      return rows.map(mapMessageRow)
    }

    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, conversation_id::text, direction, body, raw_payload,
              sender_admin_id::text, landing_source_url, read_at, created_at
       from public.customer_care_messages
       where conversation_id = $1::uuid
       order by created_at asc, id asc`,
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
  conversationId: string,
  options?: { limit?: number; sinceCreatedAt?: string | null }
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
    const rows = await fetchPartnerMessagesFromPg(conversationId, options)
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

/** `metadata->>'ui_locale'` của hội thoại widget (nếu có). */
export async function fetchGuestWidgetUiLocaleForPartnerFromPg(
  partnerId: string,
  externalThreadId: string | null
): Promise<string | null> {
  if (!isPgConfigured() || !externalThreadId?.trim()) return null
  const convId = await fetchGuestWidgetConversationIdFromPg(partnerId, externalThreadId.trim())
  if (!convId) return null
  return fetchConversationUiLocaleFromPg(convId)
}

export async function fetchGuestWidgetMessagesSubsetFromPg(
  conversationId: string
): Promise<
  (Pick<
    CustomerCareMessageRow,
    'id' | 'direction' | 'body' | 'created_at' | 'raw_payload' | 'landing_source_url'
  >[]) | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text as id, direction, body, created_at, raw_payload, landing_source_url
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
      landing_source_url: r.landing_source_url != null ? String(r.landing_source_url) : null,
    }))
  } catch (e) {
    console.error('[customer-care-pg] fetchGuestWidgetMessagesSubsetFromPg', e)
    return null
  }
}

export async function fetchGuestWidgetMessagesWindowFromPg(
  conversationId: string,
  opts?: { beforeMessageId?: string | null; limit?: number }
): Promise<
  | {
      rows: Pick<
        CustomerCareMessageRow,
        'id' | 'direction' | 'body' | 'created_at' | 'raw_payload' | 'landing_source_url'
      >[]
      hasMoreOlder: boolean
    }
  | null
> {
  if (!isPgConfigured()) return null
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const lim = Math.max(20, Math.min(120, Math.floor(Number(opts?.limit ?? 80)) || 80))
  const beforeIdRaw = typeof opts?.beforeMessageId === 'string' ? opts.beforeMessageId.trim() : ''
  const beforeId = beforeIdRaw && UUID_RE.test(beforeIdRaw) ? beforeIdRaw : null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `with anchor as (
         select created_at as c_at, id as c_id
         from public.customer_care_messages
         where conversation_id = $1::uuid and id = $2::uuid
         limit 1
       ),
       picked as (
         select id::text as id, direction, body, created_at, raw_payload, landing_source_url
         from public.customer_care_messages m
         where m.conversation_id = $1::uuid
           and (
             $2::uuid is null
             or exists (
               select 1
               from anchor a
               where m.created_at < a.c_at or (m.created_at = a.c_at and m.id < a.c_id)
             )
           )
         order by m.created_at desc, m.id desc
         limit $3::int + 1
       )
       select id, direction, body, created_at, raw_payload, landing_source_url
       from picked
       order by created_at asc, id asc`,
      [conversationId, beforeId, lim]
    )
    const hasMoreOlder = rows.length > lim
    const windowRows = hasMoreOlder ? rows.slice(rows.length - lim) : rows
    return {
      rows: windowRows.map((r) => ({
        id: String(r.id),
        direction: String(r.direction) as CustomerCareMessageRow['direction'],
        body: String(r.body ?? ''),
        created_at: isoTimestampRequired(r.created_at),
        raw_payload: (r.raw_payload ?? null) as Json | null,
        landing_source_url: r.landing_source_url != null ? String(r.landing_source_url) : null,
      })),
      hasMoreOlder,
    }
  } catch (e) {
    console.error('[customer-care-pg] fetchGuestWidgetMessagesWindowFromPg', e)
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

/**
 * Các `product_url_key` đã bấm «Tư vấn», **mới nhất trước** — mỗi URL một lần (lần tư vấn gần nhất của mỗi SP quyết định thứ hạng).
 */
export async function fetchConsultedProductUrlKeysByRecencyFromPg(
  conversationId: string,
  limit: number
): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(1, Math.min(30, Math.floor(Number(limit)) || 10))
  try {
    const rows = await pgQuery<{ product_url_key: string }>(
      `select trim(product_url_key) as product_url_key
       from (
         select product_url_key, max(consulted_at) as last_at
         from public.customer_care_consulted_products
         where conversation_id = $1::uuid
         group by product_url_key
       ) t
       order by last_at desc
       limit $2`,
      [conversationId, lim]
    )
    const out: string[] = []
    for (const r of rows) {
      const k = String(r.product_url_key ?? '').trim()
      if (k) out.push(k)
    }
    return out.length ? out : []
  } catch (e) {
    console.error('[customer-care-pg] fetchConsultedProductUrlKeysByRecencyFromPg', e)
    return null
  }
}

/**
 * `raw_payload` các tin trong hội thoại, **mới nhất trước** — dùng gom SP đã hiện trên thẻ trong chat.
 */
export async function fetchCustomerCareMessagePayloadsDescFromPg(
  conversationId: string,
  maxMessages = 500
): Promise<Array<{ raw_payload: Json | null }> | null> {
  if (!isPgConfigured()) return null
  const lim = Math.max(50, Math.min(2000, Math.floor(Number(maxMessages)) || 500))
  try {
    const rows = await pgQuery<{ raw_payload: Json | null }>(
      `select raw_payload
       from public.customer_care_messages
       where conversation_id = $1::uuid
       order by created_at desc
       limit $2`,
      [conversationId, lim]
    )
    return rows.map((r) => ({ raw_payload: (r.raw_payload ?? null) as Json | null }))
  } catch (e) {
    console.error('[customer-care-pg] fetchCustomerCareMessagePayloadsDescFromPg', e)
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
         set external_thread_id = $1,
             guest_account_id = $2::uuid,
             updated_at = now()
         where id = $3::uuid`,
        [guestAccountId, guestAccountId, oldId]
      )
      if ((renamed.rowCount ?? 0) < 1) {
        await client.query('rollback')
        return false
      }
      /** Đơn nháp / thanh toán neo `external_thread_id` — đồng bộ với thread mới (tránh PATCH 400 sau khi gộp). */
      await client.query(
        `update public.messaging_partner_orders
         set external_thread_id = $1, updated_at = now()
         where conversation_id = $2::uuid and partner_id = $3::uuid`,
        [guestAccountId, oldId, partnerId]
      )
      await client.query('commit')
      return true
    }

    if (targetId === oldId) {
      await client.query('commit')
      return true
    }

    /**
     * Trước khi xóa hội thoại cũ: chuyển mọi thứ neo `conversation_id` — nếu không,
     * `on delete cascade` sẽ xóa đơn hàng / job AI / đã tư vấn (mất đơn nháp → PATCH «Không tìm thấy đơn»).
     */
    await client.query(
      `update public.messaging_partner_orders
       set conversation_id = $1::uuid,
           external_thread_id = $2,
           updated_at = now()
       where conversation_id = $3::uuid and partner_id = $4::uuid`,
      [targetId, guestAccountId.trim(), oldId, partnerId]
    )
    await client.query(
      `update public.messaging_partner_ai_jobs
       set conversation_id = $1::uuid
       where conversation_id = $2::uuid`,
      [targetId, oldId]
    )
    await client.query(
      `update public.messaging_partner_ai_token_usage
       set conversation_id = $1::uuid
       where conversation_id = $2::uuid`,
      [targetId, oldId]
    )
    await client.query(
      `delete from public.customer_care_consulted_products o
       using public.customer_care_consulted_products t
       where o.conversation_id = $2::uuid
         and t.conversation_id = $1::uuid
         and t.source_message_id = o.source_message_id
         and t.product_url_key = o.product_url_key`,
      [targetId, oldId]
    )
    await client.query(
      `update public.customer_care_consulted_products
       set conversation_id = $1::uuid
       where conversation_id = $2::uuid`,
      [targetId, oldId]
    )

    await client.query(
      `update public.customer_care_messages
       set conversation_id = $1::uuid
       where conversation_id = $2::uuid`,
      [targetId, oldId]
    )
    await client.query(
      `update public.customer_care_conversations
       set guest_account_id = $1::uuid, updated_at = now()
       where id = $2::uuid and guest_account_id is null`,
      [guestAccountId, targetId]
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

/**
 * Xóa hội thoại widget rác chỉ có 1 tin inbound auto-opening (không có trao đổi thật).
 * Dùng cho cron dọn inbox: ẩn rác sale + giảm phình DB.
 */
export async function purgeStaleWidgetAutoOpeningConversationsPg(
  olderThanMinutes = 30,
  limit = 300
): Promise<number> {
  if (!isPgConfigured()) return 0
  const minutes = Math.max(1, Math.min(60 * 24 * 14, Math.floor(olderThanMinutes)))
  const maxRows = Math.max(1, Math.min(5000, Math.floor(limit)))
  try {
    const res = await getPgPool().query<{ id: string }>(
      `with candidates as (
         select c.id
         from public.customer_care_conversations c
         join (
           select
             m.conversation_id,
             count(*) as total_count,
             count(*) filter (where m.direction = 'inbound') as inbound_count,
             count(*) filter (where m.direction = 'outbound') as outbound_count,
             max(m.created_at) as last_message_at,
             bool_or(coalesce(m.raw_payload ->> 'widget_auto_opening', 'false') = 'true') as has_auto_opening
           from public.customer_care_messages m
           group by m.conversation_id
         ) s on s.conversation_id = c.id
         where c.channel = 'widget'
           and s.total_count = 1
           and s.inbound_count = 1
           and s.outbound_count = 0
           and s.has_auto_opening
           and s.last_message_at <= now() - ($1::int * interval '1 minute')
         order by s.last_message_at asc
         limit $2
       )
       delete from public.customer_care_conversations c
       using candidates x
       where c.id = x.id
       returning c.id::text as id`,
      [minutes, maxRows]
    )
    return res.rowCount ?? 0
  } catch (e) {
    console.error('[customer-care-pg] purgeStaleWidgetAutoOpeningConversationsPg', e)
    return 0
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
              sender_admin_id::text, landing_source_url, read_at, created_at
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
              sender_admin_id::text, landing_source_url, read_at, created_at
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

/** Gộp patch vào `raw_payload` (jsonb merge) — không ghi đè toàn bộ payload. */
export async function mergeCustomerCareMessageRawPayloadPatchPg(
  messageId: string,
  patch: Record<string, unknown>
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.customer_care_messages
         set raw_payload = coalesce(raw_payload, '{}'::jsonb) || $1::jsonb
       where id = $2::uuid`,
      [JSON.stringify(patch), messageId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[customer-care-pg] mergeCustomerCareMessageRawPayloadPatchPg', e)
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

/**
 * Hai tin nhắn ngay **trước** `$triggerMessageId` (đồng hồ, gần trigger trước).
 * `order`: cũ trước → mới sau ( chronological ).
 */
export async function fetchTwoCareMessagesImmediatelyBeforePg(
  conversationId: string,
  triggerMessageId: string
): Promise<Array<{ direction: string; body: string; raw_payload: Json | null }> | null> {
  if (!isPgConfigured()) return null
  const cid = conversationId.trim()
  const tid = triggerMessageId.trim()
  if (!cid || !tid) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select direction, body, raw_payload
       from public.customer_care_messages m
       where m.conversation_id = $1::uuid
         and (m.created_at, m.id) <
             (select i.created_at, i.id from public.customer_care_messages i where i.id = $2::uuid)
       order by m.created_at desc, m.id desc
       limit 2`,
      [cid, tid]
    )
    return [...rows]
      .reverse()
      .map((r) => ({
        direction: String(r.direction ?? ''),
        body: String(r.body ?? ''),
        raw_payload: (r.raw_payload ?? null) as Json | null,
      }))
  } catch (e) {
    console.error('[customer-care-pg] fetchTwoCareMessagesImmediatelyBeforePg', e)
    return null
  }
}

/** Tin shop (outbound) mới nhất — dùng cho phân loại ý định widget (LLM). */
export async function fetchLastOutboundCustomerCareMessageBodyPg(
  conversationId: string
): Promise<string | null> {
  if (!isPgConfigured() || !conversationId.trim()) return null
  try {
    const row = await pgQueryOne<{ body: unknown }>(
      `select body from public.customer_care_messages
       where conversation_id = $1::uuid and direction = 'outbound'
       order by created_at desc
       limit 1`,
      [conversationId]
    )
    if (!row) return null
    const b = String(row.body ?? '').trim()
    return b.length ? b : null
  } catch (e) {
    console.error('[customer-care-pg] fetchLastOutboundCustomerCareMessageBodyPg', e)
    return null
  }
}

export async function fetchCustomerCareTranscriptLinesFromPg(
  conversationId: string,
  limit: number
): Promise<
  {
    direction: string
    body: string
    created_at: string
    raw_payload: Json | null
    sender_admin_id: string | null
  }[] | null
> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select direction, body, created_at, raw_payload, sender_admin_id
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
      sender_admin_id: r.sender_admin_id == null ? null : String(r.sender_admin_id),
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

/**
 * Các tin inbound của khách **sau** tin shop gần nhất, tới hết lượt (đến `triggerCreatedAtIso` gồm cả tin trigger).
 * Dùng gộp burst (2–3 tin liên tiục) thành một ngữ cảnh LLM — giữ đúng thứ tự.
 */
export async function fetchInboundTailForPartnerAiJobPg(
  conversationId: string,
  triggerCreatedAtIso: string
): Promise<Array<{ id: string; body: string; raw_payload: Json | null }> | null> {
  if (!isPgConfigured() || !conversationId.trim()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text as id, body, raw_payload
       from public.customer_care_messages m
       where m.conversation_id = $1::uuid
         and m.direction = 'inbound'
         and m.created_at <= $2::timestamptz
         and m.created_at > coalesce(
           (select max(created_at)
            from public.customer_care_messages
            where conversation_id = $1::uuid and direction = 'outbound'),
           '-infinity'::timestamptz
         )
       order by m.created_at asc, m.id asc
       limit 40`,
      [conversationId, triggerCreatedAtIso]
    )
    return rows.map((r) => ({
      id: String(r.id ?? ''),
      body: typeof r.body === 'string' ? r.body : '',
      raw_payload: (r.raw_payload ?? null) as Json | null,
    }))
  } catch (e) {
    console.error('[customer-care-pg] fetchInboundTailForPartnerAiJobPg', e)
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

import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type MarketingCampaignStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'cancelled'
  | 'failed'

export type MarketingDeliveryStatus =
  | 'pending'
  | 'sent_chat'
  | 'sent_chat_email'
  | 'skipped'
  | 'failed'

export type MarketingCampaignRow = {
  id: string
  partner_id: string
  created_by_user_id: string
  status: MarketingCampaignStatus
  channel_chat: boolean
  channel_email: boolean
  segment_json: Record<string, unknown>
  template_subject: string | null
  template_body_chat: string
  template_body_email: string | null
  offer_percent: number | null
  scheduled_at: string | null
  started_at: string | null
  completed_at: string | null
  total_queued: number
  sent_chat: number
  sent_email: number
  skipped: number
  failed: number
  created_at: string
  updated_at: string
}

export type MarketingDeliveryRow = {
  id: string
  campaign_id: string
  partner_id: string
  conversation_id: string | null
  recipient_key: string
  email: string | null
  status: MarketingDeliveryStatus
  skip_reason: string | null
  rendered_body_chat: string | null
  rendered_body_email: string | null
  sent_chat_at: string | null
  sent_email_at: string | null
  created_at: string
  updated_at: string
}

export type MarketingSegmentRecipientRow = {
  conversation_id: string
  recipient_key: string
  linked_user_id: string | null
  guest_account_id: string | null
  customer_name: string | null
  external_thread_id: string
  metadata: Record<string, unknown> | null
  last_message_at: string | null
}

const CAMPAIGN_SELECT = `
  id::text, partner_id::text, created_by_user_id::text, status,
  channel_chat, channel_email, segment_json, template_subject,
  template_body_chat, template_body_email, offer_percent::int,
  scheduled_at::text, started_at::text, completed_at::text,
  total_queued::int, sent_chat::int, sent_email::int, skipped::int, failed::int,
  created_at::text, updated_at::text
`

function mapCampaignRow(r: Record<string, unknown>): MarketingCampaignRow {
  return {
    id: String(r.id),
    partner_id: String(r.partner_id),
    created_by_user_id: String(r.created_by_user_id),
    status: String(r.status) as MarketingCampaignStatus,
    channel_chat: Boolean(r.channel_chat),
    channel_email: Boolean(r.channel_email),
    segment_json:
      r.segment_json && typeof r.segment_json === 'object' && !Array.isArray(r.segment_json)
        ? (r.segment_json as Record<string, unknown>)
        : {},
    template_subject: r.template_subject != null ? String(r.template_subject) : null,
    template_body_chat: String(r.template_body_chat ?? ''),
    template_body_email: r.template_body_email != null ? String(r.template_body_email) : null,
    offer_percent: r.offer_percent != null ? Number(r.offer_percent) : null,
    scheduled_at: r.scheduled_at != null ? String(r.scheduled_at) : null,
    started_at: r.started_at != null ? String(r.started_at) : null,
    completed_at: r.completed_at != null ? String(r.completed_at) : null,
    total_queued: Number(r.total_queued) || 0,
    sent_chat: Number(r.sent_chat) || 0,
    sent_email: Number(r.sent_email) || 0,
    skipped: Number(r.skipped) || 0,
    failed: Number(r.failed) || 0,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

function mapDeliveryRow(r: Record<string, unknown>): MarketingDeliveryRow {
  return {
    id: String(r.id),
    campaign_id: String(r.campaign_id),
    partner_id: String(r.partner_id),
    conversation_id: r.conversation_id != null ? String(r.conversation_id) : null,
    recipient_key: String(r.recipient_key),
    email: r.email != null ? String(r.email) : null,
    status: String(r.status) as MarketingDeliveryStatus,
    skip_reason: r.skip_reason != null ? String(r.skip_reason) : null,
    rendered_body_chat: r.rendered_body_chat != null ? String(r.rendered_body_chat) : null,
    rendered_body_email: r.rendered_body_email != null ? String(r.rendered_body_email) : null,
    sent_chat_at: r.sent_chat_at != null ? String(r.sent_chat_at) : null,
    sent_email_at: r.sent_email_at != null ? String(r.sent_email_at) : null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  }
}

export async function insertMarketingCampaignFromPg(input: {
  partnerId: string
  createdByUserId: string
  segmentJson: Record<string, unknown>
  templateBodyChat: string
  offerPercent?: number | null
  channelEmail?: boolean
  templateBodyEmail?: string | null
}): Promise<MarketingCampaignRow | null> {
  if (!isPgConfigured()) return null
  const pct =
    input.offerPercent != null
      ? Math.max(0, Math.min(100, Math.floor(Number(input.offerPercent) || 0)))
      : null
  const emailIntro =
    input.templateBodyEmail != null ? input.templateBodyEmail.trim().slice(0, 2000) || null : null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `insert into public.messaging_partner_marketing_campaigns (
        partner_id, created_by_user_id, status, segment_json, template_body_chat, offer_percent, channel_email, template_body_email
      ) values ($1::uuid, $2::uuid, 'draft', $3::jsonb, $4, $5, $6, $7)
      returning ${CAMPAIGN_SELECT}`,
      [
        input.partnerId,
        input.createdByUserId,
        JSON.stringify(input.segmentJson),
        input.templateBodyChat.slice(0, 8000),
        pct,
        Boolean(input.channelEmail),
        emailIntro,
      ]
    )
    return row ? mapCampaignRow(row) : null
  } catch (e) {
    console.warn('[insertMarketingCampaignFromPg]', e)
    return null
  }
}

export async function fetchMarketingCampaignForPartnerFromPg(
  partnerId: string,
  campaignId: string
): Promise<MarketingCampaignRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select ${CAMPAIGN_SELECT}
       from public.messaging_partner_marketing_campaigns
       where id = $1::uuid and partner_id = $2::uuid
       limit 1`,
      [campaignId, partnerId]
    )
    return row ? mapCampaignRow(row) : null
  } catch (e) {
    console.warn('[fetchMarketingCampaignForPartnerFromPg]', e)
    return null
  }
}

export async function listMarketingCampaignsForPartnerFromPg(
  partnerId: string,
  limit = 20
): Promise<MarketingCampaignRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select ${CAMPAIGN_SELECT}
       from public.messaging_partner_marketing_campaigns
       where partner_id = $1::uuid
       order by created_at desc
       limit $2`,
      [partnerId, Math.max(1, Math.min(50, limit))]
    )
    return rows.map(mapCampaignRow)
  } catch (e) {
    console.warn('[listMarketingCampaignsForPartnerFromPg]', e)
    return []
  }
}

export async function updateMarketingCampaignTemplateFromPg(
  campaignId: string,
  partnerId: string,
  templateBodyChat: string,
  offerPercent?: number | null,
  opts?: { channelEmail?: boolean; templateBodyEmail?: string | null }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pct =
    offerPercent != null
      ? Math.max(0, Math.min(100, Math.floor(Number(offerPercent) || 0)))
      : null
  const channelEmail = opts?.channelEmail == null ? null : Boolean(opts.channelEmail)
  const emailIntro =
    opts?.templateBodyEmail == null ? null : opts.templateBodyEmail.trim().slice(0, 2000) || null
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_campaigns
       set template_body_chat = $3,
           offer_percent = $4,
           channel_email = coalesce($5, channel_email),
           template_body_email = case when $5 is null then template_body_email else $6 end,
           updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid and status = 'draft'`,
      [campaignId, partnerId, templateBodyChat.slice(0, 8000), pct, channelEmail, emailIntro]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[updateMarketingCampaignTemplateFromPg]', e)
    return false
  }
}

export async function listMarketingSegmentRecipientsFromPg(input: {
  partnerId: string
  daysSinceChat: number
  requireHasOrder?: boolean
  limit?: number
}): Promise<MarketingSegmentRecipientRow[]> {
  if (!isPgConfigured()) return []
  const days = Math.max(1, Math.min(365, Math.floor(input.daysSinceChat) || 90))
  const lim = Math.max(1, Math.min(5000, Math.floor(input.limit ?? 5000)))
  const orderClause = input.requireHasOrder
    ? `and exists (
         select 1 from public.messaging_partner_orders o
         where o.conversation_id = c.id and o.partner_id = $1::uuid
       )`
    : `and (
         c.updated_at >= now() - ($2::int || ' days')::interval
         or c.last_message_at >= now() - ($2::int || ' days')::interval
         or exists (
           select 1 from public.messaging_partner_orders o
           where o.conversation_id = c.id and o.partner_id = $1::uuid
         )
       )`
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select distinct on (recipient_key)
         c.id::text as conversation_id,
         case
           when c.linked_user_id is not null then 'user:' || c.linked_user_id::text
           when c.guest_account_id is not null then 'guest:' || c.guest_account_id::text
           else 'thread:' || c.external_thread_id
         end as recipient_key,
         c.linked_user_id::text,
         c.guest_account_id::text,
         c.customer_name,
         c.external_thread_id,
         c.metadata,
         c.last_message_at::text
       from public.customer_care_conversations c
       where c.partner_id = $1::uuid
         and c.channel = 'widget'
         and exists (
           select 1
           from public.customer_care_messages m
           where m.conversation_id = c.id
             and m.direction = 'inbound'
             and coalesce(m.raw_payload ->> 'widget_auto_opening', 'false') <> 'true'
             and nullif(trim(replace(replace(coalesce(m.body, ''), '📷', ''), '📦', '')), '') is not null
         )
         ${orderClause}
       order by recipient_key, c.last_message_at desc nulls last
       limit $3`,
      [input.partnerId, days, lim]
    )
    return rows.map((r) => ({
      conversation_id: String(r.conversation_id),
      recipient_key: String(r.recipient_key),
      linked_user_id: r.linked_user_id != null ? String(r.linked_user_id) : null,
      guest_account_id: r.guest_account_id != null ? String(r.guest_account_id) : null,
      customer_name: r.customer_name != null ? String(r.customer_name) : null,
      external_thread_id: String(r.external_thread_id),
      metadata:
        r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)
          ? (r.metadata as Record<string, unknown>)
          : null,
      last_message_at: r.last_message_at != null ? String(r.last_message_at) : null,
    }))
  } catch (e) {
    console.warn('[listMarketingSegmentRecipientsFromPg]', e)
    return []
  }
}

export async function countMarketingSegmentRecipientsFromPg(input: {
  partnerId: string
  daysSinceChat: number
  requireHasOrder?: boolean
}): Promise<number> {
  const rows = await listMarketingSegmentRecipientsFromPg({ ...input, limit: 5000 })
  return rows.length
}

export async function bulkInsertMarketingDeliveriesFromPg(
  campaignId: string,
  partnerId: string,
  recipients: Array<{ conversationId: string; recipientKey: string }>
): Promise<number> {
  if (!isPgConfigured() || recipients.length === 0) return 0
  try {
    const pool = getPgPool()
    let inserted = 0
    const chunk = 100
    for (let i = 0; i < recipients.length; i += chunk) {
      const slice = recipients.slice(i, i + chunk)
      const values: string[] = []
      const params: unknown[] = [campaignId, partnerId]
      slice.forEach((r, idx) => {
        const base = idx * 2 + 3
        values.push(`($1::uuid, $2::uuid, $${base}::uuid, $${base + 1})`)
        params.push(r.conversationId, r.recipientKey)
      })
      const res = await pool.query(
        `insert into public.messaging_partner_marketing_deliveries (
           campaign_id, partner_id, conversation_id, recipient_key, status
         ) values ${values.join(', ')}
         on conflict (campaign_id, recipient_key) do nothing`,
        params
      )
      inserted += res.rowCount ?? 0
    }
    return inserted
  } catch (e) {
    console.warn('[bulkInsertMarketingDeliveriesFromPg]', e)
    return 0
  }
}

export async function queueMarketingCampaignFromPg(
  campaignId: string,
  partnerId: string,
  totalQueued: number
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_campaigns
       set status = 'queued',
           total_queued = $3,
           updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid and status = 'draft'`,
      [campaignId, partnerId, totalQueued]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[queueMarketingCampaignFromPg]', e)
    return false
  }
}

export async function cancelMarketingCampaignFromPg(
  campaignId: string,
  partnerId: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_campaigns
       set status = 'cancelled', updated_at = now(), completed_at = now()
       where id = $1::uuid and partner_id = $2::uuid
         and status in ('queued', 'running')`,
      [campaignId, partnerId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[cancelMarketingCampaignFromPg]', e)
    return false
  }
}

export async function fetchRunningOrQueuedMarketingCampaignFromPg(): Promise<MarketingCampaignRow | null> {
  if (!isPgConfigured()) return null
  try {
    const running = await pgQueryOne<Record<string, unknown>>(
      `select ${CAMPAIGN_SELECT}
       from public.messaging_partner_marketing_campaigns
       where status = 'running'
       order by started_at asc nulls last
       limit 1`
    )
    if (running) return mapCampaignRow(running)

    const queued = await pgQueryOne<Record<string, unknown>>(
      `select ${CAMPAIGN_SELECT}
       from public.messaging_partner_marketing_campaigns
       where status = 'queued'
       order by created_at asc
       limit 1`
    )
    if (!queued) return null

    const promoted = await pgQueryOne<Record<string, unknown>>(
      `update public.messaging_partner_marketing_campaigns
       set status = 'running', started_at = now(), updated_at = now()
       where id = $1::uuid and status = 'queued'
       returning ${CAMPAIGN_SELECT}`,
      [queued.id]
    )
    return promoted ? mapCampaignRow(promoted) : null
  } catch (e) {
    console.warn('[fetchRunningOrQueuedMarketingCampaignFromPg]', e)
    return null
  }
}

export async function fetchPendingMarketingDeliveriesFromPg(
  campaignId: string,
  limit = 25
): Promise<MarketingDeliveryRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, campaign_id::text, partner_id::text, conversation_id::text,
              recipient_key, email, status, skip_reason,
              rendered_body_chat, rendered_body_email,
              sent_chat_at::text, sent_email_at::text,
              created_at::text, updated_at::text
       from public.messaging_partner_marketing_deliveries
       where campaign_id = $1::uuid and status = 'pending'
       order by created_at asc
       limit $2`,
      [campaignId, Math.max(1, Math.min(50, limit))]
    )
    return rows.map(mapDeliveryRow)
  } catch (e) {
    console.warn('[fetchPendingMarketingDeliveriesFromPg]', e)
    return []
  }
}

export async function countPendingMarketingDeliveriesFromPg(campaignId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ n: string }>(
      `select count(*)::text as n
       from public.messaging_partner_marketing_deliveries
       where campaign_id = $1::uuid and status = 'pending'`,
      [campaignId]
    )
    return Number(row?.n) || 0
  } catch (e) {
    console.warn('[countPendingMarketingDeliveriesFromPg]', e)
    return 0
  }
}

export async function hasRecentMarketingSentSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  withinDays: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const days = Math.max(1, Math.min(90, Math.floor(input.withinDays) || 14))
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.messaging_partner_marketing_sent_slots
       where partner_id = $1::uuid
         and recipient_key = $2
         and sent_at >= now() - ($3::int || ' days')::interval
       limit 1`,
      [input.partnerId, input.recipientKey.slice(0, 128), days]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[hasRecentMarketingSentSlotFromPg]', e)
    return false
  }
}

export async function tryClaimMarketingSentSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  campaignKey: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const r = await pool.query<{ id: string }>(
      `insert into public.messaging_partner_marketing_sent_slots (partner_id, recipient_key, campaign_key)
       values ($1::uuid, $2, $3)
       on conflict (partner_id, recipient_key, campaign_key) do nothing
       returning id::text`,
      [input.partnerId, input.recipientKey.slice(0, 128), input.campaignKey.slice(0, 64)]
    )
    return r.rowCount === 1
  } catch (e) {
    console.warn('[tryClaimMarketingSentSlotFromPg]', e)
    return false
  }
}

export async function markMarketingDeliverySkippedFromPg(
  deliveryId: string,
  skipReason: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_deliveries d
       set status = 'skipped',
           skip_reason = $2,
           updated_at = now()
       from public.messaging_partner_marketing_campaigns c
       where d.id = $1::uuid and d.campaign_id = c.id
       returning c.id::text as campaign_id`,
      [deliveryId, skipReason.slice(0, 64)]
    )
    if ((res.rowCount ?? 0) === 0) return false
    const campaignId = res.rows[0]?.campaign_id
    if (campaignId) {
      await getPgPool().query(
        `update public.messaging_partner_marketing_campaigns
         set skipped = skipped + 1, updated_at = now()
         where id = $1::uuid`,
        [campaignId]
      )
    }
    return true
  } catch (e) {
    console.warn('[markMarketingDeliverySkippedFromPg]', e)
    return false
  }
}

export async function markMarketingDeliverySentChatFromPg(
  deliveryId: string,
  renderedBody: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_deliveries d
       set status = 'sent_chat',
           rendered_body_chat = $2,
           sent_chat_at = now(),
           updated_at = now()
       from public.messaging_partner_marketing_campaigns c
       where d.id = $1::uuid and d.campaign_id = c.id
       returning c.id::text as campaign_id`,
      [deliveryId, renderedBody.slice(0, 8000)]
    )
    if ((res.rowCount ?? 0) === 0) return false
    const campaignId = res.rows[0]?.campaign_id
    if (campaignId) {
      await getPgPool().query(
        `update public.messaging_partner_marketing_campaigns
         set sent_chat = sent_chat + 1, updated_at = now()
         where id = $1::uuid`,
        [campaignId]
      )
    }
    return true
  } catch (e) {
    console.warn('[markMarketingDeliverySentChatFromPg]', e)
    return false
  }
}

export async function markMarketingDeliveryFailedFromPg(
  deliveryId: string,
  reason: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_deliveries d
       set status = 'failed',
           skip_reason = $2,
           updated_at = now()
       from public.messaging_partner_marketing_campaigns c
       where d.id = $1::uuid and d.campaign_id = c.id
       returning c.id::text as campaign_id`,
      [deliveryId, reason.slice(0, 64)]
    )
    if ((res.rowCount ?? 0) === 0) return false
    const campaignId = res.rows[0]?.campaign_id
    if (campaignId) {
      await getPgPool().query(
        `update public.messaging_partner_marketing_campaigns
         set failed = failed + 1, updated_at = now()
         where id = $1::uuid`,
        [campaignId]
      )
    }
    return true
  } catch (e) {
    console.warn('[markMarketingDeliveryFailedFromPg]', e)
    return false
  }
}

export async function completeMarketingCampaignFromPg(campaignId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_campaigns
       set status = 'completed', completed_at = now(), updated_at = now()
       where id = $1::uuid and status = 'running'`,
      [campaignId]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.warn('[completeMarketingCampaignFromPg]', e)
    return false
  }
}

export async function listMarketingDeliveriesForCampaignFromPg(
  campaignId: string,
  limit = 100
): Promise<MarketingDeliveryRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, campaign_id::text, partner_id::text, conversation_id::text,
              recipient_key, email, status, skip_reason,
              rendered_body_chat, rendered_body_email,
              sent_chat_at::text, sent_email_at::text,
              created_at::text, updated_at::text
       from public.messaging_partner_marketing_deliveries
       where campaign_id = $1::uuid
       order by created_at asc
       limit $2`,
      [campaignId, Math.max(1, Math.min(500, limit))]
    )
    return rows.map(mapDeliveryRow)
  } catch (e) {
    console.warn('[listMarketingDeliveriesForCampaignFromPg]', e)
    return []
  }
}

/** Đã gửi thành công chat + email — cập nhật cả hai và tăng sent_email. */
export async function markMarketingDeliverySentChatEmailFromPg(input: {
  deliveryId: string
  renderedBodyChat: string
  renderedBodyEmail: string
  email: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const res = await getPgPool().query(
      `update public.messaging_partner_marketing_deliveries d
       set status = 'sent_chat_email',
           rendered_body_chat = $2,
           rendered_body_email = $3,
           email = $4,
           sent_chat_at = coalesce(sent_chat_at, now()),
           sent_email_at = now(),
           updated_at = now()
       from public.messaging_partner_marketing_campaigns c
       where d.id = $1::uuid and d.campaign_id = c.id
       returning c.id::text as campaign_id`,
      [
        input.deliveryId,
        input.renderedBodyChat.slice(0, 8000),
        input.renderedBodyEmail.slice(0, 8000),
        input.email.slice(0, 256),
      ]
    )
    if ((res.rowCount ?? 0) === 0) return false
    const campaignId = res.rows[0]?.campaign_id
    if (campaignId) {
      await getPgPool().query(
        `update public.messaging_partner_marketing_campaigns
         set sent_email = sent_email + 1, updated_at = now()
         where id = $1::uuid`,
        [campaignId]
      )
    }
    return true
  } catch (e) {
    console.warn('[markMarketingDeliverySentChatEmailFromPg]', e)
    return false
  }
}

export async function hasMarketingOptOutFromPg(input: {
  partnerId: string
  recipientKey: string
  email?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const email = input.email?.trim().toLowerCase() || null
    const row = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.messaging_partner_marketing_opt_out
       where partner_id = $1::uuid
         and (recipient_key = $2 or ($3 is not null and email_normalized = $3))
       limit 1`,
      [input.partnerId, input.recipientKey.slice(0, 128), email]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[hasMarketingOptOutFromPg]', e)
    return false
  }
}

export async function insertMarketingOptOutFromPg(input: {
  partnerId: string
  recipientKey: string
  emailNormalized?: string | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const email = input.emailNormalized?.trim().toLowerCase() || null
    await getPgPool().query(
      `insert into public.messaging_partner_marketing_opt_out (partner_id, recipient_key, email_normalized)
       values ($1::uuid, $2, $3)
       on conflict (partner_id, recipient_key)
       do update set email_normalized = coalesce(excluded.email_normalized, public.messaging_partner_marketing_opt_out.email_normalized),
                     opted_out_at = now()`,
      [input.partnerId, input.recipientKey.slice(0, 128), email]
    )
    return true
  } catch (e) {
    console.warn('[insertMarketingOptOutFromPg]', e)
    return false
  }
}

export async function countMarketingOptOutForPartnerFromPg(partnerId: string): Promise<number> {
  if (!isPgConfigured()) return 0
  try {
    const row = await pgQueryOne<{ n: string }>(
      `select count(*)::text as n
       from public.messaging_partner_marketing_opt_out
       where partner_id = $1::uuid`,
      [partnerId]
    )
    return Number(row?.n) || 0
  } catch (e) {
    console.warn('[countMarketingOptOutForPartnerFromPg]', e)
    return 0
  }
}

/** Cooldown email marketing (mặc định 7 ngày) — namespace 'email:' tách khỏi slot chat. */
export async function hasRecentMarketingEmailSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  withinDays: number
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const days = Math.max(1, Math.min(60, Math.floor(input.withinDays) || 7))
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text
       from public.messaging_partner_marketing_sent_slots
       where partner_id = $1::uuid
         and recipient_key = $2
         and campaign_key like 'email:%'
         and sent_at >= now() - ($3::int || ' days')::interval
       limit 1`,
      [input.partnerId, input.recipientKey.slice(0, 128), days]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[hasRecentMarketingEmailSlotFromPg]', e)
    return false
  }
}

export async function tryClaimMarketingEmailSlotFromPg(input: {
  partnerId: string
  recipientKey: string
  campaignId: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const r = await getPgPool().query<{ id: string }>(
      `insert into public.messaging_partner_marketing_sent_slots (partner_id, recipient_key, campaign_key)
       values ($1::uuid, $2, $3)
       on conflict (partner_id, recipient_key, campaign_key) do nothing
       returning id::text`,
      [input.partnerId, input.recipientKey.slice(0, 128), `email:${input.campaignId}`.slice(0, 64)]
    )
    return r.rowCount === 1
  } catch (e) {
    console.warn('[tryClaimMarketingEmailSlotFromPg]', e)
    return false
  }
}

export async function fetchConversationForMarketingDeliveryFromPg(
  partnerId: string,
  conversationId: string
): Promise<MarketingSegmentRecipientRow | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select c.id::text as conversation_id,
         case
           when c.linked_user_id is not null then 'user:' || c.linked_user_id::text
           when c.guest_account_id is not null then 'guest:' || c.guest_account_id::text
           else 'thread:' || c.external_thread_id
         end as recipient_key,
         c.linked_user_id::text,
         c.guest_account_id::text,
         c.customer_name,
         c.external_thread_id,
         c.metadata,
         c.last_message_at::text
       from public.customer_care_conversations c
       where c.id = $1::uuid and c.partner_id = $2::uuid and c.channel = 'widget'
       limit 1`,
      [conversationId, partnerId]
    )
    if (!row) return null
    return {
      conversation_id: String(row.conversation_id),
      recipient_key: String(row.recipient_key),
      linked_user_id: row.linked_user_id != null ? String(row.linked_user_id) : null,
      guest_account_id: row.guest_account_id != null ? String(row.guest_account_id) : null,
      customer_name: row.customer_name != null ? String(row.customer_name) : null,
      external_thread_id: String(row.external_thread_id),
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      last_message_at: row.last_message_at != null ? String(row.last_message_at) : null,
    }
  } catch (e) {
    console.warn('[fetchConversationForMarketingDeliveryFromPg]', e)
    return null
  }
}

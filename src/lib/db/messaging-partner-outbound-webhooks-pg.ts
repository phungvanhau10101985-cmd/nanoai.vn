import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import {
  PARTNER_OUTBOUND_WEBHOOK_EVENTS,
  type PartnerOutboundWebhookEvent,
} from '@/lib/messaging/partner-outbound-webhook-types'

export type PartnerOutboundWebhookRow = {
  partnerId: string
  webhookUrl: string
  webhookSecret: string
  isEnabled: boolean
  events: PartnerOutboundWebhookEvent[]
  updatedAt: string
}

const DEFAULT_EVENTS: PartnerOutboundWebhookEvent[] = [...PARTNER_OUTBOUND_WEBHOOK_EVENTS]

function parseEvents(raw: unknown): PartnerOutboundWebhookEvent[] {
  if (!Array.isArray(raw)) return DEFAULT_EVENTS
  const allowed = new Set<string>(PARTNER_OUTBOUND_WEBHOOK_EVENTS)
  const out = raw
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x): x is PartnerOutboundWebhookEvent => allowed.has(x))
  return out.length > 0 ? out : DEFAULT_EVENTS
}

function mapRow(r: {
  partner_id: string
  webhook_url: string | null
  webhook_secret: string | null
  is_enabled: boolean | null
  events: unknown
  updated_at: unknown
}): PartnerOutboundWebhookRow {
  return {
    partnerId: r.partner_id,
    webhookUrl: String(r.webhook_url ?? '').trim(),
    webhookSecret: String(r.webhook_secret ?? ''),
    isEnabled: r.is_enabled === true,
    events: parseEvents(r.events),
    updatedAt: String(r.updated_at ?? ''),
  }
}

export async function fetchPartnerOutboundWebhookFromPg(
  partnerId: string
): Promise<PartnerOutboundWebhookRow | null> {
  if (!isPgConfigured()) return null
  const pid = partnerId.trim()
  if (!pid) return null
  try {
    const row = await pgQueryOne<Parameters<typeof mapRow>[0]>(
      `select partner_id::text, webhook_url, webhook_secret, is_enabled, events, updated_at
       from public.messaging_partner_outbound_webhooks
       where partner_id = $1::uuid
       limit 1`,
      [pid]
    )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[fetchPartnerOutboundWebhookFromPg]', e)
    return null
  }
}

export async function upsertPartnerOutboundWebhookFromPg(input: {
  partnerId: string
  webhookUrl: string
  isEnabled: boolean
  events: PartnerOutboundWebhookEvent[]
  webhookSecret?: string | null
}): Promise<PartnerOutboundWebhookRow | null> {
  if (!isPgConfigured()) return null
  const pid = input.partnerId.trim()
  if (!pid) return null
  const events = input.events.filter((e) =>
    (PARTNER_OUTBOUND_WEBHOOK_EVENTS as readonly string[]).includes(e)
  )
  const eventsJson = JSON.stringify(events.length > 0 ? events : DEFAULT_EVENTS)
  const secretProvided = input.webhookSecret != null && String(input.webhookSecret).trim().length > 0
  try {
    const row = secretProvided
      ? await pgQueryOne<Parameters<typeof mapRow>[0]>(
          `insert into public.messaging_partner_outbound_webhooks (
             partner_id, webhook_url, is_enabled, events, webhook_secret, updated_at
           ) values ($1::uuid, $2, $3, $4::jsonb, $5, now())
           on conflict (partner_id) do update set
             webhook_url = excluded.webhook_url,
             is_enabled = excluded.is_enabled,
             events = excluded.events,
             webhook_secret = excluded.webhook_secret,
             updated_at = now()
           returning partner_id::text, webhook_url, webhook_secret, is_enabled, events, updated_at`,
          [pid, input.webhookUrl.trim().slice(0, 2000), input.isEnabled, eventsJson, String(input.webhookSecret).trim().slice(0, 256)]
        )
      : await pgQueryOne<Parameters<typeof mapRow>[0]>(
          `insert into public.messaging_partner_outbound_webhooks (
             partner_id, webhook_url, is_enabled, events, updated_at
           ) values ($1::uuid, $2, $3, $4::jsonb, now())
           on conflict (partner_id) do update set
             webhook_url = excluded.webhook_url,
             is_enabled = excluded.is_enabled,
             events = excluded.events,
             updated_at = now()
           returning partner_id::text, webhook_url, webhook_secret, is_enabled, events, updated_at`,
          [pid, input.webhookUrl.trim().slice(0, 2000), input.isEnabled, eventsJson]
        )
    return row ? mapRow(row) : null
  } catch (e) {
    console.warn('[upsertPartnerOutboundWebhookFromPg]', e)
    return null
  }
}

export async function setPartnerOutboundWebhookSecretFromPg(
  partnerId: string,
  secret: string
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const pid = partnerId.trim()
  const sec = secret.trim()
  if (!pid || !sec) return false
  try {
    await pgQueryOne(
      `insert into public.messaging_partner_outbound_webhooks (partner_id, webhook_secret, updated_at)
       values ($1::uuid, $2, now())
       on conflict (partner_id) do update set
         webhook_secret = excluded.webhook_secret,
         updated_at = now()`,
      [pid, sec.slice(0, 256)]
    )
    return true
  } catch (e) {
    console.warn('[setPartnerOutboundWebhookSecretFromPg]', e)
    return false
  }
}

export async function peekPartnerOutboundWebhookSecretFromPg(
  partnerId: string
): Promise<{ secret: string } | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ webhook_secret: string | null }>(
      `select webhook_secret from public.messaging_partner_outbound_webhooks
       where partner_id = $1::uuid limit 1`,
      [partnerId.trim()]
    )
    if (!row) return { secret: '' }
    return { secret: String(row.webhook_secret ?? '').trim() }
  } catch (e) {
    console.warn('[peekPartnerOutboundWebhookSecretFromPg]', e)
    return null
  }
}

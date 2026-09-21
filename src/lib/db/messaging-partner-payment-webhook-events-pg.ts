import { createHash, randomUUID } from 'node:crypto'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

export function partnerPaymentWebhookEventId(input: {
  transactionId?: string | null
  rawBody: string
}): string {
  const transactionId = String(input.transactionId || '').trim()
  if (transactionId) return transactionId.slice(0, 300)
  return `sha256:${createHash('sha256').update(input.rawBody).digest('hex')}`
}

export function partnerPaymentWebhookClaimSql(): string {
  return `insert into public.messaging_partner_payment_webhook_events (
       partner_id, provider, provider_event_id, payload_hash, status, attempts, claim_token, created_at, updated_at
     ) values ($1::uuid, $2, $3, $4, 'processing', 1, $5::uuid, now(), now())
     on conflict (partner_id, provider, provider_event_id) do update
       set status = 'processing',
           attempts = messaging_partner_payment_webhook_events.attempts + 1,
           claim_token = excluded.claim_token,
           last_error = '',
           payload_hash = excluded.payload_hash,
           updated_at = now()
       where messaging_partner_payment_webhook_events.status = 'failed'
          or (
            messaging_partner_payment_webhook_events.status = 'processing'
            and messaging_partner_payment_webhook_events.updated_at < now() - interval '15 minutes'
          )
     returning id::text`
}

export function partnerPaymentWebhookEffectClaimSql(): string {
  return `insert into public.messaging_partner_payment_webhook_effects (
       event_id, effect_key, status, attempts, claim_token, claimed_at, updated_at
     ) values ($1::uuid, $2, 'running', 1, $3::uuid, now(), now())
     on conflict (event_id, effect_key) do update
       set status = 'running',
           attempts = messaging_partner_payment_webhook_effects.attempts + 1,
           claim_token = excluded.claim_token,
           claimed_at = now(),
           last_error = '',
           updated_at = now()
       where messaging_partner_payment_webhook_effects.status = 'failed'
          or (
            messaging_partner_payment_webhook_effects.status = 'running'
            and messaging_partner_payment_webhook_effects.claimed_at < now() - interval '15 minutes'
          )
     returning effect_key`
}

export async function claimPartnerPaymentWebhookEventFromPg(input: {
  partnerId: string
  provider: 'sepay'
  providerEventId: string
  payloadHash: string
}): Promise<{
  claimed: boolean
  eventId: string | null
  claimToken: string | null
  existingStatus: 'processing' | 'completed' | 'failed' | null
}> {
  if (!isPgConfigured()) {
    return { claimed: false, eventId: null, claimToken: null, existingStatus: null }
  }
  const claimToken = randomUUID()
  const row = await pgQueryOne<{ id: string }>(
    partnerPaymentWebhookClaimSql(),
    [input.partnerId, input.provider, input.providerEventId, input.payloadHash, claimToken]
  )
  return row?.id
    ? { claimed: true, eventId: row.id, claimToken, existingStatus: null }
    : {
        claimed: false,
        eventId: null,
        claimToken: null,
        existingStatus:
          (
            await pgQueryOne<{ status: 'processing' | 'completed' | 'failed' }>(
              `select status
               from public.messaging_partner_payment_webhook_events
               where partner_id = $1::uuid and provider = $2 and provider_event_id = $3`,
              [input.partnerId, input.provider, input.providerEventId]
            )
          )?.status ?? null,
      }
}

export async function completePartnerPaymentWebhookEventFromPg(input: {
  eventId: string
  claimToken: string
  orderId: string
}): Promise<void> {
  await pgQueryOne(
    `update public.messaging_partner_payment_webhook_events
     set status = 'completed', order_id = $2::uuid, completed_at = now(), updated_at = now()
     where id = $1::uuid and claim_token = $3::uuid and status = 'processing'
     returning id`,
    [input.eventId, input.orderId, input.claimToken]
  )
}

export async function failPartnerPaymentWebhookEventFromPg(input: {
  eventId: string
  claimToken: string
  error: string
}): Promise<void> {
  await pgQueryOne(
    `update public.messaging_partner_payment_webhook_events
     set status = 'failed', last_error = $2, updated_at = now()
     where id = $1::uuid and claim_token = $3::uuid and status = 'processing'
     returning id`,
    [input.eventId, input.error.slice(0, 1000), input.claimToken]
  )
}

export type PartnerPaymentWebhookEffectKey =
  | 'customer_chat'
  | 'payment_event'
  | 'customer_notification'
  | 'owner_notification'
  | 'affiliate_grant'

export async function runPartnerPaymentWebhookEffectOnceFromPg<T>(input: {
  eventId: string
  effectKey: PartnerPaymentWebhookEffectKey
  run: () => Promise<T>
}): Promise<{ ran: boolean; value?: T }> {
  const claimToken = randomUUID()
  const claimed = await pgQueryOne<{ effect_key: string }>(
    partnerPaymentWebhookEffectClaimSql(),
    [input.eventId, input.effectKey, claimToken]
  )
  if (!claimed) {
    const existing = await pgQueryOne<{ status: 'running' | 'completed' | 'failed' }>(
      `select status
       from public.messaging_partner_payment_webhook_effects
       where event_id = $1::uuid and effect_key = $2`,
      [input.eventId, input.effectKey]
    )
    if (existing?.status === 'completed') return { ran: false }
    throw new Error(`Payment webhook effect ${input.effectKey} is already running; retry later.`)
  }
  try {
    const value = await input.run()
    await pgQuery(
      `update public.messaging_partner_payment_webhook_effects
       set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
       where event_id = $1::uuid and effect_key = $2
         and claim_token = $3::uuid and status = 'running'`,
      [input.eventId, input.effectKey, claimToken]
    )
    return { ran: true, value }
  } catch (error) {
    await pgQuery(
      `update public.messaging_partner_payment_webhook_effects
       set status = 'failed', last_error = $4, updated_at = now()
       where event_id = $1::uuid and effect_key = $2
         and claim_token = $3::uuid and status = 'running'`,
      [input.eventId, input.effectKey, claimToken, String(error || 'unknown error').slice(0, 1000)]
    )
    throw error
  }
}

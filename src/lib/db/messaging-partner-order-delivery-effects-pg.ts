import { randomUUID } from 'node:crypto'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'

export type PartnerOrderDeliveryEffectKey =
  | 'customer_notification'
  | 'review_invitation'
  | 'first_order_promotion'
  | 'affiliate_confirmation'

export function partnerOrderDeliveryEffectClaimSql(): string {
  return `insert into public.messaging_partner_order_delivery_effects (
       order_id, effect_key, status, attempts, claim_token, claimed_at, updated_at
     ) values ($1::uuid, $2, 'running', 1, $3::uuid, now(), now())
     on conflict (order_id, effect_key) do update
       set status = 'running',
           attempts = messaging_partner_order_delivery_effects.attempts + 1,
           claim_token = excluded.claim_token,
           claimed_at = now(),
           last_error = '',
           updated_at = now()
       where messaging_partner_order_delivery_effects.status = 'failed'
          or (
            messaging_partner_order_delivery_effects.status = 'running'
            and messaging_partner_order_delivery_effects.claimed_at < now() - interval '15 minutes'
          )
     returning order_id::text`
}

export function partnerOrderDeliveryEffectFinishSql(): string {
  return `update public.messaging_partner_order_delivery_effects
     set status = $4,
         completed_at = case when $4 = 'completed' then coalesce(completed_at, now()) else completed_at end,
         last_error = $5,
         updated_at = now()
     where order_id = $1::uuid and effect_key = $2
       and claim_token = $3::uuid and status = 'running'`
}

export async function claimPartnerOrderDeliveryEffectFromPg(input: {
  orderId: string
  effectKey: PartnerOrderDeliveryEffectKey
}): Promise<{ claimed: boolean; claimToken: string | null }> {
  if (!isPgConfigured()) return { claimed: false, claimToken: null }
  const claimToken = randomUUID()
  const row = await pgQueryOne<{ order_id: string }>(
    partnerOrderDeliveryEffectClaimSql(),
    [input.orderId, input.effectKey, claimToken]
  )
  return row?.order_id
    ? { claimed: true, claimToken }
    : { claimed: false, claimToken: null }
}

export async function finishPartnerOrderDeliveryEffectFromPg(input: {
  orderId: string
  effectKey: PartnerOrderDeliveryEffectKey
  claimToken: string
  ok: boolean
  error?: unknown
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    partnerOrderDeliveryEffectFinishSql(),
    [
      input.orderId,
      input.effectKey,
      input.claimToken,
      input.ok ? 'completed' : 'failed',
      input.ok ? '' : String(input.error || 'unknown error').slice(0, 1000),
    ]
  )
}

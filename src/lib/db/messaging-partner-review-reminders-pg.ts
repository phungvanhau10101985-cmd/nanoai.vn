import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

const CLAIM_STALE_MINUTES = 15

type ReviewMailKind = 'delivered' | 'reminder'

function claimColumns(kind: ReviewMailKind): { claimed: string; sent: string } {
  return kind === 'delivered'
    ? {
        claimed: 'delivered_review_email_claimed_at',
        sent: 'delivered_review_email_sent_at',
      }
    : {
        claimed: 'review_reminder_claimed_at',
        sent: 'review_reminder_sent_at',
      }
}

/** Atomic, retryable send claim shared by customer-confirm, carrier and admin delivery paths. */
export async function claimPartnerOrderReviewMailFromPg(
  orderId: string,
  kind: ReviewMailKind
): Promise<boolean> {
  if (!isPgConfigured()) return false
  const cols = claimColumns(kind)
  const row = await pgQueryOne<{ id: string }>(
    `update public.messaging_partner_orders
     set ${cols.claimed} = now(),
         delivered_at = coalesce(delivered_at, now())
     where id = $1::uuid
       and status <> 'cancelled'
       and shipping_status = 'delivered'
       and ${cols.sent} is null
       and (
         ${cols.claimed} is null
         or ${cols.claimed} < now() - ($2::int * interval '1 minute')
       )
     returning id::text`,
    [orderId, CLAIM_STALE_MINUTES]
  )
  return Boolean(row?.id)
}

export async function finishPartnerOrderReviewMailClaimFromPg(input: {
  orderId: string
  kind: ReviewMailKind
  sent: boolean
}): Promise<void> {
  if (!isPgConfigured()) return
  const cols = claimColumns(input.kind)
  await pgQuery(
    `update public.messaging_partner_orders
     set ${cols.claimed} = null,
         ${cols.sent} = case when $2 then coalesce(${cols.sent}, now()) else ${cols.sent} end
     where id = $1::uuid`,
    [input.orderId, input.sent]
  )
}

export async function listPartnerOrderReviewReminderCandidatesFromPg(
  limit = 40
): Promise<Array<{ orderId: string; partnerId: string }>> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery<{ id: string; partner_id: string }>(
    `select id::text, partner_id::text
     from public.messaging_partner_orders
     where status <> 'cancelled'
       and shipping_status = 'delivered'
       and delivered_at is not null
       and delivered_at <= now() - interval '3 days'
       and delivered_at >= now() - interval '7 days'
       and review_reminder_sent_at is null
       and trim(coalesce(customer_email, '')) <> ''
       and exists (
         select 1
         from public.messaging_partner_order_lines l
         where l.order_id = messaging_partner_orders.id
           and l.product_inventory_id is not null
           and not exists (
             select 1
             from public.messaging_partner_product_reviews r
             where r.order_line_id = l.id
               and r.is_imported = false
           )
       )
     order by delivered_at asc, id asc
     limit $1`,
    [Math.max(1, Math.min(200, Math.floor(limit)))]
  )
  return rows.map((row) => ({ orderId: row.id, partnerId: row.partner_id }))
}

/** 188 parity: do not remind an order after every reviewable line has a real review. */
export async function partnerOrderHasUnreviewedProductsFromPg(orderId: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  const row = await pgQueryOne<{ exists: boolean }>(
    `select exists (
       select 1
       from public.messaging_partner_order_lines l
       where l.order_id = $1::uuid
         and l.product_inventory_id is not null
         and not exists (
           select 1
           from public.messaging_partner_product_reviews r
           where r.order_line_id = l.id
             and r.is_imported = false
         )
     ) as exists`,
    [orderId]
  )
  return Boolean(row?.exists)
}

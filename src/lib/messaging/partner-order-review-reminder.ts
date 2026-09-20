import { fetchPartnerOrderByIdForPartnerFromPg, type PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import {
  claimPartnerOrderReviewMailFromPg,
  finishPartnerOrderReviewMailClaimFromPg,
  listPartnerOrderReviewReminderCandidatesFromPg,
  partnerOrderHasUnreviewedProductsFromPg,
} from '@/lib/db/messaging-partner-review-reminders-pg'
import {
  emailCustomerOrderDeliveredReview,
  emailCustomerOrderReviewReminder,
} from '@/lib/messaging/partner-order-customer-email'

export const PARTNER_REVIEW_REMINDER_MIN_DAYS = 3
export const PARTNER_REVIEW_REMINDER_MAX_DAYS = 7

export function deliveredInPartnerReviewReminderWindow(
  deliveredAt: string | Date | null | undefined,
  now = new Date()
): boolean {
  if (!deliveredAt) return false
  const deliveredMs = new Date(deliveredAt).getTime()
  const nowMs = now.getTime()
  if (!Number.isFinite(deliveredMs) || !Number.isFinite(nowMs)) return false
  const ageDays = (nowMs - deliveredMs) / 86_400_000
  return ageDays >= PARTNER_REVIEW_REMINDER_MIN_DAYS && ageDays <= PARTNER_REVIEW_REMINDER_MAX_DAYS
}

/** Immediate invitation, exactly once across customer-confirm, carrier and admin delivery paths. */
export async function sendPartnerOrderDeliveredReviewOnce(input: {
  order: PartnerOrderRow
  customerLocale?: string | null
}): Promise<'sent' | 'already_claimed' | 'failed'> {
  const claimed = await claimPartnerOrderReviewMailFromPg(input.order.id, 'delivered')
  if (!claimed) return 'already_claimed'
  let sent = false
  try {
    sent = await emailCustomerOrderDeliveredReview({
      order: input.order,
      customerLocale: input.customerLocale,
      skipInApp: true,
    })
    return sent ? 'sent' : 'failed'
  } finally {
    await finishPartnerOrderReviewMailClaimFromPg({
      orderId: input.order.id,
      kind: 'delivered',
      sent,
    }).catch((error) => console.warn('[sendPartnerOrderDeliveredReviewOnce] finish claim', error))
  }
}

/** 188 parity: one follow-up in days 3-7, skipped when every line has already been reviewed. */
export async function runPartnerOrderReviewReminderBatch(limit = 40): Promise<{
  scanned: number
  sent: number
  skippedReviewed: number
  failed: number
}> {
  const candidates = await listPartnerOrderReviewReminderCandidatesFromPg(limit)
  let sent = 0
  let skippedReviewed = 0
  let failed = 0
  for (const candidate of candidates) {
    const hasUnreviewed = await partnerOrderHasUnreviewedProductsFromPg(candidate.orderId)
    if (!hasUnreviewed) {
      skippedReviewed += 1
      continue
    }
    const claimed = await claimPartnerOrderReviewMailFromPg(candidate.orderId, 'reminder')
    if (!claimed) continue
    let mailSent = false
    try {
      const order = await fetchPartnerOrderByIdForPartnerFromPg(candidate.partnerId, candidate.orderId)
      if (order) mailSent = await emailCustomerOrderReviewReminder({ order })
      if (mailSent) sent += 1
      else failed += 1
    } catch (error) {
      failed += 1
      console.warn('[runPartnerOrderReviewReminderBatch]', candidate.orderId, error)
    } finally {
      await finishPartnerOrderReviewMailClaimFromPg({
        orderId: candidate.orderId,
        kind: 'reminder',
        sent: mailSent,
      }).catch((error) => console.warn('[runPartnerOrderReviewReminderBatch] finish claim', error))
    }
  }
  return { scanned: candidates.length, sent, skippedReviewed, failed }
}

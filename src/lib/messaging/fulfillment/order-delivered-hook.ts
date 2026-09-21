import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import {
  claimPartnerOrderDeliveryEffectFromPg,
  finishPartnerOrderDeliveryEffectFromPg,
  type PartnerOrderDeliveryEffectKey,
} from '@/lib/db/messaging-partner-order-delivery-effects-pg'
import { notifyPartnerCustomerDeliveredWebApp } from '@/lib/messaging/partner-customer-webapp-notify'
import { sendPartnerOrderDeliveredReviewOnce } from '@/lib/messaging/partner-order-review-reminder'
import { processFirstDeliveredOrderPromotion } from '@/lib/messaging/partner-promotion-auto-grant'
import { runPartnerOrderLifecycleHook } from '@/lib/messaging/fulfillment/order-lifecycle-hook'

export type PartnerOrderDeliveredTrigger = 'ems' | 'customer' | 'admin'

export function deliveredEffectKeys(order: { conversation_id?: string | null }): PartnerOrderDeliveryEffectKey[] {
  return [
    'customer_notification',
    'review_invitation',
    ...(order.conversation_id ? (['first_order_promotion'] as const) : []),
    'affiliate_confirmation',
  ]
}

async function runEffect(input: {
  order: PartnerOrderRow
  trigger: PartnerOrderDeliveredTrigger
  customerLocale?: string | null
  effectKey: PartnerOrderDeliveryEffectKey
}): Promise<void> {
  if (input.effectKey === 'customer_notification') {
    await notifyPartnerCustomerDeliveredWebApp(
      input.order,
      input.trigger === 'customer' ? 'customer_confirm' : 'ems_auto',
      input.customerLocale
    )
    return
  }
  if (input.effectKey === 'review_invitation') {
    const result = await sendPartnerOrderDeliveredReviewOnce({
      order: input.order,
      customerLocale: input.customerLocale,
    })
    if (result === 'failed') throw new Error('Delivered review invitation failed.')
    return
  }
  if (input.effectKey === 'first_order_promotion') {
    if (!input.order.conversation_id) return
    await processFirstDeliveredOrderPromotion({
      partnerId: input.order.partner_id,
      orderId: input.order.id,
      conversationId: input.order.conversation_id,
      emailNormalized: input.order.customer_email,
    })
    return
  }
  await runPartnerOrderLifecycleHook({
    partnerId: input.order.partner_id,
    orderId: input.order.id,
    event: 'delivered',
  })
}

/** One retryable, per-effect idempotent hook for all delivered actors. */
export async function runPartnerOrderDeliveredHook(input: {
  order: PartnerOrderRow
  trigger: PartnerOrderDeliveredTrigger
  customerLocale?: string | null
}): Promise<{ completed: PartnerOrderDeliveryEffectKey[]; skipped: PartnerOrderDeliveryEffectKey[]; failed: PartnerOrderDeliveryEffectKey[] }> {
  const completed: PartnerOrderDeliveryEffectKey[] = []
  const skipped: PartnerOrderDeliveryEffectKey[] = []
  const failed: PartnerOrderDeliveryEffectKey[] = []
  for (const effectKey of deliveredEffectKeys(input.order)) {
    const claim = await claimPartnerOrderDeliveryEffectFromPg({ orderId: input.order.id, effectKey })
    if (!claim.claimed || !claim.claimToken) {
      skipped.push(effectKey)
      continue
    }
    try {
      await runEffect({ ...input, effectKey })
      await finishPartnerOrderDeliveryEffectFromPg({
        orderId: input.order.id,
        effectKey,
        claimToken: claim.claimToken,
        ok: true,
      })
      completed.push(effectKey)
    } catch (error) {
      await finishPartnerOrderDeliveryEffectFromPg({
        orderId: input.order.id,
        effectKey,
        claimToken: claim.claimToken,
        ok: false,
        error,
      })
      failed.push(effectKey)
      console.warn('[runPartnerOrderDeliveredHook]', input.order.id, effectKey, error)
    }
  }
  return { completed, skipped, failed }
}

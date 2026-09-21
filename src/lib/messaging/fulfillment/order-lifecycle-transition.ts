import { selectOptimizedFulfillmentOutcome } from '@/lib/messaging/fulfillment/optimized-fulfillment-runtime'

export type PartnerOrderPaymentStatus =
  | 'awaiting_payment'
  | 'payment_checking'
  | 'paid_verified'
  | 'pending_manual_review'
  | 'cancelled'

export type PartnerOrderShippingStatus =
  | 'pending'
  | 'confirmed'
  | 'packing'
  | 'shipping'
  | 'delivered'
  | 'returned'
  | 'cancelled'

const PAYMENT_TRANSITIONS: Record<PartnerOrderPaymentStatus, readonly PartnerOrderPaymentStatus[]> = {
  awaiting_payment: ['awaiting_payment', 'payment_checking', 'paid_verified', 'pending_manual_review', 'cancelled'],
  payment_checking: ['awaiting_payment', 'payment_checking', 'paid_verified', 'pending_manual_review', 'cancelled'],
  pending_manual_review: ['awaiting_payment', 'payment_checking', 'paid_verified', 'pending_manual_review', 'cancelled'],
  // A paid order can be cancelled operationally, but its payment receipt must
  // remain auditable. Refund status is the only axis allowed to reverse money.
  paid_verified: ['paid_verified'],
  cancelled: ['cancelled'],
}

const SHIPPING_TRANSITIONS: Record<PartnerOrderShippingStatus, readonly PartnerOrderShippingStatus[]> = {
  pending: ['pending', 'confirmed', 'packing', 'shipping', 'cancelled'],
  confirmed: ['confirmed', 'packing', 'shipping', 'cancelled'],
  packing: ['packing', 'shipping', 'cancelled'],
  shipping: ['shipping', 'delivered', 'returned', 'cancelled'],
  delivered: ['delivered', 'returned'],
  returned: ['returned'],
  cancelled: ['cancelled'],
}

export type PartnerOrderLifecycleState = {
  status: PartnerOrderPaymentStatus
  shippingStatus: PartnerOrderShippingStatus
}

/** Payment cancellation and carrier cancellation are separate state dimensions. */
export function canTransitionPartnerOrderPayment(
  current: PartnerOrderLifecycleState,
  next: PartnerOrderPaymentStatus
): boolean {
  if (!PAYMENT_TRANSITIONS[current.status].includes(next)) return false
  if (next === 'cancelled' && !['pending', 'confirmed', 'packing'].includes(current.shippingStatus)) return false
  return true
}

export function canTransitionPartnerOrderShipping(
  current: PartnerOrderLifecycleState,
  next: PartnerOrderShippingStatus
): boolean {
  if (current.status === 'cancelled' && next !== current.shippingStatus) return false
  return SHIPPING_TRANSITIONS[current.shippingStatus].includes(next)
}

export function selectPartnerOrderPaymentTransition(input: {
  partnerId: string
  current: PartnerOrderLifecycleState
  next: PartnerOrderPaymentStatus
}) {
  return selectOptimizedFulfillmentOutcome({
    tenantId: input.partnerId,
    operation: 'payment',
    legacy: () => true,
    optimized: () => canTransitionPartnerOrderPayment(input.current, input.next),
  })
}

export function selectPartnerOrderShippingTransition(input: {
  partnerId: string
  current: PartnerOrderLifecycleState
  next: PartnerOrderShippingStatus
}) {
  return selectOptimizedFulfillmentOutcome({
    tenantId: input.partnerId,
    operation: 'shipping',
    legacy: () => true,
    optimized: () => canTransitionPartnerOrderShipping(input.current, input.next),
  })
}

export function canCancelPartnerOrder(current: PartnerOrderLifecycleState): boolean {
  return canTransitionPartnerOrderPayment(current, 'cancelled')
}

export function partnerOrderCancellationAxis(
  current: PartnerOrderLifecycleState
): 'payment' | 'shipping' | null {
  if (current.status === 'cancelled' || current.shippingStatus === 'cancelled') return null
  if (canCancelPartnerOrder(current)) return 'payment'
  if (canTransitionPartnerOrderShipping(current, 'cancelled')) return 'shipping'
  return null
}

export function partnerOrderPaymentTransitionSql(statusParam = '$3'): string {
  return `(
    ${statusParam}::text = o.status
    or (
      o.status in ('awaiting_payment', 'payment_checking', 'pending_manual_review')
      and ${statusParam}::text in ('awaiting_payment', 'payment_checking', 'pending_manual_review', 'paid_verified', 'cancelled')
      and (${statusParam}::text <> 'cancelled' or coalesce(o.shipping_status, 'pending') in ('pending', 'confirmed', 'packing'))
    )
  )`
}

export function partnerOrderShippingTransitionSql(statusParam = '$3'): string {
  return `(
    ${statusParam}::text = coalesce(o.shipping_status, 'pending')
    or (
      o.status <> 'cancelled'
      and (
        (coalesce(o.shipping_status, 'pending') = 'pending' and ${statusParam}::text in ('confirmed', 'packing', 'shipping', 'cancelled'))
        or (coalesce(o.shipping_status, 'pending') = 'confirmed' and ${statusParam}::text in ('packing', 'shipping', 'cancelled'))
        or (coalesce(o.shipping_status, 'pending') = 'packing' and ${statusParam}::text in ('shipping', 'cancelled'))
        or (coalesce(o.shipping_status, 'pending') = 'shipping' and ${statusParam}::text in ('delivered', 'returned', 'cancelled'))
        or (coalesce(o.shipping_status, 'pending') = 'delivered' and ${statusParam}::text = 'returned')
      )
    )
  )`
}

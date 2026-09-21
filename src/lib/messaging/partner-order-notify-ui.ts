import {
  canConfirmReceivedFromShipment,
  type PartnerOrderShipmentEvent,
  type ShipmentStepKey,
} from '@/lib/messaging/fulfillment/order-shipment-timeline'
import { canCancelPartnerOrder } from '@/lib/messaging/fulfillment/order-lifecycle-transition'

export type PartnerOrderNotifyEvent =
  | 'order_placed'
  | 'payment_proof_received'
  | 'payment_confirmed'
  | 'deposit_reminder_2h'
  | 'deposit_reminder_20h'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'customer_cancelled'
  | 'customer_received'
  | 'chat_needs_reply'

export type PartnerOrderNotifyAudience = 'customer' | 'owner'
export type PartnerOrderNotifyChannel = 'email' | 'in_app' | 'push' | 'chat'

/** One declarative matrix keeps email, notification and chat fan-out reviewable. */
export const PARTNER_ORDER_NOTIFY_EVENT_MATRIX: Readonly<
  Record<PartnerOrderNotifyEvent, Readonly<Record<PartnerOrderNotifyAudience, readonly PartnerOrderNotifyChannel[]>>>
> = {
  order_placed: { customer: ['email', 'in_app', 'push', 'chat'], owner: ['email', 'in_app', 'push'] },
  payment_proof_received: { customer: ['email', 'in_app', 'push', 'chat'], owner: ['email', 'in_app', 'push'] },
  payment_confirmed: { customer: ['email', 'in_app', 'push', 'chat'], owner: ['email', 'in_app', 'push'] },
  deposit_reminder_2h: { customer: ['email', 'in_app', 'push'], owner: [] },
  deposit_reminder_20h: { customer: ['email', 'in_app', 'push'], owner: [] },
  shipped: { customer: ['email', 'in_app', 'push', 'chat'], owner: [] },
  delivered: { customer: ['email', 'in_app', 'push', 'chat'], owner: [] },
  cancelled: { customer: ['email', 'in_app', 'push', 'chat'], owner: [] },
  refunded: { customer: ['email', 'in_app', 'push', 'chat'], owner: [] },
  customer_cancelled: { customer: [], owner: ['email', 'in_app', 'push'] },
  customer_received: { customer: [], owner: ['email', 'in_app', 'push'] },
  chat_needs_reply: { customer: [], owner: ['email', 'in_app', 'push'] },
}

export function partnerOrderNotifyIdempotencyKey(input: {
  partnerId: string
  event: PartnerOrderNotifyEvent
  orderId?: string | null
  conversationId?: string | null
  channel?: PartnerOrderNotifyChannel | 'owner'
}): string {
  const identity = input.orderId?.trim() || input.conversationId?.trim() || 'unknown'
  return ['partner-order', input.partnerId.trim(), identity, input.event, input.channel || 'all'].join(':')
}

export type BuyerOrderAction = 'pay_deposit' | 'cancel' | 'track' | 'confirm_received' | 'review'

function buyerCanCancel(status: string, shippingStatus: string): boolean {
  if (!['awaiting_payment', 'payment_checking', 'pending_manual_review', 'paid_verified', 'cancelled'].includes(status)) {
    return false
  }
  if (!['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'returned', 'cancelled'].includes(shippingStatus)) {
    return false
  }
  return canCancelPartnerOrder({
    status: status as Parameters<typeof canCancelPartnerOrder>[0]['status'],
    shippingStatus: shippingStatus as Parameters<typeof canCancelPartnerOrder>[0]['shippingStatus'],
  })
}

export function buyerOrderActions(input: {
  status?: string | null
  shippingStatus?: string | null
  requiredAmount?: number | null
  paidAmount?: number | null
  hasReview?: boolean | null
  shipmentEvents?: PartnerOrderShipmentEvent[] | null
}): BuyerOrderAction[] {
  const status = String(input.status || '').toLowerCase()
  const shipping = String(input.shippingStatus || 'pending').toLowerCase()
  const cancelled = status === 'cancelled' || shipping === 'cancelled'
  if (cancelled) return []
  const actions: BuyerOrderAction[] = []
  const waitingPayment = status === 'awaiting_payment' || status === 'payment_checking'
  if (waitingPayment && Number(input.requiredAmount || 0) > Number(input.paidAmount || 0)) {
    actions.push('pay_deposit')
  }
  if (buyerCanCancel(status, shipping)) actions.push('cancel')
  if (
    status === 'paid_verified' ||
    status === 'pending_manual_review' ||
    ['confirmed', 'packing', 'shipping', 'delivered'].includes(shipping)
  ) {
    actions.push('track')
  }
  const events = input.shipmentEvents || []
  if (shipping === 'shipping' && events.length > 0 && canConfirmReceivedFromShipment(events)) {
    actions.push('confirm_received')
  }
  if (shipping === 'delivered' && input.hasReview === false) actions.push('review')
  return actions
}

export type OrderWaitingActor = 'system' | 'seller' | 'carrier' | 'buyer' | 'none'

export function orderWaitingState(
  events?: PartnerOrderShipmentEvent[] | null
): { step: ShipmentStepKey | null; actor: OrderWaitingActor; timestamp: string | null; source: string | null } {
  const active = (events || []).find((event) => event.status === 'active')
  if (!active) return { step: null, actor: 'none', timestamp: null, source: null }
  const actor: OrderWaitingActor =
    active.stepKey === 'awaiting_confirm'
      ? 'buyer'
      : ['at_customs', 'domestic_shipping', 'vn_picking', 'vn_packed'].includes(active.stepKey)
        ? 'seller'
        : active.updatedBy === 'ems'
          ? 'carrier'
          : 'system'
  return {
    step: active.stepKey,
    actor,
    timestamp: active.completedAt || active.scheduledAt || null,
    source: active.updatedBy || null,
  }
}

/** Strip internal routing, carrier actor/source and notes before any storefront response. */
export function publicOrderShipmentEvents(
  events?: PartnerOrderShipmentEvent[] | null
): Array<Pick<PartnerOrderShipmentEvent, 'stepKey' | 'status' | 'scheduledAt' | 'completedAt'>> {
  return (events || []).map(({ stepKey, status, scheduledAt, completedAt }) => ({
    stepKey,
    status,
    scheduledAt,
    completedAt,
  }))
}

export function stripInternalOrderSource<T extends Record<string, unknown>>(
  order: T
): Omit<T, 'fulfillment_source' | 'fulfillment_needs_review' | 'source_platform' | 'source_url'> {
  const clean = { ...order }
  delete clean.fulfillment_source
  delete clean.fulfillment_needs_review
  delete clean.source_platform
  delete clean.source_url
  return clean
}

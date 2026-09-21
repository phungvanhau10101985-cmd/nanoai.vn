import {
  fetchPartnerCheckoutGroupOrdersFromPg,
  type PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import {
  buyerOrderActions,
  publicOrderShipmentEvents,
  stripInternalOrderSource,
} from '@/lib/messaging/partner-order-notify-ui'
import {
  buildGuestOrderDepositView,
  fetchPartnerOrderDetailForGuestWidgetIfAllowed,
} from '@/lib/messaging/guest-chat-ordering'
import { resolveCommerceOrderPartnerBySlug } from '@/lib/messaging/resolve-commerce-partner'
import { resolveWidgetOrderThreadFromCookies } from '@/lib/messaging/resolve-widget-order-thread'
import type { PartnerSiteDepositPaymentDisplay } from '@/lib/partner-website/shop/partner-site-checkout-handoff'

export type GuestOrderPagePayload = Awaited<ReturnType<typeof buildGuestOrderDepositView>> & {
  partner_display_name: string
  partner_slug: string
  shipment_events: Awaited<ReturnType<typeof fetchPartnerOrderShipmentEventsFromPg>>
  sibling_orders: Awaited<ReturnType<typeof fetchPartnerCheckoutGroupOrdersFromPg>>
  can_confirm_received: boolean
  can_cancel: boolean
  buyer_actions: ReturnType<typeof buyerOrderActions>
}

export async function buildGuestOrderPagePayload(input: {
  partnerId: string
  partnerDisplayName: string
  slug: string
  order: PartnerOrderRow
}): Promise<GuestOrderPagePayload> {
  const order = input.order
  const view = await buildGuestOrderDepositView({ partnerId: input.partnerId, order })
  const [events, siblings] = await Promise.all([
    fetchPartnerOrderShipmentEventsFromPg(order.id),
    fetchPartnerCheckoutGroupOrdersFromPg(input.partnerId, order.checkout_group_id),
  ])
  const buyerActions = buyerOrderActions({
    status: order.status,
    shippingStatus: order.shipping_status,
    requiredAmount: order.required_amount,
    paidAmount: order.paid_amount,
    shipmentEvents: events,
  })
  return {
    ...view,
    order: stripInternalOrderSource(view.order as unknown as Record<string, unknown>) as typeof view.order,
    payment_display: view.payment_display as PartnerSiteDepositPaymentDisplay | null,
    partner_display_name: input.partnerDisplayName,
    partner_slug: input.slug,
    shipment_events: publicOrderShipmentEvents(events) as typeof events,
    sibling_orders: siblings
      .filter((row) => row.id !== order.id)
      .map((row) => stripInternalOrderSource(row as unknown as Record<string, unknown>)) as typeof siblings,
    can_confirm_received: buyerActions.includes('confirm_received'),
    can_cancel: buyerActions.includes('cancel'),
    buyer_actions: buyerActions,
  }
}

/** First HTML for deposit / order detail — cookie session, no client click/keypress. */
export async function loadGuestOrderPageForCookies(
  slug: string,
  orderId: string
): Promise<GuestOrderPagePayload | null> {
  const partner = await resolveCommerceOrderPartnerBySlug(slug)
  if ('error' in partner) return null
  const oid = String(orderId ?? '').trim()
  if (!oid) return null
  const thread = await resolveWidgetOrderThreadFromCookies(partner.partnerId)
  if (!thread) return null
  const order = await fetchPartnerOrderDetailForGuestWidgetIfAllowed(partner.partnerId, oid, thread)
  if (!order) return null
  return buildGuestOrderPagePayload({
    partnerId: partner.partnerId,
    partnerDisplayName: partner.displayName,
    slug,
    order,
  })
}

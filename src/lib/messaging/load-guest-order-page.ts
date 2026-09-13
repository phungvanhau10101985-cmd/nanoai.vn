import {
  fetchPartnerCheckoutGroupOrdersFromPg,
  type PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import { canConfirmReceivedFromShipment } from '@/lib/messaging/fulfillment/order-shipment-timeline'
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
  return {
    ...view,
    payment_display: view.payment_display as PartnerSiteDepositPaymentDisplay | null,
    partner_display_name: input.partnerDisplayName,
    partner_slug: input.slug,
    shipment_events: events,
    sibling_orders: siblings.filter((row) => row.id !== order.id),
    can_confirm_received:
      order.status !== 'cancelled' &&
      (events.length > 0
        ? canConfirmReceivedFromShipment(events)
        : order.shipping_status === 'shipping'),
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

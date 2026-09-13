import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import {
  fetchPartnerCheckoutGroupsMapFromPg,
  fetchPartnerOrdersForConversationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsForOrdersFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import { fetchReviewedOrderIdsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { canConfirmReceivedFromShipment } from '@/lib/messaging/fulfillment/order-shipment-timeline'
import { resolvePartnerStorefrontSaleIdentity } from '@/lib/partner-website/shop/partner-site-personalization'

type BaseOrderRow = NonNullable<
  Awaited<ReturnType<typeof fetchPartnerOrdersForConversationFromPg>>
>[number]
type SiblingOrderRow = Awaited<
  ReturnType<typeof fetchPartnerCheckoutGroupsMapFromPg>
>[string][number]

export type SiteOrderRow = BaseOrderRow & {
  has_review: boolean
  can_cancel: boolean
  can_confirm_received: boolean
  shipment_events: Awaited<ReturnType<typeof fetchPartnerOrderShipmentEventsForOrdersFromPg>>[string]
  sibling_orders: SiblingOrderRow[]
}

/** RSC first paint for order list — read existing account cookies, never finalize auth. */
export async function loadSiteOrdersForRequest(
  partnerId: string,
  limit = 80
): Promise<SiteOrderRow[] | null> {
  const identity = await resolvePartnerStorefrontSaleIdentity(partnerId)
  if (!identity.accountKey) return null
  const conversationId = await fetchGuestWidgetConversationIdFromPg(
    partnerId,
    identity.accountKey
  )
  if (!conversationId) return []

  const orders =
    (await fetchPartnerOrdersForConversationFromPg(partnerId, conversationId, limit)) ?? []
  const orderIds = orders.map((order) => order.id).filter(Boolean)
  const [reviewedIds, eventsByOrder, siblingsByGroup] = await Promise.all([
    fetchReviewedOrderIdsFromPg(partnerId, orderIds),
    fetchPartnerOrderShipmentEventsForOrdersFromPg(orderIds),
    fetchPartnerCheckoutGroupsMapFromPg(
      partnerId,
      orders
        .map((order) => order.checkout_group_id)
        .filter((id): id is string => Boolean(id))
    ),
  ])

  return orders.map((order) => {
    const events = eventsByOrder[order.id] || []
    const siblings = (
      order.checkout_group_id ? siblingsByGroup[order.checkout_group_id] || [] : []
    ).filter((row) => row.id !== order.id)
    return {
      ...order,
      has_review: reviewedIds.has(order.id),
      can_cancel:
        (order.status === 'awaiting_payment' || order.status === 'payment_checking') &&
        order.shipping_status !== 'delivered' &&
        order.shipping_status !== 'returned',
      can_confirm_received:
        order.status !== 'cancelled' &&
        (events.length > 0
          ? canConfirmReceivedFromShipment(events)
          : order.shipping_status === 'shipping'),
      shipment_events: events,
      sibling_orders: siblings,
    }
  })
}

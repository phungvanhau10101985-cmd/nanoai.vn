import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import {
  fetchPartnerCheckoutGroupsMapFromPg,
  fetchPartnerOrdersForConversationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsForOrdersFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import { fetchReviewedOrderIdsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import {
  buyerOrderActions,
  publicOrderShipmentEvents,
  stripInternalOrderSource,
} from '@/lib/messaging/partner-order-notify-ui'
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
  buyer_actions: ReturnType<typeof buyerOrderActions>
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
    const buyerActions = buyerOrderActions({
      status: order.status,
      shippingStatus: order.shipping_status,
      requiredAmount: order.required_amount,
      paidAmount: order.paid_amount,
      hasReview: reviewedIds.has(order.id),
      shipmentEvents: events,
    })
    return {
      ...stripInternalOrderSource(order as unknown as Record<string, unknown>),
      has_review: reviewedIds.has(order.id),
      can_cancel: buyerActions.includes('cancel'),
      can_confirm_received: buyerActions.includes('confirm_received'),
      buyer_actions: buyerActions,
      shipment_events: publicOrderShipmentEvents(events),
      sibling_orders: siblings.map((row) =>
        stripInternalOrderSource(row as unknown as Record<string, unknown>)
      ),
    } as SiteOrderRow
  })
}

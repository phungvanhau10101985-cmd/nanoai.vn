import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import { findGuestAccountIdByEmailPg } from '@/lib/db/messaging-guest-pg'
import { resolveGuestIdentity } from '@/lib/messaging/guest-widget-identity'
import { applyGuestIdentityToResponse } from '@/lib/messaging/guest-auth-session'
import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import {
  fetchPartnerCheckoutGroupsMapFromPg,
  fetchPartnerOrdersForConversationFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsForOrdersFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import { canConfirmReceivedFromShipment } from '@/lib/messaging/fulfillment/order-shipment-timeline'
import { fetchReviewedOrderIdsFromPg } from '@/lib/db/messaging-partner-reviews-pg'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  return resolveCommerceOrderPartnerBySlug(slug)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)
  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    const err = commercePartnerErrorResponse(partner.error)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const { partnerId } = partner

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId

  if (identity.user?.id && !effectiveGuestAccountId) {
    const email = identity.user.email?.trim().toLowerCase() || ''
    const accountId = email ? await findGuestAccountIdByEmailPg(partnerId, email) : null
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  try {
    const convIdPg = await fetchGuestWidgetConversationIdFromPg(partnerId, effectiveExternalThreadId)
    if (convIdPg === null) {
      const res = NextResponse.json({ orders: [] as unknown[] })
      applyGuestIdentityToResponse(res, request, {
        newSessionId: identity.newSessionId,
        user: identity.user ?? null,
        effectiveExternalThreadId,
        effectiveGuestAccountId,
      })
      return res
    }
    const orders = (await fetchPartnerOrdersForConversationFromPg(partnerId, convIdPg, 80)) ?? []
    const reviewedIds = await fetchReviewedOrderIdsFromPg(
      partnerId,
      orders.map((o) => o.id).filter(Boolean)
    )
    const eventsByOrder = await fetchPartnerOrderShipmentEventsForOrdersFromPg(orders.map((o) => o.id))
    const groupIds = orders.map((o) => o.checkout_group_id).filter((id): id is string => Boolean(id))
    const siblingsByGroup = await fetchPartnerCheckoutGroupsMapFromPg(partnerId, groupIds)
    const enriched = orders.map((o) => {
      const events = eventsByOrder[o.id] || []
      const siblings = (o.checkout_group_id ? siblingsByGroup[o.checkout_group_id] || [] : []).filter(
        (row) => row.id !== o.id
      )
      return {
        ...o,
        has_review: reviewedIds.has(o.id),
        can_cancel:
          (o.status === 'awaiting_payment' || o.status === 'payment_checking') &&
          o.shipping_status !== 'delivered' &&
          o.shipping_status !== 'returned',
        can_confirm_received:
          o.status !== 'cancelled' &&
          (events.length > 0 ? canConfirmReceivedFromShipment(events) : o.shipping_status === 'shipping'),
        shipment_events: events,
        sibling_orders: siblings,
      }
    })
    const res = NextResponse.json({ orders: enriched })
    applyGuestIdentityToResponse(res, request, {
      newSessionId: identity.newSessionId,
      user: identity.user ?? null,
      effectiveExternalThreadId,
      effectiveGuestAccountId,
    })
    return res
  } catch (e) {
    console.warn('[guest widget orders GET]', e)
    return NextResponse.json({ error: 'Failed to load orders.' }, { status: 500 })
  }
}

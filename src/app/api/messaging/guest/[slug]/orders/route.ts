import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import {
  resolveGuestIdentity,
  upsertGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'
import { applyGuestIdentityToResponse } from '@/lib/messaging/guest-auth-session'
import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import { fetchPartnerOrdersForConversationFromPg } from '@/lib/db/messaging-partner-orders-pg'
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

  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partnerId, request, identity.user)
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
    const enriched = orders.map((o) => ({
      ...o,
      has_review: reviewedIds.has(o.id),
      can_cancel:
        (o.status === 'awaiting_payment' || o.status === 'payment_checking') &&
        o.shipping_status !== 'delivered' &&
        o.shipping_status !== 'returned',
      can_confirm_received: o.status !== 'cancelled' && o.shipping_status === 'shipping',
    }))
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

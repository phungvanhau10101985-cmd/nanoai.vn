import { NextRequest, NextResponse } from 'next/server'
import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { applyGuestIdentityToResponse } from '@/lib/messaging/guest-auth-session'
import { buildProductShelfSimilarToConsultedProducts } from '@/lib/messaging/product-shelf-consulted-similar'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import {
  resolveGuestIdentity,
  upsertGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ ok: false, error: 'database_unavailable' }, { status: 503 })
  }

  const partner = await resolveFashionMessagingPartnerBySlug(slug)
  if (!partner) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  }

  const identity = await resolveGuestIdentity(request)
  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId

  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partner.id, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const convId = await fetchGuestWidgetConversationIdFromPg(partner.id, effectiveExternalThreadId)
  const cards =
    convId != null
      ? await buildProductShelfSimilarToConsultedProducts(partner.id, convId)
      : []

  const res = NextResponse.json({
    ok: true,
    cards,
    source: cards.length > 0 ? ('chat_similar' as const) : ('none' as const),
  })
  applyGuestIdentityToResponse(res, request, {
    newSessionId: identity.newSessionId,
    user: identity.user ?? null,
    effectiveExternalThreadId,
    effectiveGuestAccountId,
  })
  return res
}

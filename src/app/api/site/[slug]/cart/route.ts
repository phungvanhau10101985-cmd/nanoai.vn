import { NextRequest, NextResponse } from 'next/server'
import { fetchMessagingGuestCartFromPg, upsertMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'
import { sanitizeHeadlessCartItems } from '@/lib/messaging/partner-headless-cart-utils'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

function isSignedIn(visitor: Awaited<ReturnType<typeof resolveSiteVisitorContext>>): boolean {
  return Boolean(visitor.thread.guestAccountId || visitor.thread.linkedUserId)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!isSignedIn(visitor)) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'AUTH_REQUIRED_CART_LOGIN', requireAuth: true, items: [] },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }
  const items = await fetchMessagingGuestCartFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, items: Array.isArray(items) ? items : [], sync: true },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!isSignedIn(visitor)) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'AUTH_REQUIRED_CART_LOGIN', requireAuth: true },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  const items = sanitizeHeadlessCartItems(body?.items)
  const ok = await upsertMessagingGuestCartFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    cartItems: items,
  })
  if (!ok) return NextResponse.json({ error: 'Could not save cart.' }, { status: 500 })

  return jsonSitePersonalization(
    request,
    { ok: true, items },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

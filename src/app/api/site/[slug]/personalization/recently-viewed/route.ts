import { NextRequest, NextResponse } from 'next/server'
import { clearPartnerVisitorRecentlyViewedFromPg } from '@/lib/db/messaging-partner-visitor-personalization-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  getSiteRecentlyViewedProducts,
  resolveSiteVisitorContext,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 8) || 8))
  const products = await getSiteRecentlyViewedProducts({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    accountKey: visitor.accountKey,
    limit,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, products, count: products.length },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

/** DELETE — xóa lịch sử đã xem. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const ok = await clearPartnerVisitorRecentlyViewedFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
  })
  if (!ok) return NextResponse.json({ error: 'Could not clear history' }, { status: 500 })

  return jsonSitePersonalization(
    request,
    { ok: true, products: [], count: 0 },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

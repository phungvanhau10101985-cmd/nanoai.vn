import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { getSiteFeaturedCategoryBlock } from '@/lib/partner-website/shop/featured-categories'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const limit = Math.min(20, Math.max(4, Number(request.nextUrl.searchParams.get('limit') ?? 10) || 10))
  const block = await getSiteFeaturedCategoryBlock({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    accountKey: visitor.accountKey,
    linkedUserId: visitor.thread.linkedUserId,
    locale: shop.site.locale,
    limit,
  })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      tiles: block.tiles,
      nav_pills: block.nav_pills,
      gender: block.gender,
      gender_label: block.gender_label,
      source: block.source,
      hub_href: block.hub_href,
      count: block.tiles.length,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

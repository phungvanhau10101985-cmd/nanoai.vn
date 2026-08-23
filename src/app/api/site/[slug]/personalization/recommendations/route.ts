import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { getSiteHomeRecommendationBlock } from '@/lib/partner-website/shop/partner-site-home-recommendation'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const limit = Math.min(24, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 10) || 10))
  const block = await getSiteHomeRecommendationBlock({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    accountKey: visitor.accountKey,
    linkedUserId: visitor.thread.linkedUserId,
    limit,
  })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      products: block.products,
      count: block.products.length,
      personalized: block.personalized,
      cohort_mode: block.cohort_mode,
      cohort_badge_product_ids: block.cohort_badge_product_ids,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

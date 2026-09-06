import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { getSiteHomeRecommendationBlock } from '@/lib/partner-website/shop/partner-site-home-recommendation'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  const loggedIn = Boolean(visitor.thread.linkedUserId || visitor.thread.guestAccountId)
  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') ?? 0) || 0)
  const limit = Math.min(48, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 10) || 10))
  const sameShopOnly =
    request.nextUrl.searchParams.get('sameShopOnly') === '1' ||
    request.nextUrl.searchParams.get('same_shop_only') === '1'
  const seedRaw = request.nextUrl.searchParams.get('seed')
  const mixSeed = seedRaw != null && seedRaw !== '' && Number.isFinite(Number(seedRaw)) ? Number(seedRaw) : null
  const block = await getSiteHomeRecommendationBlock({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    accountKey: visitor.accountKey,
    linkedUserId: visitor.thread.linkedUserId,
    loggedIn,
    email,
    limit,
    offset,
    mixSeed,
    sameShopOnly: sameShopOnly || offset > 0,
  })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      products: block.products,
      hasMore: block.has_more,
      offset,
      limit,
      count: block.products.length,
      personalized: block.personalized,
      cohort_mode: block.cohort_mode,
      logged_in: loggedIn,
      cohort_badge_product_ids: block.cohort_badge_product_ids,
      same_shop_seed: block.same_shop_seed,
      same_shop_used: block.same_shop_used,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

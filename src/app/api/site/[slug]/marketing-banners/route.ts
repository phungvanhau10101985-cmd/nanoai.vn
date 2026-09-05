import { NextRequest } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveCurrentPartnerMarketingBanners } from '@/lib/partner-website/promotions/partner-marketing-banner-current'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return Response.json({ ok: false, error: 'not_found' }, { status: 404 })
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const items = await resolveCurrentPartnerMarketingBanners({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    locale: shop.site.locale,
    linkedUserId: visitor.thread.linkedUserId,
    guestAccountId: visitor.thread.guestAccountId,
  })
  return jsonSitePersonalization(
    request,
    { ok: true, items },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

import { NextResponse } from 'next/server'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  buildPartnerShopServiceWorkerSource,
  partnerSitePwaIconPath,
  partnerSitePwaStartUrl,
} from '@/lib/partner-website/shop/partner-site-pwa'
import { partnerSiteAccountTabPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const dynamic = 'force-dynamic'

/** W5.5 — per-shop service worker: cache shop shell (home) only. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return new NextResponse('Not found', { status: 404 })
  }

  const customDomain = Boolean(req.headers.get(PARTNER_CUSTOM_DOMAIN_HEADER)?.trim())
  const startUrl = partnerSitePwaStartUrl(shop.site.siteSlug, customDomain)
  const source = buildPartnerShopServiceWorkerSource({
    siteSlug: shop.site.siteSlug,
    startUrl,
    customDomain,
    inboxPath: partnerSiteAccountTabPath(shop.site.siteSlug, 'notifications', { customDomain }),
    iconPath: partnerSitePwaIconPath(shop.site.siteSlug, 192, customDomain),
  })

  return new NextResponse(source, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  })
}

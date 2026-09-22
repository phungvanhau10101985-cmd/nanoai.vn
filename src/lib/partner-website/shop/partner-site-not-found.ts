import { NextResponse } from 'next/server'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export function partnerShopNotFoundHomePath(siteSlug: string, customDomain: boolean): string {
  return partnerSiteHomePath(siteSlug, { customDomain })
}

/** Unknown storefront URL → shop home (custom domain `/`, platform `/site/{slug}`). */
export function redirectPartnerShopMissingPageToHome(req: Request, siteSlug: string): NextResponse {
  const slug = siteSlug.trim()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => req.headers.get(name)))
  const home = partnerShopNotFoundHomePath(slug, customDomain)
  return NextResponse.redirect(new URL(home, req.url), 307)
}

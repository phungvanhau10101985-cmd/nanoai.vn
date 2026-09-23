import { NextResponse } from 'next/server'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { partnerSiteHomePath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export function partnerShopNotFoundHomePath(siteSlug: string, customDomain: boolean): string {
  return partnerSiteHomePath(siteSlug, { customDomain })
}

function isLocalHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host.trim())
}

/** Public origin for redirects. Next `req.url` behind nginx is often `http://localhost:3000`. */
function redirectBaseUrl(req: Request): string {
  const customHost = readPartnerCustomDomainFromHeaders((name) => req.headers.get(name))
  const forwarded = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || ''
  const hostHeader = req.headers.get('host')?.split(',')[0]?.trim() || ''
  const pick = (raw: string) => raw.split(':')[0]?.trim().toLowerCase() || ''
  const host =
    customHost ||
    (!isLocalHost(pick(forwarded)) ? pick(forwarded) : '') ||
    (!isLocalHost(pick(hostHeader)) ? pick(hostHeader) : '')
  if (!host) return req.url
  const proto =
    req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
    (isLocalHost(host) ? 'http' : 'https')
  return `${proto}://${host}/`
}

/** Unknown storefront URL → shop home (custom domain `/`, platform `/site/{slug}`). */
export function redirectPartnerShopMissingPageToHome(req: Request, siteSlug: string): NextResponse {
  const slug = siteSlug.trim()
  const customDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => req.headers.get(name)))
  const home = partnerShopNotFoundHomePath(slug, customDomain)
  return NextResponse.redirect(new URL(home, redirectBaseUrl(req)), 307)
}

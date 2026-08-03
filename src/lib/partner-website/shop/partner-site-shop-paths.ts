import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'
import { buildPartnerSiteProductKey } from '@/lib/partner-website/shop/partner-site-product-slug'

type PathOpts = { customDomain?: boolean; name?: string | null }

export function partnerSiteHomePath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/', opts?.customDomain)
}

export function partnerSiteLandingPath(siteSlug: string, landingSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, `/lp/${encodeURIComponent(landingSlug.trim())}`, opts?.customDomain)
}

export function partnerSiteProductsPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/products', opts?.customDomain)
}

export function partnerSiteProductPath(
  siteSlug: string,
  inventoryId: string,
  opts?: PathOpts
): string {
  const key = buildPartnerSiteProductKey(opts?.name, inventoryId)
  return partnerSiteHref(siteSlug, `/products/${encodeURIComponent(key)}`, opts?.customDomain)
}

export function partnerSiteCartPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/cart', opts?.customDomain)
}

/** Same-platform shop cart (no Bearer / partner slug). */
export function partnerSiteCartApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/cart`
}

export function partnerSiteOrdersPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/orders', opts?.customDomain)
}

export function partnerSiteAccountPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/account', opts?.customDomain)
}

export function partnerSiteAccountEditPath(siteSlug: string, opts?: PathOpts): string {
  return `${partnerSiteAccountPath(siteSlug, opts)}#edit-profile`
}

export function partnerSiteAddressesPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/addresses', opts?.customDomain)
}

export function partnerSiteProductsApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/products`
}

export function partnerSiteProductApiPath(siteSlug: string, inventoryId: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/products/${encodeURIComponent(inventoryId.trim())}`
}

export function partnerSiteOrderTrackingApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/order-tracking`
}

export function partnerSiteOrderTrackingPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/order-tracking', opts?.customDomain)
}

export function partnerSiteWishlistPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/wishlist', opts?.customDomain)
}

export function partnerSiteRecentlyViewedPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/recently-viewed', opts?.customDomain)
}

export function partnerSiteSessionApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/session`
}

/** Đăng nhập email NanoAI (OTP) — dùng chung mọi shop, kể cả domain riêng (cùng origin). */
export function partnerSiteNanoAiLoginHref(returnPath: string): string {
  const next = returnPath.trim()
  const safe =
    next.startsWith('/') && !next.startsWith('//') && !next.includes('://') && !next.includes('\\')
      ? next
      : '/'
  return `/auth/login?next=${encodeURIComponent(safe)}`
}

export function partnerSiteAuthSyncApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/auth/sync-session`
}

export function partnerSitePersonalizationApiPath(siteSlug: string, subpath: string): string {
  const base = `/api/site/${encodeURIComponent(siteSlug.trim())}/personalization`
  const tail = subpath.replace(/^\/+/, '')
  return tail ? `${base}/${tail}` : base
}

/** Same-platform shop text search (no Bearer). */
export function partnerSiteSearchTextApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/search/text`
}

/** Same-platform shop image search (no Bearer). */
export function partnerSiteSearchImageApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/search/image`
}

export function partnerSiteInfoPath(
  siteSlug: string,
  page:
    | 'about'
    | 'contact'
    | 'faq'
    | 'sale'
    | 'shipping'
    | 'returns'
    | 'privacy'
    | 'terms',
  opts?: PathOpts
): string {
  return partnerSiteHref(siteSlug, `/${page}`, opts?.customDomain)
}

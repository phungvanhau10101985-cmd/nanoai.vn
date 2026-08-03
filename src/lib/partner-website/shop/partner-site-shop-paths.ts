export function partnerSiteHomePath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}`
}

export function partnerSiteLandingPath(siteSlug: string, landingSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/lp/${encodeURIComponent(landingSlug.trim())}`
}

export function partnerSiteProductsPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/products`
}

export function partnerSiteProductPath(siteSlug: string, inventoryId: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/products/${encodeURIComponent(inventoryId.trim())}`
}

export function partnerSiteCartPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/cart`
}

/** Same-platform shop cart (no Bearer / partner slug). */
export function partnerSiteCartApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/cart`
}

export function partnerSiteOrdersPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/orders`
}

export function partnerSiteAccountPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/account`
}

export function partnerSiteAccountEditPath(siteSlug: string): string {
  return `${partnerSiteAccountPath(siteSlug)}#edit-profile`
}

export function partnerSiteAddressesPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/addresses`
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

export function partnerSiteOrderTrackingPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/order-tracking`
}

export function partnerSiteWishlistPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/wishlist`
}

export function partnerSiteRecentlyViewedPath(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/recently-viewed`
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
    | 'terms'
): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}/${page}`
}

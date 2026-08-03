/** Map public shop URLs on a partner custom domain ↔ internal /site/{slug}/… routes. */

const SHOP_PUBLIC_ROOT_SEGMENTS = new Set([
  'products',
  'cart',
  'orders',
  'account',
  'addresses',
  'wishlist',
  'recently-viewed',
  'about',
  'contact',
  'faq',
  'sale',
  'shipping',
  'returns',
  'privacy',
  'terms',
  'lp',
  'order-tracking',
])

export function partnerSiteInternalPrefix(siteSlug: string): string {
  return `/site/${encodeURIComponent(siteSlug.trim())}`
}

function normalizePathname(pathname: string): string {
  const p = pathname.trim() || '/'
  if (p.length > 1 && p.endsWith('/')) return p.replace(/\/+$/, '') || '/'
  return p
}

/** `/products/x` → `/site/{slug}/products/x`; `/` → `/site/{slug}`. */
export function mapPartnerCustomDomainPathToInternal(
  siteSlug: string,
  pathname: string
): string | null {
  const slug = siteSlug.trim()
  if (!slug) return null
  const path = normalizePathname(pathname)
  const prefix = partnerSiteInternalPrefix(slug)

  if (path === prefix || path.startsWith(`${prefix}/`)) {
    return path
  }

  if (path === '/') {
    return prefix
  }

  const segments = path.split('/').filter(Boolean)
  const root = segments[0]?.toLowerCase() ?? ''
  if (!root || !SHOP_PUBLIC_ROOT_SEGMENTS.has(root)) {
    return null
  }

  return `${prefix}${path}`
}

/** `/site/{slug}/products/x` → `/products/x`; `/site/{slug}` → `/`. */
export function mapPartnerInternalPathToPublic(siteSlug: string, pathname: string): string | null {
  const slug = siteSlug.trim()
  if (!slug) return null
  const path = normalizePathname(pathname)
  const prefix = partnerSiteInternalPrefix(slug)

  if (path === prefix) return '/'
  if (path.startsWith(`${prefix}/`)) {
    const tail = path.slice(prefix.length)
    return tail || '/'
  }
  return null
}

/** Build href for shop pages — clean paths on custom domain, /site/{slug}/… on platform. */
export function partnerSiteHref(siteSlug: string, subpath: string, customDomain = false): string {
  const slug = siteSlug.trim()
  const raw = subpath.trim()
  const tail = !raw || raw === '/' ? '/' : raw.startsWith('/') ? raw : `/${raw}`

  if (customDomain) {
    return tail === '/' ? '/' : tail
  }

  if (tail === '/') {
    return partnerSiteInternalPrefix(slug)
  }
  return `${partnerSiteInternalPrefix(slug)}${tail}`
}

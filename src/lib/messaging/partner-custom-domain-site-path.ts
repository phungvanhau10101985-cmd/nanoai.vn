/** Map public shop URLs on a partner custom domain ↔ internal /site/{slug}/… routes. */

export const SHOP_PUBLIC_ROOT_SEGMENTS = new Set([
  'products',
  'c',
  'cart',
  'orders',
  'account',
  'login',
  'addresses',
  'wishlist',
  'recently-viewed',
  'about',
  'contact',
  'faq',
  'sale',
  'kho-sale',
  'search',
  'tim-kiem',
  'tim-theo-anh',
  'shipping',
  'returns',
  'privacy',
  'terms',
  'payment',
  'how-to-buy',
  'brand-origin',
  'reviews-policy',
  'trust',
  'company',
  'thank-you',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
  'goi-y-tuoi-gioi',
  'lp',
  'pages',
  'order-tracking',
  'thanh-vien',
  'vi-dien-tu',
  'tai-khoan-ngan-hang',
  'sitemap.xml',
  'sitemap-pages.xml',
  'sitemap-products',
  'manifest.webmanifest',
  'sw.js',
  'pw-shop-sw.js',
  'pwa-icon',
  'favicon.ico',
])

/**
 * Host files that must not be rewritten into `/site/{slug}`.
 * `messaging` is the guest chat page (`/messaging/p/{slug}`). Rewriting it into the shop
 * catch-all 307s the iframe home — and `req.url` inside Next is localhost, so Chrome shows
 * «localhost đã từ chối kết nối» instead of the conversation.
 */
export const SHOP_CUSTOM_DOMAIN_PASSTHROUGH_ROOTS = new Set([
  '.well-known',
  'robots.txt',
  'auth',
  'messaging',
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
  if (!root || SHOP_CUSTOM_DOMAIN_PASSTHROUGH_ROOTS.has(root)) {
    return null
  }

  // Custom-domain `/sw.js` is NanoAI next-pwa. Shop workers use `/pw-shop-sw.js`.
  if (root === 'pw-shop-sw.js' || root === 'sw.js') {
    return `${prefix}/sw.js`
  }

  // Known shop routes and unknown URLs both enter `/site/{slug}/…`.
  // Unknown paths then redirect home with shop chrome — not the Next.js default 404.
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
    if (tail === '/sw.js' || tail === '/pw-shop-sw.js') return '/pw-shop-sw.js'
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

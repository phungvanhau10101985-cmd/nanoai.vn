/**
 * W2.3 — nav/footer JSON schema (platform links only, no free HTML).
 */

export type PartnerSiteNavHrefKey =
  | 'home'
  | 'products'
  | 'sale'
  | 'wishlist'
  | 'cart'
  | 'orders'
  | 'account'
  | 'about'
  | 'contact'
  | 'faq'
  | 'shipping'
  | 'returns'
  | 'privacy'
  | 'terms'
  | 'payment'
  | 'stores'
  | 'lookbook'
  | 'size-guide'
  | 'blog'

export type PartnerSiteNavLinkItem = {
  id: string
  hrefKey: PartnerSiteNavHrefKey
  labelOverride?: string | null
  visible: boolean
  sortOrder: number
}

const NAV_HREF_KEYS = new Set<string>([
  'home',
  'products',
  'sale',
  'wishlist',
  'cart',
  'orders',
  'account',
  'about',
  'contact',
  'faq',
  'shipping',
  'returns',
  'privacy',
  'terms',
  'payment',
  'stores',
  'lookbook',
  'size-guide',
  'blog',
])

export const DEFAULT_PARTNER_SITE_NAV_LINKS: PartnerSiteNavLinkItem[] = [
  { id: 'nav_home', hrefKey: 'home', visible: true, sortOrder: 0 },
  { id: 'nav_products', hrefKey: 'products', visible: true, sortOrder: 1 },
  { id: 'nav_sale', hrefKey: 'sale', visible: true, sortOrder: 2 },
  { id: 'nav_wishlist', hrefKey: 'wishlist', visible: true, sortOrder: 3 },
]

export const DEFAULT_PARTNER_SITE_FOOTER_LINKS: PartnerSiteNavLinkItem[] = [
  { id: 'ft_about', hrefKey: 'about', visible: true, sortOrder: 0 },
  { id: 'ft_contact', hrefKey: 'contact', visible: true, sortOrder: 1 },
  { id: 'ft_stores', hrefKey: 'stores', visible: true, sortOrder: 2 },
  { id: 'ft_lookbook', hrefKey: 'lookbook', visible: true, sortOrder: 3 },
  { id: 'ft_products', hrefKey: 'products', visible: true, sortOrder: 4 },
  { id: 'ft_sale', hrefKey: 'sale', visible: true, sortOrder: 5 },
  { id: 'ft_wishlist', hrefKey: 'wishlist', visible: true, sortOrder: 6 },
  { id: 'ft_size', hrefKey: 'size-guide', visible: true, sortOrder: 7 },
  { id: 'ft_faq', hrefKey: 'faq', visible: true, sortOrder: 8 },
  { id: 'ft_shipping', hrefKey: 'shipping', visible: true, sortOrder: 9 },
  { id: 'ft_returns', hrefKey: 'returns', visible: true, sortOrder: 10 },
  { id: 'ft_payment', hrefKey: 'payment', visible: true, sortOrder: 11 },
  { id: 'ft_privacy', hrefKey: 'privacy', visible: true, sortOrder: 12 },
  { id: 'ft_terms', hrefKey: 'terms', visible: true, sortOrder: 13 },
  { id: 'ft_blog', hrefKey: 'blog', visible: true, sortOrder: 14 },
]

export function isPartnerSiteNavHrefKey(v: unknown): v is PartnerSiteNavHrefKey {
  return typeof v === 'string' && NAV_HREF_KEYS.has(v)
}

export function normalizePartnerSiteNavLinks(
  raw: unknown,
  fallback: PartnerSiteNavLinkItem[]
): PartnerSiteNavLinkItem[] {
  if (!Array.isArray(raw) || raw.length === 0) return fallback.map((x) => ({ ...x }))
  const out: PartnerSiteNavLinkItem[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const o = row as Record<string, unknown>
    if (!isPartnerSiteNavHrefKey(o.hrefKey)) continue
    const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : `link_${i}`
    out.push({
      id,
      hrefKey: o.hrefKey,
      labelOverride: typeof o.labelOverride === 'string' ? o.labelOverride : null,
      visible: o.visible !== false,
      sortOrder: typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? o.sortOrder : i,
    })
  }
  if (out.length === 0) return fallback.map((x) => ({ ...x }))
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

export function visibleSortedNavLinks(items: PartnerSiteNavLinkItem[]): PartnerSiteNavLinkItem[] {
  return items.filter((x) => x.visible).sort((a, b) => a.sortOrder - b.sortOrder)
}

/** Resolve platform href for a nav key (relative to shop root). */
export function resolvePartnerSiteNavHref(
  hrefKey: PartnerSiteNavHrefKey,
  paths: {
    home: string
    products: string
    sale: string
    wishlist: string
    cart: string
    orders: string
    account: string
    contact: string
  },
  infoPath: (key: string) => string
): string {
  switch (hrefKey) {
    case 'home':
      return paths.home
    case 'products':
      return paths.products
    case 'sale':
      return paths.sale
    case 'wishlist':
      return paths.wishlist
    case 'cart':
      return paths.cart
    case 'orders':
      return paths.orders
    case 'account':
      return paths.account
    case 'contact':
      return paths.contact
    default:
      return infoPath(hrefKey)
  }
}

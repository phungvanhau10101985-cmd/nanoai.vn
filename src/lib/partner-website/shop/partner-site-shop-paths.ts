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

/** Text search listing — 188 `/?q=`. Live React, not visual HTML. */
export function partnerSiteSearchPath(siteSlug: string, opts?: PathOpts & { q?: string }): string {
  const base = partnerSiteHref(siteSlug, '/search', opts?.customDomain)
  const q = String(opts?.q ?? '').trim()
  return q ? `${base}?q=${encodeURIComponent(q)}` : base
}

/** Image search listing — 188 `/tim-theo-anh`. */
export function partnerSiteImageSearchPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/tim-theo-anh', opts?.customDomain)
}

/** Listing hàng hoàn / thanh lý kho — giống 188 `/kho-sale`. */
export function partnerSiteKhoSalePath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/kho-sale', opts?.customDomain)
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

export function partnerSiteSaleCalendarApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/sale-calendar`
}

export function partnerSiteOrdersPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/orders', opts?.customDomain)
}

/** Chi tiết đơn — COD / sau cọc. */
export function partnerSiteOrderDetailPath(siteSlug: string, orderId: string, opts?: PathOpts): string {
  const id = orderId.trim()
  return partnerSiteHref(siteSlug, `/orders/${encodeURIComponent(id)}`, opts?.customDomain)
}

/** Trang thanh toán cọc — giống 188 `/account/orders/:id/deposit`. */
export function partnerSiteOrderDepositPath(siteSlug: string, orderId: string, opts?: PathOpts): string {
  const id = orderId.trim()
  return partnerSiteHref(siteSlug, `/orders/${encodeURIComponent(id)}/deposit`, opts?.customDomain)
}

export function partnerSiteAccountPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/account', opts?.customDomain)
}

/** Dedicated shop login — same flow as 188 `/auth/login` (then `?redirect=`). */
export function partnerSiteLoginPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/login', opts?.customDomain)
}

/** W5.6 — valid account tabs. `overview` lives at `/account` (no trailing segment). */
export const PARTNER_SITE_ACCOUNT_TABS = [
  'overview',
  'cart',
  'orders',
  'wallet',
  'wishlist',
  'recently-viewed',
  'addresses',
  'edit-profile',
  'contact',
  'security',
  'notifications',
  'install-app',
] as const

export type PartnerSiteAccountTab = (typeof PARTNER_SITE_ACCOUNT_TABS)[number]

const PARTNER_SITE_ACCOUNT_TAB_SET = new Set<string>(PARTNER_SITE_ACCOUNT_TABS)

export function isPartnerSiteAccountTab(value: string): value is PartnerSiteAccountTab {
  return PARTNER_SITE_ACCOUNT_TAB_SET.has(value.trim())
}

/** W5.6 — `/account` for overview; `/account/{tab}` for the rest. */
export function partnerSiteAccountTabPath(
  siteSlug: string,
  tab: PartnerSiteAccountTab | string,
  opts?: PathOpts
): string {
  const normalized = tab.trim().toLowerCase()
  if (!normalized || normalized === 'overview') {
    return partnerSiteAccountPath(siteSlug, opts)
  }
  return partnerSiteHref(siteSlug, `/account/${encodeURIComponent(normalized)}`, opts?.customDomain)
}

export function partnerSiteAccountEditPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteAccountTabPath(siteSlug, 'edit-profile', opts)
}

export function partnerSiteContactChannelsApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/contact-channels`
}

export function partnerSiteLeadApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/lead`
}

export function partnerSitePromotionsValidateApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/promotions/validate`
}

export function partnerSiteNotificationsApiPath(siteSlug: string, opts?: { unread?: boolean }): string {
  const base = `/api/site/${encodeURIComponent(siteSlug.trim())}/notifications`
  return opts?.unread ? `${base}?count=1` : base
}

export function partnerSitePushApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/push`
}

export function partnerSiteAddressesPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/addresses', opts?.customDomain)
}

/** Sổ địa chỉ khách — mọi shop, cần email đăng nhập. */
export function partnerSiteAddressesApiPath(
  siteSlug: string,
  addressId?: string,
  action?: 'default'
): string {
  const base = `/api/site/${encodeURIComponent(siteSlug.trim())}/addresses`
  const id = addressId?.trim()
  if (!id) return base
  const item = `${base}/${encodeURIComponent(id)}`
  return action === 'default' ? `${item}/default` : item
}

export function partnerSiteProductsApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/products`
}

export function partnerSiteOutfitApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/products/outfit`
}

/** W4.14 — hub danh mục `/site/{slug}/c` (tương đương 188 `/danh-muc`). */
export function partnerSiteCategoryHubPath(siteSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, '/c', opts?.customDomain)
}

/** W4.7 — trang danh mục công khai `/site/{slug}/c/{...path}`. `categoryPath` không có `/` đầu/cuối. */
export function partnerSiteCategoryPath(
  siteSlug: string,
  categoryPath: string,
  opts?: PathOpts
): string {
  const segments = categoryPath
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => encodeURIComponent(s))
  return partnerSiteHref(siteSlug, `/c/${segments.join('/')}`, opts?.customDomain)
}

/** W4.8 — cây danh mục công khai (active only) cho mega menu. */
export function partnerSiteCategoriesApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/categories`
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

/** Same-platform shop search history (account when logged in; guest stays in the browser). */
export function partnerSiteSearchHistoryApiPath(siteSlug: string): string {
  return `/api/site/${encodeURIComponent(siteSlug.trim())}/search/history`
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
    | 'payment'
    | 'thank-you'
    | 'stores'
    | 'lookbook'
    | 'size-guide'
    | 'blog',
  opts?: PathOpts
): string {
  return partnerSiteHref(siteSlug, `/${page}`, opts?.customDomain)
}

/** W3.4 — trang tĩnh tự do do merchant tạo (không phải 1 trong 8 trang có sẵn ở `partnerSiteInfoPath`). */
export function partnerSiteCustomPagePath(siteSlug: string, pageSlug: string, opts?: PathOpts): string {
  return partnerSiteHref(siteSlug, `/pages/${encodeURIComponent(pageSlug)}`, opts?.customDomain)
}

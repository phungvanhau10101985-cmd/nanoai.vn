import { SHOP_PUBLIC_ROOT_SEGMENTS } from '@/lib/messaging/partner-custom-domain-site-path'
import {
  partnerSiteAccountPath,
  partnerSiteLoginPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

export const PARTNER_SHOP_LOGIN_REDIRECT_QUERY_KEY = 'redirect'
const LEGACY_NEXT_QUERY_KEY = 'next'

type PathOpts = { customDomain?: boolean }

/** Redirect sau đăng nhập — chỉ đường dẫn nội bộ (pathname + ?query + #hash). */
export function isSafeRelativeRedirectPath(loc: string): boolean {
  const t = (loc || '').trim()
  if (!t.startsWith('/') || t.startsWith('//')) return false
  if (t.includes('://') || t.includes('\\')) return false
  if (t.length > 2048) return false
  return true
}

function pathOnly(loc: string): string {
  const raw = loc.split('#')[0].split('?')[0]
  if (!raw || raw === '/') return '/'
  return raw.replace(/\/+$/, '') || '/'
}

function sitePrefix(siteSlug: string): string {
  return `/site/${siteSlug.trim()}`
}

function isShopLoginPath(pathname: string, siteSlug: string): boolean {
  const p = pathOnly(pathname)
  if (p === '/login') return true
  const prefix = sitePrefix(siteSlug)
  return p === `${prefix}/login`
}

/** Chỉ cho phép quay lại trang của đúng shop (platform `/site/{slug}` hoặc path public domain khách). */
export function isSafePartnerShopRedirectPath(loc: string, siteSlug: string): boolean {
  if (!isSafeRelativeRedirectPath(loc)) return false
  const slug = siteSlug.trim()
  if (!slug) return false
  const p = pathOnly(loc)
  if (isShopLoginPath(p, slug)) return false

  const prefix = sitePrefix(slug)
  if (p === prefix || p.startsWith(`${prefix}/`)) {
    const rest = p.slice(prefix.length) || '/'
    return !isShopLoginPath(rest, slug)
  }

  if (p === '/') return true
  const root = p.split('/').filter(Boolean)[0]?.toLowerCase() ?? ''
  if (!root || root === 'login') return false
  return SHOP_PUBLIC_ROOT_SEGMENTS.has(root)
}

/**
 * @param pathname ví dụ `/products/abc` hoặc `/site/{slug}/products/abc`
 * @param search chuỗi query có hoặc không có `?`
 * @param hash có hoặc không có `#`
 */
export function composePartnerShopReturnLocation(
  pathname: string | null | undefined,
  search: string | null | undefined,
  hash: string | null | undefined
): string {
  let p =
    pathname == null || pathname === ''
      ? '/'
      : pathname.startsWith('/')
        ? pathname
        : `/${pathname}`
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1) || '/'

  let qs = ''
  if (search != null && search !== '') {
    qs = search.startsWith('?') ? search : `?${search}`
  }

  let h = ''
  if (hash != null && hash !== '') {
    h = hash.startsWith('#') ? hash : `#${hash}`
  }

  return `${p}${qs}${h}`
}

export function sanitizePartnerShopReturnLocation(
  siteSlug: string,
  loc: string,
  opts?: PathOpts
): string {
  const fallback = partnerSiteAccountPath(siteSlug, opts)
  const trimmed = (loc || '').trim()
  if (!trimmed) return fallback
  try {
    const decoded = trimmed.includes('%') ? decodeURIComponent(trimmed) : trimmed
    return isSafePartnerShopRedirectPath(decoded, siteSlug) ? decoded.slice(0, 2048) : fallback
  } catch {
    return fallback
  }
}

/** Full path đã đúng định dạng — bọc vào `/login?redirect=` (188: `/auth/login?redirect=`). */
export function buildPartnerShopLoginHref(
  siteSlug: string,
  fullPath: string,
  opts?: PathOpts
): string {
  const safe = sanitizePartnerShopReturnLocation(siteSlug, fullPath, opts)
  const login = partnerSiteLoginPath(siteSlug, opts)
  return `${login}?${PARTNER_SHOP_LOGIN_REDIRECT_QUERY_KEY}=${encodeURIComponent(safe)}`
}

export function buildPartnerShopLoginHrefFromParts(
  siteSlug: string,
  pathname: string | null | undefined,
  searchParams: { toString(): string } | null | undefined,
  hash?: string | null,
  opts?: PathOpts
): string {
  const qs = searchParams?.toString()
  const full = composePartnerShopReturnLocation(pathname, qs ? qs : '', hash ?? '')
  return buildPartnerShopLoginHref(siteSlug, full, opts)
}

/** Trình duyệt hiện tại — dùng trong handler (client). */
export function getPartnerShopBrowserReturnLocation(siteSlug: string, opts?: PathOpts): string {
  if (typeof window === 'undefined') return partnerSiteAccountPath(siteSlug, opts)
  const full = composePartnerShopReturnLocation(
    window.location.pathname,
    window.location.search?.replace(/^\?/, '') ?? '',
    window.location.hash || ''
  )
  if (isShopLoginPath(window.location.pathname, siteSlug)) {
    return getPartnerShopLoginRedirectFromUrl(siteSlug, opts)
  }
  return sanitizePartnerShopReturnLocation(siteSlug, full, opts)
}

/** Đọc `?redirect=` (188) hoặc `?next=` trên URL trang đăng nhập. */
export function getPartnerShopLoginRedirectFromUrl(siteSlug: string, opts?: PathOpts): string {
  const fallback = partnerSiteAccountPath(siteSlug, opts)
  if (typeof window === 'undefined') return fallback
  const sp = new URLSearchParams(window.location.search)
  const raw = sp.get(PARTNER_SHOP_LOGIN_REDIRECT_QUERY_KEY) || sp.get(LEGACY_NEXT_QUERY_KEY)
  if (!raw) return fallback
  return sanitizePartnerShopReturnLocation(siteSlug, raw, opts)
}

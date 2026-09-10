import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'

type PathOpts = { customDomain?: boolean }

/** Trang soạn tìm kiếm mobile (kiểu Shopee / 188 `/tim-kiem`) — kết quả vẫn ở `/search?q=`. */
export const PARTNER_MOBILE_SEARCH_COMPOSE_SEGMENT = 'tim-kiem'

/** Khớp 188 `md` (768): máy stamp mobile, hoặc tab <768 khi chưa khóa máy. Tablet không mở trang này. */
export const PARTNER_MOBILE_SEARCH_COMPOSE_MQ = '(max-width:767px)'

export function partnerSiteMobileSearchPath(
  siteSlug: string,
  opts?: PathOpts & { q?: string }
): string {
  const base = partnerSiteHref(siteSlug, `/${PARTNER_MOBILE_SEARCH_COMPOSE_SEGMENT}`, opts?.customDomain)
  const q = String(opts?.q ?? '').trim()
  return q ? `${base}?q=${encodeURIComponent(q)}` : base
}

export function isPartnerMobileSearchComposePath(pathname: string | null | undefined): boolean {
  if (pathname == null || pathname === '') return false
  const p = pathname.replace(/\/$/, '') || '/'
  return p === `/${PARTNER_MOBILE_SEARCH_COMPOSE_SEGMENT}` || /\/tim-kiem$/.test(p)
}

export function isPartnerShopMobileSearchComposeFace(input: {
  editDevice?: string | null
  sceneLock?: string | null
  queryDevice?: string | null
  viewportMobile?: boolean
}): boolean {
  const stamped = String(input.editDevice || input.sceneLock || input.queryDevice || '')
    .trim()
    .toLowerCase()
  if (stamped === 'mobile') return true
  if (stamped === 'desktop' || stamped === 'laptop' || stamped === 'tablet') return false
  return Boolean(input.viewportMobile)
}

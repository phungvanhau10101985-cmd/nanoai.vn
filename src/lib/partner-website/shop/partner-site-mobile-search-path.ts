import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'

type PathOpts = { customDomain?: boolean }

/** Trang soạn tìm kiếm (kiểu 188 `/tim-kiem`) — mọi máy. Kết quả vẫn ở `/search?q=`. */
export const PARTNER_MOBILE_SEARCH_COMPOSE_SEGMENT = 'tim-kiem'

/** Legacy MQ — 188 mở `/tim-kiem` trên mọi máy, không còn cổng <768. */
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

/** 188: mọi máy bấm ô tìm → `/tim-kiem`. Stamp / viewport không đổi. */
export function isPartnerShopMobileSearchComposeFace(_input?: {
  editDevice?: string | null
  sceneLock?: string | null
  queryDevice?: string | null
  viewportMobile?: boolean
}): boolean {
  return true
}

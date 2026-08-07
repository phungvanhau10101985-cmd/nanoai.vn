import { headers } from 'next/headers'
import { readPartnerCustomDomainFromHeaders } from '@/lib/auth/app-request-headers'
import { getPublicOriginFromAppRouterHeaders } from '@/lib/auth/public-app-url'
import { partnerSiteHref } from '@/lib/messaging/partner-custom-domain-site-path'

/**
 * W4.12/S0.6 — URL tuyệt đối cho JSON-LD/canonical trên trang shop công khai.
 * Đọc header do middleware gắn (`x-partner-custom-domain`) để biết đang mở qua domain riêng
 * hay platform, rồi ghép đúng path (`/c/...` hay `/site/{slug}/c/...`).
 */
export function resolvePartnerSiteAbsoluteUrl(siteSlug: string, subpath: string): string {
  const headerStore = headers()
  const onCustomDomain = Boolean(readPartnerCustomDomainFromHeaders((name) => headerStore.get(name)))
  const origin = getPublicOriginFromAppRouterHeaders(headerStore)
  const path = partnerSiteHref(siteSlug, subpath, onCustomDomain)
  return `${origin}${path}`
}

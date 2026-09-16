import {
  normalizePartnerCustomDomainHostname,
  partnerCustomDomainSeoHostname,
} from '@/lib/messaging/partner-custom-domain-hostname'
import { sanitizePartnerShopSlogan } from '@/lib/partner-website/shop/partner-site-shop-slogan'

const PLATFORM_HOST_RE = /(^|\.)nanoai\.vn$/i

/** Hostname shop (apex, không www) — bỏ domain nền tảng NanoAI. */
export function partnerShopBrandHostname(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    const url = new URL(s.includes('://') ? s : `https://${s}`)
    const host = partnerCustomDomainSeoHostname(url.hostname)
    if (!host || PLATFORM_HOST_RE.test(host)) return ''
    return normalizePartnerCustomDomainHostname(host) || ''
  } catch {
    const host = partnerCustomDomainSeoHostname(s.replace(/^www\./i, ''))
    if (!host || PLATFORM_HOST_RE.test(host)) return ''
    return normalizePartnerCustomDomainHostname(host) || ''
  }
}

/**
 * Title tab trình duyệt cho shop white-label: tên miền khách + slogan.
 * Không gắn «NanoAI» / «Login».
 */
export function buildPartnerShopBrandDocumentTitle(input: {
  hostname?: string | null
  slogan?: string | null
  fallbackName?: string | null
}): string {
  const fromHost = partnerShopBrandHostname(input.hostname)
  const fromName = partnerShopBrandHostname(input.fallbackName)
  const brand = fromHost || fromName || String(input.fallbackName ?? '').trim()
  const slogan = sanitizePartnerShopSlogan(input.slogan)
  if (brand && slogan && brand.toLowerCase() !== slogan.toLowerCase()) {
    return `${brand} — ${slogan}`
  }
  return brand || slogan || 'Shop'
}

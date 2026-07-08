import { rewriteLegacyBunnyCdnUrl } from '@/lib/bunny-cdn-url'

/** Pull zone Bunny cũ của shop 188 — ISP VN có thể chặn *.b-cdn.net (DNS NXDOMAIN). */
export const LEGACY_188_SHOP_CDN_HOST = '188comvn.b-cdn.net'

/** Host CDN public mới (custom hostname Bunny). */
export function get188ShopCdnPublicBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_188_CDN_PUBLIC_BASE_URL?.trim() ||
    process.env.SHOP188_CDN_PUBLIC_BASE_URL?.trim() ||
    'https://cdn.188.com.vn'
  return raw.replace(/\/$/, '')
}

/**
 * Đổi host `188comvn.b-cdn.net` → CDN custom (mặc định `https://cdn.188.com.vn`).
 * URL cũ trong DB / JSON không cần migrate ngay nếu gọi hàm này lúc render hoặc tải ảnh.
 */
export function rewriteLegacy188ShopCdnUrl(url: string | null | undefined): string {
  const t = String(url ?? '').trim()
  if (!t) return ''
  if (!/^https?:\/\//i.test(t) && !t.startsWith('//')) return t

  try {
    const u = new URL(t.startsWith('//') ? `https:${t}` : t)
    if (u.hostname.toLowerCase() !== LEGACY_188_SHOP_CDN_HOST) return t
    const base = get188ShopCdnPublicBase()
    if (!base) return t
    return `${base}${u.pathname}${u.search}${u.hash}`
  } catch {
    return t
  }
}

/** Thay host legacy trong chuỗi (JSON stock_note, variant_image_urls, raw_payload…). */
export function replaceLegacy188ShopCdnHostInText(text: string): string {
  const t = String(text ?? '')
  if (!t.includes(LEGACY_188_SHOP_CDN_HOST)) return t
  const base = get188ShopCdnPublicBase()
  if (!base) return t
  try {
    const targetHost = new URL(base).hostname
    return t.split(LEGACY_188_SHOP_CDN_HOST).join(targetHost)
  } catch {
    return t
  }
}

/** Chuỗi rewrite CDN cho messaging / kho shop: 188 shop + Bunny NanoAI. */
export function rewriteAllMessagingCdnUrls(url: string | null | undefined): string {
  return rewriteLegacyBunnyCdnUrl(rewriteLegacy188ShopCdnUrl(url))
}

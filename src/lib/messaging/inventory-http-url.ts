import { normalizeAlicdnImageUrl } from '@/lib/fetch-image-1688'
import { rewriteLegacy188ShopCdnUrl } from '@/lib/shop188-cdn-url'

/** Chuẩn hoá URL http(s) cho ảnh/video/link trong kho (tránh import `xlsx` phía client). */
export function validateInventoryHttpUrl(raw: string): string {
  let u = raw.trim()
  if (!u || u.length > 2048) return ''
  if (u.startsWith('//')) u = `https:${u}`
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return normalizeAlicdnImageUrl(rewriteLegacy188ShopCdnUrl(u))
  } catch {
    return ''
  }
}

import { randomInt } from 'node:crypto'
import { normalizeAlicdnImageUrl } from '@/lib/fetch-image-1688'

const VIPOMALL_IMAGE_HOST_MARKERS = ['viposeller', 'viettelidc.com.vn']

export function cleanText(raw: unknown, limit = 500): string {
  const s = String(raw ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return s.slice(0, limit)
}

export function parseVndPrice(raw: unknown): number {
  const digits = String(raw ?? '').replace(/[^\d]/g, '')
  if (!digits) return 0
  const val = Number.parseInt(digits, 10)
  return Number.isFinite(val) && val > 0 ? val : 0
}

export function listingVndPerCny(): number {
  const raw = process.env.LISTING_IMPORT_VND_PER_CNY
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0) return n
  return 3580
}

export function estimateCnyFromVnd(priceVnd: number): string {
  if (!Number.isFinite(priceVnd) || priceVnd <= 0) return ''
  const cny = priceVnd / listingVndPerCny()
  return String(cny.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '')
}

export function normProductImageUrl(raw: string, extraBlockHosts: string[] = []): string {
  let u = (raw || '').trim().replace(/^["']+|["']+$/g, '')
  if (!u) return ''
  if (u.startsWith('//')) u = `https:${u}`
  if (u.startsWith('http://')) u = `https://${u.slice('http://'.length)}`
  const low = u.toLowerCase()
  if ([...VIPOMALL_IMAGE_HOST_MARKERS, ...extraBlockHosts].some((m) => low.includes(m))) return ''
  return normalizeAlicdnImageUrl(u)
}

export function dedupeUrls(values: string[], extraBlockHosts: string[] = []): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const u = normProductImageUrl(String(raw || ''), extraBlockHosts)
    if (!u) continue
    const k = u.split('?')[0]
    if (seen.has(k)) continue
    seen.add(k)
    out.push(u)
  }
  return out
}

export function syntheticEngagementCounts(): {
  likes: number
  question_total: number
  purchases: number
  rating_total: number
  rating_point: number
} {
  const rand = (lo: number, hi: number) => randomInt(lo, hi + 1)
  const likes = rand(96, 138)
  const question_total = Math.max(0, likes - rand(5, 15))
  const purchases = Math.max(0, question_total - rand(5, 12))
  const rating_total = Math.max(0, purchases - rand(5, 15))
  const cents = rand(480, 500)
  return {
    likes,
    question_total,
    purchases,
    rating_total,
    rating_point: Math.round(cents) / 100,
  }
}

export function isVariantInStock(r: Record<string, unknown>): boolean {
  if (r.in_stock === false) return false
  const stockText = cleanText(r.stock_text || '', 160)
  if (/hết\s*hàng/i.test(stockText)) return false
  if (r.in_stock === true) return true
  const stock = Number(r.stock || 0) || 0
  if (stock > 0) return true
  if (/có\s*sẵn/i.test(stockText)) return true
  return false
}

export function mergeListingOverlayIntoProductData(
  productData: Record<string, unknown>,
  overlay: Record<string, unknown> | null | undefined
): void {
  if (!overlay) return
  const cn = String(overlay.chinese_name || '').trim()
  if (cn) productData.chinese_name = cn
  const shopCn = String(overlay.shop_name_chinese || '').trim()
  if (shopCn) productData.shop_name_chinese = shopCn
  const pl = String(overlay.pro_lower_price || '').trim()
  if (pl) productData.pro_lower_price = pl
  const ph = String(overlay.pro_high_price || '').trim()
  if (ph) productData.pro_high_price = ph
  const price = overlay.price
  if (typeof price === 'number' && Number.isFinite(price) && price > 0) {
    productData.price = price
  }
}

export function preferListingChineseName(productData: Record<string, unknown>): void {
  const cn = String(productData.chinese_name || '').trim()
  if (!cn) return
  const cur = String(productData.name || '').trim()
  if (cur && cur !== cn) {
    const pi =
      productData.product_info && typeof productData.product_info === 'object'
        ? (productData.product_info as Record<string, unknown>)
        : {}
    const inner =
      pi.product_info && typeof pi.product_info === 'object'
        ? (pi.product_info as Record<string, unknown>)
        : {}
    if (!inner.scraped_display_name_before_excel_chinese_name) {
      inner.scraped_display_name_before_excel_chinese_name = cur.slice(0, 500)
    }
    pi.product_info = inner
    productData.product_info = pi
  }
  productData.name = cn.slice(0, 500)
}

export const IMPORT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

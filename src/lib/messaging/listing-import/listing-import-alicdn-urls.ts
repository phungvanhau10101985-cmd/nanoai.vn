/**
 * Khớp 188 `backend/app/services/alicdn_urls.py`.
 * Cắt hậu tố nén AliCDN trước khi lưu Variant / gallery / mô tả.
 */

const IMG_KEYS = ['img', 'image', 'image_url', 'imageUrl', 'url', 'thumb', 'picture'] as const
const IMAGE_JSON_KEYS = ['images', 'gallery', 'colors', 'product_info'] as const
const EXTRA_LIST_KEYS = ['color_image_urls', 'detail_block_images_1688', 'color_swatch_images_1688', 'carousel_images_1688'] as const
const SUPPLIER_IMAGE_BLOCK_MARKERS = ['viposeller', 'viettelidc.com.vn']
const FIRST_JPG = /\.jpg/i
const WEBP_RESIZE_SUFFIX = /(_\d+x\d+q?\d*|\.sum)\.(jpg|jpeg|png|webp)$/gi
const STATIC_IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp)$/i
const URL_IN_TEXT = /https?:\/\/[^\s"'<>]+|\/\/[^\s"'<>]+/gi

function schemeNormalize(url: string): string {
  let u = (url || '').trim()
  if (u.startsWith('//')) u = `https:${u}`
  if (u.startsWith('http://')) u = `https://${u.slice('http://'.length)}`
  return u
}

export function isBlockedSupplierImageUrl(url: string): boolean {
  const u = (url || '').trim().toLowerCase()
  return SUPPLIER_IMAGE_BLOCK_MARKERS.some((m) => u.includes(m))
}

export function truncateAlicdnUrlToFirstJpg(url: string): string {
  const u = (url || '').trim()
  if (!u) return u
  const m = FIRST_JPG.exec(u)
  if (!m || m.index == null) return u
  return u.slice(0, m.index + m[0].length)
}

function stripImageCacheQuery(base: string, query: string): string {
  if (!query) return ''
  if (!STATIC_IMAGE_EXT_RE.test(base)) return query
  return query
    .split('&')
    .filter((part) => {
      if (!part) return false
      const key = part.split('=', 1)[0]?.trim().toLowerCase()
      return key !== '__r__'
    })
    .join('&')
}

/** Chuẩn hoá một URL ảnh trước khi lưu DB — khớp `normalize_product_image_url`. */
export function normalizeListingProductImageUrl(url: string): string {
  const u = schemeNormalize(url)
  if (!u) return ''

  const qIdx = u.indexOf('?')
  let base = qIdx >= 0 ? u.slice(0, qIdx) : u
  let query = qIdx >= 0 ? u.slice(qIdx + 1) : ''

  base = base.replace(/\.webp\.jpg$/i, '.webp').replace(/\.png\.jpg$/i, '.png')
  const lower = base.toLowerCase()

  if (/\.jpg[._?]/i.test(base)) {
    base = truncateAlicdnUrlToFirstJpg(base)
  } else if (lower.includes('.webp')) {
    base = base.replace(WEBP_RESIZE_SUFFIX, '')
    base = base.replace(/\.webp\.jpg$/i, '.webp')
  } else if (lower.endsWith('.png') || lower.includes('.png_')) {
    base = base.replace(WEBP_RESIZE_SUFFIX, '')
    base = base.replace(/\.png\.jpg$/i, '.png')
  }

  query = stripImageCacheQuery(base, query)
  const out = query ? `${base}?${query}` : base
  return isBlockedSupplierImageUrl(out) ? '' : out
}

function looksLikeImageUrl(value: string): boolean {
  const u = (value || '').trim()
  if (!u) return false
  const lower = u.toLowerCase()
  if (!(lower.startsWith('http://') || lower.startsWith('https://') || lower.startsWith('//'))) return false
  return (
    lower.includes('.jpg') ||
    lower.includes('.webp') ||
    lower.includes('.png') ||
    lower.includes('alicdn') ||
    lower.includes('/img/ibank/') ||
    lower.includes('imgextra')
  )
}

export function normalizeListingImageUrlsInText(text: string): string {
  if (!text.trim()) return text
  return text.replace(URL_IN_TEXT, (raw) => {
    if (!looksLikeImageUrl(raw)) return raw
    return normalizeListingProductImageUrl(raw) || raw
  })
}

export function normalizeListingImageUrlsDeep(value: unknown): unknown {
  if (typeof value === 'string') {
    if (looksLikeImageUrl(value)) return normalizeListingProductImageUrl(value) || value
    return value
  }
  if (Array.isArray(value)) return value.map((item) => normalizeListingImageUrlsDeep(item))
  if (value && typeof value === 'object') {
    const rec = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(rec)) {
      if ((IMG_KEYS as readonly string[]).includes(key) && typeof item === 'string' && looksLikeImageUrl(item)) {
        out[key] = normalizeListingProductImageUrl(item) || item
      } else {
        out[key] = normalizeListingImageUrlsDeep(item)
      }
    }
    return out
  }
  return value
}

/** In-place — khớp `normalize_product_data_image_urls_for_db`. */
export function normalizeListingProductDataImageUrls(productData: Record<string, unknown>): void {
  const mi = productData.main_image
  if (typeof mi === 'string' && mi.trim()) {
    productData.main_image = normalizeListingProductImageUrl(mi)
  }
  for (const key of [...IMAGE_JSON_KEYS, ...EXTRA_LIST_KEYS]) {
    const val = productData[key]
    if (val != null) productData[key] = normalizeListingImageUrlsDeep(val)
  }
  const desc = productData.description
  if (typeof desc === 'string' && desc.trim()) {
    productData.description = normalizeListingImageUrlsInText(desc)
  }
}

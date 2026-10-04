import {
  buildCanonical1688ProductId,
  buildCanonicalTaobaoProductId,
  supplyProductLinkDefaultForItemSlug,
} from '@/lib/messaging/listing-import/import-source-ids'
import { VIPOMALL_PLATFORM_TAOBAO } from '@/lib/messaging/listing-import/listing-import-urls'
import { listingSellVndForCny } from '@/lib/messaging/listing-import/listing-sell-vnd'
import { formatCnyCell, parseCnyAmount } from '@/lib/messaging/listing-import/per-sku-listing-price'
import {
  cleanText,
  dedupeUrls,
  keepListingDetailImageUrl,
  listingVndPerCny,
  normProductImageUrl,
  syntheticEngagementCounts,
} from '@/lib/messaging/listing-import/scrape-common'

const VIPOMALL_DETAIL_API = 'https://api-vipo.viettelpost.vn/listing/product/detail'
const COLOR_PROP_RE = /颜色|色|màu|color/i
const SIZE_PROP_RE = /尺码|尺寸|规格|size|kích/i
const HTML_IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["']/gi

export class VipomallApiUnavailable extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VipomallApiUnavailable'
  }
}

function propKind(propName: string): 'color' | 'size' | 'variant' {
  if (COLOR_PROP_RE.test(propName || '')) return 'color'
  if (SIZE_PROP_RE.test(propName || '')) return 'size'
  return 'variant'
}

function skuCny(sku: Record<string, unknown>): number {
  const direct = parseCnyAmount(sku.price)
  if (direct > 0) return direct
  const bands = Array.isArray(sku.price_ranges) ? sku.price_ranges : []
  for (const band of bands) {
    if (!band || typeof band !== 'object') continue
    const n = parseCnyAmount((band as Record<string, unknown>).price)
    if (n > 0) return n
  }
  return 0
}

function skuInStock(sku: Record<string, unknown>): boolean {
  if (sku.is_active === false) return false
  if (sku.stock == null || sku.stock === '') return true
  const n = Number(sku.stock)
  return Number.isFinite(n) ? n > 0 : true
}

function skuPropValues(sku: Record<string, unknown>): { kind: string; value: string }[] {
  const out: { kind: string; value: string }[] = []
  const props = Array.isArray(sku.sku_prop_list) ? sku.sku_prop_list : []
  for (const prop of props) {
    if (!prop || typeof prop !== 'object') continue
    const rec = prop as Record<string, unknown>
    const value = cleanText(rec.value_name || rec.original_value_name, 160)
    if (!value) continue
    const propName = cleanText(rec.prop_name || rec.original_prop_name, 80)
    out.push({ kind: propKind(propName), value })
  }
  return out
}

function htmlToText(rawHtml: string): string {
  let text = (rawHtml || '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
  const lines = text
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return lines.join('\n').slice(0, 20000)
}

function htmlImageUrls(rawHtml: string): string[] {
  const out: string[] = []
  for (const match of (rawHtml || '').matchAll(HTML_IMG_SRC_RE)) {
    if (match[1]) out.push(match[1])
  }
  return dedupeUrls(out)
}

export async function fetchVipomallProductDetail(
  offerId: string,
  platformType: number,
  merchantId = '101'
): Promise<Record<string, unknown>> {
  const payload = {
    product_id: String(offerId),
    platform_type: String(platformType),
    product_link: null,
    merchant_id: String(merchantId || '101'),
  }
  let body: unknown
  try {
    const resp = await fetch(VIPOMALL_DETAIL_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: 'https://vipomall.vn',
        Referer: 'https://vipomall.vn/',
        'User-Agent':
          process.env.IMPORT_1688_USER_AGENT ||
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    })
    body = await resp.json()
  } catch (error) {
    throw new VipomallApiUnavailable(error instanceof Error ? error.message : String(error))
  }
  if (!body || typeof body !== 'object' || String((body as { status?: unknown }).status || '') !== '01') {
    throw new VipomallApiUnavailable('status')
  }
  const data = (body as { data?: unknown }).data
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new VipomallApiUnavailable('Thiếu data.')
  }
  return data as Record<string, unknown>
}

type ParsedSku = {
  color: string
  size: string
  img: string
  sku_code: string
  price_cny: number
  price: number
  stock: unknown
}

export function vipomallApiDetailToProductData(
  detail: Record<string, unknown>,
  sourceUrl: string,
  offerId: string,
  platformType: number
): Record<string, unknown> {
  const rawSkus = Array.isArray(detail.product_sku_info_list) ? detail.product_sku_info_list : []
  const parsed: ParsedSku[] = []
  for (const item of rawSkus) {
    if (!item || typeof item !== 'object') continue
    const sku = item as Record<string, unknown>
    if (!skuInStock(sku)) continue
    const cny = skuCny(sku)
    if (cny <= 0) continue
    const props = skuPropValues(sku)
    let color = ''
    let size = ''
    const extras: string[] = []
    for (const prop of props) {
      if (prop.kind === 'color' && !color) color = prop.value
      else if (prop.kind === 'size' && !size) size = prop.value
      else extras.push(prop.value)
    }
    if (!color) {
      color = extras.length ? extras.join(' / ') : props[0]?.value || ''
    } else if (extras.length) {
      color = [color, ...extras].join(' / ')
    }
    const valuesForCode = props.map((p) => p.value)
    const skuCode =
      (valuesForCode.length === 1 ? valuesForCode[0] : String(sku.sku_id || '').trim() || valuesForCode.join(' / ')) ||
      color
    const sell = listingSellVndForCny(cny)
    if (sell <= 0) continue
    parsed.push({
      color: color || skuCode,
      size,
      img: normProductImageUrl(String(sku.img_url || '')),
      sku_code: (skuCode || String(sku.sku_id || '')).slice(0, 100),
      price_cny: cny,
      price: sell,
      stock: sku.stock,
    })
  }

  const hasSize = parsed.some((row) => row.size)
  if (!hasSize) for (const row of parsed) row.size = ''

  const colorsOut: Record<string, unknown>[] = []
  const seenColor = new Set<string>()
  const sizes: string[] = []
  const seenSize = new Set<string>()
  const pairs: Record<string, unknown>[] = []
  const ordered = [...parsed].sort((a, b) => a.price - b.price || a.color.localeCompare(b.color) || a.size.localeCompare(b.size))
  for (const row of ordered) {
    const label = row.color || row.sku_code || 'Mẫu'
    if (!seenColor.has(label.toLowerCase())) {
      seenColor.add(label.toLowerCase())
      const same = parsed.filter((r) => (r.color || r.sku_code) === (row.color || row.sku_code))
      const cheapest = same.reduce((best, cur) => (cur.price < best.price ? cur : best), same[0] || row)
      colorsOut.push({
        name: label,
        img: cheapest.img || row.img,
        sku: label,
        sku_code: cheapest.sku_code || label,
        price: cheapest.price,
        price_cny: cheapest.price_cny,
      })
    }
    if (hasSize && row.size && !seenSize.has(row.size.toLowerCase())) {
      seenSize.add(row.size.toLowerCase())
      sizes.push(row.size)
    }
    if (hasSize) {
      pairs.push({
        color: label,
        size: row.size,
        price: row.price,
        price_cny: row.price_cny,
        sku_code: row.sku_code,
        img: row.img,
      })
    }
  }

  if (!parsed.length) {
    const band = detail.sku_price_ranges
    const fallback = band && typeof band === 'object' ? parseCnyAmount((band as Record<string, unknown>).min_price) : 0
    if (fallback > 0) {
      parsed.push({
        color: '',
        size: '',
        img: '',
        sku_code: '',
        price_cny: fallback,
        price: listingSellVndForCny(fallback),
        stock: null,
      })
    }
  }

  const prices = parsed.map((r) => r.price).filter((n) => n > 0)
  const cnys = parsed.map((r) => r.price_cny).filter((n) => n > 0)
  const priceVnd = prices.length ? Math.min(...prices) : 0
  const cnyLow = cnys.length ? Math.min(...cnys) : 0
  const cnyHigh = cnys.length ? Math.max(...cnys) : 0
  const cheapest = parsed.length ? parsed.reduce((best, cur) => (cur.price < best.price ? cur : best)) : null

  const gallery = dedupeUrls((Array.isArray(detail.main_img_url_list) ? detail.main_img_url_list : []).map((u) => String(u)))
  const descHtml = String(detail.description || '')
  const galleryKeys = new Set(gallery.map((u) => u.split('?')[0]))
  const detailImgs = htmlImageUrls(descHtml).filter((u) => {
    if (galleryKeys.has(u.split('?')[0])) return false
    return keepListingDetailImageUrl(u)
  })
  let mainImage = cheapest?.img || gallery[0] || ''
  if (!gallery.length && mainImage) gallery.push(mainImage)

  let title = cleanText(detail.product_name, 500)
  if (!title) title = `${platformType === VIPOMALL_PLATFORM_TAOBAO ? 'Taobao' : '1688'} ${offerId}`
  const chineseName = cleanText(detail.original_product_name, 500) || null
  const infoLines: string[] = []
  for (const attr of Array.isArray(detail.product_attribute_list) ? detail.product_attribute_list : []) {
    if (!attr || typeof attr !== 'object') continue
    const rec = attr as Record<string, unknown>
    const name = cleanText(rec.attribute_name, 80)
    const vals = Array.isArray(rec.attribute_value_list) ? rec.attribute_value_list : []
    const joined = vals.map((v) => cleanText(v, 80)).filter(Boolean).join(', ')
    if (!name || !joined || joined.length > 240) continue
    infoLines.push(`${name}: ${joined}`)
  }
  let desc = htmlToText(descHtml)
  if (infoLines.length) {
    desc = `${desc ? `${desc}\n\n--- Thông số ---\n` : '--- Thông số ---\n'}${infoLines.slice(0, 40).join('\n')}`
  }

  const isTaobao = platformType === VIPOMALL_PLATFORM_TAOBAO
  const supplySlug = isTaobao ? offerId : `abb-${offerId}`
  const supplyUrl = supplyProductLinkDefaultForItemSlug(supplySlug)
  const originalUrl = cleanText(detail.original_product_url, 500)
  const productId = isTaobao ? buildCanonicalTaobaoProductId(offerId) : buildCanonical1688ProductId(offerId)
  const origin = isTaobao ? 'taobao' : '1688'
  const variantBits: string[] = []
  if (colorsOut.length) {
    variantBits.push(`Màu sắc: ${colorsOut.map((c) => String(c.name || '')).filter(Boolean).join(', ')}`)
  }
  if (sizes.length) variantBits.push(`Kích cỡ: ${sizes.join(', ')}`)
  const variants: Record<string, unknown> = {
    pairs,
    source: 'vipomall',
    supply_platform: origin,
    supply_product_url: supplyUrl,
    vipomall_product_url: sourceUrl,
    vipomall_platform_type: platformType,
  }
  if (colorsOut.length && !sizes.length) variants.variant_only = true
  if (sizes.length) variants.sizes = sizes
  if (pairs.length) {
    variants.price_pairs = pairs.map((p) => ({
      color: p.color || '',
      size: p.size || '',
      price: p.price,
      price_cny: p.price_cny,
      sku_code: p.sku_code || '',
    }))
  }
  let video = ''
  for (const key of ['main_video', 'detail_video']) {
    const cand = cleanText(detail[key], 1000)
    if (cand.startsWith('http')) {
      video = cand
      break
    }
  }
  if (!video) {
    for (const item of Array.isArray(detail.main_video_url_list) ? detail.main_video_url_list : []) {
      const cand = cleanText(item, 1000)
      if (cand.startsWith('http')) {
        video = cand
        break
      }
    }
  }
  const stocks = parsed
    .map((row) => Number(row.stock) || 0)
    .filter((n) => n > 0)
  const eng = syntheticEngagementCounts()
  const cnyLowCell = formatCnyCell(cnyLow)
  const cnyHighCell = formatCnyCell(cnyHigh) || cnyLowCell
  return {
    product_id: productId,
    code: '',
    origin,
    brand_name: null,
    name: title.slice(0, 500),
    chinese_name: chineseName,
    description: desc.slice(0, 20000),
    price: priceVnd,
    cost_cny: cnyLow > 0 ? cnyLow : null,
    shop_name: cleanText(detail.shop_name, 200) || 'Vipomall',
    shop_name_chinese: cleanText(detail.original_shop_name, 200) || null,
    shop_id: offerId,
    pro_lower_price: cnyLowCell,
    pro_high_price: cnyHighCell,
    group_rating: 888,
    group_question: 0,
    sizes,
    colors: colorsOut,
    images: gallery,
    gallery: detailImgs,
    carousel_images_1688: gallery,
    color_swatch_images_1688: colorsOut.map((c) => String(c.img || '')).filter(Boolean),
    detail_block_images_1688: detailImgs,
    link_default: originalUrl || supplyUrl || sourceUrl,
    video_link: video,
    main_image: mainImage,
    likes: eng.likes,
    purchases: eng.purchases,
    rating_total: eng.rating_total,
    question_total: eng.question_total,
    rating_point: eng.rating_point,
    available: stocks.length ? Math.max(...stocks) : 500,
    deposit_require: 1,
    category: null,
    subcategory: null,
    sub_subcategory: null,
    material: null,
    style: null,
    color: colorsOut.map((c) => String(c.name || '')).filter(Boolean).join(', ').slice(0, 500) || null,
    occasion: null,
    features: [],
    weight: null,
    product_info: {
      product_info: { name_original: chineseName || title, listing_sku_hint: productId },
      market_info: {
        currency: 'VND',
        price_cny_approx: cnyLow || null,
        listing_import_vnd_per_cny_used: listingVndPerCny(),
      },
      specifications: {
        supplier_specs_excerpt: [...variantBits, ...infoLines.slice(0, 40)].join('\n').slice(0, 4000),
      },
      variants,
    },
    is_active: true,
    slug: '',
  }
}

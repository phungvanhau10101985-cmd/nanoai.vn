import { PANDAMALL_SCRAPE_JS } from './pandamall-scrape-js'
import {
  buildCanonical1688ProductId,
  buildCanonicalTaobaoProductId,
  supplyProductLinkDefaultForItemSlug,
} from './import-source-ids'
import { extractPandamallDetail, resolvePandamallImportUrl } from './listing-import-urls'
import {
  cleanText,
  dedupeUrls,
  estimateCnyFromVnd,
  isVariantInStock,
  listingVndPerCny,
  normProductImageUrl,
  parseVndPrice,
  syntheticEngagementCounts,
} from './scrape-common'
import { ListingImportPlaywrightError, withListingImportPage } from './playwright-browser'

const BLOCK_MARKERS = ['captcha', 'cloudflare', 'cf-ray', 'access denied', 'forbidden', 'blocked']
const PANDAMALL_INFO_NOISE_RE = /(quy trình order|đăng ký tài khoản|liên hệ chúng tôi|pandamall\.vn\s*$)/i

function cleanInfoTexts(values: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const s = cleanText(raw, 400)
    if (!s || PANDAMALL_INFO_NOISE_RE.test(s)) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

function pickShopNameChinese(row: Record<string, unknown>): string | null {
  for (const raw of (row.shop_name_candidates as unknown[]) || []) {
    const s = cleanText(raw, 200)
    if (s && /[\u4e00-\u9fff]/.test(s)) return s.slice(0, 200)
  }
  return null
}

function pickCnyPrice(row: Record<string, unknown>, priceVnd: number): string {
  for (const raw of (row.cny_price_texts as unknown[]) || []) {
    const s = String(raw || '').trim().replace(/,/g, '')
    const val = Number.parseFloat(s)
    if (Number.isFinite(val) && val > 0 && val < 9_999_999) {
      return String(val.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '')
    }
  }
  return estimateCnyFromVnd(priceVnd)
}

export function pandamallRowToProductData(
  row: Record<string, unknown>,
  sourceUrl: string,
  itemId: string,
  platform: 'taobao' | '1688'
): Record<string, unknown> {
  const gallery = dedupeUrls((row.gallery_images as unknown[] | undefined)?.map((u) => String(u)) || [])
  const colorsRaw = ((row.colors as unknown[]) || []).filter((c) => c && typeof c === 'object') as Record<
    string,
    unknown
  >[]
  let colorsOut: { name: string; img: string }[] = []
  for (const [idx, c] of colorsRaw.entries()) {
    const label = cleanText(c.label, 160) || `Màu ${idx + 1}`
    const img = normProductImageUrl(String(c.image_url || ''))
    colorsOut.push({ name: label, img })
  }
  const exclude = new Set(gallery.map((u) => u.split('?')[0]))
  for (const c of colorsOut) if (c.img) exclude.add(c.img.split('?')[0])
  const detailImgs = dedupeUrls((row.detail_images as unknown[] | undefined)?.map((x) => String(x)) || []).filter(
    (u) => !exclude.has(u.split('?')[0])
  )

  const variantRows = ((row.variant_rows as unknown[]) || []).filter(
    (r) => r && typeof r === 'object' && isVariantInStock(r as Record<string, unknown>)
  ) as Record<string, unknown>[]

  const pairObjs: { color: string; size: string }[] = []
  const sizes: string[] = []
  const seenSize = new Set<string>()
  const prices: number[] = []
  const stocks: number[] = []
  const colorOnly = variantRows.length > 0 && variantRows.every((r) => !cleanText(r.size, 80))
  for (const r of variantRows) {
    const color = cleanText(r.color, 160)
    const size = cleanText(r.size, 80)
    if (colorOnly) {
      if (color) pairObjs.push({ color, size: '' })
    } else if (color && size) pairObjs.push({ color, size })
    if (!colorOnly && size && !seenSize.has(size.toLowerCase())) {
      seenSize.add(size.toLowerCase())
      sizes.push(size)
    }
    const priceVnd = parseVndPrice(r.price_vnd || r.price_text)
    if (priceVnd > 0) prices.push(priceVnd)
    const stock = Number(r.stock || 0) || 0
    if (stock > 0) stocks.push(stock)
  }

  let priceVnd = prices.length ? Math.min(...prices) : 0
  if (priceVnd <= 0) {
    for (const t of (row.price_texts as unknown[]) || []) {
      priceVnd = parseVndPrice(t)
      if (priceVnd > 0) break
    }
  }
  const mainImage = (gallery[0] || colorsOut[0]?.img || '') as string
  const galleryOut = gallery.length ? gallery : mainImage ? [mainImage] : []
  let title = cleanText(row.title || row.meta_title || row.document_title, 500)
  if (title.toLowerCase().includes('pandamall') && title.includes('-')) {
    title = title.split('-', 1)[0].trim() || title
  }
  if (!title) title = `${platform === 'taobao' ? 'Taobao' : '1688'} ${itemId}`

  const isTaobao = platform === 'taobao'
  const supplySlug = isTaobao ? itemId : `abb-${itemId}`
  const supplyUrl = supplyProductLinkDefaultForItemSlug(supplySlug)
  const productId = isTaobao ? buildCanonicalTaobaoProductId(itemId) : buildCanonical1688ProductId(itemId)
  const origin = isTaobao ? 'taobao' : '1688'
  const infoTexts = cleanInfoTexts((row.info_texts as unknown[]) || [])
  const descBase = cleanText(row.meta_description, 2000)
  const desc = infoTexts.length
    ? `${descBase ? `${descBase}\n\n--- Thông số ---\n` : '--- Thông số ---\n'}${infoTexts.slice(0, 60).join('\n')}`
    : descBase
  const cny = pickCnyPrice(row, priceVnd)
  const eng = syntheticEngagementCounts()
  const variants: Record<string, unknown> = {
    pairs: pairObjs,
    source: 'pandamall',
    supply_platform: origin,
    supply_product_url: supplyUrl,
    pandamall_product_url: sourceUrl,
  }
  if (colorOnly) variants.variant_only = true
  if (sizes.length) variants.sizes = sizes

  return {
    product_id: productId,
    code: '',
    origin,
    brand_name: null,
    name: title.slice(0, 500),
    chinese_name: title.slice(0, 500) || null,
    description: desc.slice(0, 20000),
    price: priceVnd,
    shop_name: 'PandaMall',
    shop_name_chinese: pickShopNameChinese(row),
    shop_id: itemId,
    pro_lower_price: cny,
    pro_high_price: cny,
    group_rating: 888,
    group_question: 0,
    sizes: colorOnly ? [] : sizes,
    colors: colorsOut,
    images: galleryOut,
    gallery: detailImgs,
    carousel_images_1688: galleryOut,
    color_swatch_images_1688: colorsOut.map((c) => c.img).filter(Boolean),
    detail_block_images_1688: detailImgs,
    link_default: supplyUrl || sourceUrl,
    video_link: cleanText(row.video_url, 1000),
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
    color: colorsOut.map((c) => c.name).filter(Boolean).join(', ').slice(0, 500) || null,
    occasion: null,
    features: [],
    weight: null,
    product_info: {
      product_info: { name_original: title, listing_sku_hint: productId },
      market_info: {
        currency: 'VND',
        pandamall_price_vnd: priceVnd || null,
        listing_import_vnd_per_cny_used: listingVndPerCny(),
      },
      variants,
    },
    is_active: true,
    slug: '',
  }
}

export async function scrapePandamallForImport(
  sourceUrl: string,
  partnerId?: string | null
): Promise<{ raw: Record<string, unknown>; productData: Record<string, unknown>; warnings: string[] }> {
  const resolved = resolvePandamallImportUrl(sourceUrl)
  const detail = extractPandamallDetail(resolved.url) || extractPandamallDetail(sourceUrl)
  const itemId = detail?.itemId || ''
  const raw = await withListingImportPage(resolved.url, PANDAMALL_SCRAPE_JS, ['Xem thêm', 'Xem thêm chi tiết'], {
    partnerId,
    preferHosts: ['pandamall.vn'],
    pandamallLogin: true,
  })
  const pageText = ['title', 'document_title', 'body_text_sample']
    .map((k) => String(raw[k] || ''))
    .join(' ')
    .toLowerCase()
  if (BLOCK_MARKERS.some((t) => pageText.includes(t))) {
    throw new ListingImportPlaywrightError('PandaMall đang chặn/CAPTCHA hoặc không cho tải PDP.')
  }
  const productData = pandamallRowToProductData(raw, resolved.url, itemId, resolved.platform)
  const warnings: string[] = []
  if (!Array.isArray(productData.colors) || !(productData.colors as unknown[]).length) {
    warnings.push('PandaMall: chưa thu được variant màu.')
  }
  return { raw, productData, warnings }
}

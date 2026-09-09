import { VIPOMALL_SCRAPE_JS } from './vipomall-scrape-js'
import {
  buildCanonical1688ProductId,
  buildCanonicalTaobaoProductId,
  supplyProductLinkDefaultForItemSlug,
} from './import-source-ids'
import {
  VIPOMALL_PLATFORM_1688,
  VIPOMALL_PLATFORM_TAOBAO,
  extractVipomallOfferId,
  resolveVipomallImportUrl,
} from './listing-import-urls'
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

const VIPOMALL_INFO_NOISE_RE =
  /(trung tâm hỗ trợ|hướng dẫn|ước tính chi phí|chính sách|hàng cấm|giới thiệu|điều khoản dịch vụ|quy chế hoạt động|kinh nghiệm vipomall|vipo\s*mall)/i
const BLOCK_MARKERS = ['captcha', 'cloudflare', 'cf-ray', 'access denied', 'forbidden', 'blocked']

function cleanInfoTexts(values: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    const s = cleanText(raw, 400)
    if (!s || VIPOMALL_INFO_NOISE_RE.test(s)) continue
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
  const body = String(row.body_text_sample || '')
  const m = /([\u4e00-\u9fff]{2,40}(?:旗舰店|专卖店|店))/.exec(body)
  return m?.[1]?.trim().slice(0, 200) || null
}

function pickCnyPrice(row: Record<string, unknown>, priceVnd: number): string {
  for (const raw of (row.cny_price_texts as unknown[]) || []) {
    const s = String(raw || '').trim().replace(/,/g, '')
    if (!s) continue
    const val = Number.parseFloat(s)
    if (Number.isFinite(val) && val > 0 && val < 9_999_999) {
      return String(val.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '')
    }
  }
  for (const t of (row.price_texts as unknown[]) || []) {
    const m = /(?:¥|￥|CNY|元)\s*([\d.,]+)/.exec(String(t))
    if (m) {
      const val = Number.parseFloat(m[1].replace(/,/g, ''))
      if (Number.isFinite(val) && val > 0 && val < 9_999_999) {
        return String(val.toFixed(4)).replace(/0+$/, '').replace(/\.$/, '')
      }
    }
  }
  return estimateCnyFromVnd(priceVnd)
}

function variantRowsAreColorOnly(variantRows: Record<string, unknown>[]): boolean {
  return variantRows.length > 0 && variantRows.every((r) => !cleanText(r.size, 80))
}

function appendColor(
  label: string,
  imageUrl: string,
  colorsRaw: Record<string, unknown>[],
  colorsOut: { name: string; img: string }[],
  swatches: { label: string; image_url: string | null }[],
  seen: Set<string>
) {
  const name = cleanText(label, 160)
  if (!name) return
  const key = name.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  const img = normProductImageUrl(imageUrl)
  colorsRaw.push({ label: name, image_url: img || null })
  colorsOut.push({ name, img })
  swatches.push({ label: name, image_url: img || null })
}

function remapVariantOnlyRows(
  colorsRaw: Record<string, unknown>[],
  colorsOut: { name: string; img: string }[],
  swatches: { label: string; image_url: string | null }[],
  variantRows: Record<string, unknown>[]
) {
  if (colorsOut.length) return { colorsRaw, colorsOut, swatches, variantRows }
  const remapped: Record<string, unknown>[] = []
  const newRaw = [...colorsRaw]
  const newOut = [...colorsOut]
  const newSw = [...swatches]
  const seen = new Set(newOut.map((c) => c.name.toLowerCase()).filter(Boolean))
  const hasColorField = variantRows.some((r) => cleanText(r.color, 160))
  if (hasColorField) {
    for (const r of variantRows) {
      const label = cleanText(r.color, 160)
      const img = normProductImageUrl(String(r.image_url || ''))
      if (label) appendColor(label, img, newRaw, newOut, newSw, seen)
      remapped.push(r)
    }
    return { colorsRaw: newRaw, colorsOut: newOut, swatches: newSw, variantRows: remapped }
  }
  for (const r of variantRows) {
    const label = cleanText(r.size, 160)
    if (!label) {
      remapped.push(r)
      continue
    }
    remapped.push({ ...r, color: label, size: '' })
    appendColor(label, normProductImageUrl(String(r.image_url || '')), newRaw, newOut, newSw, seen)
  }
  if (newOut.length) return { colorsRaw: newRaw, colorsOut: newOut, swatches: newSw, variantRows: remapped }
  return { colorsRaw, colorsOut, swatches, variantRows }
}

export function vipomallRowToProductData(
  row: Record<string, unknown>,
  sourceUrl: string,
  offerId: string,
  platformType: number
): Record<string, unknown> {
  const gallery = dedupeUrls((row.gallery_images as unknown[] | undefined)?.map((u) => String(u)) || [])
  const colorsRaw = ((row.colors as unknown[]) || []).filter((c) => c && typeof c === 'object') as Record<
    string,
    unknown
  >[]
  let colorsOut: { name: string; img: string }[] = []
  let swatches: { label: string; image_url: string | null }[] = []
  colorsRaw.forEach((c, idx) => {
    const label = cleanText(c.label, 160) || `Màu ${idx + 1}`
    const img = normProductImageUrl(String(c.image_url || ''))
    colorsOut.push({ name: label, img })
    swatches.push({ label, image_url: img || null })
  })

  const exclude = new Set(gallery.map((u) => u.split('?')[0]))
  for (const c of colorsOut) if (c.img) exclude.add(c.img.split('?')[0])
  const detailImgs = dedupeUrls((row.detail_images as unknown[] | undefined)?.map((x) => String(x)) || []).filter(
    (u) => !exclude.has(u.split('?')[0])
  )

  let variantRows = ((row.variant_rows as unknown[]) || []).filter(
    (r) => r && typeof r === 'object' && isVariantInStock(r as Record<string, unknown>)
  ) as Record<string, unknown>[]

  const remapped = remapVariantOnlyRows(colorsRaw, colorsOut, swatches, variantRows)
  colorsOut = remapped.colorsOut
  swatches = remapped.swatches
  variantRows = remapped.variantRows

  const colorMap = new Map<string, string>()
  remapped.colorsRaw.forEach((rawC, i) => {
    const rawLabel = cleanText(rawC.label, 160)
    const vn = cleanText(colorsOut[i]?.name, 160)
    if (rawLabel && vn) colorMap.set(rawLabel, vn)
  })

  const pairObjs: { color: string; size: string }[] = []
  const sizes: string[] = []
  const seenSize = new Set<string>()
  const prices: number[] = []
  const stocks: number[] = []
  const inStockRawColors = new Set<string>()
  const variantOnly = variantRowsAreColorOnly(variantRows)
  for (const r of variantRows) {
    const rawColor = cleanText(r.color, 160)
    const size = cleanText(r.size, 80)
    const color = colorMap.get(rawColor) || rawColor
    if (rawColor) inStockRawColors.add(rawColor)
    if (color && size) pairObjs.push({ color, size })
    if (size && !seenSize.has(size.toLowerCase())) {
      seenSize.add(size.toLowerCase())
      sizes.push(size)
    }
    const priceVnd = parseVndPrice(r.price_vnd || r.price_text)
    if (priceVnd > 0) prices.push(priceVnd)
    const stock = Number(r.stock || 0) || 0
    if (stock > 0) stocks.push(stock)
  }

  let sizesOut = sizes
  const colorOnlyLayout = Boolean(colorsOut.length) && variantOnly
  if (colorOnlyLayout) {
    sizesOut = []
    for (const r of variantRows) {
      const rawColor = cleanText(r.color, 160)
      const color = colorMap.get(rawColor) || rawColor
      if (color) pairObjs.push({ color, size: '' })
    }
  } else if (!sizesOut.length) {
    sizesOut = ((row.sizes as unknown[]) || []).map((s) => cleanText(s, 80)).filter(Boolean)
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
  if (title.toLowerCase().includes('vipomall') && title.includes('-')) {
    title = title.split('-', 1)[0].trim() || title
  }
  if (!title) title = `${platformType === VIPOMALL_PLATFORM_TAOBAO ? 'Taobao' : '1688'} ${offerId}`

  const shopCn = pickShopNameChinese(row)
  const isTaobao = platformType === VIPOMALL_PLATFORM_TAOBAO
  const supplySlug = isTaobao ? offerId : `abb-${offerId}`
  const supplyUrl = supplyProductLinkDefaultForItemSlug(supplySlug)
  const productId = isTaobao ? buildCanonicalTaobaoProductId(offerId) : buildCanonical1688ProductId(offerId)
  const origin = isTaobao ? 'taobao' : '1688'
  const cny = pickCnyPrice(row, priceVnd)
  const infoTexts = cleanInfoTexts((row.info_texts as unknown[]) || [])
  const variantParts: string[] = []
  if (colorsOut.length) {
    variantParts.push(`${colorOnlyLayout ? 'Biến thể' : 'Màu sắc'}: ${colorsOut.map((c) => c.name).filter(Boolean).join(', ')}`)
  }
  if (sizesOut.length) variantParts.push(`Kích cỡ: ${sizesOut.join(', ')}`)
  const descBase = cleanText(row.meta_description, 2000)
  const desc = infoTexts.length
    ? `${descBase ? `${descBase}\n\n--- Thông số ---\n` : '--- Thông số ---\n'}${infoTexts.slice(0, 60).join('\n')}`
    : descBase

  const variants: Record<string, unknown> = {
    pairs: pairObjs,
    source: 'vipomall',
    supply_platform: origin,
    supply_product_url: supplyUrl,
    vipomall_product_url: sourceUrl,
    vipomall_platform_type: platformType,
  }
  if (colorOnlyLayout) variants.variant_only = true
  if (swatches.length) variants.color_swatches = swatches
  if (sizesOut.length) variants.sizes = sizesOut
  if (variantRows.length) variants.vipomall_rows = variantRows.slice(0, 300)

  const productInfo = {
    product_info: { name_original: title, listing_sku_hint: productId },
    market_info: {
      currency: 'VND',
      vipomall_price_vnd: priceVnd || null,
      price_cny_approx: Number(estimateCnyFromVnd(priceVnd)) || null,
      listing_import_vnd_per_cny_used: listingVndPerCny(),
    },
    specifications: {
      supplier_specs_excerpt: [...variantParts, ...infoTexts.slice(0, 80)].join('\n').slice(0, 4000),
      vipomall_info_texts: infoTexts.slice(0, 80),
    },
    variants,
  }
  const eng = syntheticEngagementCounts()
  return {
    product_id: productId,
    code: '',
    origin,
    brand_name: null,
    name: title.slice(0, 500),
    chinese_name: title.slice(0, 500) || null,
    description: desc.slice(0, 20000),
    price: priceVnd,
    shop_name: 'Vipomall',
    shop_name_chinese: shopCn,
    shop_id: offerId,
    pro_lower_price: cny,
    pro_high_price: cny,
    group_rating: 888,
    group_question: 0,
    sizes: sizesOut,
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
    product_info: productInfo,
    is_active: true,
    slug: '',
  }
}

export async function scrapeVipomallForImport(
  sourceUrl: string,
  partnerId?: string | null
): Promise<{ raw: Record<string, unknown>; productData: Record<string, unknown>; warnings: string[] }> {
  let pageUrl: string
  let platformType: number
  try {
    const resolved = resolveVipomallImportUrl(sourceUrl)
    pageUrl = resolved.url
    platformType = resolved.platformType
  } catch (e) {
    const oid = extractVipomallOfferId(sourceUrl)
    if (!oid) throw e instanceof Error ? e : new Error(String(e))
    platformType = VIPOMALL_PLATFORM_1688
    pageUrl = `https://vipomall.vn/san-pham/${oid}?platform_type=${platformType}`
  }
  const offerId = extractVipomallOfferId(pageUrl) || ''
  const raw = await withListingImportPage(pageUrl, VIPOMALL_SCRAPE_JS, ['Xem thêm', 'Xem thêm chi tiết'], {
    partnerId,
    preferHosts: ['vipomall.vn'],
  })
  const pageText = ['title', 'document_title', 'body_text_sample']
    .map((k) => String(raw[k] || ''))
    .join(' ')
    .toLowerCase()
  if (BLOCK_MARKERS.some((t) => pageText.includes(t))) {
    throw new ListingImportPlaywrightError('Vipomall đang chặn/CAPTCHA hoặc không cho tải PDP.')
  }
  const productData = vipomallRowToProductData(raw, pageUrl, offerId, platformType)
  const warnings: string[] = []
  if (!Array.isArray(productData.colors) || !(productData.colors as unknown[]).length) {
    warnings.push('Vipomall: chưa thu được variant màu.')
  }
  if (!Array.isArray(productData.images) || !(productData.images as unknown[]).length) {
    warnings.push('Vipomall: chưa thu được ảnh gallery.')
  }
  return { raw, productData, warnings }
}

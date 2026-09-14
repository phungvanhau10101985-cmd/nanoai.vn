import { PANDAMALL_SCRAPE_JS } from './pandamall-scrape-js'
import {
  buildCanonical1688ProductId,
  buildCanonicalTaobaoProductId,
  canonical1688OfferPcUrl,
  supplyProductLinkDefaultForItemSlug,
} from './import-source-ids'
import { extractPandamallDetail, resolvePandamallImportUrl } from './listing-import-urls'
import { enrichListingProductDataFromBody, pickCnyPriceFromScrapeRow } from './listing-import-body-specs'
import {
  cleanText,
  dedupeUrls,
  estimateCnyFromVnd,
  isPandamallVariantInStock,
  listingVndPerCny,
  normProductImageUrl,
  parseVndPrice,
  syntheticEngagementCounts,
} from './scrape-common'
import { ListingImportPlaywrightError, expandPandamallDetailOnPage, withListingImportPage } from './playwright-browser'

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

function pickCnyPrice(row: Record<string, unknown>, priceVnd: number): string {
  const fromColors = ((row.colors as unknown[]) || [])
    .map((c) =>
      c && typeof c === 'object' ? String((c as Record<string, unknown>).price_cny || '') : ''
    )
    .filter(Boolean)
  if (fromColors.length && !Array.isArray(row.cny_price_texts)) {
    return pickCnyPriceFromScrapeRow({ ...row, cny_price_texts: fromColors }, priceVnd)
  }
  const merged = [...((row.cny_price_texts as unknown[]) || []), ...fromColors]
  return pickCnyPriceFromScrapeRow({ ...row, cny_price_texts: merged }, priceVnd)
}

function variantRowsAreColorOnly(variantRows: Record<string, unknown>[]): boolean {
  return variantRows.length > 0 && variantRows.every((r) => !cleanText(r.size, 80))
}

function pandamallLayoutIsColorOnly(row: Record<string, unknown>, variantRows: Record<string, unknown>[]): boolean {
  const layout = String(row.layout_mode || '').trim().toLowerCase()
  if (layout === 'color_only') return true
  const scrapedSizes = ((row.sizes as unknown[]) || []).map((s) => cleanText(s, 80)).filter(Boolean)
  if (scrapedSizes.length) return false
  return variantRowsAreColorOnly(variantRows)
}

export function pandamallRowToProductData(
  row: Record<string, unknown>,
  sourceUrl: string,
  itemId: string,
  platform: 'taobao' | '1688'
): Record<string, unknown> {
  const gallery = dedupeUrls((row.gallery_images as unknown[] | undefined)?.map((u) => String(u)) || [])
  const metaImage = normProductImageUrl(String(row.meta_image || ''))
  const colorsRaw = ((row.colors as unknown[]) || []).filter((c) => c && typeof c === 'object') as Record<
    string,
    unknown
  >[]
  let colorsOut: { name: string; img: string }[] = []
  let swatches: { label: string; image_url: string | null }[] = []
  for (const [idx, c] of colorsRaw.entries()) {
    const label = cleanText(c.label, 160) || `Màu ${idx + 1}`
    const img = normProductImageUrl(String(c.image_url || ''))
    colorsOut.push({ name: label, img })
    swatches.push({ label, image_url: img || null })
  }
  const exclude = new Set(gallery.map((u) => u.split('?')[0]))
  for (const c of colorsOut) if (c.img) exclude.add(c.img.split('?')[0])
  const detailImgs = dedupeUrls((row.detail_images as unknown[] | undefined)?.map((x) => String(x)) || []).filter(
    (u) => !exclude.has(u.split('?')[0])
  )

  const variantRows = ((row.variant_rows as unknown[]) || []).filter(
    (r) => r && typeof r === 'object' && isPandamallVariantInStock(r as Record<string, unknown>)
  ) as Record<string, unknown>[]

  const colorMap = new Map<string, string>()
  colorsRaw.forEach((rawC, i) => {
    const rawLabel = cleanText(rawC.label, 160)
    const vn = cleanText(colorsOut[i]?.name, 160)
    if (rawLabel && vn) colorMap.set(rawLabel, vn)
  })

  const colorOnlyLayout = pandamallLayoutIsColorOnly(row, variantRows)
  let pairObjs: { color: string; size: string }[] = []
  let sizes: string[] = []
  const seenSize = new Set<string>()
  const prices: number[] = []
  const stocks: number[] = []
  const inStockRawColors = new Set<string>()
  for (const r of variantRows) {
    const rawColor = cleanText(r.color, 160)
    const size = cleanText(r.size, 80)
    const color = colorMap.get(rawColor) || rawColor
    if (rawColor) inStockRawColors.add(rawColor)
    if (colorOnlyLayout) {
      if (color) pairObjs.push({ color, size: '' })
    } else if (color && size) {
      pairObjs.push({ color, size })
    }
    if (!colorOnlyLayout && size && !seenSize.has(size.toLowerCase())) {
      seenSize.add(size.toLowerCase())
      sizes.push(size)
    }
    const priceVnd = parseVndPrice(r.price_vnd || r.price_text)
    if (priceVnd > 0) prices.push(priceVnd)
    const stock = Number(r.stock || 0) || 0
    if (stock > 0) stocks.push(stock)
  }

  if (inStockRawColors.size) {
    const keptOut: { name: string; img: string }[] = []
    const keptSw: { label: string; image_url: string | null }[] = []
    colorsRaw.forEach((rawC, i) => {
      if (!inStockRawColors.has(cleanText(rawC.label, 160))) return
      if (colorsOut[i]) keptOut.push(colorsOut[i])
      if (swatches[i]) keptSw.push(swatches[i])
    })
    colorsOut = keptOut
    swatches = keptSw
  }

  if (!colorOnlyLayout) {
    const scrapedSizes = ((row.sizes as unknown[]) || []).map((s) => cleanText(s, 80)).filter(Boolean)
    if (!sizes.length) sizes = scrapedSizes
    else if (scrapedSizes.length) sizes = scrapedSizes
    if (colorsOut.length && sizes.length) {
      pairObjs = []
      for (const c of colorsOut) {
        const cname = cleanText(c.name, 160)
        if (!cname) continue
        for (const sz of sizes) pairObjs.push({ color: cname, size: sz })
      }
    }
  } else {
    sizes = []
    if (!pairObjs.length) {
      pairObjs = colorsOut.filter((c) => c.name).map((c) => ({ color: c.name, size: '' }))
    }
  }

  let priceVnd = prices.length ? Math.min(...prices) : 0
  if (priceVnd <= 0) {
    for (const t of (row.price_texts as unknown[]) || []) {
      priceVnd = parseVndPrice(t)
      if (priceVnd > 0) break
    }
  }
  const mainImage = (gallery[0] || colorsOut[0]?.img || metaImage || '') as string
  const galleryOut = gallery.length ? gallery : mainImage ? [mainImage] : []
  let title = cleanText(row.title || row.meta_title || row.document_title, 500)
  if (title.toLowerCase().includes('pandamall') && title.includes('-')) {
    title = title.split('-', 1)[0].trim() || title
  }
  if (!title) title = `${platform === 'taobao' ? 'Taobao' : '1688'} ${itemId}`

  const isTaobao = platform === 'taobao'
  const supplySlug = isTaobao ? itemId : `abb-${itemId}`
  let supplyUrl = supplyProductLinkDefaultForItemSlug(supplySlug)
  if (!isTaobao && /^\d+$/.test(itemId)) {
    supplyUrl = canonical1688OfferPcUrl(itemId) || supplyUrl
  }
  const productId = isTaobao ? buildCanonicalTaobaoProductId(itemId) : buildCanonical1688ProductId(itemId)
  const origin = isTaobao ? 'taobao' : '1688'
  const infoTexts = cleanInfoTexts((row.info_texts as unknown[]) || [])
  const variantParts: string[] = []
  if (colorsOut.length) {
    variantParts.push(
      `${colorOnlyLayout ? 'Biến thể' : 'Màu sắc'}: ${colorsOut.map((c) => c.name).filter(Boolean).join(', ')}`
    )
  }
  if (sizes.length) variantParts.push(`Kích cỡ: ${sizes.join(', ')}`)
  const descBase = cleanText(row.description_text || row.meta_description, 12000)
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
    pandamall_platform: platform,
  }
  if (colorOnlyLayout) variants.variant_only = true
  if (swatches.length) variants.color_swatches = swatches
  if (sizes.length) variants.sizes = sizes
  if (variantRows.length) variants.pandamall_rows = variantRows.slice(0, 300)

  const out: Record<string, unknown> = {
    product_id: productId,
    code: '',
    origin,
    brand_name: null,
    name: title.slice(0, 500),
    chinese_name: title.slice(0, 500) || null,
    description: desc.slice(0, 20000),
    price: priceVnd,
    shop_name: 'PandaMall',
    shop_name_chinese: null,
    shop_id: itemId,
    pro_lower_price: cny,
    pro_high_price: cny,
    group_rating: 888,
    group_question: 0,
    sizes,
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
        price_cny_approx: Number(estimateCnyFromVnd(priceVnd)) || null,
        listing_import_vnd_per_cny_used: listingVndPerCny(),
      },
      specifications: {
        supplier_specs_excerpt: [...variantParts, ...infoTexts.slice(0, 80)].join('\n').slice(0, 4000),
        pandamall_info_texts: infoTexts.slice(0, 80),
      },
      variants,
    },
    is_active: true,
    slug: '',
  }
  enrichListingProductDataFromBody(out, row)
  return out
}

export async function scrapePandamallForImport(
  sourceUrl: string,
  partnerId?: string | null
): Promise<{ raw: Record<string, unknown>; productData: Record<string, unknown>; warnings: string[] }> {
  const resolved = resolvePandamallImportUrl(sourceUrl)
  const detail = extractPandamallDetail(resolved.url) || extractPandamallDetail(sourceUrl)
  const itemId = detail?.itemId || ''
  const raw = await withListingImportPage(resolved.url, PANDAMALL_SCRAPE_JS, {
    partnerId,
    preferHosts: ['pandamall.vn'],
    pandamallLogin: true,
    afterIdle: expandPandamallDetailOnPage,
    scrollDetailModal: false,
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
    warnings.push('PandaMall: chưa thu được màu từ .item-property / .variation-values.')
  } else if (
    (!Array.isArray(productData.sizes) || !(productData.sizes as unknown[]).length) &&
    (productData.product_info as Record<string, unknown> | undefined)?.variants &&
    ((productData.product_info as Record<string, unknown>).variants as Record<string, unknown>).variant_only
  ) {
    const nColors = (productData.colors as unknown[]).length
    if (nColors) {
      warnings.push(`PandaMall: layout chỉ màu/biến thể (túi, phụ kiện…) — ${nColors} màu, không có size.`)
    }
  }
  if (
    (!Array.isArray(productData.sizes) || !(productData.sizes as unknown[]).length) &&
    (!Array.isArray(productData.colors) || !(productData.colors as unknown[]).length)
  ) {
    warnings.push('PandaMall: chưa thu được size/màu từ trang chi tiết.')
  }
  if (!Array.isArray(productData.gallery) || !(productData.gallery as unknown[]).length) {
    warnings.push('PandaMall: chưa thu được gallery từ swiper.')
  }
  return { raw, productData, warnings }
}

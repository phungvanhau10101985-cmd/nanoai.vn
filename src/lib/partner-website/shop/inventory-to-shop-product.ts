import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { parseColorVariantsJson } from '@/lib/messaging/inventory-color-variants'
import type { Catalog188Snapshot } from '@/lib/messaging/partner-inventory-catalog-188'
import {
  collectShopProductDetailImages,
  collectShopProductGalleryImages,
  collectShopProductMaterialImageUrl,
  collectShopProductRealUseImages,
  inventoryShopDetailDescription,
  inventoryShopProductVideoUrl,
  normalizeShopImageUrl,
  pickShopCardImageRaw,
  type InventoryShopSourceRow,
} from '@/lib/partner-website/shop/inventory-shop-detail'
import { parseInventorySizesForFacet } from '@/lib/partner-website/shop/partner-shop-industry-facets'
import {
  isDisplayablePdpScalar,
  isPdpProductInfoJsonBlob,
  parsePdpProductInfo,
  shopDisplayConsultNote,
} from '@/lib/partner-website/shop/pdp-product-info-html'
import type { LivePdpBindColor } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { normalizePartnerSalePriceAmount } from '@/lib/partner-website/shop/partner-shop-flash-sale'

type InventoryShopProductRow = InventoryShopSourceRow & {
  id: string
  name?: string | null
  price_hint?: string | null
  sku?: string | null
  remarketing_id?: string | null
  product_url?: string | null
  stock_qty?: number | null
  price_amount?: number | null
  price_currency?: string | null
  sale_price_amount?: number | null
  sale_starts_at?: string | null
  sale_ends_at?: string | null
  is_clearance?: boolean | null
  description?: string | null
  sizes_json?: unknown
  sizeGuideImageUrl?: string | null
  brand_name?: string | null
  origin?: string | null
  source_origin?: string | null
  material_note?: string | null
  style?: string | null
  occasion?: string | null
  weight?: string | null
  features_json?: unknown
  chinese_name?: string | null
  color_summary?: string | null
  consult_note?: string | null
  category_l1?: string | null
  category_l2?: string | null
  category_l3?: string | null
  source_shop_name?: string | null
  source_shop_id?: string | null
  source_shop_name_chinese?: string | null
  price_low_hint?: string | null
  price_high_hint?: string | null
  catalog_slug?: string | null
  catalog_json?: unknown
  product_info_json?: unknown
  deposit_required?: boolean | null
  likes_count?: number | null
  purchases_count?: number | null
  reviews_count?: number | null
  questions_count?: number | null
  rating_score?: number | null
}

/** Small, denormalized projection used by storefront cards and ID batches. */
export type PartnerInventoryShopCardRow = {
  id: string
  partner_id: string
  sort_order: number
  sku: string | null
  name: string
  stock_qty: number
  price_hint: string
  image_url: string
  product_url: string
  remarketing_id: string
  is_active: boolean
  is_clearance: boolean
  price_amount: number | null
  price_currency: string
  sale_price_amount: number | null
  sale_starts_at: string | null
  sale_ends_at: string | null
  category_l1: string | null
  category_l2: string | null
  category_l3: string | null
  likes_count: number
  purchases_count: number
  reviews_count: number
  questions_count: number
  rating_score: number
  created_at: string
  updated_at: string
}

function catalog188SnapshotOf(raw: unknown): Catalog188Snapshot | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as Catalog188Snapshot
}

function catalogStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((x) => String(x ?? '').trim()).filter(Boolean)
}

function firstCatalogUrls(primary: unknown, fallback: unknown): string[] {
  const a = catalogStringList(primary)
  return a.length ? a : catalogStringList(fallback)
}

function firstValidShopImageUrl(...vals: unknown[]): string {
  for (const raw of vals) {
    const url = normalizeShopImageUrl(String(raw ?? ''))
    if (url) return url
  }
  return ''
}

function firstCatalogText(...vals: unknown[]): string | null {
  for (const raw of vals) {
    const v = String(raw ?? '').trim()
    if (isDisplayablePdpScalar(v)) return v
  }
  return null
}

function firstCatalogCount(...vals: unknown[]): number {
  for (const raw of vals) {
    const n = Math.round(Number(raw))
    if (Number.isFinite(n) && n > 0) return n
  }
  return 0
}

/** Điền cột denormalized trống từ snapshot Excel/188 (`catalog_json`) — PDP đọc đủ hàng sản phẩm. */
export function hydrateInventoryShopRowFromCatalog188(row: InventoryShopProductRow): InventoryShopProductRow {
  const snap = catalog188SnapshotOf(row.catalog_json)
  if (!snap) return row
  const snapColors = Array.isArray(snap.colors)
    ? snap.colors
        .map((c) => ({
          name: String(c?.name || '').trim(),
          img: String(c?.img || '').trim(),
        }))
        .filter((c) => c.name)
    : []
  return {
    ...row,
    name: firstCatalogText(row.name, snap.name) || row.name,
    description:
      firstCatalogText(String(row.description ?? '').trim().startsWith('[') ? '' : row.description, snap.description) ||
      row.description,
    sku: firstCatalogText(row.sku, snap.code) || row.sku,
    remarketing_id: firstCatalogText(row.remarketing_id, snap.product_id) || row.remarketing_id,
    image_url: firstValidShopImageUrl(row.image_url, snap.main_image) || row.image_url,
    product_url: firstCatalogText(row.product_url, snap.link_default) || row.product_url,
    product_video_url: firstCatalogText(row.product_video_url, snap.video_link) || row.product_video_url,
    gallery_urls: firstCatalogUrls(row.gallery_urls, snap.images),
    detail_image_urls: firstCatalogUrls(row.detail_image_urls, snap.gallery),
    sizes_json: Array.isArray(row.sizes_json)
      ? row.sizes_json
      : snap.sizes?.length
        ? snap.sizes
        : row.sizes_json,
    colors_json: Array.isArray(row.colors_json)
      ? row.colors_json
      : snapColors.length
        ? snapColors
        : row.colors_json,
    brand_name: firstCatalogText(row.brand_name, snap.brand_name) || row.brand_name,
    source_origin: firstCatalogText(row.source_origin, row.origin, snap.origin) || row.source_origin,
    origin: firstCatalogText(row.origin, snap.origin) || row.origin,
    material_note: firstCatalogText(row.material_note, snap.material) || row.material_note,
    style: firstCatalogText(row.style, snap.style) || row.style,
    occasion: firstCatalogText(row.occasion, snap.occasion) || row.occasion,
    weight: firstCatalogText(row.weight, snap.weight) || row.weight,
    color_summary: firstCatalogText(row.color_summary, snap.color) || row.color_summary,
    chinese_name: firstCatalogText(row.chinese_name, snap.chinese_name) || row.chinese_name,
    category_l1: firstCatalogText(row.category_l1, snap.category) || row.category_l1,
    category_l2: firstCatalogText(row.category_l2, snap.subcategory) || row.category_l2,
    category_l3: firstCatalogText(row.category_l3, snap.sub_subcategory) || row.category_l3,
    source_shop_name: firstCatalogText(row.source_shop_name, snap.shop_name) || row.source_shop_name,
    source_shop_id: firstCatalogText(row.source_shop_id, snap.shop_id) || row.source_shop_id,
    source_shop_name_chinese:
      firstCatalogText(row.source_shop_name_chinese, snap.shop_name_chinese) || row.source_shop_name_chinese,
    price_low_hint: firstCatalogText(row.price_low_hint, snap.pro_lower_price) || row.price_low_hint,
    price_high_hint: firstCatalogText(row.price_high_hint, snap.pro_high_price) || row.price_high_hint,
    catalog_slug: firstCatalogText(row.catalog_slug, snap.slug) || row.catalog_slug,
    features_json: Array.isArray(row.features_json)
      ? row.features_json
      : Array.isArray(snap.features) && snap.features.length
        ? snap.features
        : row.features_json,
    product_info_json: row.product_info_json ?? snap.product_info,
    deposit_required:
      typeof row.deposit_required === 'boolean' ? row.deposit_required : snap.deposit_require === true,
    likes_count: firstCatalogCount(row.likes_count, snap.likes),
    purchases_count: firstCatalogCount(row.purchases_count, snap.purchases),
    reviews_count: firstCatalogCount(row.reviews_count, snap.rating_total),
    questions_count: firstCatalogCount(row.questions_count, snap.question_total),
    rating_score: Number(row.rating_score) || Number(snap.rating_point) || 0,
    stock_qty: firstCatalogCount(row.stock_qty, snap.available) || row.stock_qty,
    price_amount:
      row.price_amount != null && Number.isFinite(Number(row.price_amount))
        ? row.price_amount
        : Number(snap.price) > 0
          ? Number(snap.price)
          : row.price_amount,
    price_hint: firstCatalogText(row.price_hint) || row.price_hint,
  }
}

export type PartnerSiteShopProduct = {
  id: string
  name: string
  description: string
  detailDescription: string
  galleryImages: string[]
  detailImages: string[]
  productVideoUrl: string | null
  priceHint: string
  imageUrl: string
  productUrl: string
  sku: string
  detailPath: string
  /** Tồn kho hiện tại — chỉ dùng để hiển thị cảnh báo "sắp hết hàng" (W1.6), KHÔNG dùng để chặn mua
   * (nhiều shop chưa từng nhập số liệu này nên mặc định 0 — chặn mua theo giá trị này sẽ hỏng
   * checkout hàng loạt cho shop chưa cấu hình tồn kho, xem partner-site-shop-product-client.tsx). */
  stockQty: number
  /** W4.10 / W1.4 — optional on mock/SSR stubs */
  priceAmount?: number | null
  priceCurrency?: string
  salePriceAmount?: number | null
  saleStartsAt?: string | null
  saleEndsAt?: string | null
  isClearance?: boolean
  siteSalePhase?: 'off' | 'teaser' | 'active'
  siteSalePercent?: number
  siteSaleExpectedPrice?: number | null
  siteSale?: import('@/lib/partner-website/promotions/partner-site-sale-display').PartnerSiteSalePricing | null
  sizes: string[]
  colors: LivePdpBindColor[]
  /** W1.5 — resolved from primary category when available. */
  sizeGuideImageUrl?: string | null
  categoryId?: string | null
  categoryPath?: string | null
  brandName?: string | null
  origin?: string | null
  material?: string | null
  style?: string | null
  occasion?: string | null
  weight?: string | null
  features?: string[] | null
  chineseName?: string | null
  colorSummary?: string | null
  consultNote?: string | null
  materialImageUrl?: string | null
  realUseImageUrls?: string[] | null
  questionsCount?: number
  categoryL1?: string | null
  categoryL2?: string | null
  categoryL3?: string | null
  remarketingId?: string | null
  sourceShopName?: string | null
  sourceShopNameChinese?: string | null
  priceLowHint?: string | null
  priceHighHint?: string | null
  catalogSlug?: string | null
  /** Cột AK — chỉ gắn khi PDP (`pdp: true`), không nhét vào listing. */
  productInfo?: Record<string, unknown> | null
  depositPolicy?: boolean | null
  likesCount?: number
  purchasesCount?: number
  reviewsCount?: number
  ratingScore?: number
}
/** Mô tả hiển thị shop — bỏ qua cột JSON size/màu (description / stock_note). */
export function inventoryShopDisplayDescription(row: {
  description?: string | null
  stock_note?: string | null
  consult_note?: string | null
}): string {
  const consult = (row.consult_note ?? '').trim()
  const desc = (row.description ?? '').trim()
  const stock = (row.stock_note ?? '').trim()
  if (desc && !desc.startsWith('[') && !isPdpProductInfoJsonBlob(desc)) return desc
  const consultText = shopDisplayConsultNote(consult)
  if (consultText) return consultText
  if (stock && !stock.startsWith('[') && !isPdpProductInfoJsonBlob(stock)) return stock
  return ''
}

export function inventoryRowToShopProduct(
  siteSlug: string,
  rawRow: InventoryShopProductRow,
  opts?: { pdp?: boolean }
): PartnerSiteShopProduct | null {
  const row = hydrateInventoryShopRowFromCatalog188(rawRow)
  const name = (row.name ?? '').trim() || 'Product'
  const detailPath = partnerSiteProductPath(siteSlug, row.id, { name })
  const galleryImages = collectShopProductGalleryImages(row)
  const snap = catalog188SnapshotOf(row.catalog_json)
  const rawImage =
    normalizeShopImageUrl(
      pickShopCardImageRaw({
        image_url: row.image_url,
        main_image: snap?.main_image,
        galleryImages,
        images: snap?.images,
      })
    ) ||
    firstValidShopImageUrl(row.image_url, galleryImages[0]) ||
    galleryImages[0] ||
    ''
  // Prefer a reachable https image; otherwise keep a visible placeholder so catalog is not empty.
  const imageUrl = rawImage
    ? rawImage
    : `https://placehold.co/600x600/f1f5f9/64748b?text=${encodeURIComponent(name.slice(0, 18))}`
  const rawProductUrl = (row.product_url ?? '').trim()
  // Chat inventory often omits product_url — shop detail path is enough.
  const productUrl = /^https?:\/\//i.test(rawProductUrl)
    ? rawProductUrl
    : `https://shop.local${detailPath}`
  const variants = inventoryRowToLivePdpVariants(row)
  const sku = (row.sku ?? '').trim() || (row.remarketing_id ?? '').trim()
  const textField = (raw: unknown) => {
    const v = String(raw ?? '').trim()
    return isDisplayablePdpScalar(v) ? v : null
  }
  const features = Array.isArray(row.features_json)
    ? row.features_json.map((x) => String(x ?? '').trim()).filter((x) => isDisplayablePdpScalar(x))
    : []
  return {
    id: row.id,
    name,
    description: inventoryShopDisplayDescription(row),
    detailDescription: inventoryShopDetailDescription(row),
    galleryImages: galleryImages.length
      ? galleryImages
      : /^https?:\/\//i.test(rawImage)
        ? [rawImage]
        : [imageUrl],
    detailImages: collectShopProductDetailImages(row),
    productVideoUrl: inventoryShopProductVideoUrl(row),
    priceHint: (row.price_hint ?? '').trim(),
    imageUrl,
    productUrl,
    sku,
    detailPath,
    stockQty: Math.max(0, Math.round(Number(row.stock_qty ?? 0)) || 0),
    priceAmount: row.price_amount != null && Number.isFinite(Number(row.price_amount)) ? Number(row.price_amount) : null,
    priceCurrency: String(row.price_currency ?? 'VND').trim() || 'VND',
    salePriceAmount: normalizePartnerSalePriceAmount(row.sale_price_amount),
    saleStartsAt: row.sale_starts_at ? String(row.sale_starts_at) : null,
    saleEndsAt: row.sale_ends_at ? String(row.sale_ends_at) : null,
    isClearance: row.is_clearance === true,
    sizes: variants.sizes,
    colors: variants.colors,
    sizeGuideImageUrl: row.sizeGuideImageUrl?.trim() || null,
    brandName: textField(row.brand_name),
    origin: textField(row.source_origin) || textField(row.origin),
    material: textField(row.material_note),
    style: textField(row.style),
    occasion: textField(row.occasion),
    weight: textField(row.weight),
    features: features.length ? features : null,
    chineseName: textField(row.chinese_name),
    colorSummary: textField(row.color_summary),
    consultNote: shopDisplayConsultNote(row.consult_note) || null,
    sourceShopName: textField(row.source_shop_name),
    sourceShopNameChinese: textField(row.source_shop_name_chinese),
    priceLowHint: textField(row.price_low_hint),
    priceHighHint: textField(row.price_high_hint),
    catalogSlug: textField(row.catalog_slug),
    materialImageUrl: collectShopProductMaterialImageUrl(row),
    realUseImageUrls: collectShopProductRealUseImages(row),
    categoryL1: textField(row.category_l1),
    categoryL2: textField(row.category_l2),
    categoryL3: textField(row.category_l3),
    remarketingId: textField(row.remarketing_id),
    productInfo: opts?.pdp
      ? parsePdpProductInfo(row.product_info_json) || parsePdpProductInfo(row.consult_note)
      : null,
    depositPolicy: row.deposit_required === true,
    likesCount: Math.max(0, Math.round(Number(row.likes_count ?? 0)) || 0),
    purchasesCount: Math.max(0, Math.round(Number(row.purchases_count ?? 0)) || 0),
    reviewsCount: Math.max(0, Math.round(Number(row.reviews_count ?? 0)) || 0),
    questionsCount: Math.max(0, Math.round(Number(row.questions_count ?? 0)) || 0),
    ratingScore: Number(row.rating_score ?? 0) || 0,
  }
}

/**
 * Maps the deliberately small storefront SELECT without invoking PDP/catalog
 * hydration. Card callers must not accidentally make large JSON/media columns
 * part of their data contract.
 */
export function inventoryCardRowToShopProduct(
  siteSlug: string,
  row: PartnerInventoryShopCardRow
): PartnerSiteShopProduct {
  const name = row.name.trim() || 'Product'
  const detailPath = partnerSiteProductPath(siteSlug, row.id, { name })
  const rawImage = normalizeShopImageUrl(row.image_url)
  const imageUrl =
    rawImage ||
    `https://placehold.co/600x600/f1f5f9/64748b?text=${encodeURIComponent(name.slice(0, 18))}`
  const rawProductUrl = row.product_url.trim()
  return {
    id: row.id,
    name,
    description: '',
    detailDescription: '',
    galleryImages: [imageUrl],
    detailImages: [],
    productVideoUrl: null,
    priceHint: row.price_hint.trim(),
    imageUrl,
    productUrl: /^https?:\/\//i.test(rawProductUrl)
      ? rawProductUrl
      : `https://shop.local${detailPath}`,
    sku: row.sku?.trim() || row.remarketing_id.trim(),
    detailPath,
    stockQty: Math.max(0, Math.round(Number(row.stock_qty)) || 0),
    priceAmount:
      row.price_amount != null && Number.isFinite(Number(row.price_amount))
        ? Number(row.price_amount)
        : null,
    priceCurrency: row.price_currency.trim() || 'VND',
    salePriceAmount: normalizePartnerSalePriceAmount(row.sale_price_amount),
    saleStartsAt: row.sale_starts_at,
    saleEndsAt: row.sale_ends_at,
    isClearance: row.is_clearance,
    sizes: [],
    colors: [],
    brandName: null,
    origin: null,
    material: null,
    style: null,
    occasion: null,
    weight: null,
    features: null,
    chineseName: null,
    colorSummary: null,
    consultNote: null,
    sourceShopName: null,
    sourceShopNameChinese: null,
    priceLowHint: null,
    priceHighHint: null,
    catalogSlug: null,
    materialImageUrl: null,
    realUseImageUrls: null,
    categoryL1: row.category_l1,
    categoryL2: row.category_l2,
    categoryL3: row.category_l3,
    remarketingId: row.remarketing_id || null,
    productInfo: null,
    depositPolicy: null,
    likesCount: Math.max(0, Math.round(Number(row.likes_count)) || 0),
    purchasesCount: Math.max(0, Math.round(Number(row.purchases_count)) || 0),
    reviewsCount: Math.max(0, Math.round(Number(row.reviews_count)) || 0),
    questionsCount: Math.max(0, Math.round(Number(row.questions_count)) || 0),
    ratingScore: Number(row.rating_score) || 0,
  }
}

/** Size/color for visual PDP bind — same source as GET .../options. */
export function inventoryRowToLivePdpVariants(row: {
  description?: string | null
  stock_note?: string | null
  sizes_json?: unknown
  colors_json?: unknown
}): { sizes: string[]; colors: LivePdpBindColor[] } {
  const sizes = parseInventorySizesForFacet(
    row.description,
    Array.isArray(row.sizes_json)
      ? row.sizes_json.map((x) => String(x ?? '').trim()).filter(Boolean)
      : null
  )
  const colorRows = Array.isArray(row.colors_json) ? row.colors_json : null
  const hasColorsColumn = colorRows != null
  const structured = hasColorsColumn
    ? colorRows
        .map((item: unknown) => {
          const c = item as { name?: string; img?: string } | null
          return {
            name: String(c?.name || '').trim(),
            img: String(c?.img || '').trim() || null,
          }
        })
        .filter((c: LivePdpBindColor) => c.name)
    : []
  return {
    sizes,
    colors: hasColorsColumn ? structured : parseColorVariantsJson(row.stock_note ?? ''),
  }
}

export function shopProductToCartCard(product: PartnerSiteShopProduct): PartnerAiProductCard {
  const card: PartnerAiProductCard = {
    name: product.name,
    image_url: product.imageUrl,
    product_url: product.productUrl,
    inventory_id: product.id,
  }
  if (product.priceHint) card.price_hint = product.priceHint
  if (product.sku) card.sku = product.sku
  return card
}

export function inventoryRowToCartCard(
  row: InventoryShopSourceRow & { id: string; name?: string | null; price_hint?: string | null; sku?: string | null; product_url?: string | null }
): PartnerAiProductCard | null {
  const name = (row.name ?? '').trim() || 'Product'
  const image_url = (row.image_url ?? '').trim()
  if (!/^https?:\/\//i.test(image_url)) return null
  const rawProductUrl = (row.product_url ?? '').trim()
  const product_url = /^https?:\/\//i.test(rawProductUrl)
    ? rawProductUrl
    : `https://shop.local/inventory/${encodeURIComponent(row.id)}`
  const card: PartnerAiProductCard = {
    name,
    image_url,
    product_url,
    inventory_id: row.id,
  }
  const ph = (row.price_hint ?? '').trim()
  if (ph) card.price_hint = ph
  const sku = (row.sku ?? '').trim()
  if (sku) card.sku = sku.slice(0, 128)
  return card
}

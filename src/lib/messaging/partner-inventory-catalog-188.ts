/**
 * Hợp đồng dữ liệu sản phẩm khớp Excel 188.com.vn (~41 cột).
 * Engine dùng chung mọi shop — không khóa slug 188.
 *
 * Cột Excel EN + nhãn VI lấy từ `188-com-vn/backend/app/services/excel_importer.py`
 * (`PRODUCT_EXCEL_EXPORT_COLUMNS` / `PRODUCT_EXCEL_VIETNAMESE_HEADERS`).
 */

export const CATALOG_188_EXCEL_COLUMNS = [
  'id',
  'sku',
  'origin',
  'brand',
  'name',
  'pro_content',
  'price',
  'shop_name',
  'shop_id',
  'pro_lower_price',
  'pro_high_price',
  'rating_group_id',
  'question_group_id',
  'sizes',
  'Variant',
  'gallery_images',
  'detail_images',
  'product_url',
  'video_url',
  'main_image',
  'likes_count',
  'purchases_count',
  'reviews_count',
  'questions_count',
  'rating_score',
  'stock_quantity',
  'deposit_required',
  'Main Category',
  'Subcategory',
  'Sub-subcategory',
  'Material',
  'Style',
  'Color',
  'Occasion',
  'Features',
  'Weight',
  'product_info',
  'chinese_name',
  'shop_name_chinese',
  'Slug',
  'listed',
] as const

export type Catalog188ExcelColumn = (typeof CATALOG_188_EXCEL_COLUMNS)[number]

export const CATALOG_188_VI_HEADERS: Record<Catalog188ExcelColumn, string> = {
  id: 'Id sản phẩm',
  sku: 'Mã sản phẩm',
  origin: 'Xuất xứ',
  brand: 'Thương hiệu',
  name: 'Tên',
  pro_content: 'Mô tả sản phẩm',
  price: 'Giá',
  shop_name: 'Tên shop',
  shop_id: 'Shop id',
  pro_lower_price: 'Sp giá thấp hơn',
  pro_high_price: 'Sp giá cao hơn',
  rating_group_id: 'Nhóm đánh giá',
  question_group_id: 'Nhóm câu hỏi',
  sizes: 'Size',
  Variant: 'Biến thể',
  gallery_images: 'Thư viện ảnh',
  detail_images: 'Nội dung',
  product_url: 'Link mặc định',
  video_url: 'Link Video',
  main_image: 'Link img',
  likes_count: 'Thích',
  purchases_count: 'Mua',
  reviews_count: 'Lượt đánh giá',
  questions_count: 'Lượt hỏi',
  rating_score: 'Điểm đánh giá',
  stock_quantity: 'Số lượng có thể mua',
  deposit_required: 'Cần đặt cọc',
  'Main Category': 'Danh mục cấp 1',
  Subcategory: 'Danh mục cấp 2',
  'Sub-subcategory': 'Danh mục cấp 3',
  Material: 'Chất liệu',
  Style: 'Kiểu dáng',
  Color: 'màu sắc',
  Occasion: 'Dịp',
  Features: 'Tính năng',
  Weight: 'Trọng lượng',
  product_info: 'Thông tin sản phẩm',
  chinese_name: 'Tên tiếng trung',
  shop_name_chinese: 'Shop Trung Quốc',
  Slug: 'Slug',
  listed: 'Trong danh sách (1=import, 0=xóa DB)',
}

/** Cột chỉ có trên file xuất SaaS — 188 bỏ qua khi import. */
export const CATALOG_188_EXPORT_ONLY_COLUMNS = ['consult_url', 'inventory_id'] as const
export const CATALOG_188_EXPORT_ONLY_VI = {
  consult_url: 'Link tư vấn',
  inventory_id: 'Id kho',
} as const

export type Catalog188Color = { name: string; img: string; value?: string }

/** Snapshot JSON khớp dict `excel_row_to_product` bên 188 (tên field DB 188). */
export type Catalog188Snapshot = {
  product_id: string
  code: string
  origin: string
  brand_name: string
  name: string
  description: string
  price: number
  shop_name: string
  shop_id: string
  pro_lower_price: string
  pro_high_price: string
  group_rating: number
  group_question: number
  sizes: string[]
  colors: Catalog188Color[]
  images: string[]
  gallery: string[]
  link_default: string
  video_link: string
  main_image: string
  likes: number
  purchases: number
  rating_total: number
  question_total: number
  rating_point: number
  available: number
  deposit_require: boolean
  category: string
  subcategory: string
  sub_subcategory: string
  raw_category: string
  raw_subcategory: string
  raw_sub_subcategory: string
  material: string
  style: string
  color: string
  occasion: string
  features: string[]
  weight: string
  product_info: Record<string, unknown> | null
  chinese_name: string
  shop_name_chinese: string
  slug: string
}

export type InventoryCatalog188Fields = {
  catalog_json: Catalog188Snapshot
  brand_name: string
  source_origin: string
  chinese_name: string
  deposit_required: boolean
  category_l1: string
  category_l2: string
  category_l3: string
  likes_count: number
  purchases_count: number
  reviews_count: number
  questions_count: number
  rating_score: number
  catalog_slug: string
  style: string
  color_summary: string
  occasion: string
  weight: string
  features_json: string[]
  product_info_json: Record<string, unknown> | null
  source_shop_name: string
  source_shop_id: string
  source_shop_name_chinese: string
  price_low_hint: string
  price_high_hint: string
  rating_group_id: number | null
  question_group_id: number | null
  sizes: string[]
  colors: Catalog188Color[]
  gallery_urls: string[]
  detail_image_urls: string[]
  material_note: string
}

export function emptyInventoryCatalogRowFields(): {
  catalog_json: null
  brand_name: null
  source_origin: null
  chinese_name: null
  deposit_required: false
  category_l1: null
  category_l2: null
  category_l3: null
  likes_count: 0
  purchases_count: 0
  reviews_count: 0
  questions_count: 0
  rating_score: 0
  catalog_slug: null
  style: null
  color_summary: null
  occasion: null
  weight: null
  features_json: null
  product_info_json: null
  source_shop_name: null
  source_shop_id: null
  source_shop_name_chinese: null
  price_low_hint: null
  price_high_hint: null
  rating_group_id: null
  question_group_id: null
} {
  return {
    catalog_json: null,
    brand_name: null,
    source_origin: null,
    chinese_name: null,
    deposit_required: false,
    category_l1: null,
    category_l2: null,
    category_l3: null,
    likes_count: 0,
    purchases_count: 0,
    reviews_count: 0,
    questions_count: 0,
    rating_score: 0,
    catalog_slug: null,
    style: null,
    color_summary: null,
    occasion: null,
    weight: null,
    features_json: null,
    product_info_json: null,
    source_shop_name: null,
    source_shop_id: null,
    source_shop_name_chinese: null,
    price_low_hint: null,
    price_high_hint: null,
    rating_group_id: null,
    question_group_id: null,
  }
}

export function normalizeHeaderKey188(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const HEADER_TO_COLUMN: Record<string, Catalog188ExcelColumn> = (() => {
  const out: Record<string, Catalog188ExcelColumn> = {}
  const add = (alias: string, col: Catalog188ExcelColumn) => {
    const k = normalizeHeaderKey188(alias)
    if (k && !out[k]) out[k] = col
  }
  for (const col of CATALOG_188_EXCEL_COLUMNS) {
    add(col, col)
    add(CATALOG_188_VI_HEADERS[col], col)
  }
  add('product_id', 'id')
  add('id_san_pham', 'id')
  add('ma_san_pham', 'sku')
  add('code', 'sku')
  add('brand_name', 'brand')
  add('thuong_hieu', 'brand')
  add('xuat_xu', 'origin')
  add('ten', 'name')
  add('mo_ta_san_pham', 'pro_content')
  add('description', 'pro_content')
  add('gia', 'price')
  add('ten_shop', 'shop_name')
  add('sp_gia_thap_hon', 'pro_lower_price')
  add('sp_gia_cao_hon', 'pro_high_price')
  add('nhom_danh_gia', 'rating_group_id')
  add('nhom_cau_hoi', 'question_group_id')
  add('size', 'sizes')
  add('bien_the', 'Variant')
  add('variant', 'Variant')
  add('colors', 'Variant')
  add('thu_vien_anh', 'gallery_images')
  add('images', 'gallery_images')
  add('noi_dung', 'detail_images')
  add('gallery', 'detail_images')
  add('link_mac_dinh', 'product_url')
  add('link_video', 'video_url')
  add('link_img', 'main_image')
  add('main_image', 'main_image')
  add('thich', 'likes_count')
  add('mua', 'purchases_count')
  add('luot_danh_gia', 'reviews_count')
  add('luot_hoi', 'questions_count')
  add('diem_danh_gia', 'rating_score')
  add('so_luong_co_the_mua', 'stock_quantity')
  add('stock_quantity', 'stock_quantity')
  add('can_dat_coc', 'deposit_required')
  add('danh_muc_cap_1', 'Main Category')
  add('main_category', 'Main Category')
  add('danh_muc_cap_2', 'Subcategory')
  add('danh_muc_cap_3', 'Sub-subcategory')
  add('sub_subcategory', 'Sub-subcategory')
  add('chat_lieu', 'Material')
  add('material', 'Material')
  add('kieu_dang', 'Style')
  add('mau_sac', 'Color')
  add('dip', 'Occasion')
  add('tinh_nang', 'Features')
  add('trong_luong', 'Weight')
  add('thong_tin_san_pham', 'product_info')
  add('ten_tieng_trung', 'chinese_name')
  add('shop_trung_quoc', 'shop_name_chinese')
  add('trong_danh_sach', 'listed')
  add('listed', 'listed')
  add('is_active', 'listed')
  return out
})()

export function resolveCatalog188Column(headerCell: string): Catalog188ExcelColumn | null {
  return HEADER_TO_COLUMN[normalizeHeaderKey188(headerCell)] ?? null
}

const CATALOG_188_MARKERS = new Set([
  'pro_content',
  'variant',
  'gallery_images',
  'main_category',
  'detail_images',
  'deposit_required',
  'chinese_name',
])

/** File 188: có cột `id` (mã SP) + ít nhất một cột catalog đặc trưng. */
export function isCatalog188HeaderRow(headers: string[]): boolean {
  const resolved = new Set<string>()
  for (const h of headers) {
    const col = resolveCatalog188Column(h)
    if (col) resolved.add(normalizeHeaderKey188(col))
  }
  const hasId = resolved.has('id')
  const hasName = resolved.has('name')
  let markers = 0
  for (const m of CATALOG_188_MARKERS) {
    if (resolved.has(m)) markers += 1
  }
  return hasId && hasName && markers >= 1
}

/** Hàng 2 của template 188 — nhãn tiếng Việt, không phải dữ liệu. */
export function isCatalog188LabelRow(cells: string[]): boolean {
  const joined = cells.map((c) => normalizeHeaderKey188(c)).join(' ')
  if (!joined.trim()) return false
  const hits = [
    'id_san_pham',
    'mo_ta_san_pham',
    'bien_the',
    'thu_vien_anh',
    'danh_muc_cap_1',
    'trong_danh_sach',
    'ten_tieng_trung',
  ].filter((k) => joined.includes(k)).length
  if (hits >= 2) return true
  let viHeaders = 0
  for (const cell of cells) {
    const col = resolveCatalog188Column(cell)
    if (!col) continue
    if (normalizeHeaderKey188(cell) === normalizeHeaderKey188(CATALOG_188_VI_HEADERS[col])) {
      viHeaders += 1
    }
  }
  return viHeaders >= 4
}

export function parseJsonFieldLenient(raw: string): unknown {
  const t = raw.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

export function parseStringArrayField(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  const parsed = parseJsonFieldLenient(t)
  if (Array.isArray(parsed)) {
    return parsed.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 200)
  }
  return t
    .split(/[,;|]/)
    .map((x) => x.trim().replace(/^["']+|["']+$/g, ''))
    .filter(Boolean)
    .slice(0, 200)
}

export function parseColorVariantsField(raw: string): Catalog188Color[] {
  const t = raw.trim()
  if (!t) return []
  const out: Catalog188Color[] = []
  const seen = new Set<string>()
  const push = (nameRaw: unknown, imgRaw: unknown, valueRaw?: unknown) => {
    const name = String(nameRaw ?? '').trim()
    const img = String(imgRaw ?? '').trim()
    const value = String(valueRaw ?? '').trim()
    if (!name) return
    const key = `${name.toLowerCase()}|${img.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(value && value !== name ? { name, img, value } : { name, img })
  }
  const parsed = parseJsonFieldLenient(t)
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item === 'string') {
        push(item, '')
        continue
      }
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      push(o.name ?? o.label ?? o.value, o.img ?? o.image ?? o.image_url, o.value)
    }
    return out.slice(0, 200)
  }
  for (const part of t.split(/[,;|]/)) {
    const name = part.trim()
    if (name) push(name, '')
  }
  return out.slice(0, 200)
}

export function parseFeaturesField(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith('[') && t.endsWith(']')) {
    const parsed = parseJsonFieldLenient(t)
    if (Array.isArray(parsed)) {
      return parsed.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 100)
    }
  }
  return t
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 100)
}

export function parseProductInfoField(raw: string): Record<string, unknown> | null {
  const parsed = parseJsonFieldLenient(raw)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, unknown>
  }
  return null
}

export function parseIntCell(raw: string, fallback = 0): number {
  const t = raw.trim()
  if (!t) return fallback
  const n = Number.parseInt(t.replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : fallback
}

export function parseFloatCell(raw: string, fallback = 0): number {
  const t = raw.trim().replace(',', '.')
  if (!t) return fallback
  const n = Number.parseFloat(t.replace(/[^\d.+-]/g, ''))
  return Number.isFinite(n) ? n : fallback
}

/** 188: ô trống → cần cọc (true). Chỉ áp cho file catalog 188. */
export function parseDepositRequired188(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s) return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return true
}

export function parseListed188(raw: string): 'upsert' | 'delete' {
  const s = raw.trim().toLowerCase()
  if (!s) return 'upsert'
  if (s === '0' || s === 'false' || s === 'no' || s === 'off' || s === 'xoa' || s === 'xóa' || s === 'delete') {
    return 'delete'
  }
  return 'upsert'
}

export function buildCatalog188Snapshot(input: {
  productId: string
  sku: string
  origin: string
  brand: string
  name: string
  description: string
  price: number
  shopName: string
  shopId: string
  priceLow: string
  priceHigh: string
  ratingGroupId: number
  questionGroupId: number
  sizes: string[]
  colors: Catalog188Color[]
  gallery: string[]
  detail: string[]
  productUrl: string
  videoUrl: string
  mainImage: string
  likes: number
  purchases: number
  reviews: number
  questions: number
  ratingScore: number
  stockQty: number
  depositRequired: boolean
  categoryL1: string
  categoryL2: string
  categoryL3: string
  material: string
  style: string
  color: string
  occasion: string
  features: string[]
  weight: string
  productInfo: Record<string, unknown> | null
  chineseName: string
  shopNameChinese: string
  slug: string
}): Catalog188Snapshot {
  return {
    product_id: input.productId,
    code: input.sku,
    origin: input.origin,
    brand_name: input.brand,
    name: input.name,
    description: input.description,
    price: input.price,
    shop_name: input.shopName,
    shop_id: input.shopId,
    pro_lower_price: input.priceLow,
    pro_high_price: input.priceHigh,
    group_rating: input.ratingGroupId,
    group_question: input.questionGroupId,
    sizes: input.sizes,
    colors: input.colors,
    images: input.gallery,
    gallery: input.detail,
    link_default: input.productUrl,
    video_link: input.videoUrl,
    main_image: input.mainImage,
    likes: input.likes,
    purchases: input.purchases,
    rating_total: input.reviews,
    question_total: input.questions,
    rating_point: input.ratingScore,
    available: input.stockQty,
    deposit_require: input.depositRequired,
    category: input.categoryL1,
    subcategory: input.categoryL2,
    sub_subcategory: input.categoryL3,
    raw_category: input.categoryL1,
    raw_subcategory: input.categoryL2,
    raw_sub_subcategory: input.categoryL3,
    material: input.material,
    style: input.style,
    color: input.color,
    occasion: input.occasion,
    features: input.features,
    weight: input.weight,
    product_info: input.productInfo,
    chinese_name: input.chineseName,
    shop_name_chinese: input.shopNameChinese,
    slug: input.slug,
  }
}

export function catalogFieldsFromSnapshot(snap: Catalog188Snapshot): InventoryCatalog188Fields {
  return {
    catalog_json: snap,
    brand_name: snap.brand_name,
    source_origin: snap.origin,
    chinese_name: snap.chinese_name,
    deposit_required: snap.deposit_require,
    category_l1: snap.category,
    category_l2: snap.subcategory,
    category_l3: snap.sub_subcategory,
    likes_count: snap.likes,
    purchases_count: snap.purchases,
    reviews_count: snap.rating_total,
    questions_count: snap.question_total,
    rating_score: snap.rating_point,
    catalog_slug: snap.slug,
    style: snap.style,
    color_summary: snap.color,
    occasion: snap.occasion,
    weight: snap.weight,
    features_json: snap.features,
    product_info_json: snap.product_info,
    source_shop_name: snap.shop_name,
    source_shop_id: snap.shop_id,
    source_shop_name_chinese: snap.shop_name_chinese,
    price_low_hint: snap.pro_lower_price,
    price_high_hint: snap.pro_high_price,
    rating_group_id: snap.group_rating || null,
    question_group_id: snap.group_question || null,
    sizes: snap.sizes,
    colors: snap.colors,
    gallery_urls: snap.images,
    detail_image_urls: snap.gallery,
    material_note: snap.material,
  }
}

export function catalogFieldsFromLegacyVariants(input: {
  sizes: string[]
  colors: Catalog188Color[]
}): InventoryCatalog188Fields | null {
  if (input.sizes.length === 0 && input.colors.length === 0) return null
  const snap = buildCatalog188Snapshot({
    productId: '',
    sku: '',
    origin: '',
    brand: '',
    name: '',
    description: '',
    price: 0,
    shopName: '',
    shopId: '',
    priceLow: '',
    priceHigh: '',
    ratingGroupId: 0,
    questionGroupId: 0,
    sizes: input.sizes,
    colors: input.colors,
    gallery: [],
    detail: [],
    productUrl: '',
    videoUrl: '',
    mainImage: '',
    likes: 0,
    purchases: 0,
    reviews: 0,
    questions: 0,
    ratingScore: 0,
    stockQty: 0,
    depositRequired: false,
    categoryL1: '',
    categoryL2: '',
    categoryL3: '',
    material: '',
    style: '',
    color: '',
    occasion: '',
    features: [],
    weight: '',
    productInfo: null,
    chineseName: '',
    shopNameChinese: '',
    slug: '',
  })
  return catalogFieldsFromSnapshot(snap)
}

export function jsonCell(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return ''
  }
}

function cellText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, 200)
  }
  if (typeof value === 'string') return parseStringArrayField(value)
  return []
}

function asColors(value: unknown): Catalog188Color[] {
  if (value == null || value === '') return []
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    try {
      return parseColorVariantsField(JSON.stringify(value))
    } catch {
      return []
    }
  }
  if (typeof value === 'string') return parseColorVariantsField(value)
  return []
}

function asProductInfo(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string') return parseProductInfoField(value)
  return null
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') return parseFloatCell(value, fallback)
  return fallback
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value
  if (value == null || value === '') return fallback
  const s = cellText(value).toLowerCase()
  if (s === 'true' || s === '1' || s === 'yes') return true
  if (s === 'false' || s === '0' || s === 'no') return false
  return fallback
}

/**
 * Map object sản phẩm REST kiểu 188 (`sizes`, `colors`, `gallery`, danh mục…)
 * sang cột catalog kho SaaS. Thiếu field thì để trống — không bịa dữ liệu.
 */
export function catalogFieldsFromExternalProduct(product: unknown): InventoryCatalog188Fields | null {
  if (!product || typeof product !== 'object' || Array.isArray(product)) return null
  const p = product as Record<string, unknown>
  const sizes = asStringArray(p.sizes ?? p.size)
  const colors = asColors(p.colors ?? p.color_variants ?? p.variants)
  const images = asStringArray(p.images)
  const gallery = asStringArray(p.gallery ?? p.detail_images)
  const galleryUrls = [...(images.length ? images : gallery)]
  const detailUrls = images.length ? [...gallery] : []
  const mainImage = cellText(p.main_image ?? p.image)
  if (mainImage && !galleryUrls.includes(mainImage)) galleryUrls.unshift(mainImage)

  const categoryL1 = cellText(p.category ?? p.raw_category).slice(0, 200)
  const categoryL2 = cellText(p.subcategory ?? p.raw_subcategory).slice(0, 200)
  const categoryL3 = cellText(p.sub_subcategory ?? p.raw_sub_subcategory).slice(0, 200)
  const brand = cellText(p.brand_name ?? p.brand).slice(0, 200)
  const material = cellText(p.material).slice(0, 8000)
  const features = Array.isArray(p.features) ? asStringArray(p.features) : parseFeaturesField(cellText(p.features))
  const productInfo = asProductInfo(p.product_info)
  const name = cellText(p.name).slice(0, 500)
  const description = cellText(p.description).slice(0, 20000)

  const hasCatalog =
    sizes.length > 0 ||
    colors.length > 0 ||
    galleryUrls.length > 0 ||
    detailUrls.length > 0 ||
    Boolean(categoryL1 || brand || material || productInfo || features.length || name)

  if (!hasCatalog) return null

  const price = asFiniteNumber(p.price, 0)
  const snap = buildCatalog188Snapshot({
    productId: cellText(p.product_id ?? p.id).slice(0, 255),
    sku: cellText(p.code ?? p.sku).slice(0, 120),
    origin: cellText(p.origin).slice(0, 100),
    brand,
    name,
    description,
    price,
    shopName: cellText(p.shop_name).slice(0, 200),
    shopId: cellText(p.shop_id).slice(0, 100) || cellText(p.style).slice(0, 100),
    priceLow: cellText(p.pro_lower_price).slice(0, 255),
    priceHigh: cellText(p.pro_high_price).slice(0, 255),
    ratingGroupId: Math.round(asFiniteNumber(p.group_rating ?? p.rating_group_id, 0)),
    questionGroupId: Math.round(asFiniteNumber(p.group_question ?? p.question_group_id, 0)),
    sizes,
    colors,
    gallery: galleryUrls,
    detail: detailUrls,
    productUrl: cellText(p.link_default ?? p.slug ?? p.product_url).slice(0, 2000),
    videoUrl: cellText(p.video_link ?? p.video_url).slice(0, 2000),
    mainImage,
    likes: Math.max(0, Math.round(asFiniteNumber(p.likes ?? p.likes_count, 0))),
    purchases: Math.max(0, Math.round(asFiniteNumber(p.purchases ?? p.purchases_count, 0))),
    reviews: Math.max(0, Math.round(asFiniteNumber(p.rating_total ?? p.reviews_count, 0))),
    questions: Math.max(0, Math.round(asFiniteNumber(p.question_total ?? p.questions_count, 0))),
    ratingScore: asFiniteNumber(p.rating_point ?? p.rating_score, 0),
    stockQty: Math.max(0, Math.round(asFiniteNumber(p.available ?? p.stock ?? p.stock_qty, 0))),
    depositRequired: asBool(p.deposit_require ?? p.deposit_required, false),
    categoryL1,
    categoryL2,
    categoryL3,
    material,
    style: cellText(p.style).slice(0, 100),
    color: cellText(p.color).slice(0, 500),
    occasion: cellText(p.occasion).slice(0, 100),
    features,
    weight: cellText(p.weight).slice(0, 100),
    productInfo,
    chineseName: cellText(p.chinese_name).slice(0, 500),
    shopNameChinese: cellText(p.shop_name_chinese).slice(0, 200),
    slug: cellText(p.slug).slice(0, 500),
  })
  return catalogFieldsFromSnapshot(snap)
}

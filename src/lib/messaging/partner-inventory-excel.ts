import * as XLSX from 'xlsx'
import type { Database } from '@/types/database.types'
import { buildGuestConsultChatAbsoluteUrl } from '@/lib/messaging/build-guest-consult-chat-link'
import { defaultPublicOrigin } from '@/lib/public-app-origin'
import { validateInventoryHttpUrl } from '@/lib/messaging/inventory-http-url'
import {
  CATALOG_188_EXCEL_COLUMNS,
  CATALOG_188_EXPORT_ONLY_COLUMNS,
  CATALOG_188_EXPORT_ONLY_VI,
  CATALOG_188_VI_HEADERS,
  buildCatalog188Snapshot,
  catalogFieldsFromLegacyVariants,
  catalogFieldsFromSnapshot,
  isCatalog188HeaderRow,
  isCatalog188LabelRow,
  jsonCell,
  parseColorVariantsField,
  parseDepositRequired188,
  parseFeaturesField,
  parseFloatCell,
  parseIntCell,
  parseListed188,
  parseProductInfoField,
  parseStringArrayField,
  resolveCatalog188Column,
  type InventoryCatalog188Fields,
} from '@/lib/messaging/partner-inventory-catalog-188'

export type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Khóa nội bộ / tiêu đề tiếng Anh — vẫn nhận khi import (thứ tự cột file mẫu/export: SKU trước). */
/** Tiêu đề cột chuẩn (ASCII) — dùng khi import có header tiếng Anh. Không gồm sort_order (gán tự động khi import). */
export const INVENTORY_EXCEL_HEADERS = [
  'sku',
  'name',
  'description',
  'stock_note',
  'stock_qty',
  'price_hint',
  'image_url',
  'product_url',
  'product_video_url',
  'consult_note',
  'remarketing_id',
  'is_active',
] as const

/** Dòng tiêu đề file mẫu & export (tiếng Việt); cột 1 = Mã SKU. Không có cột Thứ tự — thứ tự gán theo dòng khi nhập. */
export const INVENTORY_EXCEL_HEADER_LABELS_VI = [
  'Mã SKU',
  'Tên sản phẩm',
  'Size (JSON) vd: ["38","39","40"]',
  'Màu sắc (JSON) vd: [{"name":"Đen","img":"https://..."}]',
  'Số lượng tồn kho',
  'Giá',
  'Link ảnh',
  'Link trang sản phẩm',
  'Video sản phẩm (YouTube hoặc MP4)',
  'Ghi chú tư vấn',
  'Id remarketing',
  /** Thêm/cập nhật = 1; xóa khỏi kho = 0 (khớp SKU hoặc tên). Tiêu đề dài giúp đọc file không cần mở hướng dẫn. */
  'Trạng thái thêm là 1 xóa 0',
] as const

/** Hai cột chỉ có trên file xuất (không nhập lại). */
export const INVENTORY_EXPORT_ONLY_HEADER_LABELS_VI = ['Link tư vấn', 'Id kho'] as const

export type InventoryExcelInsert = {
  sort_order: number
  name: string
  sku: string | null
  description: string
  stock_note: string
  stock_qty: number
  price_hint: string
  image_url: string
  product_url: string
  product_video_url: string
  consult_note: string
  remarketing_id: string
  is_active: boolean
  /** true: xóa dòng kho khớp SKU/tên/id (không thêm mới). */
  removeFromInventory: boolean
  /** File Excel 41 cột 188 hoặc biến thể đã parse từ file cũ. */
  catalog?: InventoryCatalog188Fields | null
  catalogFormat?: 'legacy' | '188'
}

export type InventoryImportWarning = {
  row_number: number
  sku: string
  name: string
  field: 'size_json' | 'color_json' | 'stock_qty' | 'price_hint' | 'product_info'
  code: string
  raw_value: string
  normalized_value: string
  message: string
}

const SHEET_NAME = 'inventory'

function normalizeHeaderKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

/** Cho phép tiêu đề cột tiếng Việt / không dấu. */
const HEADER_ALIASES: Record<string, string> = {
  sort_order: 'sort_order',
  thu_tu: 'sort_order',
  order: 'sort_order',
  stt: 'sort_order',
  name: 'name',
  ten: 'name',
  ten_hang: 'name',
  ten_san_pham: 'name',
  sku: 'sku',
  ma: 'sku',
  ma_sku: 'sku',
  ma_san_pham: 'sku',
  description: 'description',
  mo_ta: 'description',
  size: 'description',
  kich_co: 'description',
  kich_co_size: 'description',
  thong_so: 'description',
  stock_note: 'stock_note',
  mau_sac: 'stock_note',
  mau: 'stock_note',
  color: 'stock_note',
  colors: 'stock_note',
  color_variants: 'stock_note',
  color_variant: 'stock_note',
  ton_kho: 'stock_note',
  con_hang: 'stock_note',
  ghi_chu_ton_kho: 'stock_note',
  stock_qty: 'stock_qty',
  so_luong_ton_kho: 'stock_qty',
  so_luong_ton: 'stock_qty',
  so_luong: 'stock_qty',
  quantity: 'stock_qty',
  qty: 'stock_qty',
  ton: 'stock_qty',
  price_hint: 'price_hint',
  gia: 'price_hint',
  image_url: 'image_url',
  anh: 'image_url',
  url_anh: 'image_url',
  link_anh: 'image_url',
  product_url: 'product_url',
  link_san_pham: 'product_url',
  link_trang_san_pham: 'product_url',
  url_san_pham: 'product_url',
  trang_san_pham: 'product_url',
  product_video_url: 'product_video_url',
  video_san_pham: 'product_video_url',
  link_video: 'product_video_url',
  video_url: 'product_video_url',
  video: 'product_video_url',
  consult_note: 'consult_note',
  ghi_chu: 'consult_note',
  ghi_chu_tu_van: 'consult_note',
  remarketing_id: 'remarketing_id',
  id_remarketing: 'remarketing_id',
  ma_remarketing: 'remarketing_id',
  pixel_id: 'remarketing_id',
  is_active: 'is_active',
  dang_dung: 'is_active',
  active: 'is_active',
  trang_thai: 'is_active',
  trangthai: 'is_active',
  /** Tiêu đề cột đầy đủ trên file mẫu / export */
  trang_thai_them_la_1_xoa_0: 'is_active',
  status: 'is_active',
}

function resolveCanonicalKey(headerCell: string): string | null {
  const n = normalizeHeaderKey(headerCell)
  if ((INVENTORY_EXCEL_HEADERS as readonly string[]).includes(n)) return n
  return HEADER_ALIASES[n] ?? null
}

export function validateInventoryImageUrl(raw: string): string {
  return validateInventoryHttpUrl(raw)
}

/** URL trang sản phẩm (HTTP/HTTPS), cùng quy tắc với link ảnh. */
export function validateInventoryProductUrl(raw: string): string {
  return validateInventoryHttpUrl(raw)
}

/**
 * Cột Trạng thái / is_active: 1 = giữ & cập nhật như hiện tại; 0 = xóa khỏi kho.
 * Thiếu cột hoặc ô trống → coi như 1.
 */
export function parseInventoryExcelListingMode(raw: string): 'upsert' | 'delete' {
  const s = raw.trim().toLowerCase()
  if (!s) return 'upsert'
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return 'delete'
  if (s === 'xóa' || s === 'xoa' || s === 'delete' || s === 'removed') return 'delete'
  if (s === 'true' || s === 'yes' || s === 'on' || s === 'active' || s === '1') return 'upsert'
  const n = Number.parseInt(s, 10)
  if (n === 0) return 'delete'
  return 'upsert'
}

function cellStr(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'boolean') return val ? '1' : '0'
  if (typeof val === 'number' && Number.isFinite(val)) return String(val)
  return String(val).trim()
}

function parseStockQty(raw: string): number {
  const t = String(raw ?? '').trim()
  if (!t) return 0
  const n = Number.parseInt(t.replace(/[^\d-]/g, ''), 10)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

function normalizeComparableText(s: string): string {
  return s.trim().toLowerCase()
}

function looksLikePriceText(s: string): boolean {
  const t = normalizeComparableText(s)
  if (!t) return false
  if (/[₫$€¥£]|vnd|vnđ|k\b|đ\b|usd|eur|jpy|cny|krw|thb|rs\b/.test(t)) return true
  const digits = (t.match(/\d/g) ?? []).length
  if (digits >= 3 && /[0-9][\d\s.,]{2,}/.test(t)) return true
  return false
}

function looksLikeStockStatusText(s: string): boolean {
  const t = normalizeComparableText(s)
  if (!t) return false
  return /(còn|con|hết|het|size|cỡ|co san|co hang|in stock|out of stock|available|sold out|pre-?order)/.test(t)
}

function normalizeJsonArrayOfStringsLenient(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const out: string[] = []
  const seen = new Set<string>()
  const push = (v: unknown) => {
    const s = String(v ?? '').trim()
    if (!s) return
    const key = s.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    out.push(s)
  }
  try {
    const parsed = JSON.parse(t) as unknown
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '[]'
      for (const item of parsed) {
        if (typeof item === 'string') push(item)
      }
    }
  } catch {
    // ignore and fallback below
  }
  if (out.length === 0) {
    // Ưu tiên vớt chuỗi có quote trước: ["M","L",,"5xl"] => M,L,5xl
    const quoted = /"([^"\\]*(?:\\.[^"\\]*)*)"/g
    let m: RegExpExecArray | null
    while ((m = quoted.exec(t))) {
      const rawToken = m[1] ?? ''
      try {
        push(JSON.parse(`"${rawToken}"`))
      } catch {
        push(rawToken)
      }
    }
  }
  if (out.length === 0) {
    // Fallback cuối: cắt theo dấu phẩy nếu user nhập gần-JSON hoặc plain text.
    const noBrackets = t.replace(/^\s*\[/, '').replace(/\]\s*$/, '')
    const parts = noBrackets.split(',')
    for (const p of parts) {
      const cleaned = p.trim().replace(/^['"]+|['"]+$/g, '')
      push(cleaned)
    }
  }
  return out.length > 0 ? JSON.stringify(out.slice(0, 100)) : ''
}

function normalizeColorVariantsJsonLenient(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  const out: Array<{ name: string; img: string }> = []
  const seen = new Set<string>()
  const push = (nameRaw: unknown, imgRaw: unknown) => {
    const name = String(nameRaw ?? '').trim()
    const img = validateInventoryImageUrl(String(imgRaw ?? ''))
    if (!name || !img) return
    const key = `${name.toLowerCase()}|${img.toLowerCase()}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ name, img })
  }
  try {
    const parsed = JSON.parse(t) as unknown
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return '[]'
      for (const item of parsed) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const o = item as Record<string, unknown>
        push(o.name, o.img)
      }
    }
  } catch {
    // ignore and fallback below
  }
  if (out.length === 0) {
    // Vớt các cặp name/img trong text lỗi JSON.
    const r1 = /name\s*["']?\s*:\s*["']([^"']+)["'][\s,]*img\s*["']?\s*:\s*["']([^"']+)["']/gi
    let m1: RegExpExecArray | null
    while ((m1 = r1.exec(t))) push(m1[1], m1[2])
    const r2 = /img\s*["']?\s*:\s*["']([^"']+)["'][\s,]*name\s*["']?\s*:\s*["']([^"']+)["']/gi
    let m2: RegExpExecArray | null
    while ((m2 = r2.exec(t))) push(m2[2], m2[1])
  }
  return out.length > 0 ? JSON.stringify(out.slice(0, 100)) : ''
}

function catalog188ExampleRow(): (string | number)[] {
  return [
    'A746-DEMO-001',
    'B0038',
    '1688',
    'Demo Brand',
    'Áo thun cotton cổ tròn',
    '<p>Áo thun cotton mềm, form regular.</p>',
    199000,
    '',
    '',
    '',
    '',
    888,
    0,
    '["M","L","XL"]',
    '[{"name":"Đen","img":"https://cdn.example.com/images/ao-thun-den.jpg"},{"name":"Trắng","img":"https://cdn.example.com/images/ao-thun-trang.jpg"}]',
    '["https://cdn.example.com/images/ao-thun-1.jpg"]',
    '["https://cdn.example.com/images/ao-thun-detail.jpg"]',
    'https://shop.example.com/san-pham/ao-thun',
    '',
    'https://cdn.example.com/images/ao-thun-mau.jpg',
    0,
    0,
    0,
    0,
    0,
    120,
    0,
    'Thời trang nam',
    'Áo',
    'Áo thun',
    'Cotton',
    'Basic',
    'Đen, Trắng',
    'Hàng ngày',
    'Mềm mại, Thoáng khí',
    '180g',
    '',
    '',
    '',
    '',
    1,
  ]
}

export function buildInventoryTemplateBuffer(): Buffer {
  const en = [...CATALOG_188_EXCEL_COLUMNS]
  const vi = CATALOG_188_EXCEL_COLUMNS.map((col) => CATALOG_188_VI_HEADERS[col])
  const ws = XLSX.utils.aoa_to_sheet([en, vi, catalog188ExampleRow()])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

function inventoryRowToCatalog188Cells(
  r: InventoryRow,
  extras: { consultUrl: string }
): (string | number)[] {
  const snap = (r.catalog_json && typeof r.catalog_json === 'object' && !Array.isArray(r.catalog_json)
    ? r.catalog_json
    : null) as Record<string, unknown> | null
  const sizes = Array.isArray(r.sizes_json)
    ? r.sizes_json
    : Array.isArray(snap?.sizes)
      ? snap.sizes
      : []
  const colors = Array.isArray(r.colors_json)
    ? r.colors_json
    : Array.isArray(snap?.colors)
      ? snap.colors
      : []
  const gallery = Array.isArray(r.gallery_urls) && r.gallery_urls.length
    ? r.gallery_urls
    : Array.isArray(snap?.images)
      ? snap.images
      : []
  const detail = Array.isArray(r.detail_image_urls) && r.detail_image_urls.length
    ? r.detail_image_urls
    : Array.isArray(snap?.gallery)
      ? snap.gallery
      : []
  const features = Array.isArray(r.features_json)
    ? r.features_json.join(', ')
    : Array.isArray(snap?.features)
      ? (snap.features as unknown[]).map((x) => String(x)).join(', ')
      : ''
  const priceNum = r.price_amount != null && Number.isFinite(Number(r.price_amount))
    ? Number(r.price_amount)
    : parseFloatCell(String(r.price_hint ?? ''), 0)
  const listed = r.is_active === false ? 0 : 1
  return [
    r.remarketing_id || String(snap?.product_id ?? ''),
    r.sku ?? '',
    r.source_origin || String(snap?.origin ?? ''),
    r.brand_name || String(snap?.brand_name ?? ''),
    r.name,
    (r.description ?? '').startsWith('[') ? String(snap?.description ?? '') : r.description ?? '',
    priceNum,
    r.source_shop_name || '',
    r.source_shop_id || '',
    r.price_low_hint || '',
    r.price_high_hint || '',
    r.rating_group_id ?? Number(snap?.group_rating ?? 0) ?? 0,
    r.question_group_id ?? Number(snap?.group_question ?? 0) ?? 0,
    jsonCell(sizes),
    jsonCell(colors),
    jsonCell(gallery),
    jsonCell(detail),
    r.product_url ?? '',
    r.product_video_url ?? '',
    r.image_url ?? '',
    r.likes_count ?? 0,
    r.purchases_count ?? 0,
    r.reviews_count ?? 0,
    r.questions_count ?? 0,
    r.rating_score ?? 0,
    Number.isFinite(r.stock_qty) ? r.stock_qty : 0,
    r.deposit_required ? 1 : 0,
    r.category_l1 || '',
    r.category_l2 || '',
    r.category_l3 || '',
    r.material_note || String(snap?.material ?? ''),
    r.style || '',
    r.color_summary || '',
    r.occasion || '',
    features,
    r.weight || '',
    r.product_info_json ? jsonCell(r.product_info_json) : jsonCell(snap?.product_info ?? ''),
    r.chinese_name || '',
    r.source_shop_name_chinese || '',
    r.catalog_slug || String(snap?.slug ?? ''),
    listed,
    extras.consultUrl,
    r.id,
  ]
}

export function buildInventoryExportBuffer(
  rows: InventoryRow[],
  options: { partnerChatSlug: string }
): Buffer {
  const origin = defaultPublicOrigin()
  const slug = options.partnerChatSlug.trim()
  const aoa: (string | number)[][] = [
    [...CATALOG_188_EXCEL_COLUMNS, ...CATALOG_188_EXPORT_ONLY_COLUMNS],
    [
      ...CATALOG_188_EXCEL_COLUMNS.map((col) => CATALOG_188_VI_HEADERS[col]),
      CATALOG_188_EXPORT_ONLY_VI.consult_url,
      CATALOG_188_EXPORT_ONLY_VI.inventory_id,
    ],
  ]
  for (const r of rows) {
    const consultUrl =
      slug && r.id
        ? buildGuestConsultChatAbsoluteUrl(origin, slug, {
            id: r.id,
            image_url: r.image_url,
            product_url: r.product_url,
            sku: r.sku,
          })
        : ''
    aoa.push(inventoryRowToCatalog188Cells(r, { consultUrl }))
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

const MAX_IMPORT_ROWS = Math.max(
  500,
  Math.min(200_000, parseInt(process.env.PARTNER_INVENTORY_IMPORT_MAX_ROWS || '100000', 10) || 100_000)
)

function parseCatalog188Workbook(
  matrix: unknown[][],
  warnings: InventoryImportWarning[]
): { ok: true; rows: InventoryExcelInsert[] } | { ok: false; error: string } {
  const headerRow = (matrix[0] ?? []).map((c) => cellStr(c))
  const colIndex: Partial<Record<(typeof CATALOG_188_EXCEL_COLUMNS)[number], number>> = {}
  headerRow.forEach((h, i) => {
    const key = resolveCatalog188Column(h)
    if (key && colIndex[key] === undefined) colIndex[key] = i
  })
  if (colIndex.id === undefined || colIndex.name === undefined) {
    return { ok: false, error: 'MISSING_NAME_COLUMN' }
  }

  let dataStart = 1
  if (matrix.length > 2 && isCatalog188LabelRow((matrix[1] ?? []).map((c) => cellStr(c)))) {
    dataStart = 2
  }

  const out: InventoryExcelInsert[] = []
  const pushWarning = (w: InventoryImportWarning) => {
    if (warnings.length < 5000) warnings.push(w)
  }

  for (let r = dataStart; r < matrix.length; r++) {
    const line = matrix[r] ?? []
    const get = (k: (typeof CATALOG_188_EXCEL_COLUMNS)[number]) => {
      const idx = colIndex[k]
      return idx === undefined ? '' : cellStr(line[idx])
    }

    const productId = get('id').trim()
    const listedRaw = colIndex.listed !== undefined ? get('listed') : ''
    const mode = parseListed188(listedRaw)
    const sku = get('sku').trim() || null
    const nameRaw = get('name').trim()

    if (mode === 'delete') {
      if (!productId && !nameRaw && !sku) continue
      const displayName = (nameRaw || productId || sku || '—').slice(0, 500)
      out.push({
        sort_order: 100 + out.length,
        name: displayName,
        sku: sku ? sku.slice(0, 120) : null,
        description: '',
        stock_note: '',
        stock_qty: 0,
        price_hint: '',
        image_url: '',
        product_url: '',
        product_video_url: '',
        consult_note: '',
        remarketing_id: productId.slice(0, 500),
        is_active: true,
        removeFromInventory: true,
        catalog: null,
        catalogFormat: '188',
      })
      if (out.length >= MAX_IMPORT_ROWS) {
        return { ok: false, error: `TOO_MANY_ROWS_${MAX_IMPORT_ROWS}` }
      }
      continue
    }

    const name = nameRaw || (productId ? `Sản phẩm ${productId}` : '')
    if (!name || !productId) continue

    const sizes = parseStringArrayField(get('sizes'))
    const colors = parseColorVariantsField(get('Variant'))
    const gallery = parseStringArrayField(get('gallery_images'))
      .map((u) => validateInventoryImageUrl(u))
      .filter(Boolean)
    const detail = parseStringArrayField(get('detail_images'))
      .map((u) => validateInventoryImageUrl(u))
      .filter(Boolean)
    const features = parseFeaturesField(get('Features'))
    const productInfoRaw = get('product_info')
    const productInfo = parseProductInfoField(productInfoRaw)
    if (productInfoRaw.trim() && !productInfo) {
      pushWarning({
        row_number: r + 1,
        sku: sku ?? '',
        name: name.slice(0, 500),
        field: 'product_info',
        code: 'PRODUCT_INFO_SKIPPED',
        raw_value: productInfoRaw.slice(0, 2000),
        normalized_value: '',
        message: 'Cột product_info không phải JSON object hợp lệ — đã bỏ qua.',
      })
    }

    const mainImage = validateInventoryImageUrl(get('main_image'))
    const productUrl = validateInventoryProductUrl(get('product_url'))
    const videoUrl = validateInventoryHttpUrl(get('video_url'))
    const price = parseFloatCell(get('price'), 0)
    const stockQty = parseIntCell(get('stock_quantity'), 0)
    const depositRequired = parseDepositRequired188(get('deposit_required'))
    const style = get('Style').trim().slice(0, 100)
    const shopId = get('shop_id').trim().slice(0, 100) || style
    const description = get('pro_content').trim()
    const material = get('Material').trim().slice(0, 8000)
    const colorSummary = get('Color').trim().slice(0, 500)
    const snap = buildCatalog188Snapshot({
      productId: productId.slice(0, 255),
      sku: sku ?? '',
      origin: get('origin').trim().slice(0, 100),
      brand: get('brand').trim().slice(0, 200),
      name: name.slice(0, 500),
      description,
      price,
      shopName: get('shop_name').trim().slice(0, 200),
      shopId,
      priceLow: get('pro_lower_price').trim().slice(0, 255),
      priceHigh: get('pro_high_price').trim().slice(0, 255),
      ratingGroupId: parseIntCell(get('rating_group_id'), 0),
      questionGroupId: parseIntCell(get('question_group_id'), 0),
      sizes,
      colors,
      gallery,
      detail,
      productUrl,
      videoUrl,
      mainImage,
      likes: parseIntCell(get('likes_count'), 0),
      purchases: parseIntCell(get('purchases_count'), 0),
      reviews: parseIntCell(get('reviews_count'), 0),
      questions: parseIntCell(get('questions_count'), 0),
      ratingScore: parseFloatCell(get('rating_score'), 0),
      stockQty,
      depositRequired,
      categoryL1: get('Main Category').trim().slice(0, 200),
      categoryL2: get('Subcategory').trim().slice(0, 200),
      categoryL3: get('Sub-subcategory').trim().slice(0, 200),
      material,
      style,
      color: colorSummary,
      occasion: get('Occasion').trim().slice(0, 100),
      features,
      weight: get('Weight').trim().slice(0, 100),
      productInfo,
      chineseName: get('chinese_name').trim().slice(0, 500),
      shopNameChinese: get('shop_name_chinese').trim().slice(0, 200),
      slug: get('Slug').trim().slice(0, 500),
    })
    const catalog = catalogFieldsFromSnapshot(snap)
    const stockNote = colors.length ? JSON.stringify(colors) : ''

    out.push({
      sort_order: 100 + out.length,
      name: name.slice(0, 500),
      sku: sku ? sku.slice(0, 120) : null,
      description: description.slice(0, 20000),
      stock_note: stockNote.slice(0, 20000),
      stock_qty: stockQty,
      price_hint: get('price').trim().slice(0, 500) || (price > 0 ? String(price) : ''),
      image_url: mainImage,
      product_url: productUrl,
      product_video_url: videoUrl,
      consult_note: '',
      remarketing_id: productId.slice(0, 500),
      is_active: true,
      removeFromInventory: false,
      catalog,
      catalogFormat: '188',
    })
    if (out.length >= MAX_IMPORT_ROWS) {
      return { ok: false, error: `TOO_MANY_ROWS_${MAX_IMPORT_ROWS}` }
    }
  }

  if (out.length === 0) return { ok: false, error: 'NO_DATA_ROWS' }
  return { ok: true, rows: out }
}

export function parseInventoryWorkbook(buffer: Buffer): { ok: true; rows: InventoryExcelInsert[]; warnings: InventoryImportWarning[] } | { ok: false; error: string } {
  let wb: XLSX.WorkBook
  try {
    wb = XLSX.read(buffer, { type: 'buffer' })
  } catch {
    return { ok: false, error: 'INVALID_XLSX' }
  }
  const sheetName = wb.SheetNames[0]
  if (!sheetName) return { ok: false, error: 'EMPTY_WORKBOOK' }
  const sheet = wb.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  if (!matrix.length) return { ok: false, error: 'EMPTY_SHEET' }

  const headerRow = (matrix[0] ?? []).map((c) => cellStr(c))
  const catalog188Warnings: InventoryImportWarning[] = []
  if (isCatalog188HeaderRow(headerRow)) {
    const parsed188 = parseCatalog188Workbook(matrix, catalog188Warnings)
    if (!parsed188.ok) return parsed188
    return { ok: true, rows: parsed188.rows, warnings: catalog188Warnings }
  }

  const colIndex: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const key = resolveCanonicalKey(h)
    if (key) colIndex[key] = i
  })

  // Fallback cho file gần template chuẩn nhưng tiêu đề bị chỉnh/lệch nhẹ:
  // 10 cột (cũ): … [7]=link SP, [8]=ghi chú, [9]=trạng thái.
  // 11 cột: … [8]=video, [9]=ghi chú, [10]=trạng thái.
  // 12 cột (mới): … [9]=ghi chú, [10]=id remarketing, [11]=trạng thái.
  // Chỉ bật fallback khi sku/name đúng vị trí mẫu để tránh map sai với file custom order.
  if (colIndex.sku === 0 && colIndex.name === 1) {
    const templateFallback10: Array<[string, number]> = [
      ['description', 2],
      ['stock_note', 3],
      ['stock_qty', 4],
      ['price_hint', 5],
      ['image_url', 6],
      ['product_url', 7],
      ['consult_note', 8],
      ['is_active', 9],
    ]
    const templateFallback11: Array<[string, number]> = [
      ['description', 2],
      ['stock_note', 3],
      ['stock_qty', 4],
      ['price_hint', 5],
      ['image_url', 6],
      ['product_url', 7],
      ['product_video_url', 8],
      ['consult_note', 9],
      ['is_active', 10],
    ]
    const templateFallback12: Array<[string, number]> = [
      ['description', 2],
      ['stock_note', 3],
      ['stock_qty', 4],
      ['price_hint', 5],
      ['image_url', 6],
      ['product_url', 7],
      ['product_video_url', 8],
      ['consult_note', 9],
      ['remarketing_id', 10],
      ['is_active', 11],
    ]
    const templateFallback =
      headerRow.length >= 12 ? templateFallback12 : headerRow.length >= 11 ? templateFallback11 : templateFallback10
    for (const [k, idx] of templateFallback) {
      if (colIndex[k] === undefined && idx < headerRow.length) {
        colIndex[k] = idx
      }
    }
  }
  if (colIndex.name === undefined) return { ok: false, error: 'MISSING_NAME_COLUMN' }

  const out: InventoryExcelInsert[] = []
  const warnings: InventoryImportWarning[] = []
  const pushWarning = (w: InventoryImportWarning) => {
    if (warnings.length < 5000) warnings.push(w)
  }
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] ?? []
    const get = (k: string) => {
      const idx = colIndex[k]
      return idx === undefined ? '' : cellStr(line[idx])
    }

    const statusRaw = colIndex.is_active !== undefined ? get('is_active') : ''
    const mode = parseInventoryExcelListingMode(statusRaw)
    const sku = get('sku').trim() || null
    const nameRaw = get('name').trim()

    if (mode === 'delete') {
      if (!nameRaw && !sku) continue
      let sort_order: number
      if (colIndex.sort_order !== undefined) {
        const sortRaw = get('sort_order')
        const parsed = parseInt(sortRaw, 10)
        sort_order = Number.isFinite(parsed) ? parsed : 100 + out.length
      } else {
        sort_order = 100 + out.length
      }
      const displayName = (nameRaw || sku || '—').slice(0, 500)
      out.push({
        sort_order,
        name: displayName,
        sku: sku ? sku.slice(0, 120) : null,
        description: '',
        stock_note: '',
        stock_qty: 0,
        price_hint: '',
        image_url: '',
        product_url: '',
        product_video_url: '',
        consult_note: '',
        remarketing_id: '',
        is_active: true,
        removeFromInventory: true,
        catalog: null,
        catalogFormat: 'legacy',
      })
      if (out.length >= MAX_IMPORT_ROWS) {
        return { ok: false, error: `TOO_MANY_ROWS_${MAX_IMPORT_ROWS}` }
      }
      continue
    }

    const name = nameRaw
    if (!name) continue

    let sort_order: number
    if (colIndex.sort_order !== undefined) {
      const sortRaw = get('sort_order')
      const parsed = parseInt(sortRaw, 10)
      sort_order = Number.isFinite(parsed) ? parsed : 100 + out.length
    } else {
      sort_order = 100 + out.length
    }

    const rawDescription = get('description')
    const rawColorJson = get('stock_note')
    const rawStockQty = get('stock_qty')
    const rawPriceHint = get('price_hint')

    const description = normalizeJsonArrayOfStringsLenient(rawDescription)
    const stock_note = normalizeColorVariantsJsonLenient(rawColorJson)
    const stock_qty = parseStockQty(rawStockQty)
    let price_hint = rawPriceHint

    if (rawDescription.trim() && description !== rawDescription.trim()) {
      pushWarning({
        row_number: r + 1,
        sku: sku ?? '',
        name: name.slice(0, 500),
        field: 'size_json',
        code: 'SIZE_JSON_NORMALIZED',
        raw_value: rawDescription.slice(0, 2000),
        normalized_value: description.slice(0, 2000),
        message: 'Size JSON lỗi nhẹ đã được chuẩn hóa; phần không hợp lệ đã bị bỏ qua.',
      })
    }
    if (rawColorJson.trim() && stock_note !== rawColorJson.trim()) {
      pushWarning({
        row_number: r + 1,
        sku: sku ?? '',
        name: name.slice(0, 500),
        field: 'color_json',
        code: 'COLOR_JSON_NORMALIZED',
        raw_value: rawColorJson.slice(0, 2000),
        normalized_value: stock_note.slice(0, 2000),
        message: 'Màu sắc JSON lỗi nhẹ đã được chuẩn hóa; phần không hợp lệ đã bị bỏ qua.',
      })
    }
    if (rawStockQty.trim() && !/^\s*\d+\s*$/.test(rawStockQty)) {
      pushWarning({
        row_number: r + 1,
        sku: sku ?? '',
        name: name.slice(0, 500),
        field: 'stock_qty',
        code: 'STOCK_QTY_NORMALIZED',
        raw_value: rawStockQty.slice(0, 2000),
        normalized_value: String(stock_qty),
        message: 'Số lượng tồn không phải số nguyên sạch; đã chuẩn hóa về số hợp lệ.',
      })
    }

    if (price_hint && !looksLikePriceText(price_hint) && looksLikeStockStatusText(price_hint)) {
      pushWarning({
        row_number: r + 1,
        sku: sku ?? '',
        name: name.slice(0, 500),
        field: 'price_hint',
        code: 'PRICE_HINT_SKIPPED',
        raw_value: price_hint.slice(0, 2000),
        normalized_value: '',
        message: 'Giá có vẻ là trạng thái tồn kho/size nên đã bỏ qua giá ở dòng này.',
      })
      price_hint = ''
    }
    const image_url = validateInventoryImageUrl(get('image_url'))
    const product_url = validateInventoryProductUrl(get('product_url'))
    const product_video_url = validateInventoryHttpUrl(get('product_video_url'))
    const consult_note = get('consult_note').trim().slice(0, 2000)
    const remarketing_id = get('remarketing_id').trim().slice(0, 500)
    const parsedSizes = parseStringArrayField(description)
    const parsedColors = parseColorVariantsField(stock_note)
    out.push({
      sort_order,
      name: name.slice(0, 500),
      sku: sku ? sku.slice(0, 120) : null,
      description: description.slice(0, 4000),
      stock_note: stock_note.slice(0, 2000),
      stock_qty,
      price_hint: price_hint.slice(0, 500),
      image_url,
      product_url,
      product_video_url,
      consult_note,
      remarketing_id,
      is_active: true,
      removeFromInventory: false,
      catalog: catalogFieldsFromLegacyVariants({ sizes: parsedSizes, colors: parsedColors }),
      catalogFormat: 'legacy',
    })
    if (out.length >= MAX_IMPORT_ROWS) {
      return { ok: false, error: `TOO_MANY_ROWS_${MAX_IMPORT_ROWS}` }
    }
  }

  if (out.length === 0) return { ok: false, error: 'NO_DATA_ROWS' }
  return { ok: true, rows: out, warnings }
}

/** Khớp theo SKU (không phân biệt hoa thường, đã trim). Rỗng → null. */
export function inventorySkuMatchKey(sku: string | null | undefined): string | null {
  const t = (sku ?? '').trim()
  return t ? t.toLowerCase() : null
}

/** Khớp đồng bộ GET kho khách theo Remarketing / content ID (trim, giữ phân biệt hoa thường). Rỗng → null. */
export function inventoryRemarketingMatchKey(raw: string | null | undefined): string | null {
  const t = String(raw ?? '').trim()
  return t ? t : null
}

/** Khớp theo tên khi không có SKU (bỏ dấu, gom khoảng trắng). */
export function inventoryNameMatchKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

import * as XLSX from 'xlsx'
import type { Database } from '@/types/database.types'
import { validateInventoryHttpUrl } from '@/lib/messaging/inventory-http-url'

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
  /** Thêm/cập nhật = 1; xóa khỏi kho = 0 (khớp SKU hoặc tên). Tiêu đề dài giúp đọc file không cần mở hướng dẫn. */
  'Trạng thái thêm là 1 xóa 0',
] as const

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
  is_active: boolean
  /** true: xóa dòng kho khớp SKU/tên (không thêm mới). */
  removeFromInventory: boolean
}

export type InventoryImportWarning = {
  row_number: number
  sku: string
  name: string
  field: 'size_json' | 'color_json' | 'stock_qty' | 'price_hint'
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

export function buildInventoryTemplateBuffer(): Buffer {
  const header = [...INVENTORY_EXCEL_HEADER_LABELS_VI]
  /** Mỗi ô khớp đúng một cột tiêu đề (11 cột); không chèn thêm cột ẩn kẻo lệch cả file. */
  const example = [
    'AT-001',
    'Ví dụ: Áo thun cotton',
    '["M","L","XL"]',
    '[{"name":"Đen","img":"https://cdn.example.com/images/ao-thun-den.jpg"},{"name":"Trắng","img":"https://cdn.example.com/images/ao-thun-trang.jpg"}]',
    '120',
    '199000',
    'https://cdn.example.com/images/ao-thun-mau.jpg',
    'https://shop.example.com/san-pham/ao-thun',
    '',
    'Bảo hành đổi size trong 7 ngày',
    '1',
  ]
  const ws = XLSX.utils.aoa_to_sheet([header, example])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildInventoryExportBuffer(rows: InventoryRow[]): Buffer {
  const aoa: (string | number)[][] = [[...INVENTORY_EXCEL_HEADER_LABELS_VI]]
  for (const r of rows) {
    aoa.push([
      r.sku ?? '',
      r.name,
      r.description ?? '',
      r.stock_note ?? '',
      Number.isFinite(r.stock_qty) ? r.stock_qty : 0,
      r.price_hint ?? '',
      r.image_url ?? '',
      r.product_url ?? '',
      r.product_video_url ?? '',
      r.consult_note ?? '',
      r.is_active === false ? 0 : 1,
    ])
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
  const colIndex: Record<string, number> = {}
  headerRow.forEach((h, i) => {
    const key = resolveCanonicalKey(h)
    if (key) colIndex[key] = i
  })

  // Fallback cho file gần template chuẩn nhưng tiêu đề bị chỉnh/lệch nhẹ:
  // 10 cột (cũ): … [7]=link SP, [8]=ghi chú, [9]=trạng thái.
  // 11 cột (mới): … [7]=link SP, [8]=video, [9]=ghi chú, [10]=trạng thái.
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
    const templateFallback = headerRow.length >= 11 ? templateFallback11 : templateFallback10
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
        is_active: true,
        removeFromInventory: true,
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
      is_active: true,
      removeFromInventory: false,
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

/** Khớp theo tên khi không có SKU (bỏ dấu, gom khoảng trắng). */
export function inventoryNameMatchKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

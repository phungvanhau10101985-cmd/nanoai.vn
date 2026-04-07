import * as XLSX from 'xlsx'
import type { Database } from '@/types/database.types'

export type InventoryRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Khóa nội bộ / tiêu đề tiếng Anh — vẫn nhận khi import (thứ tự cột file mẫu/export: SKU trước). */
/** Tiêu đề cột chuẩn (ASCII) — dùng khi import có header tiếng Anh. Không gồm sort_order (gán tự động khi import). */
export const INVENTORY_EXCEL_HEADERS = [
  'sku',
  'name',
  'description',
  'stock_note',
  'price_hint',
  'image_url',
  'product_url',
  'consult_note',
  'is_active',
] as const

/** Dòng tiêu đề file mẫu & export (tiếng Việt); cột 1 = Mã SKU. Không có cột Thứ tự — thứ tự gán theo dòng khi nhập. */
export const INVENTORY_EXCEL_HEADER_LABELS_VI = [
  'Mã SKU',
  'Tên sản phẩm',
  'Mô tả',
  'Ghi chú tồn kho',
  'Giá',
  'Link ảnh',
  'Link trang sản phẩm',
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
  price_hint: string
  image_url: string
  product_url: string
  consult_note: string
  is_active: boolean
  /** true: xóa dòng kho khớp SKU/tên (không thêm mới). */
  removeFromInventory: boolean
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
  thong_so: 'description',
  stock_note: 'stock_note',
  ton_kho: 'stock_note',
  con_hang: 'stock_note',
  ghi_chu_ton_kho: 'stock_note',
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
  let u = raw.trim()
  if (!u || u.length > 2048) return ''
  /** CDN (vd. Taobao/1688) hay dùng //domain/path — chuẩn hoá thành https để parse & lưu ổn định. */
  if (u.startsWith('//')) u = `https:${u}`
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return u
  } catch {
    return ''
  }
}

/** URL trang sản phẩm (HTTP/HTTPS), cùng quy tắc với link ảnh. */
export function validateInventoryProductUrl(raw: string): string {
  return validateInventoryImageUrl(raw)
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

export function buildInventoryTemplateBuffer(): Buffer {
  const header = [...INVENTORY_EXCEL_HEADER_LABELS_VI]
  /** Mỗi ô khớp đúng một cột tiêu đề (9 cột); không chèn thêm cột ẩn (vd. số 100) kẻo lệch cả file. */
  const example = [
    'AT-001',
    'Ví dụ: Áo thun cotton',
    'Size M–XL, màu đen/trắng',
    'Còn đủ size',
    '199000',
    'https://cdn.example.com/images/ao-thun-mau.jpg',
    'https://shop.example.com/san-pham/ao-thun',
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
      r.price_hint ?? '',
      r.image_url ?? '',
      r.product_url ?? '',
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

export function parseInventoryWorkbook(buffer: Buffer): { ok: true; rows: InventoryExcelInsert[] } | { ok: false; error: string } {
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
  if (colIndex.name === undefined) return { ok: false, error: 'MISSING_NAME_COLUMN' }

  const out: InventoryExcelInsert[] = []
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
        price_hint: '',
        image_url: '',
        product_url: '',
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

    const description = get('description')
    const stock_note = get('stock_note')
    const price_hint = get('price_hint')
    if (price_hint && !looksLikePriceText(price_hint) && looksLikeStockStatusText(price_hint)) {
      return { ok: false, error: `INVALID_PRICE_STRUCTURE_ROW_${r + 1}` }
    }
    const image_url = validateInventoryImageUrl(get('image_url'))
    const product_url = validateInventoryProductUrl(get('product_url'))
    const consult_note = get('consult_note').trim().slice(0, 2000)
    out.push({
      sort_order,
      name: name.slice(0, 500),
      sku: sku ? sku.slice(0, 120) : null,
      description: description.slice(0, 4000),
      stock_note: stock_note.slice(0, 2000),
      price_hint: price_hint.slice(0, 500),
      image_url,
      product_url,
      consult_note,
      is_active: true,
      removeFromInventory: false,
    })
    if (out.length >= MAX_IMPORT_ROWS) {
      return { ok: false, error: `TOO_MANY_ROWS_${MAX_IMPORT_ROWS}` }
    }
  }

  if (out.length === 0) return { ok: false, error: 'NO_DATA_ROWS' }
  return { ok: true, rows: out }
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

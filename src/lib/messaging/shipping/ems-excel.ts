import * as XLSX from 'xlsx'

const ORDER_CODE_RE = /\b(DH\d+)\b/i
const DC_CODE_RE = /\b(DC\d+)\b/i
const MADONHANG_RE = /madonhang\s*(DH\d+|DC\d+)/i
const INVALID_ORDER_PLACEHOLDERS = new Set([
  'ZALO',
  'XALO',
  'FACEBOOK',
  'FB',
  'SHOPEE',
  'TIKTOK',
  'MDH',
  'NONE',
  'N/A',
  'NA',
])

const SHOP_EXPORT_HEADERS: Record<string, string[]> = {
  reference_code: ['MA_VAN_DON'],
  product_name: ['TEN_SP'],
  weight: ['TRONG_LUONG'],
  customer_name: ['TEN_KH'],
  address: ['DIA_CHI_KH'],
  phone: ['SDT_KH', 'SDT'],
  cod_amount: ['COD'],
  product_code: ['MA_SP', 'MA_SAN_PHAM', 'MA_SP_KHO', 'SKU', 'MA_HANG'],
  order_code: ['DON_HANG', 'MA_DON_HANG', 'MADONHANG', 'ORDER_CODE'],
}

const COL_REF_NAMES = ['MA_DON_HANG', 'MA THAM CHIEU', 'MA_THAM_CHIEU']
const COL_RECIPIENT_NAMES = ['TEN_NGUOI_NHAN', 'TEN NGUOI NHAN']
const COL_COD_NAMES = [
  'TONG_TIEN_THU_HO',
  'TONG TIEN THU HO',
  'TIEN_THU_HO',
  'TIEN THU HO',
  'THU_HO',
]

const LISTING_PRODUCT_EXPORT_MARKERS = new Set([
  'ID',
  'ID_SAN_PHAM',
  'MA_SAN_PHAM',
  'MO_TA_SAN_PHAM',
  'LINK_MAC_DINH',
])

const EXCEL_DATE_RE = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/i

export type ParsedEmsImportRow = {
  row_number: number
  reference_code: string
  recipient_label: string
  product_code: string
  product_code_raw: string
  order_code: string | null
  cod_amount: number | null
}

export function cellStr(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  return String(value).replace(/\s+/g, ' ').trim()
}

export function parseCodAmount(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  const text = cellStr(value).replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (!text) return null
  const n = Number(text)
  if (!Number.isFinite(n)) return null
  return Math.round(n)
}

export function parseExcelDateCell(value: unknown): string | null {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed?.y && parsed.m && parsed.d) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  const text = cellStr(value)
  for (const fmt of [/^(\d{4})-(\d{2})-(\d{2})/, /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/]) {
    const m = fmt.exec(text)
    if (m && fmt === /^(\d{4})-(\d{2})-(\d{2})/) return `${m[1]}-${m[2]}-${m[3]}`
    if (m && m[3]?.length === 4) {
      return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
    }
  }
  const match = EXCEL_DATE_RE.exec(text)
  if (!match) return null
  const a = Number(match[1])
  const b = Number(match[2])
  let y = Number(match[3])
  if (y < 100) y += 2000
  const day = a > 12 ? a : b > 12 ? b : a
  const month = a > 12 ? b : a
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function readSpreadsheetRows(fileBytes: Buffer): unknown[][] {
  const wb = XLSX.read(fileBytes, { type: 'buffer', cellDates: true, raw: true })
  const name = wb.SheetNames[0]
  if (!name) return []
  const sheet = wb.Sheets[name]
  const rows = XLSX.utils.sheet_to_json<(unknown | null)[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  })
  return rows.map((row) => (Array.isArray(row) ? row : []))
}

function normHeader(value: unknown): string {
  return cellStr(value).toUpperCase().replace(/\s+/g, '_')
}

function looksLikeListingProductExport(headers: Set<string>): boolean {
  let hits = 0
  for (const h of headers) {
    if (LISTING_PRODUCT_EXPORT_MARKERS.has(h)) hits += 1
  }
  return hits >= 3
}

function collectNormalizedHeaders(rows: unknown[][], maxRows = 5): Set<string> {
  const out = new Set<string>()
  for (const row of rows.slice(0, maxRows)) {
    for (const cell of row) {
      const h = normHeader(cell)
      if (h) out.add(h)
    }
  }
  return out
}

export function looksLikeRecipientNotSku(text: string | null | undefined): boolean {
  const raw = (text || '').trim()
  if (!raw) return true
  if (/^[\w./+-]{3,40}$/.test(raw) && /\d/.test(raw) && !/\s/.test(raw)) return false
  if (/\b(anh|chị|chi|cô|chú|ông|bà|mr|mrs)\b/i.test(raw)) return true
  if (raw.length > 40) return true
  return /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(raw)
}

export function extractWarehouseSkuFromEmsLabel(text: string | null | undefined): string | null {
  const raw = (text || '').trim()
  if (!raw || looksLikeRecipientNotSku(raw)) return null
  const beforeDash = raw.split('-')[0]?.trim() || raw
  const sku = beforeDash.replace(/\s+/g, '')
  return sku || null
}

export function warehouseSkuFromColHCell(text: string | null | undefined): string | null {
  return extractWarehouseSkuFromEmsLabel(text)
}

function isPlaceholderOrderCode(code: string): boolean {
  return INVALID_ORDER_PLACEHOLDERS.has(code.trim().toUpperCase())
}

function normalizeExternalOrderCode(code: string): string | null {
  const text = code.trim().toUpperCase()
  if (!text || isPlaceholderOrderCode(text)) return null
  const madon = MADONHANG_RE.exec(text)
  if (madon?.[1]) return madon[1].toUpperCase()
  const dh = ORDER_CODE_RE.exec(text)
  if (dh?.[1]) return dh[1].toUpperCase()
  const dc = DC_CODE_RE.exec(text)
  if (dc?.[1]) return dc[1].toUpperCase()
  if (/^[A-Z]{1,4}\d{2,}$/.test(text)) return text
  return null
}

export function extractOrderCodeFromRecipient(text: string | null | undefined): string | null {
  const raw = (text || '').trim()
  if (!raw) return null
  return normalizeExternalOrderCode(raw)
}

export function isShopOrderCode(orderCode: string | null | undefined): boolean {
  const text = (orderCode || '').trim().toUpperCase()
  if (!text) return false
  return Boolean(ORDER_CODE_RE.exec(text) || DC_CODE_RE.exec(text) || /^[A-Z]{1,6}\d{2,}$/.test(text))
}

function resolveOrderCode(input: {
  direct?: unknown
  productCode?: unknown
  recipientLabel?: unknown
}): string | null {
  const fromDirect = normalizeExternalOrderCode(cellStr(input.direct))
  if (fromDirect) return fromDirect
  const fromProduct = extractOrderCodeFromRecipient(cellStr(input.productCode))
  if (fromProduct) return fromProduct
  return extractOrderCodeFromRecipient(cellStr(input.recipientLabel))
}

function buildRecipientLabel(input: {
  customerName?: string
  phone?: string
  address?: string
  legacy?: string
}): string {
  const parts = [input.customerName, input.phone, input.address].map((x) => (x || '').trim()).filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return (input.legacy || '').trim()
}

function matchHeaderField(key: string, aliases: string[]): boolean {
  return aliases.includes(key)
}

function buildShopHeaderMap(row: unknown[]): Record<string, number> | null {
  const map: Record<string, number> = {}
  for (let i = 0; i < row.length; i++) {
    const h = normHeader(row[i])
    if (!h) continue
    for (const [field, aliases] of Object.entries(SHOP_EXPORT_HEADERS)) {
      if (map[field] == null && matchHeaderField(h, aliases)) map[field] = i
    }
  }
  if (map.reference_code == null) return null
  return map
}

function findHeaderMap(rows: unknown[][]): { headerIdx: number; format: 'shop_export' | 'ems_export'; colMap: Record<string, number> } | null {
  for (let idx = 0; idx < Math.min(rows.length, 8); idx++) {
    const row = rows[idx] || []
    const shop = buildShopHeaderMap(row)
    if (shop) return { headerIdx: idx, format: 'shop_export', colMap: shop }
    const headers = row.map((c) => normHeader(c))
    const refIdx = headers.findIndex((h) => COL_REF_NAMES.includes(h.replace(/_/g, ' ')) || COL_REF_NAMES.includes(h))
    const recIdx = headers.findIndex((h) => COL_RECIPIENT_NAMES.includes(h.replace(/_/g, ' ')) || COL_RECIPIENT_NAMES.includes(h))
    if (refIdx >= 0) {
      const codIdx = headers.findIndex((h) => COL_COD_NAMES.includes(h.replace(/_/g, ' ')) || COL_COD_NAMES.includes(h))
      const productIdx = headers.findIndex((h) => SHOP_EXPORT_HEADERS.product_code.includes(h))
      return {
        headerIdx: idx,
        format: 'ems_export',
        colMap: {
          reference_code: refIdx,
          recipient_label: recIdx >= 0 ? recIdx : 9,
          cod_amount: codIdx >= 0 ? codIdx : 15,
          product_code: productIdx >= 0 ? productIdx : 7,
        },
      }
    }
  }
  return null
}

function readMaSpFromExcelRow(row: unknown[], colMap: Record<string, number>): { raw: string; sku: string } {
  const idx = colMap.product_code ?? 7
  const raw = cellStr(row[idx])
  return { raw, sku: warehouseSkuFromColHCell(raw) || '' }
}

export function validateEmsShipmentImportFile(fileBytes: Buffer, sourceFilename?: string | null): void {
  const rows = readSpreadsheetRows(fileBytes)
  if (!rows.length) throw new Error('File Excel trống.')
  const headers = collectNormalizedHeaders(rows)
  if (looksLikeListingProductExport(headers)) {
    throw new Error(
      'File này giống xuất sản phẩm listing, không phải file gửi EMS. Tải mẫu «file_gui_ems_mau.xlsx».',
    )
  }
  const name = (sourceFilename || '').toLowerCase()
  if (name.includes('listing') || name.includes('san_pham') || name.includes('product-export')) {
    throw new Error('Tên file giống xuất sản phẩm — hãy dùng file gửi EMS (cột MA_VAN_DON / DON_HANG).')
  }
}

export function parseEmsExportRows(fileBytes: Buffer): { rows: ParsedEmsImportRow[]; warnings: string[] } {
  const warnings: string[] = []
  const rawRows = readSpreadsheetRows(fileBytes)
  if (!rawRows.length) return { rows: [], warnings: ['File Excel trống.'] }
  const headerMap = findHeaderMap(rawRows)
  if (!headerMap) {
    return {
      rows: [],
      warnings: ['Không nhận diện được mẫu file gửi EMS (thiếu MA_VAN_DON / MA_DON_HANG trong tiêu đề).'],
    }
  }
  const { headerIdx, format, colMap } = headerMap
  if (headerIdx > 0) warnings.push(`Phát hiện dòng tiêu đề ở hàng ${headerIdx + 1}.`)
  if (format === 'shop_export') {
    warnings.push('Định dạng file gửi EMS: cột A mã vận đơn, I đơn hàng, G COD, D tên khách.')
  }
  const refCol = colMap.reference_code
  const codCol = colMap.cod_amount ?? (format === 'shop_export' ? 6 : 15)
  const parsed: ParsedEmsImportRow[] = []
  const dataRows = rawRows.slice(headerIdx + 1)
  for (let offset = 0; offset < dataRows.length; offset++) {
    const row = dataRows[offset] || []
    const rowIdx = headerIdx + 2 + offset
    const refCode = cellStr(row[refCol]).toUpperCase()
    const codAmount = parseCodAmount(row[codCol])
    let recipientLabel = ''
    let productCode = ''
    let maSpRaw = ''
    let orderCode: string | null = null
    if (format === 'shop_export') {
      const customerName = cellStr(row[colMap.customer_name ?? 3])
      const phone = cellStr(row[colMap.phone ?? 5])
      const address = cellStr(row[colMap.address ?? 4])
      const ma = readMaSpFromExcelRow(row, colMap)
      maSpRaw = ma.raw
      productCode = ma.sku
      recipientLabel = buildRecipientLabel({ customerName, phone, address })
      orderCode = resolveOrderCode({
        direct: row[colMap.order_code ?? 8],
        productCode: maSpRaw || productCode,
        recipientLabel,
      })
    } else {
      const ma = readMaSpFromExcelRow(row, colMap)
      maSpRaw = ma.raw
      productCode = ma.sku
      recipientLabel = cellStr(row[colMap.recipient_label ?? 9])
      orderCode = resolveOrderCode({
        productCode: maSpRaw || productCode,
        recipientLabel,
      })
    }
    if (!refCode && !recipientLabel && !orderCode) continue
    parsed.push({
      row_number: rowIdx,
      reference_code: refCode,
      recipient_label: recipientLabel,
      product_code: productCode,
      product_code_raw: maSpRaw,
      order_code: orderCode,
      cod_amount: codAmount,
    })
  }
  if (!parsed.length) {
    warnings.push(
      format === 'shop_export'
        ? 'Không có dòng dữ liệu hợp lệ (cột A mã vận đơn / cột I đơn hàng / cột G COD).'
        : 'Không có dòng dữ liệu hợp lệ (cột MA_DON_HANG mã tham chiếu / TEN_NGUOI_NHAN).',
    )
  }
  return { rows: parsed, warnings }
}

export function dedupeRowsByReference(rows: ParsedEmsImportRow[]): { rows: ParsedEmsImportRow[]; warnings: string[] } {
  const seen = new Map<string, ParsedEmsImportRow>()
  const warnings: string[] = []
  let dupes = 0
  for (const row of rows) {
    const key = row.reference_code.trim().toUpperCase()
    if (!key) continue
    if (seen.has(key)) dupes += 1
    seen.set(key, row)
  }
  if (dupes) warnings.push(`${dupes} dòng trùng mã vận đơn — giữ dòng cuối.`)
  return { rows: [...seen.values()], warnings }
}

function aoaToXlsx(aoa: unknown[][], sheetName: string): Buffer {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

export function buildEmsShipmentSampleXlsx(): { bytes: Buffer; filename: string } {
  const todayNote =
    'Cột A: mã vận đơn EMS · I: mã đơn shop (DHxxx/DCxxx) · G: COD · D: tên khách · H: mã SP kho. Import lần 2: mã cột A đã có thì cập nhật, mã mới thì thêm dòng.'
  const bytes = aoaToXlsx(
    [
      ['MA_VAN_DON', 'TEN_SP', 'TRONG_LUONG', 'TEN_KH', 'DIA_CHI_KH', 'SDT_KH', 'COD', 'MA_SP', 'DON_HANG'],
      ['EE123456789VN', 'Áo thun nam', 0.5, 'Nguyễn Văn A', '123 Đường ABC, Q.1, TP.HCM', '0901234567', 150000, 'H9441/1/xl', 'DH131'],
      ['EE987654321VN', 'Quần jean', 0.8, 'Trần Thị B', '456 Đường XYZ, Q.3, TP.HCM', '0912345678', 0, 'H0723/40/3', 'DC42'],
      [todayNote],
    ],
    'Gui EMS',
  )
  return { bytes, filename: 'file_gui_ems_mau.xlsx' }
}

export function buildCodSettlementSampleXlsx(): { bytes: Buffer; filename: string } {
  const today = new Date()
  const label = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`
  const bytes = aoaToXlsx(
    [
      [null, null, null, null, label, '(E1: ngày EMS trả tiền cho shop)'],
      [null, 'Mã tham chiếu (B)', 'Mã vận chuyển EMS (C)', 'Số tiền đã trả (D)'],
      [null, 'MA_THAM_CHIEU_01', 'EE123456789VN', 5200000],
      [null, '', 'EE987654321VN', 1500000],
    ],
    'Doi soat COD',
  )
  return { bytes, filename: 'doi_soat_cod_mau.xlsx' }
}

export function buildFreightSettlementSampleXlsx(): { bytes: Buffer; filename: string } {
  const row1: unknown[] = new Array(12).fill(null)
  row1[0] = 'MA_E1'
  row1[2] = 'Ngay_Phat_Hanh'
  row1[11] = 'CUOC_PHI'
  const r2: unknown[] = new Array(12).fill(null)
  r2[0] = 'EE123456789VN'
  r2[2] = '01/06/2026'
  r2[11] = 45000
  const r3: unknown[] = new Array(12).fill(null)
  r3[0] = 'EE987654321VN'
  r3[2] = '02/06/2026'
  r3[11] = 62000
  const bytes = aoaToXlsx([row1, r2, r3], 'Doi soat cuoc')
  return { bytes, filename: 'doi_soat_cuoc_mau.xlsx' }
}

export function buildShopReturnConfirmSampleXlsx(): { bytes: Buffer; filename: string } {
  const bytes = aoaToXlsx(
    [['Mã (EMS / tham chiếu / DHxxx)'], ['EE123456789VN'], ['MA_THAM_CHIEU_A'], ['DH131']],
    'Xac nhan hoan',
  )
  return { bytes, filename: 'xac_nhan_don_hoan_mau.xlsx' }
}

export const EMS_TRACKING_CODE_RE = /^[A-Z]{2}[A-Z0-9]{6,}VN$/i
export const EMS_SETTLEMENT_TRACKING_RE = /^[A-Z]{2}\d+[A-Z]{2}$/i

export function looksLikeEmsTrackingCode(value: string | null | undefined): boolean {
  let code = (value || '').trim().toUpperCase()
  if (!code) return false
  if (code.endsWith('EMS')) code = code.slice(0, -3)
  return EMS_TRACKING_CODE_RE.test(code)
}

import * as XLSX from 'xlsx'
import { parseVisionCatalogPurgeLines } from '@/lib/messaging/partner-vision-product-search'

/** Tiêu đề cột A thường gặp — bỏ qua dòng đầu nếu khớp (file mẫu / export tay). */
const HEADER_FIRST_CELL = new Set(
  [
    'id',
    'sku',
    'uuid',
    'stt',
    'inventory_id',
    'uuid_or_sku',
    'product_id',
    'mã',
    'ma',
    'mã sku',
    'ma sku',
    'code',
  ].map((s) => s.toLowerCase())
)

function isExcelFile(file: File): boolean {
  const n = file.name.toLowerCase()
  if (n.endsWith('.xlsx') || n.endsWith('.xls')) return true
  const t = file.type
  return (
    t === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    t === 'application/vnd.ms-excel'
  )
}

function cellAToLine(v: unknown): string | null {
  if (v == null || v === '') return null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v).trim() || null
  const s = String(v).trim()
  return s || null
}

function tokensFromXlsxBuffer(buf: ArrayBuffer): string[] {
  const wb = XLSX.read(buf, { type: 'array' })
  const sn = wb.SheetNames[0]
  if (!sn) return []
  const sheet = wb.Sheets[sn]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' }) as unknown[][]
  const lineTexts: string[] = []
  for (const row of rows) {
    const line = cellAToLine(row?.[0])
    if (line) lineTexts.push(line)
  }
  if (lineTexts.length > 0) {
    const first = lineTexts[0].toLowerCase()
    if (HEADER_FIRST_CELL.has(first)) lineTexts.shift()
  }
  return parseVisionCatalogPurgeLines(lineTexts.join('\n'))
}

/** multipart file → danh sách token gỡ (txt/csv hoặc Excel cột A). */
export async function parseVisionPurgeUploadToTokens(file: File): Promise<string[]> {
  if (isExcelFile(file)) {
    const buf = await file.arrayBuffer()
    return tokensFromXlsxBuffer(buf)
  }
  const raw = await file.text()
  return parseVisionCatalogPurgeLines(raw)
}

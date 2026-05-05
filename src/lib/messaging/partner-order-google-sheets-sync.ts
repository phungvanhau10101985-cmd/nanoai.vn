import { google } from 'googleapis'

import {
  fetchPartnerGoogleSheetsSettingsForSyncFromPg,
  updatePartnerOrderGoogleSheetRowFromPg,
} from '@/lib/db/messaging-partner-google-sheets-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  fetchPartnerOrderByIdForPartnerFromPg,
  fetchPartnerOrderLinesFromPg,
  type PartnerOrderLineRow,
  type PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'
import {
  type ParsedVariantLine,
  parsePartnerOrderVariantLines,
} from '@/lib/messaging/partner-order-variant-lines'

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

/** 30 cột A → AD — đủ thông tin đơn + SP + cọc + link. */
const SHEET_COL_LAST = 'AD'
const SHEET_COL_COUNT = 30
/** Cột ghi chú — nếu đã có nội dung khi cập nhật thì giữ (shop sửa tay). 0-based. */
const SHEET_MERGE_PRESERVE_COLS = new Set([24, 26])

const HEADER: string[] = [
  'Ma don (UUID)',
  'Ma noi dung CK',
  'TT thanh toan',
  'TT giao hang',
  'Coc %',
  'Tien coc can (VND)',
  'Da thanh toan (VND)',
  'Con lai giao hang (VND)',
  'Co can coc',
  'Trang thai coc',
  'Ten san pham',
  'SKU (kho)',
  'Mau',
  'Size',
  'SL',
  'Don gia (VND)',
  'Tong tien hang (VND)',
  'Link anh SP',
  'Link trang SP',
  'ID dong kho',
  'Khach hang',
  'SDT',
  'Email',
  'Dia chi giao hang',
  'Ghi chu don',
  'Loai tien',
  'Ghi chu xac minh',
  'Tao luc (VN)',
  'Cap nhat (VN)',
  'Xac minh TT luc (VN)',
]

/** Trích ID từ URL Google Sheet hoặc chuỗi ID thuần (lưu DB / dùng API). */
export function parseSpreadsheetId(raw: string): string {
  const s = raw.trim()
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (m?.[1]) return m[1]
  return s.replace(/[^\w-]/g, '').slice(0, 128)
}

/** A1 sheet name quoting for Google Sheets API. */
export function escapeSheetNameForRange(name: string): string {
  const n = name.trim() || 'Sheet1'
  return /[^A-Za-z0-9_]/.test(n) ? `'${n.replace(/'/g, "''")}'` : n
}

function parseRowFromUpdatedRange(range: string | null | undefined): number | null {
  if (!range) return null
  const m = range.match(/![A-Za-z]+(\d+)/)
  if (!m?.[1]) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function formatVnTime(iso: string | null | undefined): string {
  if (iso == null || String(iso).trim() === '') return ''
  const t = Date.parse(String(iso))
  if (!Number.isFinite(t)) return String(iso)
  return new Date(t).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function depositStatusLine(o: PartnerOrderRow, req: number, paid: number): string {
  if (req <= 0) return '—'
  if (o.status === 'paid_verified' || paid >= req) return 'Du coc / da xac nhan TT'
  if (paid > 0) return `Mot phan (${paid}/${req} VND)`
  return 'Chua coc'
}

/** Không có JSON ảnh — một hàng với chuỗi màu/size như DB. */
function sheetVariantColumnsLegacy(o: PartnerOrderRow): { mau: string; size: string; sl: string; linkAnh: string } {
  return {
    mau: o.variant_color,
    size: o.variant_size,
    sl: String(o.quantity),
    linkAnh: o.product_image_url,
  }
}

function padSheetRow(cells: string[] | undefined, w: number): string[] {
  const a = [...(cells ?? [])]
  while (a.length < w) a.push('')
  return a.slice(0, w)
}

function padRowsToSpan(rows: string[][], span: number, w: number): string[][] {
  const out = rows.map((r) => padSheetRow(r, w))
  while (out.length < span) {
    out.push(Array(w).fill(''))
  }
  return out.slice(0, span)
}

/**
 * Gộp dữ liệu mới với Sheet hiện có: hàng đã có dữ liệu mà không phải đơn này (cột A ≠ UUID) → giữ nguyên.
 * Cột ghi chú 24/26: nếu đã có chữ → giữ (không ghi đè).
 */
function mergeOrderSheetBlock(
  incoming: string[][],
  existing: string[][] | undefined,
  orderId: string
): string[][] {
  const W = SHEET_COL_COUNT
  const R = Math.max(incoming.length, existing?.length ?? 0)
  const out: string[][] = []
  for (let r = 0; r < R; r++) {
    const inc = padSheetRow(incoming[r], W)
    const ex = existing?.[r] ?? []
    const aEx = String(ex[0] ?? '').trim()
    const rowHas = ex.some((c) => String(c ?? '').trim() !== '')
    if (rowHas && aEx !== orderId) {
      out.push(padSheetRow(ex, W))
      continue
    }
    const row: string[] = []
    for (let c = 0; c < W; c++) {
      const e = String(ex[c] ?? '')
      const i = String(inc[c] ?? '')
      if (SHEET_MERGE_PRESERVE_COLS.has(c) && e.trim() !== '') {
        row.push(e)
      } else {
        row.push(i)
      }
    }
    out.push(row)
  }
  return out
}

function buildSheetRow(
  o: PartnerOrderRow,
  sku: string,
  spec:
    | { kind: 'legacy'; v: ReturnType<typeof sheetVariantColumnsLegacy> }
    | { kind: 'line'; line: ParsedVariantLine; lineIndex: number; totalLines: number }
): string[] {
  const sub = Math.round(o.subtotal_amount)
  const paid = Math.round(o.paid_amount)
  const req = Math.round(o.required_amount)
  const conLaiGiaoHang = Math.max(0, sub - paid)
  const unit = Math.round(o.unit_price)
  const canCoc = req > 0 ? 'Co' : 'Khong'

  let mau: string
  let size: string
  let sl: string
  let linkAnh: string
  let tongCell: number
  let showDepositBlock: boolean
  let noteCell: string

  if (spec.kind === 'legacy') {
    const v = spec.v
    mau = v.mau
    size = v.size
    sl = v.sl
    linkAnh = v.linkAnh
    tongCell = sub
    showDepositBlock = true
    noteCell = o.note
  } else {
    const { line, lineIndex, totalLines } = spec
    mau = line.variantName
    size = line.size
    sl = String(line.qty)
    linkAnh = line.imageUrl
    tongCell = Math.max(0, Math.round(unit * line.qty))
    showDepositBlock = lineIndex === 0
    noteCell = totalLines > 1 && lineIndex > 0 ? '' : o.note
  }

  const dep = (s: string) => (showDepositBlock ? s : '')

  return [
    o.id,
    o.payment_reference,
    o.status,
    o.shipping_status,
    dep(String(o.deposit_percent)),
    dep(String(req)),
    dep(String(paid)),
    dep(String(conLaiGiaoHang)),
    dep(canCoc),
    dep(depositStatusLine(o, req, paid)),
    o.product_name,
    sku,
    mau,
    size,
    sl,
    String(unit),
    String(tongCell),
    linkAnh,
    o.product_url,
    o.product_inventory_id ?? '',
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.shipping_address,
    noteCell,
    o.currency,
    o.verified_note,
    formatVnTime(o.created_at),
    formatVnTime(o.updated_at),
    formatVnTime(o.verified_at),
  ]
}

function buildSheetRowFromOrderLine(
  o: PartnerOrderRow,
  line: PartnerOrderLineRow,
  lineIndex: number,
  totalLines: number
): string[] {
  const sub = Math.round(o.subtotal_amount)
  const paid = Math.round(o.paid_amount)
  const req = Math.round(o.required_amount)
  const conLaiGiaoHang = Math.max(0, sub - paid)
  const unit = Math.round(line.unit_price)
  const canCoc = req > 0 ? 'Co' : 'Khong'
  const dep = (s: string) => (lineIndex === 0 ? s : '')
  return [
    o.id,
    o.payment_reference,
    o.status,
    o.shipping_status,
    dep(String(o.deposit_percent)),
    dep(String(req)),
    dep(String(paid)),
    dep(String(conLaiGiaoHang)),
    dep(canCoc),
    dep(depositStatusLine(o, req, paid)),
    line.product_name,
    '',
    line.variant_color,
    line.variant_size,
    String(line.quantity),
    String(unit),
    String(Math.max(0, Math.round(line.line_subtotal))),
    line.product_image_url,
    line.product_url,
    line.product_inventory_id ?? '',
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.shipping_address,
    totalLines > 1 && lineIndex > 0 ? '' : (line.note || o.note),
    o.currency,
    lineIndex === 0 ? o.verified_note : '',
    formatVnTime(o.created_at),
    formatVnTime(o.updated_at),
    formatVnTime(o.verified_at),
  ]
}

async function orderToSheetRows(partnerId: string, o: PartnerOrderRow): Promise<string[][]> {
  const orderLines = await fetchPartnerOrderLinesFromPg(o.id)
  if (orderLines.length > 1) {
    return orderLines.map((line, lineIndex) =>
      buildSheetRowFromOrderLine(o, line, lineIndex, orderLines.length)
    )
  }

  let sku = ''
  if (o.product_inventory_id) {
    try {
      const inv = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, o.product_inventory_id)
      sku = String(inv?.sku ?? '').trim()
    } catch {
      sku = ''
    }
  }

  const lines = parsePartnerOrderVariantLines(o)
  if (lines && lines.length > 1) {
    return lines.map((line, lineIndex) =>
      buildSheetRow(o, sku, {
        kind: 'line',
        line,
        lineIndex,
        totalLines: lines.length,
      })
    )
  }
  if (lines && lines.length === 1) {
    return [
      buildSheetRow(o, sku, {
        kind: 'line',
        line: lines[0]!,
        lineIndex: 0,
        totalLines: 1,
      }),
    ]
  }
  return [buildSheetRow(o, sku, { kind: 'legacy', v: sheetVariantColumnsLegacy(o) })]
}

function loadSheetsClientFromCredentialsJson(raw: string) {
  let credentials: Record<string, unknown>
  try {
    credentials = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SHEETS_SCOPES,
  })
  return google.sheets({ version: 'v4', auth })
}

async function ensureHeaderRow(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTitle: string
): Promise<void> {
  const esc = escapeSheetNameForRange(sheetTitle)
  const headerRange = `${esc}!A1:${SHEET_COL_LAST}1`
  const got = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: headerRange,
  })
  const first = got.data.values?.[0]
  const empty = !first || first.every((c) => !String(c ?? '').trim())
  if (!empty) return
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: headerRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADER] },
  })
}

/**
 * Đồng bộ một đơn lên Google Sheet (append lần đầu, cập nhật dòng khi đã có `google_sheet_row`).
 * Ưu tiên JSON service account lưu trong cài đặt shop; không có thì dùng `GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON` (fallback host).
 */
export async function syncPartnerOrderToGoogleSheets(partnerId: string, orderId: string): Promise<void> {
  const settings = await fetchPartnerGoogleSheetsSettingsForSyncFromPg(partnerId)
  if (!settings?.enabled) return
  const spreadsheetId = parseSpreadsheetId(settings.spreadsheet_id)
  if (!spreadsheetId) return

  let credRaw = settings.service_account_json?.trim() ?? ''
  if (!credRaw) {
    credRaw = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON?.trim() ?? ''
  }
  const sheets = credRaw ? loadSheetsClientFromCredentialsJson(credRaw) : null
  if (!sheets) {
    console.warn(
      '[partner-order-google-sheets-sync] Thiếu JSON service account (cài đặt shop hoặc GOOGLE_SHEETS_SERVICE_ACCOUNT_JSON).'
    )
    return
  }

  const order = await fetchPartnerOrderByIdForPartnerFromPg(partnerId, orderId)
  if (!order || order.partner_id !== partnerId) return

  const sheetTitle = settings.sheet_name.trim() || 'Don hang'
  const esc = escapeSheetNameForRange(sheetTitle)
  const rows = await orderToSheetRows(partnerId, order)
  const n = Math.max(1, rows.length)

  try {
    await ensureHeaderRow(sheets, spreadsheetId, sheetTitle)

    const existingRow = order.google_sheet_row
    const oldCount = order.google_sheet_row_count ?? 1

    if (existingRow != null && existingRow > 0) {
      const span = Math.max(n, oldCount)
      const range = `${esc}!A${existingRow}:${SHEET_COL_LAST}${existingRow + span - 1}`
      const incomingPadded = padRowsToSpan(rows, span, SHEET_COL_COUNT)
      let existingMatrix: string[][] | undefined
      try {
        const got = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        })
        existingMatrix = got.data.values as string[][] | undefined
      } catch {
        existingMatrix = undefined
      }
      const merged = mergeOrderSheetBlock(incomingPadded, existingMatrix, order.id)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: merged },
      })
      await updatePartnerOrderGoogleSheetRowFromPg({
        partnerId,
        orderId,
        sheetRow: existingRow,
        sheetRowCount: n,
      })
      return
    }

    const appended = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${esc}!A:${SHEET_COL_LAST}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    })
    const updatedRange = appended.data.updates?.updatedRange ?? appended.data.tableRange
    const newRow = parseRowFromUpdatedRange(updatedRange ?? null)
    if (newRow) {
      await updatePartnerOrderGoogleSheetRowFromPg({
        partnerId,
        orderId,
        sheetRow: newRow,
        sheetRowCount: n,
      })
    }
  } catch (e) {
    logGoogleSheetsSyncError('syncPartnerOrderToGoogleSheets', partnerId, orderId, e)
  }
}

/** Đọc lỗi từ Google APIs / gaxios để log gợi ý xử lý (403 API chưa bật, quyền Sheet, v.v.). */
function logGoogleSheetsSyncError(
  context: string,
  partnerId: string,
  orderId: string,
  e: unknown
): void {
  const err = e as {
    code?: number
    response?: {
      data?: {
        error?: {
          message?: string
          status?: string
          errors?: Array<{ reason?: string; message?: string; domain?: string }>
        }
      }
    }
    message?: string
  }
  const first = err.response?.data?.error?.errors?.[0]
  const reason = String(first?.reason ?? '')
  const detail = String(first?.message ?? err.response?.data?.error?.message ?? err.message ?? e)

  if (reason === 'accessNotConfigured' || detail.includes('has not been used in project')) {
    console.warn(
      `[${context}] partner=${partnerId} order=${orderId} — Google Sheets API chưa bật trên đúng Google Cloud project ` +
        `(project của file JSON service account). Vào Console → APIs & Services → Library → bật «Google Sheets API», đợi vài phút rồi thử lại.`
    )
    console.warn(`[${context}] Google: ${detail}`)
    return
  }

  if (
    err.code === 403 ||
    reason === 'forbidden' ||
    detail.toLowerCase().includes('does not have permission') ||
    detail.includes('PERMISSION_DENIED')
  ) {
    console.warn(
      `[${context}] partner=${partnerId} order=${orderId} — 403/permission: kiểm tra đã Share Google Sheet với email ` +
        `client_email trong JSON (quyền Editor), và API đã bật như trên.`
    )
    console.warn(`[${context}] Google: ${detail}`)
    return
  }

  console.warn(`[${context}] partner=${partnerId} order=${orderId}`, e)
}

export function queuePartnerOrderGoogleSheetsSync(partnerId: string, orderId: string): void {
  const pid = String(partnerId ?? '').trim()
  const oid = String(orderId ?? '').trim()
  if (!pid || !oid) return
  void syncPartnerOrderToGoogleSheets(pid, oid).catch((e) =>
    console.warn('[queuePartnerOrderGoogleSheetsSync]', e)
  )
}

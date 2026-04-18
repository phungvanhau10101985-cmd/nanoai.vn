import { google } from 'googleapis'

import {
  fetchPartnerGoogleSheetsSettingsForSyncFromPg,
  updatePartnerOrderGoogleSheetRowFromPg,
} from '@/lib/db/messaging-partner-google-sheets-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerOrderByIdForPartnerFromPg, type PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

/** 30 cột A → AD — đủ thông tin đơn + SP + cọc + link. */
const SHEET_COL_LAST = 'AD'

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

async function orderToSheetValues(partnerId: string, o: PartnerOrderRow): Promise<string[]> {
  let sku = ''
  if (o.product_inventory_id) {
    try {
      const inv = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, o.product_inventory_id)
      sku = String(inv?.sku ?? '').trim()
    } catch {
      sku = ''
    }
  }

  const sub = Math.round(o.subtotal_amount)
  const paid = Math.round(o.paid_amount)
  const req = Math.round(o.required_amount)
  const conLaiGiaoHang = Math.max(0, sub - paid)
  const canCoc = req > 0 ? 'Co' : 'Khong'

  return [
    o.id,
    o.payment_reference,
    o.status,
    o.shipping_status,
    String(o.deposit_percent),
    String(req),
    String(paid),
    String(conLaiGiaoHang),
    canCoc,
    depositStatusLine(o, req, paid),
    o.product_name,
    sku,
    o.variant_color,
    o.variant_size,
    String(o.quantity),
    String(Math.round(o.unit_price)),
    String(sub),
    o.product_image_url,
    o.product_url,
    o.product_inventory_id ?? '',
    o.customer_name,
    o.customer_phone,
    o.customer_email,
    o.shipping_address,
    o.note,
    o.currency,
    o.verified_note,
    formatVnTime(o.created_at),
    formatVnTime(o.updated_at),
    formatVnTime(o.verified_at),
  ]
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
  const rowVals = await orderToSheetValues(partnerId, order)
  const values = [rowVals]

  try {
    await ensureHeaderRow(sheets, spreadsheetId, sheetTitle)

    const existingRow = order.google_sheet_row
    if (existingRow != null && existingRow > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${esc}!A${existingRow}:${SHEET_COL_LAST}${existingRow}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      })
      return
    }

    const appended = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${esc}!A:${SHEET_COL_LAST}`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })
    const updatedRange = appended.data.updates?.updatedRange ?? appended.data.tableRange
    const newRow = parseRowFromUpdatedRange(updatedRange ?? null)
    if (newRow) {
      await updatePartnerOrderGoogleSheetRowFromPg({
        partnerId,
        orderId,
        sheetRow: newRow,
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

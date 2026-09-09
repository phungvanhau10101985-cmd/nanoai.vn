import { applyPartnerEmsFreightSettlementFromPg, findPartnerEmsRecordByTokenFromPg } from '@/lib/db/messaging-partner-ems-shipping-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { cellStr, EMS_SETTLEMENT_TRACKING_RE, parseCodAmount, parseExcelDateCell, readSpreadsheetRows } from '@/lib/messaging/shipping/ems-excel'

const COL_TRACKING = 0
const COL_ISSUE_DATE = 2
const COL_FREIGHT = 11
const HIGH_FEE_THRESHOLD = 70_000
const HEADER_TRACKING_NAMES = new Set(['MA_E1', 'MA E1', 'MA_VAN_CHUYEN', 'MA VAN CHUYEN'])

function findHeaderRow(raw: unknown[][]): number {
  for (let i = 0; i < Math.min(raw.length, 5); i++) {
    const h = cellStr(raw[i]?.[COL_TRACKING]).toUpperCase()
    if (HEADER_TRACKING_NAMES.has(h) || HEADER_TRACKING_NAMES.has(h.replace(/_/g, ' '))) return i
  }
  return 0
}

export type FreightParsedRow = {
  row_number: number
  ems_tracking_code: string | null
  freight_amount: number | null
  reconcile_status: string
  reconcile_message: string | null
  high_fee_warning: string | null
  ems_shipping_record_id?: string | null
}

export function parseFreightSettlementRows(fileBytes: Buffer): {
  settlementDate: string | null
  rows: FreightParsedRow[]
  warnings: string[]
} {
  const warnings: string[] = []
  const raw = readSpreadsheetRows(fileBytes)
  if (!raw.length) return { settlementDate: null, rows: [], warnings: ['File Excel trống.'] }
  const headerIdx = findHeaderRow(raw)
  let settlementDate: string | null = null
  const parsed: FreightParsedRow[] = []
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] || []
    const tracking = cellStr(row[COL_TRACKING]).toUpperCase()
    const freight = parseCodAmount(row[COL_FREIGHT])
    const issue = parseExcelDateCell(row[COL_ISSUE_DATE])
    if (issue && (!settlementDate || issue > settlementDate)) settlementDate = issue
    if (!tracking && freight == null) continue
    if (!tracking || (!EMS_SETTLEMENT_TRACKING_RE.test(tracking) && !tracking.endsWith('VN'))) {
      parsed.push({
        row_number: i + 1,
        ems_tracking_code: tracking || null,
        freight_amount: freight,
        reconcile_status: 'parse_error',
        reconcile_message: 'Thiếu hoặc sai mã EMS (cột A).',
        high_fee_warning: null,
      })
      continue
    }
    const high = freight != null && freight >= HIGH_FEE_THRESHOLD ? '1' : null
    parsed.push({
      row_number: i + 1,
      ems_tracking_code: tracking,
      freight_amount: freight,
      reconcile_status: 'pending',
      reconcile_message: null,
      high_fee_warning: high,
    })
  }
  return { settlementDate, rows: parsed, warnings }
}

async function reconcileRow(partnerId: string, row: FreightParsedRow): Promise<FreightParsedRow> {
  if (row.reconcile_status === 'parse_error') return row
  const record = await findPartnerEmsRecordByTokenFromPg(partnerId, row.ems_tracking_code || '')
  if (!record) {
    return {
      ...row,
      reconcile_status: 'record_not_found',
      reconcile_message: `Không thấy vận đơn «${row.ems_tracking_code}».`,
    }
  }
  if ((record.freight_settlement_status || '') === 'settled') {
    return {
      ...row,
      ems_shipping_record_id: record.id,
      reconcile_status: 'already_settled',
      reconcile_message: 'Đã đối soát cước trước đó.',
    }
  }
  return {
    ...row,
    ems_shipping_record_id: record.id,
    reconcile_status: 'settled',
    reconcile_message: 'Đã ghi cước EMS.',
  }
}

export async function importFreightSettlementExcel(input: {
  partnerId: string
  fileBytes: Buffer
  filename?: string | null
  userId?: string | null
}) {
  if (!isPgConfigured()) throw new Error('Database not configured')
  const parsed = parseFreightSettlementRows(input.fileBytes)
  const reconciled = []
  for (const row of parsed.rows) reconciled.push(await reconcileRow(input.partnerId, row))
  const summary = {
    total_rows: reconciled.length,
    settled: reconciled.filter((r) => r.reconcile_status === 'settled').length,
    record_not_found: reconciled.filter((r) => r.reconcile_status === 'record_not_found').length,
    already_settled: reconciled.filter((r) => r.reconcile_status === 'already_settled').length,
    parse_error: reconciled.filter((r) => r.reconcile_status === 'parse_error').length,
    high_fee_warning: reconciled.filter((r) => r.high_fee_warning === '1').length,
    total_freight_amount: reconciled.reduce((s, r) => s + Math.max(0, r.freight_amount || 0), 0),
  }
  const batch = await pgQueryOne<{ id: string }>(
    `insert into public.messaging_partner_ems_freight_settlement_batches (
       partner_id, settlement_date, source_filename, imported_by_user_id, total_rows, settled_count,
       record_not_found_count, already_settled_count, parse_error_count, high_fee_warning_count, total_freight_amount
     ) values ($1::uuid, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11)
     returning id::text`,
    [
      input.partnerId,
      parsed.settlementDate,
      input.filename || null,
      input.userId || null,
      summary.total_rows,
      summary.settled,
      summary.record_not_found,
      summary.already_settled,
      summary.parse_error,
      summary.high_fee_warning,
      summary.total_freight_amount,
    ],
  )
  for (const row of reconciled) {
    await pgQuery(
      `insert into public.messaging_partner_ems_freight_settlement_rows (
         batch_id, excel_row_number, ems_tracking_code, freight_amount, ems_shipping_record_id,
         high_fee_warning, reconcile_status, reconcile_message
       ) values ($1::uuid, $2, $3, $4, $5::uuid, $6, $7, $8)`,
      [
        batch?.id,
        row.row_number,
        row.ems_tracking_code,
        row.freight_amount,
        row.ems_shipping_record_id || null,
        row.high_fee_warning,
        row.reconcile_status,
        row.reconcile_message,
      ],
    )
    if (row.ems_shipping_record_id) {
      await applyPartnerEmsFreightSettlementFromPg({
        partnerId: input.partnerId,
        recordId: row.ems_shipping_record_id,
        freightAmount: row.freight_amount,
        status: row.reconcile_status,
        message: row.reconcile_message,
        highFeeWarning: row.high_fee_warning,
      })
    }
  }
  const import_batch = {
    id: batch?.id || null,
    settlement_date: parsed.settlementDate,
    source_filename: input.filename || null,
    total_rows: summary.total_rows,
    settled_count: summary.settled,
    already_settled_count: summary.already_settled,
    record_not_found_count: summary.record_not_found,
    parse_error_count: summary.parse_error,
    high_fee_warning_count: summary.high_fee_warning,
    total_freight_amount: summary.total_freight_amount,
    rows: reconciled,
  }
  return {
    ok: true,
    warnings: parsed.warnings,
    summary: {
      ...summary,
      settled_count: summary.settled,
      already_settled_count: summary.already_settled,
      high_fee_warning_count: summary.high_fee_warning,
    },
    settlement_date: parsed.settlementDate,
    batch_id: batch?.id,
    import_batch,
    rows: reconciled,
  }
}

export async function listFreightSettlementBatchesFromPg(partnerId: string) {
  if (!isPgConfigured()) return { batches: [] as Array<Record<string, unknown>> }
  const batches = await pgQuery(
    `select id::text, settlement_date, source_filename, total_rows, settled_count, record_not_found_count,
            already_settled_count, parse_error_count, high_fee_warning_count, total_freight_amount, created_at
     from public.messaging_partner_ems_freight_settlement_batches
     where partner_id = $1::uuid
     order by created_at desc
     limit 30`,
    [partnerId],
  )
  const out = []
  for (const b of batches) {
    const rows = await pgQuery(
      `select excel_row_number as row_number, ems_tracking_code, freight_amount, high_fee_warning,
              reconcile_status, reconcile_message, ems_shipping_record_id::text as ems_shipping_record_id
       from public.messaging_partner_ems_freight_settlement_rows
       where batch_id = $1::uuid
       order by excel_row_number nulls last`,
      [b.id],
    )
    out.push({ ...b, rows })
  }
  return { batches: out }
}

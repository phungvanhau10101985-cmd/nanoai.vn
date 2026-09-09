import {
  applyPartnerEmsCodSettlementFromPg,
  clearPartnerEmsCodSettlementOnRecordFromPg,
  findPartnerEmsRecordByTokenFromPg,
} from '@/lib/db/messaging-partner-ems-shipping-pg'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  cellStr,
  EMS_SETTLEMENT_TRACKING_RE,
  parseCodAmount,
  parseExcelDateCell,
  readSpreadsheetRows,
} from '@/lib/messaging/shipping/ems-excel'

const COL_TRACKING = 2
const COL_PAID = 3
const COL_REFERENCE = 1
const PAYMENT_DATE_ROW = 0
const PAYMENT_DATE_COL = 4
const DATA_START_ROW = 2

export type CodSettlementParsedRow = {
  row_number: number
  ems_reference_code: string | null
  ems_tracking_code: string | null
  paid_amount: number | null
  reconcile_status: string
  reconcile_message: string | null
  ems_shipping_record_id?: string | null
  db_cod_amount?: number | null
  amount_difference?: number | null
}

export function parseCodSettlementRows(fileBytes: Buffer): {
  paymentDate: string | null
  rows: CodSettlementParsedRow[]
  warnings: string[]
} {
  const warnings: string[] = []
  const raw = readSpreadsheetRows(fileBytes)
  if (!raw.length) return { paymentDate: null, rows: [], warnings: ['File Excel trống.'] }
  const e1 = raw[PAYMENT_DATE_ROW]?.[PAYMENT_DATE_COL]
  const paymentDate = parseExcelDateCell(e1)
  if (!paymentDate) {
    warnings.push(
      'Không đọc được ngày trả tiền từ ô E1 (vd. «Ngày trả tiền: 02/06/2026») — vẫn import nhưng thiếu ngày.',
    )
  }
  const parsed: CodSettlementParsedRow[] = []
  for (let i = DATA_START_ROW; i < raw.length; i++) {
    const row = raw[i] || []
    const tracking = cellStr(row[COL_TRACKING]).toUpperCase()
    const reference = cellStr(row[COL_REFERENCE]).toUpperCase()
    const paidAmount = parseCodAmount(row[COL_PAID])
    if (!tracking && !reference && paidAmount == null) continue
    if (tracking && !EMS_SETTLEMENT_TRACKING_RE.test(tracking) && !tracking.endsWith('VN')) {
      continue
    }
    if (!tracking) {
      parsed.push({
        row_number: i + 1,
        ems_reference_code: reference || null,
        ems_tracking_code: null,
        paid_amount: paidAmount,
        reconcile_status: 'parse_error',
        reconcile_message: 'Thiếu mã vận chuyển EMS (cột C).',
      })
      continue
    }
    parsed.push({
      row_number: i + 1,
      ems_reference_code: reference || null,
      ems_tracking_code: tracking,
      paid_amount: paidAmount,
      reconcile_status: 'pending',
      reconcile_message: null,
    })
  }
  return { paymentDate, rows: parsed, warnings }
}

async function reconcileRow(partnerId: string, row: CodSettlementParsedRow): Promise<CodSettlementParsedRow> {
  if (row.reconcile_status === 'parse_error') return row
  const token = row.ems_tracking_code || row.ems_reference_code || ''
  const record = await findPartnerEmsRecordByTokenFromPg(partnerId, token)
  if (!record) {
    return {
      ...row,
      reconcile_status: 'record_not_found',
      reconcile_message: `Không thấy vận đơn «${token}» trong bảng EMS của shop.`,
    }
  }
  const dbCod = record.cod_amount
  const paid = row.paid_amount
  const diff = paid != null && dbCod != null ? paid - dbCod : null
  const mismatch = diff != null && diff !== 0
  return {
    ...row,
    ems_shipping_record_id: record.id,
    db_cod_amount: dbCod,
    amount_difference: diff,
    reconcile_status: mismatch ? 'amount_mismatch' : 'matched',
    reconcile_message: mismatch
      ? `Lệch ${diff?.toLocaleString('vi-VN')} đ so với COD trên vận đơn.`
      : 'Khớp COD — EMS đã trả shop.',
  }
}

export async function importCodSettlementExcel(input: {
  partnerId: string
  fileBytes: Buffer
  filename?: string | null
  userId?: string | null
}) {
  if (!isPgConfigured()) throw new Error('Database not configured')
  const parsed = parseCodSettlementRows(input.fileBytes)
  const warnings = [...parsed.warnings]
  const reconciled = []
  for (const row of parsed.rows) reconciled.push(await reconcileRow(input.partnerId, row))
  const summary = {
    total_rows: reconciled.length,
    matched: reconciled.filter((r) => r.reconcile_status === 'matched').length,
    amount_mismatch: reconciled.filter((r) => r.reconcile_status === 'amount_mismatch').length,
    record_not_found: reconciled.filter((r) => r.reconcile_status === 'record_not_found').length,
    parse_error: reconciled.filter((r) => r.reconcile_status === 'parse_error').length,
    total_paid_amount: reconciled.reduce((s, r) => s + Math.max(0, r.paid_amount || 0), 0),
    total_db_cod_amount: reconciled.reduce((s, r) => s + Math.max(0, r.db_cod_amount || 0), 0),
    total_amount_difference: reconciled.reduce((s, r) => s + (r.amount_difference || 0), 0),
  }
  const paymentDate = parsed.paymentDate || new Date().toISOString().slice(0, 10)
  const filename = (input.filename || '').trim()
  let batchId: string | null = null
  if (filename) {
    const existing = await pgQueryOne<{ id: string }>(
      `select id::text from public.messaging_partner_ems_cod_settlement_batches
       where partner_id = $1::uuid and lower(coalesce(source_filename, '')) = lower($2)
       order by created_at asc limit 1`,
      [input.partnerId, filename],
    )
    if (existing?.id) {
      batchId = existing.id
      const oldRows = await pgQuery<{ ems_shipping_record_id: string | null }>(
        `select ems_shipping_record_id::text as ems_shipping_record_id
         from public.messaging_partner_ems_cod_settlement_rows where batch_id = $1::uuid`,
        [batchId],
      )
      for (const r of oldRows) {
        if (r.ems_shipping_record_id) {
          await clearPartnerEmsCodSettlementOnRecordFromPg(input.partnerId, r.ems_shipping_record_id)
        }
      }
      await pgQuery(`delete from public.messaging_partner_ems_cod_settlement_rows where batch_id = $1::uuid`, [batchId])
      await pgQuery(
        `update public.messaging_partner_ems_cod_settlement_batches
         set payment_date = $2::date, source_filename = $3, imported_by_user_id = $4::uuid,
             total_rows = $5, matched_count = $6, amount_mismatch_count = $7, record_not_found_count = $8,
             parse_error_count = $9, total_paid_amount = $10, total_db_cod_amount = $11, total_amount_difference = $12
         where id = $1::uuid`,
        [
          batchId,
          paymentDate,
          filename,
          input.userId || null,
          summary.total_rows,
          summary.matched,
          summary.amount_mismatch,
          summary.record_not_found,
          summary.parse_error,
          summary.total_paid_amount,
          summary.total_db_cod_amount,
          summary.total_amount_difference,
        ],
      )
      warnings.push(`File «${filename}» đã import trước đó — cập nhật đợt, không tạo đợt mới.`)
    }
  }
  if (!batchId) {
    const created = await pgQueryOne<{ id: string }>(
      `insert into public.messaging_partner_ems_cod_settlement_batches (
         partner_id, payment_date, source_filename, imported_by_user_id, total_rows, matched_count,
         amount_mismatch_count, record_not_found_count, parse_error_count,
         total_paid_amount, total_db_cod_amount, total_amount_difference
       ) values ($1::uuid, $2::date, $3, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id::text`,
      [
        input.partnerId,
        paymentDate,
        filename || null,
        input.userId || null,
        summary.total_rows,
        summary.matched,
        summary.amount_mismatch,
        summary.record_not_found,
        summary.parse_error,
        summary.total_paid_amount,
        summary.total_db_cod_amount,
        summary.total_amount_difference,
      ],
    )
    batchId = String(created?.id || '')
  }
  for (const row of reconciled) {
    await pgQuery(
      `insert into public.messaging_partner_ems_cod_settlement_rows (
         batch_id, excel_row_number, ems_reference_code, ems_tracking_code, paid_amount,
         ems_shipping_record_id, db_cod_amount, amount_difference, reconcile_status, reconcile_message
       ) values ($1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10)`,
      [
        batchId,
        row.row_number,
        row.ems_reference_code,
        row.ems_tracking_code,
        row.paid_amount,
        row.ems_shipping_record_id || null,
        row.db_cod_amount ?? null,
        row.amount_difference ?? null,
        row.reconcile_status,
        row.reconcile_message,
      ],
    )
    if (row.ems_shipping_record_id) {
      await applyPartnerEmsCodSettlementFromPg({
        partnerId: input.partnerId,
        recordId: row.ems_shipping_record_id,
        paidAmount: row.paid_amount,
        paymentDate,
        status: row.reconcile_status,
        message: row.reconcile_message,
      })
    }
  }
  const import_batch = {
    id: batchId,
    payment_date: paymentDate,
    source_filename: filename || null,
    total_rows: summary.total_rows,
    matched_count: summary.matched,
    amount_mismatch_count: summary.amount_mismatch,
    record_not_found_count: summary.record_not_found,
    parse_error_count: summary.parse_error,
    total_paid_amount: summary.total_paid_amount,
    total_db_cod_amount: summary.total_db_cod_amount,
    total_amount_difference: summary.total_amount_difference,
    rows: reconciled,
  }
  return {
    ok: true,
    warnings,
    summary: {
      ...summary,
      matched_count: summary.matched,
      amount_mismatch_count: summary.amount_mismatch,
    },
    payment_date: paymentDate,
    batch_id: batchId,
    import_batch,
    rows: reconciled,
  }
}

export async function listCodSettlementBatchesFromPg(partnerId: string) {
  if (!isPgConfigured()) return { batches: [] as Array<Record<string, unknown>> }
  const batches = await pgQuery(
    `select id::text, payment_date, source_filename, total_rows, matched_count, amount_mismatch_count,
            record_not_found_count, parse_error_count, total_paid_amount, total_db_cod_amount,
            total_amount_difference, created_at
     from public.messaging_partner_ems_cod_settlement_batches
     where partner_id = $1::uuid
     order by created_at desc
     limit 30`,
    [partnerId],
  )
  const out = []
  for (const b of batches) {
    const rows = await pgQuery(
      `select excel_row_number as row_number, ems_reference_code, ems_tracking_code, paid_amount,
              db_cod_amount, amount_difference, reconcile_status, reconcile_message,
              ems_shipping_record_id::text as ems_shipping_record_id
       from public.messaging_partner_ems_cod_settlement_rows
       where batch_id = $1::uuid
       order by excel_row_number nulls last`,
      [b.id],
    )
    out.push({ ...b, rows })
  }
  return { batches: out }
}

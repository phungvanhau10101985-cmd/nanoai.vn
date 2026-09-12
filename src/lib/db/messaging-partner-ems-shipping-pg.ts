import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import type { PartnerEmsRecord, EmsSyncStatus, EmsImportSummary } from '@/lib/messaging/shipping/ems-types'
import { returnToShopLabel } from '@/lib/messaging/shipping/shipping-ops'

function num(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function mapEmsRecord(r: Record<string, unknown>): PartnerEmsRecord {
  const shopStatus = r.shop_order_status != null ? String(r.shop_order_status) : null
  const orderStatus = r.order_status != null ? String(r.order_status) : null
  const emsStatus = r.ems_status != null ? String(r.ems_status) : null
  const shopReturn = r.shop_return_received_at ? String(r.shop_return_received_at) : null
  return {
    id: String(r.id ?? ''),
    partner_id: String(r.partner_id ?? ''),
    reference_code: String(r.reference_code ?? ''),
    product_code: r.product_code != null ? String(r.product_code) : null,
    recipient_label: r.recipient_label != null ? String(r.recipient_label) : null,
    order_code: r.order_code != null ? String(r.order_code) : null,
    order_id: r.order_id ? String(r.order_id) : null,
    excel_row_number: r.excel_row_number != null ? num(r.excel_row_number) : null,
    order_status: orderStatus,
    shop_return_received_at: shopReturn,
    current_step_key: r.current_step_key != null ? String(r.current_step_key) : null,
    tracking_number_saved: r.tracking_number_saved != null ? String(r.tracking_number_saved) : null,
    ems_tracking_code: r.ems_tracking_code != null ? String(r.ems_tracking_code) : null,
    ems_reference_code: r.ems_reference_code != null ? String(r.ems_reference_code) : null,
    ems_status: emsStatus,
    ems_phase: r.ems_phase != null ? String(r.ems_phase) : null,
    sync_status: (String(r.sync_status || 'pending') as EmsSyncStatus) || 'pending',
    sync_message: r.sync_message != null ? String(r.sync_message) : null,
    ems_error: r.ems_error != null ? String(r.ems_error) : null,
    cod_amount: numOrNull(r.cod_amount),
    cod_paid_amount: numOrNull(r.cod_paid_amount),
    cod_paid_date: r.cod_paid_date != null ? String(r.cod_paid_date).slice(0, 10) : null,
    cod_settlement_status: r.cod_settlement_status != null ? String(r.cod_settlement_status) : null,
    cod_settlement_message: r.cod_settlement_message != null ? String(r.cod_settlement_message) : null,
    freight_amount: numOrNull(r.freight_amount),
    freight_settled_at: r.freight_settled_at ? String(r.freight_settled_at) : null,
    freight_settlement_status: r.freight_settlement_status != null ? String(r.freight_settlement_status) : null,
    freight_settlement_message: r.freight_settlement_message != null ? String(r.freight_settlement_message) : null,
    freight_high_fee_warning: r.freight_high_fee_warning != null ? String(r.freight_high_fee_warning) : null,
    import_source_filename: r.import_source_filename != null ? String(r.import_source_filename) : null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
    shop_order_status: shopStatus,
    shop_customer_phone: r.shop_customer_phone != null ? String(r.shop_customer_phone) : null,
    shop_customer_name: r.shop_customer_name != null ? String(r.shop_customer_name) : null,
    return_to_shop_label: returnToShopLabel({
      orderStatus: shopStatus || orderStatus,
      emsStatus,
      shopReturnReceivedAt: shopReturn,
    }),
  }
}

const RECORD_SELECT = `
  r.id::text, r.partner_id::text, r.reference_code, r.product_code, r.recipient_label,
  r.order_code, r.order_id::text, r.excel_row_number, r.order_status, r.shop_return_received_at,
  r.current_step_key, r.tracking_number_saved, r.ems_tracking_code, r.ems_reference_code,
  r.ems_status, r.ems_phase, r.sync_status, r.sync_message, r.ems_error,
  r.cod_amount, r.cod_paid_amount, r.cod_paid_date, r.cod_settlement_status, r.cod_settlement_message,
  r.freight_amount, r.freight_settled_at, r.freight_settlement_status, r.freight_settlement_message,
  r.freight_high_fee_warning, r.import_source_filename, r.created_at, r.updated_at,
  o.shipping_status as shop_order_status, o.customer_phone as shop_customer_phone,
  o.customer_name as shop_customer_name, coalesce(o.tracking_number, '') as shop_tracking_number
`

const FROM_JOIN = `
  from public.messaging_partner_ems_shipping_records r
  left join public.messaging_partner_orders o on o.id = r.order_id
`

export async function fetchPartnerEmsRecordByIdFromPg(
  partnerId: string,
  recordId: string,
): Promise<PartnerEmsRecord | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne(
    `select ${RECORD_SELECT} ${FROM_JOIN} where r.partner_id = $1::uuid and r.id = $2::uuid`,
    [partnerId, recordId],
  )
  return row ? mapEmsRecord(row) : null
}

export async function fetchPartnerEmsRecordByReferenceFromPg(
  partnerId: string,
  referenceCode: string,
): Promise<PartnerEmsRecord | null> {
  if (!isPgConfigured()) return null
  const ref = referenceCode.trim().toUpperCase()
  if (!ref) return null
  const row = await pgQueryOne(
    `select ${RECORD_SELECT} ${FROM_JOIN}
     where r.partner_id = $1::uuid and upper(r.reference_code) = $2`,
    [partnerId, ref],
  )
  return row ? mapEmsRecord(row) : null
}

export async function findPartnerEmsRecordByTokenFromPg(
  partnerId: string,
  token: string,
): Promise<PartnerEmsRecord | null> {
  if (!isPgConfigured()) return null
  const t = token.trim().toUpperCase()
  if (t.length < 3) return null
  const row = await pgQueryOne(
    `select ${RECORD_SELECT} ${FROM_JOIN}
     where r.partner_id = $1::uuid
       and (
         upper(coalesce(r.ems_tracking_code, '')) = $2
         or upper(r.reference_code) = $2
         or upper(coalesce(r.ems_reference_code, '')) = $2
         or upper(coalesce(r.order_code, '')) = $2
       )
     order by r.updated_at desc
     limit 1`,
    [partnerId, t],
  )
  return row ? mapEmsRecord(row) : null
}

function searchWhere(search: string, startIndex: number): { sql: string; params: unknown[] } {
  const q = search.trim()
  if (!q) return { sql: '', params: [] }
  const digits = q.replace(/\D/g, '')
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`
  const likeSlot = `$${startIndex}`
  const params: unknown[] = [like]
  let phoneSql = ''
  if (digits.length >= 8) {
    params.push(`%${digits.slice(-9)}%`)
    phoneSql = ` or regexp_replace(coalesce(o.customer_phone, ''), '\\D', '', 'g') like $${startIndex + 1}`
  }
  return {
    sql: ` and (
      r.reference_code ilike ${likeSlot} escape '\\'
      or coalesce(r.ems_tracking_code, '') ilike ${likeSlot} escape '\\'
      or coalesce(r.ems_reference_code, '') ilike ${likeSlot} escape '\\'
      or coalesce(r.order_code, '') ilike ${likeSlot} escape '\\'
      or coalesce(r.recipient_label, '') ilike ${likeSlot} escape '\\'
      or coalesce(o.payment_reference, '') ilike ${likeSlot} escape '\\'
      or coalesce(o.tracking_number, '') ilike ${likeSlot} escape '\\'
      ${phoneSql}
    )`,
    params,
  }
}

function appendEmsSearchAndSync(
  where: string,
  params: unknown[],
  search?: string,
  syncStatus?: string,
): string {
  const searchPart = searchWhere(search || '', params.length + 1)
  if (searchPart.sql) {
    params.push(...searchPart.params)
    where += searchPart.sql
  }
  if (syncStatus && syncStatus !== 'all') {
    if (syncStatus === 'unlinked') {
      where += ` and r.sync_status in ('unlinked', 'order_not_found')`
    } else {
      params.push(syncStatus)
      where += ` and r.sync_status = $${params.length}`
    }
  }
  return where
}

export async function listPartnerEmsRecordsFromPg(input: {
  partnerId: string
  search?: string
  syncStatus?: string
  skip?: number
  limit?: number
}): Promise<{ rows: PartnerEmsRecord[]; total: number }> {
  if (!isPgConfigured()) return { rows: [], total: 0 }
  const skip = Math.max(0, Math.floor(input.skip || 0))
  const limit = Math.min(100, Math.max(1, Math.floor(input.limit || 50)))
  const params: unknown[] = [input.partnerId]
  const where = appendEmsSearchAndSync('where r.partner_id = $1::uuid', params, input.search, input.syncStatus)
  const countRow = await pgQueryOne<{ c: number }>(
    `select count(*)::int as c ${FROM_JOIN} ${where}`,
    params,
  )
  params.push(limit, skip)
  const rows = await pgQuery(
    `select ${RECORD_SELECT} ${FROM_JOIN} ${where}
     order by r.updated_at desc, r.created_at desc
     limit $${params.length - 1} offset $${params.length}`,
    params,
  )
  return { rows: rows.map(mapEmsRecord), total: Number(countRow?.c || 0) }
}

export async function listPartnerEmsRecordIdsFromPg(input: {
  partnerId: string
  search?: string
  syncStatus?: string
}): Promise<string[]> {
  if (!isPgConfigured()) return []
  const params: unknown[] = [input.partnerId]
  const where = appendEmsSearchAndSync('where r.partner_id = $1::uuid', params, input.search, input.syncStatus)
  const rows = await pgQuery<{ id: string }>(
    `select r.id::text as id ${FROM_JOIN} ${where} order by r.updated_at desc, r.created_at desc`,
    params,
  )
  return rows.map((r) => r.id)
}

export async function summarizePartnerEmsRecordsFromPg(
  partnerId: string,
  search?: string,
): Promise<EmsImportSummary> {
  if (!isPgConfigured()) {
    return {
      total_rows: 0,
      matched: 0,
      in_progress: 0,
      mismatch: 0,
      unlinked: 0,
      order_not_found: 0,
      ems_not_found: 0,
      parse_error: 0,
      total_cod_amount: 0,
      breakdown: [],
    }
  }
  const params: unknown[] = [partnerId]
  let where = 'where r.partner_id = $1::uuid'
  const searchPart = searchWhere(search || '', params.length + 1)
  if (searchPart.sql) {
    params.push(...searchPart.params)
    where += searchPart.sql
  }
  const grouped = await pgQuery<{ sync_status: string; c: number; cod: number }>(
    `select coalesce(r.sync_status, 'pending') as sync_status,
            count(*)::int as c,
            coalesce(sum(r.cod_amount), 0)::float as cod
     ${FROM_JOIN} ${where}
     group by coalesce(r.sync_status, 'pending')`,
    params,
  )
  const counts: Record<string, { count: number; cod_total: number }> = {}
  let totalRows = 0
  let totalCod = 0
  for (const row of grouped) {
    const key = String(row.sync_status || 'pending')
    const count = Number(row.c || 0)
    const cod = Math.round(Number(row.cod || 0))
    counts[key] = { count, cod_total: cod }
    totalRows += count
    totalCod += cod
  }
  const n = (k: string) => counts[k]?.count || 0
  return {
    total_rows: totalRows,
    matched: n('matched'),
    in_progress: n('in_progress'),
    mismatch: n('mismatch'),
    unlinked: n('unlinked') + n('order_not_found'),
    order_not_found: n('order_not_found'),
    ems_not_found: n('ems_not_found'),
    parse_error: n('parse_error'),
    total_cod_amount: totalCod,
    breakdown: Object.entries(counts)
      .filter(([, v]) => v.count > 0)
      .map(([key, v]) => ({ key, count: v.count, cod_total: v.cod_total })),
  }
}

export async function listAllPartnerEmsRecordsFromPg(partnerId: string): Promise<PartnerEmsRecord[]> {
  if (!isPgConfigured()) return []
  const rows = await pgQuery(
    `select ${RECORD_SELECT} ${FROM_JOIN}
     where r.partner_id = $1::uuid
     order by r.created_at desc`,
    [partnerId],
  )
  return rows.map(mapEmsRecord)
}

export async function listPartnerEmsRecordsByIdsFromPg(
  partnerId: string,
  ids: string[],
): Promise<PartnerEmsRecord[]> {
  if (!isPgConfigured() || !ids.length) return []
  const rows = await pgQuery(
    `select ${RECORD_SELECT} ${FROM_JOIN}
     where r.partner_id = $1::uuid and r.id = any($2::uuid[])`,
    [partnerId, ids],
  )
  return rows.map(mapEmsRecord)
}

export type UpsertEmsRecordInput = {
  partnerId: string
  referenceCode: string
  productCode?: string | null
  recipientLabel?: string | null
  orderCode?: string | null
  orderId?: string | null
  excelRowNumber?: number | null
  orderStatus?: string | null
  currentStepKey?: string | null
  trackingNumberSaved?: string | null
  emsTrackingCode?: string | null
  emsReferenceCode?: string | null
  emsStatus?: string | null
  emsPhase?: string | null
  syncStatus?: string | null
  syncMessage?: string | null
  emsError?: string | null
  codAmount?: number | null
  sourceFilename?: string | null
  importedByUserId?: string | null
  hasEmsPayload?: boolean
}

export async function upsertPartnerEmsRecordFromPg(
  input: UpsertEmsRecordInput,
): Promise<{ record: PartnerEmsRecord; created: boolean } | null> {
  if (!isPgConfigured()) return null
  const ref = input.referenceCode.trim().toUpperCase()
  if (!ref) return null
  const existing = await fetchPartnerEmsRecordByReferenceFromPg(input.partnerId, ref)
  const shopConfirmed = Boolean(existing?.shop_return_received_at) || (existing?.order_status || '').toLowerCase() === 'returned'
  const keepCodPaid = (existing?.cod_settlement_status || '').toLowerCase() === 'matched'
  const pool = getPgPool()
  if (!existing) {
    const row = await pgQueryOne(
      `insert into public.messaging_partner_ems_shipping_records (
         partner_id, reference_code, product_code, recipient_label, order_code, order_id,
         excel_row_number, order_status, current_step_key, tracking_number_saved,
         ems_tracking_code, ems_reference_code, ems_status, ems_phase, sync_status, sync_message, ems_error,
         cod_amount, import_source_filename, imported_by_user_id, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5, $6::uuid, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::uuid, now()
       )
       returning id::text`,
      [
        input.partnerId,
        ref,
        input.productCode || null,
        input.recipientLabel || '',
        input.orderCode || null,
        input.orderId || null,
        input.excelRowNumber ?? null,
        input.orderStatus || null,
        input.currentStepKey || null,
        input.trackingNumberSaved || null,
        input.emsTrackingCode || null,
        input.emsReferenceCode || ref,
        input.emsStatus || null,
        input.emsPhase || null,
        input.syncStatus || 'pending',
        input.syncMessage || null,
        input.emsError || null,
        input.codAmount ?? null,
        input.sourceFilename || null,
        input.importedByUserId || null,
      ],
    )
    if (!row?.id) return null
    const record = await fetchPartnerEmsRecordByIdFromPg(input.partnerId, String(row.id))
    return record ? { record, created: true } : null
  }

  const productCode = input.productCode || existing.product_code
  const orderStatus = shopConfirmed ? 'returned' : input.orderStatus ?? existing.order_status
  const emsTracking = input.hasEmsPayload && input.emsTrackingCode ? input.emsTrackingCode : existing.ems_tracking_code
  const emsStatus = input.hasEmsPayload ? input.emsStatus ?? existing.ems_status : existing.ems_status
  const emsPhase = input.hasEmsPayload ? input.emsPhase ?? existing.ems_phase : existing.ems_phase
  const emsError = input.hasEmsPayload ? input.emsError ?? null : existing.ems_error
  const syncStatus = input.syncStatus || existing.sync_status
  const syncMessage = shopConfirmed ? existing.sync_message : input.syncMessage ?? existing.sync_message
  await pool.query(
    `update public.messaging_partner_ems_shipping_records
     set product_code = $3,
         recipient_label = $4,
         order_code = $5,
         order_id = $6::uuid,
         excel_row_number = $7,
         order_status = $8,
         current_step_key = $9,
         tracking_number_saved = $10,
         ems_tracking_code = $11,
         ems_reference_code = coalesce(nullif($12, ''), ems_reference_code),
         ems_status = $13,
         ems_phase = $14,
         sync_status = $15,
         sync_message = $16,
         ems_error = $17,
         cod_amount = $18,
         cod_paid_amount = case when $19 then cod_paid_amount else null end,
         cod_paid_date = case when $19 then cod_paid_date else null end,
         import_source_filename = coalesce($20, import_source_filename),
         imported_by_user_id = coalesce($21::uuid, imported_by_user_id),
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      input.partnerId,
      existing.id,
      productCode,
      input.recipientLabel || existing.recipient_label || '',
      input.orderCode ?? existing.order_code,
      input.orderId ?? existing.order_id,
      input.excelRowNumber ?? existing.excel_row_number,
      orderStatus,
      input.currentStepKey ?? existing.current_step_key,
      input.trackingNumberSaved ?? existing.tracking_number_saved,
      emsTracking,
      input.emsReferenceCode || ref,
      emsStatus,
      emsPhase,
      syncStatus,
      syncMessage,
      emsError,
      input.codAmount ?? existing.cod_amount,
      keepCodPaid,
      input.sourceFilename || null,
      input.importedByUserId || null,
    ],
  )
  const record = await fetchPartnerEmsRecordByIdFromPg(input.partnerId, existing.id)
  return record ? { record, created: false } : null
}

export async function updatePartnerEmsLiveTrackingFromPg(input: {
  partnerId: string
  recordId: string
  emsTrackingCode?: string | null
  emsReferenceCode?: string | null
  emsStatus?: string | null
  emsPhase?: string | null
  emsError?: string | null
  syncStatus?: string | null
  syncMessage?: string | null
}): Promise<PartnerEmsRecord | null> {
  if (!isPgConfigured()) return null
  await pgQuery(
    `update public.messaging_partner_ems_shipping_records
     set ems_tracking_code = coalesce(nullif($3, ''), ems_tracking_code),
         ems_reference_code = coalesce(nullif($4, ''), ems_reference_code),
         ems_status = $5,
         ems_phase = $6,
         ems_error = $7,
         sync_status = coalesce($8, sync_status),
         sync_message = coalesce($9, sync_message),
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      input.partnerId,
      input.recordId,
      input.emsTrackingCode || '',
      input.emsReferenceCode || '',
      input.emsStatus ?? null,
      input.emsPhase ?? null,
      input.emsError ?? null,
      input.syncStatus ?? null,
      input.syncMessage ?? null,
    ],
  )
  return fetchPartnerEmsRecordByIdFromPg(input.partnerId, input.recordId)
}

export async function applyPartnerEmsCodSettlementFromPg(input: {
  partnerId: string
  recordId: string
  paidAmount: number | null
  paymentDate: string
  status: string
  message?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  const matched = input.status === 'matched'
  await pgQuery(
    `update public.messaging_partner_ems_shipping_records
     set cod_paid_amount = $3,
         cod_paid_date = $4::date,
         cod_settlement_status = $5,
         cod_settlement_message = $6,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      input.partnerId,
      input.recordId,
      matched ? input.paidAmount : input.paidAmount,
      input.paymentDate,
      input.status,
      input.message || null,
    ],
  )
}

export async function clearPartnerEmsCodSettlementOnRecordFromPg(partnerId: string, recordId: string): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_ems_shipping_records
     set cod_paid_amount = null, cod_paid_date = null,
         cod_settlement_status = null, cod_settlement_message = null, updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [partnerId, recordId],
  )
}

export async function applyPartnerEmsFreightSettlementFromPg(input: {
  partnerId: string
  recordId: string
  freightAmount: number | null
  status: string
  message?: string | null
  highFeeWarning?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_ems_shipping_records
     set freight_amount = $3,
         freight_settled_at = case when $4 in ('settled', 'already_settled') then now() else freight_settled_at end,
         freight_settlement_status = $4,
         freight_settlement_message = $5,
         freight_high_fee_warning = $6,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [
      input.partnerId,
      input.recordId,
      input.freightAmount,
      input.status,
      input.message || null,
      input.highFeeWarning || null,
    ],
  )
}

export async function confirmPartnerShopReturnFromPg(input: {
  partnerId: string
  recordId: string
  orderId?: string | null
}): Promise<PartnerEmsRecord | null> {
  if (!isPgConfigured()) return null
  await pgQuery(
    `update public.messaging_partner_ems_shipping_records
     set shop_return_received_at = coalesce(shop_return_received_at, now()),
         order_status = 'returned',
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [input.partnerId, input.recordId],
  )
  if (input.orderId) {
    await pgQuery(
      `update public.messaging_partner_orders
       set shipping_status = 'returned',
           updated_at = now()
       where partner_id = $1::uuid and id = $2::uuid
         and shipping_status <> 'cancelled'`,
      [input.partnerId, input.orderId],
    )
  }
  return fetchPartnerEmsRecordByIdFromPg(input.partnerId, input.recordId)
}

export async function syncPartnerOrderShippingFromEmsFromPg(input: {
  partnerId: string
  orderId: string
  trackingNumber: string
  shippingStatus: 'shipping' | 'delivered' | 'returned'
}): Promise<void> {
  if (!isPgConfigured()) return
  await pgQuery(
    `update public.messaging_partner_orders
     set tracking_number = case when trim($3) <> '' then $3 else tracking_number end,
         shipping_provider = case when trim($3) <> '' then 'EMS' else shipping_provider end,
         shipping_status = case
           when shipping_status in ('cancelled', 'returned') and $4 <> 'returned' then shipping_status
           when shipping_status = 'delivered' and $4 = 'shipping' then shipping_status
           else $4
         end,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid`,
    [input.partnerId, input.orderId, input.trackingNumber, input.shippingStatus],
  )
}

export async function persistPartnerEmsImportBatchFromPg(input: {
  partnerId: string
  sourceFilename?: string | null
  importedByUserId?: string | null
  fileRowsProcessed: number
  created: number
  updated: number
  skippedNoReference: number
  ordersSynced: number
  totalCodAmount: number
  reportRows: Array<{
    recordId: string | null
    excelRowNumber: number | null
    referenceCode: string
    recipientLabel: string | null
    orderCode: string | null
    orderId: string | null
    codAmount: number | null
    importAction: string
    syncStatus: string | null
    syncMessage: string | null
  }>
}): Promise<{ id: string }> {
  const batch = await pgQueryOne<{ id: string }>(
    `insert into public.messaging_partner_ems_import_batches (
       partner_id, source_filename, imported_by_user_id, file_rows_processed, order_count,
       created_count, updated_count, skipped_no_reference_count, orders_synced_count, total_cod_amount
     ) values ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8, $9, $10)
     returning id::text`,
    [
      input.partnerId,
      input.sourceFilename || null,
      input.importedByUserId || null,
      input.fileRowsProcessed,
      input.created + input.updated,
      input.created,
      input.updated,
      input.skippedNoReference,
      input.ordersSynced,
      input.totalCodAmount,
    ],
  )
  const id = String(batch?.id || '')
  for (const row of input.reportRows) {
    await pgQuery(
      `insert into public.messaging_partner_ems_import_batch_rows (
         batch_id, ems_shipping_record_id, excel_row_number, reference_code, recipient_label,
         order_code, order_id, cod_amount, import_action, sync_status, sync_message
       ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8, $9, $10, $11)`,
      [
        id,
        row.recordId || null,
        row.excelRowNumber,
        row.referenceCode,
        row.recipientLabel,
        row.orderCode,
        row.orderId,
        row.codAmount,
        row.importAction,
        row.syncStatus,
        row.syncMessage,
      ],
    )
  }
  return { id }
}

export async function listPartnerEmsImportBatchesFromPg(partnerId: string, limit = 30) {
  if (!isPgConfigured()) return { batches: [] as Array<Record<string, unknown>> }
  const batches = await pgQuery(
    `select id::text, source_filename, file_rows_processed, order_count, created_count, updated_count,
            skipped_no_reference_count, orders_synced_count, total_cod_amount, created_at
     from public.messaging_partner_ems_import_batches
     where partner_id = $1::uuid
     order by created_at desc
     limit $2`,
    [partnerId, Math.min(50, Math.max(1, limit))],
  )
  const out = []
  for (const b of batches) {
    const rows = await pgQuery(
      `select excel_row_number as row_number, reference_code, recipient_label, order_code,
              order_id::text, cod_amount, import_action, sync_status, sync_message,
              ems_shipping_record_id::text as id
       from public.messaging_partner_ems_import_batch_rows
       where batch_id = $1::uuid
       order by excel_row_number nulls last`,
      [b.id],
    )
    out.push({ ...b, import_report: { rows } })
  }
  return { batches: out }
}

export async function deletePartnerEmsRecordsFromPg(partnerId: string, ids: string[]): Promise<number> {
  if (!isPgConfigured() || !ids.length) return 0
  const res = await pgQueryOne<{ c: number }>(
    `with d as (
       delete from public.messaging_partner_ems_shipping_records
       where partner_id = $1::uuid and id = any($2::uuid[])
       returning id
     ) select count(*)::int as c from d`,
    [partnerId, ids],
  )
  return Number(res?.c || 0)
}

export async function fetchPartnerOrderByPhoneLatestFromPg(partnerId: string, phone: string) {
  if (!isPgConfigured()) return null
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return null
  const tail = digits.slice(-9)
  return pgQueryOne(
    `select id::text, payment_reference, customer_name, customer_phone, shipping_status,
            tracking_number, shipping_provider, product_name, variant_size, variant_color, quantity
     from public.messaging_partner_orders
     where partner_id = $1::uuid
       and regexp_replace(coalesce(customer_phone, ''), '\\D', '', 'g') like $2
     order by created_at desc
     limit 1`,
    [partnerId, `%${tail}`],
  )
}

export async function fetchPartnerInventoryByWarehouseSkuFromPg(partnerId: string, sku: string) {
  if (!isPgConfigured()) return null
  const key = sku.trim()
  if (!key) return null
  const where = `where partner_id = $1::uuid
       and (
         lower(trim(coalesce(sku, ''))) = lower($2)
         or lower(trim(coalesce(remarketing_id, ''))) = lower($2)
         or lower(split_part(trim(coalesce(sku, '')), '/', 1)) = lower(split_part($2, '/', 1))
       )
     order by updated_at desc
     limit 1`
  try {
    return await pgQueryOne(
      `select id::text, sku, name, stock_qty, is_clearance, remarketing_id, image_url,
              price_amount, sale_price_amount, colors_json, sizes_json, gallery_urls
       from public.messaging_partner_inventory
       ${where}`,
      [partnerId, key],
    )
  } catch {
    return pgQueryOne(
      `select id::text, sku, name, stock_qty, is_clearance, remarketing_id, image_url, price_amount
       from public.messaging_partner_inventory
       ${where}`,
      [partnerId, key],
    )
  }
}

export async function intakePartnerReturnWarehouseFromPg(input: {
  partnerId: string
  inventoryId: string
  qty: number
  markClearance: boolean
}) {
  if (!isPgConfigured()) return null
  const qty = Math.max(1, Math.floor(input.qty))
  return pgQueryOne(
    `update public.messaging_partner_inventory
     set stock_qty = coalesce(stock_qty, 0) + $3,
         is_clearance = case when $4 then true else is_clearance end,
         updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid
     returning id::text, sku, name, stock_qty, is_clearance`,
    [input.partnerId, input.inventoryId, qty, input.markClearance],
  )
}

export type PartnerEmsTrackingJobRow = {
  id: string
  partner_id: string
  status: string
  source: string
  message: string
  record_ids: string[]
  processed: number
  ok_count: number
  total: number
  error: string | null
  created_at: string
  updated_at: string
}

function mapTrackingJob(r: Record<string, unknown>): PartnerEmsTrackingJobRow {
  const ids = Array.isArray(r.record_ids) ? r.record_ids.map((x) => String(x)) : []
  return {
    id: String(r.id ?? ''),
    partner_id: String(r.partner_id ?? ''),
    status: String(r.status || 'queued'),
    source: String(r.source || 'manual'),
    message: String(r.message || ''),
    record_ids: ids,
    processed: num(r.processed),
    ok_count: num(r.ok_count),
    total: num(r.total),
    error: r.error != null ? String(r.error) : null,
    created_at: String(r.created_at ?? ''),
    updated_at: String(r.updated_at ?? ''),
  }
}

export async function createPartnerEmsTrackingJobFromPg(input: {
  partnerId: string
  recordIds: string[]
  source?: string
}): Promise<PartnerEmsTrackingJobRow | null> {
  if (!isPgConfigured()) return null
  const ids = input.recordIds.filter(Boolean)
  const row = await pgQueryOne(
    `insert into public.messaging_partner_ems_tracking_jobs (
       partner_id, status, source, message, record_ids, processed, ok_count, total
     ) values ($1::uuid, 'queued', $2, $3, $4::uuid[], 0, 0, $5)
     returning id::text, partner_id::text, status, source, message, record_ids, processed, ok_count, total, error, created_at, updated_at`,
    [
      input.partnerId,
      input.source || 'manual',
      ids.length ? `Đang tra ${ids.length} vận đơn EMS…` : 'Không có vận đơn để tra.',
      ids,
      ids.length,
    ],
  )
  return row ? mapTrackingJob(row) : null
}

export async function fetchPartnerEmsTrackingJobFromPg(
  partnerId: string,
  jobId: string,
): Promise<PartnerEmsTrackingJobRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne(
    `select id::text, partner_id::text, status, source, message, record_ids, processed, ok_count, total, error, created_at, updated_at
     from public.messaging_partner_ems_tracking_jobs
     where partner_id = $1::uuid and id = $2::uuid`,
    [partnerId, jobId],
  )
  return row ? mapTrackingJob(row) : null
}

export async function fetchActivePartnerEmsTrackingJobFromPg(
  partnerId: string,
): Promise<PartnerEmsTrackingJobRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne(
    `select id::text, partner_id::text, status, source, message, record_ids, processed, ok_count, total, error, created_at, updated_at
     from public.messaging_partner_ems_tracking_jobs
     where partner_id = $1::uuid and status in ('queued', 'running')
     order by created_at desc
     limit 1`,
    [partnerId],
  )
  return row ? mapTrackingJob(row) : null
}

export async function updatePartnerEmsTrackingJobFromPg(input: {
  partnerId: string
  jobId: string
  status: string
  processed: number
  okCount: number
  message: string
  error?: string | null
}): Promise<PartnerEmsTrackingJobRow | null> {
  if (!isPgConfigured()) return null
  const row = await pgQueryOne(
    `update public.messaging_partner_ems_tracking_jobs
     set status = $3, processed = $4, ok_count = $5, message = $6, error = $7, updated_at = now()
     where partner_id = $1::uuid and id = $2::uuid
     returning id::text, partner_id::text, status, source, message, record_ids, processed, ok_count, total, error, created_at, updated_at`,
    [input.partnerId, input.jobId, input.status, input.processed, input.okCount, input.message, input.error ?? null],
  )
  return row ? mapTrackingJob(row) : null
}

export function serializeEmsTrackingJob(job: PartnerEmsTrackingJobRow) {
  const remaining = Math.max(0, job.total - job.processed)
  const done = job.status === 'done' || job.status === 'error' || remaining === 0
  return {
    job_id: job.id,
    status: done && job.status === 'queued' ? 'done' : job.status,
    source: job.source,
    total: job.total,
    processed: job.processed,
    ok: job.ok_count,
    errors: Math.max(0, job.processed - job.ok_count),
    message: job.message,
    created_at: job.created_at,
    updated_at: job.updated_at,
    is_stale: false,
  }
}

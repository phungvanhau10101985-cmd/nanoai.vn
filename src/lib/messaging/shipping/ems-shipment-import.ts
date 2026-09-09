import { fetchPartnerOrderByPaymentReferenceForPartnerFromPg } from '@/lib/db/messaging-partner-orders-pg'
import { insertPartnerOrderEventFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  persistPartnerEmsImportBatchFromPg,
  syncPartnerOrderShippingFromEmsFromPg,
  upsertPartnerEmsRecordFromPg,
  updatePartnerEmsLiveTrackingFromPg,
  fetchPartnerEmsTrackingJobFromPg,
  listPartnerEmsRecordsByIdsFromPg,
  updatePartnerEmsTrackingJobFromPg,
  serializeEmsTrackingJob,
  createPartnerEmsTrackingJobFromPg,
  type UpsertEmsRecordInput,
} from '@/lib/db/messaging-partner-ems-shipping-pg'
import {
  dedupeRowsByReference,
  isShopOrderCode,
  parseEmsExportRows,
  validateEmsShipmentImportFile,
  warehouseSkuFromColHCell,
} from '@/lib/messaging/shipping/ems-excel'
import { emsLookupCandidates, emsPhaseFromDescription, fetchEmsWithFallback } from '@/lib/messaging/shipping/ems-tracking'
import type { EmsImportSummary, PartnerEmsListRow } from '@/lib/messaging/shipping/ems-types'
import { isEmsDelivered } from '@/lib/messaging/shipping/shipping-ops'

function shopHandoffMessage(orderCode?: string | null): string {
  const code = (orderCode || '').trim().toUpperCase()
  return code
    ? `Shop đã gửi EMS giao hàng — đã ghép đơn ${code}.`
    : 'Shop đã gửi EMS giao hàng.'
}

function orderNotFoundMessage(orderCode: string | null | undefined, emsPhase: string, emsStatus: string): string {
  const code = (orderCode || '').trim().toUpperCase()
  const emsPart = emsStatus ? `EMS: ${emsStatus}.` : emsPhase !== 'unknown' ? `Pha EMS: ${emsPhase}.` : ''
  if (code && isShopOrderCode(code)) {
    return `Đã lưu vận đơn — chưa có đơn shop ${code} trên hệ thống. Dùng cho đối soát COD/cước. ${emsPart}`.trim()
  }
  if (code) {
    return `Đã lưu vận đơn — mã cột I «${code}» chưa khớp đơn shop. Dùng cho đối soát COD/cước. ${emsPart}`.trim()
  }
  return `Đã lưu vận đơn — thiếu mã đơn ở cột I (DHxxx/DCxxx). Dùng cho đối soát COD/cước. ${emsPart}`.trim()
}

async function trySyncShopOrder(input: {
  partnerId: string
  orderId: string
  orderCode?: string | null
  referenceCode: string
  emsTrackingCode?: string | null
  emsPhase?: string | null
  emsStatus?: string | null
  userId?: string | null
}): Promise<{ synced: boolean; message: string; shippingStatus: 'shipping' | 'delivered' }> {
  const delivered = isEmsDelivered(input.emsPhase, input.emsStatus)
  const shippingStatus = delivered ? 'delivered' : 'shipping'
  const tracking = (input.emsTrackingCode || input.referenceCode || '').trim()
  await syncPartnerOrderShippingFromEmsFromPg({
    partnerId: input.partnerId,
    orderId: input.orderId,
    trackingNumber: tracking,
    shippingStatus,
  })
  await insertPartnerOrderEventFromPg({
    orderId: input.orderId,
    eventType: 'shipping_status',
    title: delivered ? 'EMS giao thành công' : 'Shop đã gửi EMS giao hàng',
    detail: tracking ? `Mã vận: ${tracking}` : shopHandoffMessage(input.orderCode),
    source: 'shop',
    createdBy: input.userId || undefined,
  })
  return { synced: true, message: shopHandoffMessage(input.orderCode), shippingStatus }
}

export async function processEmsImportRow(input: {
  partnerId: string
  row: {
    row_number: number
    reference_code: string
    recipient_label: string
    product_code: string
    product_code_raw: string
    order_code: string | null
    cod_amount: number | null
  }
  userId?: string | null
  skipEmsTracking?: boolean
}): Promise<UpsertEmsRecordInput & { order_synced: boolean; row_number: number; product_code_raw?: string }> {
  const referenceCode = (input.row.reference_code || '').trim().toUpperCase()
  const orderCode = (input.row.order_code || '').trim().toUpperCase() || null
  const base: UpsertEmsRecordInput & { order_synced: boolean; row_number: number; product_code_raw?: string } = {
    partnerId: input.partnerId,
    referenceCode,
    productCode: warehouseSkuFromColHCell(input.row.product_code) || warehouseSkuFromColHCell(input.row.product_code_raw) || '',
    product_code_raw: input.row.product_code_raw,
    recipientLabel: input.row.recipient_label || '',
    orderCode,
    excelRowNumber: input.row.row_number,
    row_number: input.row.row_number,
    codAmount: input.row.cod_amount,
    importedByUserId: input.userId || null,
    order_synced: false,
    syncStatus: 'pending',
    syncMessage: '',
  }
  if (!referenceCode) {
    return { ...base, syncStatus: 'parse_error', syncMessage: 'Thiếu mã vận đơn (cột A / MA_DON_HANG).' }
  }
  const order = orderCode ? await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(input.partnerId, orderCode) : null
  if (input.skipEmsTracking) {
    base.emsReferenceCode = referenceCode
    if (order) {
      base.orderId = order.id
      base.orderStatus = order.shipping_status
      base.trackingNumberSaved = order.tracking_number || referenceCode
      const sync = await trySyncShopOrder({
        partnerId: input.partnerId,
        orderId: order.id,
        orderCode,
        referenceCode,
        userId: input.userId,
      })
      base.order_synced = sync.synced
      base.orderStatus = sync.shippingStatus
      base.trackingNumberSaved = referenceCode
      base.syncStatus = 'in_progress'
      base.syncMessage = sync.message
      return base
    }
    base.syncStatus = 'unlinked'
    base.syncMessage = orderNotFoundMessage(orderCode, 'unknown', '')
    return base
  }

  const ems = await fetchEmsWithFallback(emsLookupCandidates(referenceCode, order?.tracking_number))
  const hasEms = Boolean(!ems.error || ems.events.length)
  const emsStatus = ems.current_status_description || ''
  const emsPhase = emsPhaseFromDescription(emsStatus)
  base.hasEmsPayload = hasEms
  if (hasEms) {
    base.emsTrackingCode = ems.tracking_code || referenceCode
    base.emsReferenceCode = ems.reference_code || referenceCode
    base.emsStatus = emsStatus
    base.emsPhase = emsPhase
  } else {
    base.emsError = ems.error || null
    base.emsReferenceCode = referenceCode
  }

  if (!order) {
    base.syncStatus = hasEms && !ems.error ? 'in_progress' : 'unlinked'
    base.syncMessage = orderNotFoundMessage(orderCode, emsPhase, ems.error ? '' : emsStatus)
    return base
  }

  base.orderId = order.id
  base.orderStatus = order.shipping_status
  base.trackingNumberSaved = order.tracking_number || null
  const sync = await trySyncShopOrder({
    partnerId: input.partnerId,
    orderId: order.id,
    orderCode,
    referenceCode,
    emsTrackingCode: base.emsTrackingCode,
    emsPhase,
    emsStatus,
    userId: input.userId,
  })
  base.order_synced = sync.synced
  base.orderStatus = sync.shippingStatus
  base.trackingNumberSaved = base.emsTrackingCode || referenceCode
  base.syncStatus = 'in_progress'
  base.syncMessage = sync.message
  const saved = (order.tracking_number || '').trim().toUpperCase()
  const live = (base.emsTrackingCode || '').trim().toUpperCase()
  if (live && saved && saved !== live) {
    base.syncStatus = 'mismatch'
    base.syncMessage = `Mã vận đơn shop (${saved}) khác EMS (${live}). ${base.syncMessage}`
  }
  return base
}

export function buildEmsImportSummary(rows: Array<{ syncStatus?: string | null; codAmount?: number | null }>): EmsImportSummary {
  const keys = ['matched', 'in_progress', 'mismatch', 'unlinked', 'order_not_found', 'ems_not_found', 'parse_error', 'pending'] as const
  const counts: Record<string, { count: number; cod_total: number }> = {}
  for (const k of keys) counts[k] = { count: 0, cod_total: 0 }
  for (const row of rows) {
    const key = row.syncStatus || 'pending'
    if (!counts[key]) counts[key] = { count: 0, cod_total: 0 }
    counts[key].count += 1
    counts[key].cod_total += Math.max(0, Math.round(Number(row.codAmount || 0)))
  }
  const totalCod = Object.values(counts).reduce((s, x) => s + x.cod_total, 0)
  return {
    total_rows: rows.length,
    matched: counts.matched.count,
    in_progress: counts.in_progress.count,
    mismatch: counts.mismatch.count,
    unlinked: counts.unlinked.count + counts.order_not_found.count,
    order_not_found: counts.order_not_found.count,
    ems_not_found: counts.ems_not_found.count,
    parse_error: counts.parse_error.count,
    total_cod_amount: totalCod,
    breakdown: Object.entries(counts)
      .filter(([, v]) => v.count > 0)
      .map(([key, v]) => ({ key, count: v.count, cod_total: v.cod_total })),
  }
}

export async function importEmsShipmentExcel(input: {
  partnerId: string
  fileBytes: Buffer
  filename?: string | null
  userId?: string | null
}): Promise<{
  ok: true
  warnings: string[]
  summary: EmsImportSummary
  created: number
  updated: number
  skipped_no_reference: number
  orders_synced: number
  rows: PartnerEmsListRow[]
  import_batch: { id: string }
  import_report: { rows: PartnerEmsListRow[] }
  tracking_refresh_job_id: string | null
}> {
  validateEmsShipmentImportFile(input.fileBytes, input.filename)
  const parsed = parseEmsExportRows(input.fileBytes)
  const deduped = dedupeRowsByReference(parsed.rows)
  const warnings = [...parsed.warnings, ...deduped.warnings]
  const missingMaSp = deduped.rows.filter((r) => !(r.product_code || '').trim()).length
  if (missingMaSp) {
    warnings.push(
      `${missingMaSp} dòng không đọc được MA_SP (cột H) — kiểm tra ô H / TEN_SP có dạng B7796/41/2-...`,
    )
  }
  warnings.push('Đã lưu mã vận đơn/COD/đơn. Đang tra EMS nền (MyEMS)…')

  const results = []
  for (const row of deduped.rows) {
    results.push(
      await processEmsImportRow({
        partnerId: input.partnerId,
        row,
        userId: input.userId,
        skipEmsTracking: true,
      }),
    )
  }

  let created = 0
  let updated = 0
  let skippedNoReference = 0
  let ordersSynced = 0
  const importRows: PartnerEmsListRow[] = []
  const reportRows: Parameters<typeof persistPartnerEmsImportBatchFromPg>[0]['reportRows'] = []

  for (const result of results) {
    const ref = result.referenceCode.trim().toUpperCase()
    if (!ref) {
      skippedNoReference += 1
      continue
    }
    if (result.order_synced) ordersSynced += 1
    const saved = await upsertPartnerEmsRecordFromPg({ ...result, sourceFilename: input.filename || null })
    if (!saved) continue
    if (saved.created) created += 1
    else updated += 1
    const row: PartnerEmsListRow = { ...saved.record, import_action: saved.created ? 'created' : 'updated', row_number: result.row_number }
    importRows.push(row)
    reportRows.push({
      recordId: saved.record.id,
      excelRowNumber: result.row_number,
      referenceCode: ref,
      recipientLabel: result.recipientLabel || null,
      orderCode: result.orderCode || null,
      orderId: result.orderId || null,
      codAmount: result.codAmount ?? null,
      importAction: saved.created ? 'created' : 'updated',
      syncStatus: saved.record.sync_status,
      syncMessage: saved.record.sync_message,
    })
  }

  const batch = await persistPartnerEmsImportBatchFromPg({
    partnerId: input.partnerId,
    sourceFilename: input.filename || null,
    importedByUserId: input.userId || null,
    fileRowsProcessed: results.length,
    created,
    updated,
    skippedNoReference,
    ordersSynced,
    totalCodAmount: importRows.reduce((s, r) => s + Math.max(0, Math.round(Number(r.cod_amount || 0))), 0),
    reportRows,
  })

  const trackingJob = importRows.length
    ? await createPartnerEmsTrackingJobFromPg({
        partnerId: input.partnerId,
        recordIds: importRows.map((r) => r.id).filter(Boolean),
        source: 'import',
      })
    : null

  return {
    ok: true,
    warnings,
    summary: buildEmsImportSummary(results.map((r) => ({ syncStatus: r.syncStatus, codAmount: r.codAmount }))),
    created,
    updated,
    skipped_no_reference: skippedNoReference,
    orders_synced: ordersSynced,
    rows: importRows,
    import_batch: batch,
    import_report: { rows: importRows },
    tracking_refresh_job_id: trackingJob?.id || null,
  }
}

export async function refreshEmsRecordTracking(input: {
  partnerId: string
  record: { id: string; reference_code: string; ems_tracking_code?: string | null; tracking_number_saved?: string | null; order_id?: string | null; order_code?: string | null }
  userId?: string | null
}) {
  const ems = await fetchEmsWithFallback(
    emsLookupCandidates(input.record.ems_tracking_code || input.record.reference_code, input.record.tracking_number_saved),
  )
  const emsStatus = ems.current_status_description || ''
  const emsPhase = emsPhaseFromDescription(emsStatus)
  const hasEms = Boolean(!ems.error || ems.events.length)
  if (input.record.order_id && hasEms) {
    await trySyncShopOrder({
      partnerId: input.partnerId,
      orderId: input.record.order_id,
      orderCode: input.record.order_code,
      referenceCode: input.record.reference_code,
      emsTrackingCode: ems.tracking_code || input.record.reference_code,
      emsPhase,
      emsStatus,
      userId: input.userId,
    })
  }
  return updatePartnerEmsLiveTrackingFromPg({
    partnerId: input.partnerId,
    recordId: input.record.id,
    emsTrackingCode: ems.tracking_code || null,
    emsReferenceCode: ems.reference_code || null,
    emsStatus: emsStatus || null,
    emsPhase,
    emsError: ems.error || null,
    syncStatus: hasEms ? 'in_progress' : 'ems_not_found',
    syncMessage: ems.error || emsStatus || 'Đã tra EMS.',
  })
}

const TRACKING_CHUNK = 8

export async function processPartnerEmsTrackingJobChunk(input: {
  partnerId: string
  jobId: string
  userId?: string | null
}) {
  const job = await fetchPartnerEmsTrackingJobFromPg(input.partnerId, input.jobId)
  if (!job) return null
  if (job.status === 'done' || job.status === 'error' || job.processed >= job.total) {
    if (job.status !== 'done' && job.processed >= job.total) {
      return serializeEmsTrackingJob(
        (await updatePartnerEmsTrackingJobFromPg({
          partnerId: input.partnerId,
          jobId: job.id,
          status: 'done',
          processed: job.processed,
          okCount: job.ok_count,
          message: `Đã tra xong ${job.processed}/${job.total} vận đơn.`,
        })) || job,
      )
    }
    return serializeEmsTrackingJob(job)
  }
  const slice = job.record_ids.slice(job.processed, job.processed + TRACKING_CHUNK)
  const records = await listPartnerEmsRecordsByIdsFromPg(input.partnerId, slice)
  const byId = new Map(records.map((r) => [r.id, r]))
  let ok = job.ok_count
  for (const id of slice) {
    const rec = byId.get(id)
    if (!rec) continue
    try {
      const updated = await refreshEmsRecordTracking({
        partnerId: input.partnerId,
        record: rec,
        userId: input.userId,
      })
      if (updated && !updated.ems_error) ok += 1
    } catch {
      /* keep going */
    }
  }
  const processed = job.processed + slice.length
  const done = processed >= job.total
  const updated = await updatePartnerEmsTrackingJobFromPg({
    partnerId: input.partnerId,
    jobId: job.id,
    status: done ? 'done' : 'running',
    processed,
    okCount: ok,
    message: done
      ? `Đã tra xong ${processed}/${job.total} vận đơn.`
      : `Đã tra ${processed}/${job.total} vận đơn…`,
  })
  return serializeEmsTrackingJob(updated || { ...job, processed, ok_count: ok, status: done ? 'done' : 'running' })
}

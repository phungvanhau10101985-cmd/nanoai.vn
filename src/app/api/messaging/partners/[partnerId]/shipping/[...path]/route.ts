import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  createPartnerEmsTrackingJobFromPg,
  deletePartnerEmsRecordsFromPg,
  fetchActivePartnerEmsTrackingJobFromPg,
  fetchPartnerEmsTrackingJobFromPg,
  listAllPartnerEmsRecordsFromPg,
  listPartnerEmsImportBatchesFromPg,
  listPartnerEmsRecordsFromPg,
  listPartnerEmsRecordIdsFromPg,
  listPartnerEmsRecordsByIdsFromPg,
  serializeEmsTrackingJob,
  summarizePartnerEmsRecordsFromPg,
} from '@/lib/db/messaging-partner-ems-shipping-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { importCodSettlementExcel, listCodSettlementBatchesFromPg } from '@/lib/messaging/shipping/ems-cod-settlement'
import {
  buildCodSettlementSampleXlsx,
  buildEmsShipmentSampleXlsx,
  buildFreightSettlementSampleXlsx,
  buildShopReturnConfirmSampleXlsx,
} from '@/lib/messaging/shipping/ems-excel'
import { importFreightSettlementExcel, listFreightSettlementBatchesFromPg } from '@/lib/messaging/shipping/ems-freight-settlement'
import {
  importEmsShipmentExcel,
  processPartnerEmsTrackingJobChunk,
  refreshEmsRecordTracking,
} from '@/lib/messaging/shipping/ems-shipment-import'
import { emsLookupCandidates, fetchEmsWithFallback } from '@/lib/messaging/shipping/ems-tracking'
import type { OpsBucketKey } from '@/lib/messaging/shipping/ems-types'
import {
  confirmShopReturns,
  intakeReturnWarehouse,
  parseShopReturnExcelTokens,
  previewShopReturns,
  resolveReturnWarehouseSku,
} from '@/lib/messaging/shipping/shop-return'
import {
  accumulateOpsStats,
  buildImportTimeline,
  buildReceivedTimeline,
  filterRecordsForImportPeriod,
  filterRecordsForReceivedPeriod,
  matchesOpsBucket,
} from '@/lib/messaging/shipping/shipping-ops'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

const OPS_BUCKET_LABELS: Record<string, string> = {
  total: 'Tổng vận đơn',
  in_transit: 'Đang giao',
  delivered: 'Giao OK',
  returned: 'Đơn hoàn chưa trả shop',
  pending: 'Chưa rõ EMS',
  has_cod: 'Có COD',
  cod_in_transit_unpaid: 'COD đang giao · chưa trả',
  cod_delivered_unpaid: 'Giao OK · EMS chưa trả COD',
  cod_paid: 'COD EMS trả shop',
  cod_received_in_period: 'COD nhận trong kỳ',
  cod_returned_unpaid: 'COD hoàn · chưa trả',
  cod_pending_unpaid: 'COD chưa rõ trạng thái',
  freight_unsettled: 'Chưa đối soát cước',
  shop_linked: 'Ghép đơn shop',
  shop_return_received: 'Đơn hoàn đã trả shop',
  shop_shipping: 'Đơn shop đang giao',
}

type Ctx = { params: Promise<{ partnerId: string; path: string[] }> }

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured', userId: '' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error, userId: '' }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'orders')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error, userId: '' }
  return { ok: true as const, userId: auth.user.id }
}

function joinPath(parts: string[] | undefined): string {
  return (parts || []).map((p) => decodeURIComponent(p)).join('/')
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ ok: false, error: detail, detail }, { status })
}

function xlsxResponse(bytes: Buffer, filename: string) {
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

async function readUpload(req: NextRequest): Promise<{ buffer: Buffer; filename: string } | { error: string }> {
  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) return { error: 'File trống.' }
  const filename = file.name || 'upload.xlsx'
  const lower = filename.toLowerCase()
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xlsm') && !lower.endsWith('.xls')) {
    return { error: 'Chỉ hỗ trợ file Excel .xlsx' }
  }
  if (file.size > 10 * 1024 * 1024) return { error: 'File quá lớn (tối đa 10MB).' }
  return { buffer: Buffer.from(await file.arrayBuffer()), filename }
}

function paginate<T>(rows: T[], skip: number, limit: number) {
  const total = rows.length
  const sliced = rows.slice(skip, skip + limit)
  return {
    pagination: { skip, limit, total, has_more: skip + sliced.length < total },
    rows: sliced,
  }
}

function timelineQuery(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const yearRaw = sp.get('year')
  return {
    granularity: sp.get('granularity') || 'month',
    limit: sp.get('limit') ? Number(sp.get('limit')) : null,
    dateFrom: sp.get('date_from'),
    dateTo: sp.get('date_to'),
    preset: sp.get('preset'),
    year: yearRaw ? Number(yearRaw) : null,
    periodKey: sp.get('period_key'),
    bucket: sp.get('bucket') || 'total',
    skip: Math.max(0, Number(sp.get('skip') || 0) || 0),
    pageLimit: Math.min(100, Math.max(1, Number(sp.get('limit') || 25) || 25)),
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const route = joinPath(path)
  const sp = req.nextUrl.searchParams

  try {
    if (route === 'ems-records') {
      const skip = Math.max(0, Number(sp.get('skip') || 0) || 0)
      const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 50) || 50))
      const listed = await listPartnerEmsRecordsFromPg({
        partnerId,
        search: sp.get('q') || '',
        syncStatus: sp.get('sync_status') || undefined,
        skip,
        limit,
      })
      const summary = await summarizePartnerEmsRecordsFromPg(partnerId, sp.get('q') || '')
      return NextResponse.json({
        ok: true,
        warnings: [],
        summary,
        pagination: { skip, limit, total: listed.total, has_more: skip + listed.rows.length < listed.total },
        rows: listed.rows,
      })
    }
    if (route === 'ems-import-batches') {
      const listed = await listPartnerEmsImportBatchesFromPg(partnerId, Number(sp.get('limit') || 30) || 30)
      return NextResponse.json({ ok: true, batches: listed.batches })
    }
    if (route === 'ems-import/sample') {
      const sample = buildEmsShipmentSampleXlsx()
      return xlsxResponse(sample.bytes, sample.filename)
    }
    if (route === 'cod-settlement-import/sample') {
      const sample = buildCodSettlementSampleXlsx()
      return xlsxResponse(sample.bytes, sample.filename)
    }
    if (route === 'freight-settlement-import/sample') {
      const sample = buildFreightSettlementSampleXlsx()
      return xlsxResponse(sample.bytes, sample.filename)
    }
    if (route === 'shop-return-confirm-import/sample') {
      const sample = buildShopReturnConfirmSampleXlsx()
      return xlsxResponse(sample.bytes, sample.filename)
    }
    if (route === 'freight-settlement-batches') {
      const listed = await listFreightSettlementBatchesFromPg(partnerId)
      return NextResponse.json({ ok: true, ...listed })
    }
    if (route === 'cod-settlement-batches') {
      const listed = await listCodSettlementBatchesFromPg(partnerId)
      return NextResponse.json({ ok: true, ...listed })
    }
    if (route === 'operations-stats') {
      const records = await listAllPartnerEmsRecordsFromPg(partnerId)
      return NextResponse.json({ ok: true, ...accumulateOpsStats(records) })
    }
    if (route === 'operations-stats/timeline') {
      const q = timelineQuery(req)
      const records = await listAllPartnerEmsRecordsFromPg(partnerId)
      return NextResponse.json({ ok: true, ...buildImportTimeline(records, q) })
    }
    if (route === 'operations-stats/received-timeline') {
      const q = timelineQuery(req)
      const records = await listAllPartnerEmsRecordsFromPg(partnerId)
      return NextResponse.json({ ok: true, ...buildReceivedTimeline(records, q) })
    }
    if (route === 'operations-stats/records') {
      const bucket = (sp.get('bucket') || 'total') as OpsBucketKey
      const skip = Math.max(0, Number(sp.get('skip') || 0) || 0)
      const limit = Math.min(100, Math.max(1, Number(sp.get('limit') || 25) || 25))
      const records = (await listAllPartnerEmsRecordsFromPg(partnerId)).filter((r) => matchesOpsBucket(r, bucket))
      const page = paginate(records, skip, limit)
      return NextResponse.json({
        ok: true,
        bucket,
        bucket_label: OPS_BUCKET_LABELS[bucket] || bucket,
        ...page,
      })
    }
    if (route === 'operations-stats/timeline/records') {
      const q = timelineQuery(req)
      const bucket = q.bucket as OpsBucketKey
      const records = filterRecordsForImportPeriod(await listAllPartnerEmsRecordsFromPg(partnerId), q).filter((r) =>
        matchesOpsBucket(r, bucket),
      )
      const page = paginate(records, q.skip, q.pageLimit)
      return NextResponse.json({
        ok: true,
        bucket,
        bucket_label: OPS_BUCKET_LABELS[bucket] || bucket,
        period_key: q.periodKey,
        granularity: q.granularity,
        ...page,
      })
    }
    if (route === 'operations-stats/received-timeline/records') {
      const q = timelineQuery(req)
      const records = filterRecordsForReceivedPeriod(await listAllPartnerEmsRecordsFromPg(partnerId), q.bucket, q).filter(
        (r) => matchesOpsBucket(r, q.bucket as OpsBucketKey),
      )
      const page = paginate(records, q.skip, q.pageLimit)
      return NextResponse.json({
        ok: true,
        bucket: q.bucket,
        bucket_label: OPS_BUCKET_LABELS[q.bucket] || q.bucket,
        period_key: q.periodKey,
        granularity: q.granularity,
        ...page,
      })
    }
    if (route === 'ems-tracking-refresh/active') {
      const job = await fetchActivePartnerEmsTrackingJobFromPg(partnerId)
      if (!job) return NextResponse.json({ ok: true, job: null })
      const processed = await processPartnerEmsTrackingJobChunk({ partnerId, jobId: job.id, userId: access.userId })
      return NextResponse.json({ ok: true, job: processed })
    }
    if (route.startsWith('ems-tracking-refresh/job/')) {
      const jobId = route.slice('ems-tracking-refresh/job/'.length)
      const processed = await processPartnerEmsTrackingJobChunk({ partnerId, jobId, userId: access.userId })
      if (!processed) return jsonError('Không tìm thấy job tra EMS.', 404)
      return NextResponse.json(processed)
    }
    if (route === 'resolve-return-warehouse-sku') {
      const code = (sp.get('code') || '').trim()
      if (!code) return jsonError('Thiếu mã.')
      const resolved = await resolveReturnWarehouseSku(partnerId, code)
      return NextResponse.json({ ok: !resolved.error, ...resolved })
    }
    if (route === 'return-warehouse-lookup') {
      const sku = (sp.get('sku') || sp.get('code') || '').trim()
      if (!sku) return jsonError('Thiếu SKU.')
      const resolved = await resolveReturnWarehouseSku(partnerId, sku)
      return NextResponse.json({ ok: !resolved.error, ...resolved })
    }
    if (route === 'ems-live-tracking') {
      const recordId = (sp.get('record_id') || '').trim()
      if (!recordId) return jsonError('Thiếu vận đơn.')
      const records = await listPartnerEmsRecordsByIdsFromPg(partnerId, [recordId])
      const record = records[0]
      if (!record) return jsonError('Không tìm thấy vận đơn.', 404)
      const tracking = await fetchEmsWithFallback(
        emsLookupCandidates(record.ems_tracking_code || record.reference_code, record.tracking_number_saved),
      )
      return NextResponse.json({ ok: true, row: record, tracking })
    }
    return jsonError('Not found', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi vận chuyển.'
    return jsonError(message, 400)
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const route = joinPath(path)

  try {
    if (route === 'ems-import') {
      const uploaded = await readUpload(req)
      if ('error' in uploaded) return jsonError(uploaded.error)
      const result = await importEmsShipmentExcel({
        partnerId,
        fileBytes: uploaded.buffer,
        filename: uploaded.filename,
        userId: access.userId,
      })
      if (result.tracking_refresh_job_id) {
        const trackingJob = await processPartnerEmsTrackingJobChunk({
          partnerId,
          jobId: result.tracking_refresh_job_id,
          userId: access.userId,
        })
        return NextResponse.json({ ...result, tracking_job: trackingJob })
      }
      return NextResponse.json(result)
    }
    if (route === 'cod-settlement-import') {
      const uploaded = await readUpload(req)
      if ('error' in uploaded) return jsonError(uploaded.error)
      const result = await importCodSettlementExcel({
        partnerId,
        fileBytes: uploaded.buffer,
        filename: uploaded.filename,
        userId: access.userId,
      })
      return NextResponse.json(result)
    }
    if (route === 'freight-settlement-import') {
      const uploaded = await readUpload(req)
      if ('error' in uploaded) return jsonError(uploaded.error)
      const result = await importFreightSettlementExcel({
        partnerId,
        fileBytes: uploaded.buffer,
        filename: uploaded.filename,
        userId: access.userId,
      })
      return NextResponse.json(result)
    }
    if (route === 'shop-return-preview') {
      const body = (await req.json().catch(() => null)) as { text?: string } | null
      const result = await previewShopReturns(partnerId, body?.text || '')
      return NextResponse.json({ ok: true, ...result })
    }
    if (route === 'shop-return-confirm') {
      const body = (await req.json().catch(() => null)) as { text?: string } | null
      const result = await confirmShopReturns({ partnerId, rawText: body?.text || '', userId: access.userId })
      return NextResponse.json({ ok: true, ...result })
    }
    if (route === 'shop-return-confirm-import') {
      const uploaded = await readUpload(req)
      if ('error' in uploaded) return jsonError(uploaded.error)
      const tokens = parseShopReturnExcelTokens(uploaded.buffer)
      const result = await confirmShopReturns({ partnerId, rawText: tokens.join('\n'), userId: access.userId })
      return NextResponse.json({ ok: true, ...result })
    }
    if (route === 'return-warehouse-intake') {
      const body = (await req.json().catch(() => null)) as { code?: string; qty?: number; markClearance?: boolean } | null
      const result = await intakeReturnWarehouse({
        partnerId,
        code: body?.code || '',
        qty: Number(body?.qty) || 1,
        markClearance: Boolean(body?.markClearance),
      })
      if (!result.ok) return jsonError(result.error || 'Không nhập kho được.', 400)
      return NextResponse.json(result)
    }
    if (route === 'ems-tracking-refresh') {
      const body = (await req.json().catch(() => null)) as {
        record_ids?: string[]
        q?: string
        sync_status?: string
        source?: string
      } | null
      let ids = (body?.record_ids || []).map(String).filter(Boolean)
      if (!ids.length) {
        ids = await listPartnerEmsRecordIdsFromPg({
          partnerId,
          search: body?.q || '',
          syncStatus: body?.sync_status || undefined,
        })
      }
      if (!ids.length) return jsonError('Chưa chọn dòng để tra EMS.', 400)
      const job = await createPartnerEmsTrackingJobFromPg({
        partnerId,
        recordIds: ids,
        source: body?.source || 'manual',
      })
      if (!job) return jsonError('Không tạo được job tra EMS.', 500)
      const processed = await processPartnerEmsTrackingJobChunk({ partnerId, jobId: job.id, userId: access.userId })
      return NextResponse.json(processed || serializeEmsTrackingJob(job))
    }
    if (route.startsWith('ems-tracking-refresh/resume/')) {
      const jobId = route.slice('ems-tracking-refresh/resume/'.length)
      const job = await fetchPartnerEmsTrackingJobFromPg(partnerId, jobId)
      if (!job) return jsonError('Không tìm thấy job tra EMS.', 404)
      const processed = await processPartnerEmsTrackingJobChunk({ partnerId, jobId, userId: access.userId })
      return NextResponse.json({ ...(processed || serializeEmsTrackingJob(job)), resume_ok: true })
    }
    if (route === 'refresh-one') {
      const body = (await req.json().catch(() => null)) as { record_id?: string } | null
      const recordId = String(body?.record_id || '').trim()
      const records = recordId ? await listPartnerEmsRecordsByIdsFromPg(partnerId, [recordId]) : []
      const record = records[0]
      if (!record) return jsonError('Không tìm thấy vận đơn.', 404)
      const updated = await refreshEmsRecordTracking({ partnerId, record, userId: access.userId })
      return NextResponse.json({ ok: true, row: updated })
    }
    return jsonError('Not found', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi vận chuyển.'
    return jsonError(message, 400)
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const route = joinPath(path)
  if (route !== 'ems-records') return jsonError('Not found', 404)
  const body = (await req.json().catch(() => null)) as { ids?: string[] } | null
  const ids = (body?.ids || []).map(String).filter(Boolean)
  if (!ids.length) return jsonError('Chưa chọn dòng để xóa.')
  const deleted = await deletePartnerEmsRecordsFromPg(partnerId, ids)
  return NextResponse.json({ ok: true, deleted })
}

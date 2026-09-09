import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { deletePartnerInventoryByIdsForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import {
  clearOosFlagsFromPg,
  listOosIdsInWindowFromPg,
  resetSourceStockPdpCycleFromPg,
  sourceStockActivityReportFromPg,
  sourceStockQueueStatsFromPg,
} from '@/lib/db/messaging-partner-source-stock-pg'
import { adminPreviewSourceStockByUrl } from '@/lib/messaging/source-stock-check/evaluate'
import {
  clearSourceStockMemoryQueue,
  enqueueSourceStockCheck,
  ensureSourceStockDaemon,
  getSourceStockWorkerAdminSnapshot,
  setSourceStockPaused,
} from '@/lib/messaging/source-stock-check/worker'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const maxDuration = 300
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ partnerId: string; path: string[] }> }

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'inventory')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const }
}

function joinPath(parts: string[] | undefined): string {
  return (parts || []).map((p) => decodeURIComponent(p)).join('/')
}

function jsonError(detail: string, status = 400) {
  return NextResponse.json({ ok: false, error: detail, detail }, { status })
}

function boolParam(v: string | null, fallback = true): boolean {
  if (v == null) return fallback
  return !['0', 'false', 'no', 'off'].includes(v.trim().toLowerCase())
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)
  const url = new URL(req.url)
  ensureSourceStockDaemon()

  if (p === 'queue-stats') {
    const domain = (url.searchParams.get('domain') || 'cssbuy').trim().toLowerCase()
    const activeOnly = boolParam(url.searchParams.get('active_only'), true)
    const data = await sourceStockQueueStatsFromPg(partnerId, domain, activeOnly)
    return NextResponse.json(data)
  }

  if (p === 'worker-state') {
    return NextResponse.json({ ok: true, ...(await getSourceStockWorkerAdminSnapshot(partnerId)) })
  }

  if (p === 'report') {
    const data = await sourceStockActivityReportFromPg({
      partnerId,
      domain: (url.searchParams.get('domain') || 'cssbuy').trim().toLowerCase(),
      activeOnly: boolParam(url.searchParams.get('active_only'), true),
      windowDays: Number(url.searchParams.get('window_days') || '30') || 30,
      samplesOosPage: Number(url.searchParams.get('samples_oos_page') || '1') || 1,
      samplesInStockPage: Number(url.searchParams.get('samples_in_stock_page') || '1') || 1,
      samplesBatchTtlPage: Number(url.searchParams.get('samples_batch_ttl_page') || '1') || 1,
      samplePageSize: Number(url.searchParams.get('sample_page_size') || '200') || 200,
    })
    return NextResponse.json(data)
  }

  if (p === 'oos-db-ids') {
    const ids = await listOosIdsInWindowFromPg(
      partnerId,
      Number(url.searchParams.get('window_days') || '30') || 30,
      boolParam(url.searchParams.get('active_only'), true)
    )
    return NextResponse.json({ ok: true, ids })
  }

  return jsonError('Not found', 404)
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, path } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return jsonError(auth.error, auth.status)
  const p = joinPath(path)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  ensureSourceStockDaemon()

  if (p === 'worker-pause') {
    const paused = Boolean(body.paused)
    const snap = await setSourceStockPaused(partnerId, paused)
    return NextResponse.json({ ok: true, ...snap })
  }

  if (p === 'preview-url') {
    const url = String(body.url || '').trim()
    if (!url) return jsonError('Thiếu URL.')
    const out = await adminPreviewSourceStockByUrl(url, partnerId)
    return NextResponse.json(out)
  }

  if (p === 'reset-pdp-cycle') {
    const updated = await resetSourceStockPdpCycleFromPg(partnerId, body.active_only !== false)
    const mem = clearSourceStockMemoryQueue(partnerId)
    return NextResponse.json({
      ok: true,
      products_updated: updated,
      memory_queue_cleared: mem,
      detail: 'Đã reset source_stock («unknown») cho SP trong phạm vi; bỏ qua queued/checking.',
    })
  }

  if (p === 'delete-by-db-ids') {
    const ids = Array.isArray(body.db_ids) ? body.db_ids.map((x) => String(x)).filter(Boolean) : []
    if (!ids.length) return jsonError('empty_db_ids')
    const ok = await deletePartnerInventoryByIdsForPartnerFromPg(partnerId, ids.slice(0, 50_000))
    return NextResponse.json({ ok, deleted: ok ? ids.length : 0 })
  }

  if (p === 'clear-oos-flag') {
    const id = String(body.db_id || '').trim()
    if (!id) return jsonError('product_not_found')
    const out = await clearOosFlagsFromPg(partnerId, [id])
    return NextResponse.json({ ok: true, ...out, restored_available: out.restored, product_db_id: id })
  }

  if (p === 'clear-oos-flag-bulk') {
    const allInWindow = Boolean(body.all_in_window)
    const ids = allInWindow
      ? await listOosIdsInWindowFromPg(partnerId, Number(body.window_days || 30) || 30, true)
      : Array.isArray(body.db_ids)
        ? body.db_ids.map((x) => String(x)).filter(Boolean)
        : []
    const out = await clearOosFlagsFromPg(partnerId, ids)
    return NextResponse.json({ ok: true, ...out, restored_available: out.restored, all_in_window: allInWindow })
  }

  if (p === 'force-worker-recheck') {
    const id = String(body.db_id || '').trim()
    if (!id) return jsonError('product_not_found')
    const queued = await enqueueSourceStockCheck({ partnerId, inventoryId: id, reason: 'admin_report_recheck', force: true })
    return NextResponse.json({ ok: true, queued, product_db_id: id })
  }

  return jsonError('Not found', 404)
}

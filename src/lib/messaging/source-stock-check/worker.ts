import { isPgConfigured } from '@/lib/db/pool'
import {
  claimDueSourceStockFromPg,
  commitSourceStockResultFromPg,
  enqueueSourceStockQueuedFromPg,
  ensureSourceStockWorkerStateFromPg,
  fetchSourceStockInventoryByIdFromPg,
  fetchSourceStockInventoryMiniFromPg,
  listDueSourceStockIdsFromPg,
  listPausedPartnerIdsFromPg,
  markInventoryCheckingFromPg,
  markSourceStockCheckingFromPg,
  markSourceStockFinishedFromPg,
  setSourceStockWorkerPausedFromPg,
} from '@/lib/db/messaging-partner-source-stock-pg'
import { evaluateStockPrimaryCssbuyWithFallbacks } from './evaluate'
import {
  sourceStockCheckEnabled,
  sourceStockCheckIntervalSeconds,
  sourceStockCheckPageviewMinIntervalSeconds,
  sourceStockCheckStaleMinutes,
} from './source-stock-config'
import { linkEligibleForSourceStockCheck } from './source-stock-urls'
import type { SourceStockWorkerProgressRow, SourceStockWorkerState } from './source-stock-types'

type MemItem = { partnerId: string; inventoryId: string }

const memoryQueue: MemItem[] = []
const queuedKeys = new Set<string>()
let daemonStarted = false
let daemonAlive = false
let daemonPromise: Promise<void> | null = null

function memKey(partnerId: string, inventoryId: string): string {
  return `${partnerId}:${inventoryId}`
}

function utcIso(raw: string | null | undefined): string | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? raw : d.toISOString()
}

function recentIso(raw: string | null | undefined, seconds: number): boolean {
  if (!raw) return false
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() > Date.now() - seconds * 1000
}

export function getSourceStockMemoryQueueDepth(partnerId?: string): number {
  if (!partnerId) return memoryQueue.length
  return memoryQueue.filter((x) => x.partnerId === partnerId).length
}

export function clearSourceStockMemoryQueue(partnerId?: string): number {
  if (!partnerId) {
    const n = memoryQueue.length
    memoryQueue.length = 0
    queuedKeys.clear()
    return n
  }
  let n = 0
  for (let i = memoryQueue.length - 1; i >= 0; i--) {
    if (memoryQueue[i].partnerId !== partnerId) continue
    queuedKeys.delete(memKey(memoryQueue[i].partnerId, memoryQueue[i].inventoryId))
    memoryQueue.splice(i, 1)
    n += 1
  }
  return n
}

function popMemory(paused: Set<string>): MemItem | null {
  const skipped: MemItem[] = []
  while (memoryQueue.length) {
    const next = memoryQueue.shift()
    if (!next) break
    queuedKeys.delete(memKey(next.partnerId, next.inventoryId))
    if (paused.has(next.partnerId)) {
      skipped.push(next)
      continue
    }
    for (let i = skipped.length - 1; i >= 0; i--) {
      const s = skipped[i]
      queuedKeys.add(memKey(s.partnerId, s.inventoryId))
      memoryQueue.unshift(s)
    }
    return next
  }
  for (const s of skipped) {
    queuedKeys.add(memKey(s.partnerId, s.inventoryId))
    memoryQueue.push(s)
  }
  return null
}

export async function enqueueSourceStockCheck(opts: {
  partnerId: string
  inventoryId: string
  reason?: string
  force?: boolean
}): Promise<boolean> {
  if (!sourceStockCheckEnabled() && !opts.force) return false
  const row = await fetchSourceStockInventoryByIdFromPg(opts.partnerId, opts.inventoryId)
  if (!row || !linkEligibleForSourceStockCheck(row.product_url)) return false
  const key = memKey(opts.partnerId, opts.inventoryId)
  if (queuedKeys.has(key)) return false
  queuedKeys.add(key)
  memoryQueue.push({ partnerId: opts.partnerId, inventoryId: opts.inventoryId })
  await enqueueSourceStockQueuedFromPg(opts.partnerId, opts.inventoryId)
  ensureSourceStockDaemon()
  return true
}

export async function enqueueProductViewStockCheckIfNeeded(opts: {
  partnerId: string
  inventoryId: string
  productUrl: string
  status?: string | null
  checkedAt?: string | null
  nextCheckAt?: string | null
}): Promise<boolean> {
  if (!linkEligibleForSourceStockCheck(opts.productUrl)) return false
  const status = (opts.status || '').trim().toLowerCase()
  if (
    (status === 'queued' || status === 'checking') &&
    recentIso(opts.nextCheckAt || opts.checkedAt, sourceStockCheckPageviewMinIntervalSeconds())
  ) {
    return false
  }
  if (opts.checkedAt) {
    const d = new Date(opts.checkedAt)
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - sourceStockCheckStaleMinutes() * 60_000) {
      return false
    }
  }
  return enqueueSourceStockCheck({
    partnerId: opts.partnerId,
    inventoryId: opts.inventoryId,
    reason: 'product_view',
  })
}

export async function checkProductSourceStock(partnerId: string, inventoryId: string): Promise<void> {
  let previous = ''
  let productUrl = ''
  let fallbackId: string | null = null
  let progressed = false
  let finalSt = 'error'
  let commitOk = false
  let commitDetail = 'Chưa xác nhận commit bảng kho.'
  try {
    const row = await markInventoryCheckingFromPg(partnerId, inventoryId)
    if (!row || !linkEligibleForSourceStockCheck(row.product_url)) return
    previous = (row.previous_source_stock_status || '').trim().toLowerCase()
    productUrl = row.product_url
    fallbackId = (row.remarketing_id || row.sku || '').trim() || null
    await markSourceStockCheckingFromPg(partnerId, inventoryId)
    progressed = true
  } catch (e) {
    console.warn('[source-stock prepare]', e instanceof Error ? e.message : e)
    return
  }

  let result
  try {
    result = await evaluateStockPrimaryCssbuyWithFallbacks(productUrl, {
      fallbackProductId: fallbackId,
      partnerId,
    })
  } catch (e) {
    result = {
      status: 'error',
      error: (e instanceof Error ? e.message : String(e)).slice(0, 1000),
      checked_via: null,
    }
  }

  try {
    const ok = await commitSourceStockResultFromPg({
      partnerId,
      inventoryId,
      previousStatus: previous,
      status: result.status,
      error: result.error,
      checkedVia: result.checked_via,
    })
    finalSt = result.status
    commitOk = ok
    commitDetail = ok
      ? `Đã COMMIT inventory.id=${inventoryId} status=${result.status}; cập nhật source_stock_* và stock_qty.`
      : `Không tìm thấy kho sau scrape — không COMMIT được.`
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    try {
      await commitSourceStockResultFromPg({
        partnerId,
        inventoryId,
        previousStatus: previous,
        status: 'error',
        error: msg.slice(0, 1000),
        checkedVia: null,
      })
      commitOk = true
      commitDetail = `Đã COMMIT inventory.id=${inventoryId} status=error sau exception.`
    } catch {
      commitOk = false
      commitDetail = `Không COMMIT được bảng kho sau lỗi: ${msg.slice(0, 800)}`
    }
    finalSt = 'error'
  } finally {
    if (progressed) {
      await markSourceStockFinishedFromPg({
        partnerId,
        inventoryId,
        status: finalSt,
        commitOk,
        commitDetail,
      })
    }
  }
}

async function workerLoop(): Promise<void> {
  daemonAlive = true
  const idle = Math.max(1, Math.min(15, sourceStockCheckIntervalSeconds()))
  console.info(
    `[source-stock] checker started interval=${sourceStockCheckIntervalSeconds()}s (cssbuy → vipomall → pandamall)`
  )
  while (true) {
    try {
      if (!sourceStockCheckEnabled()) {
        await sleep(idle * 1000)
        continue
      }
      const paused = await listPausedPartnerIdsFromPg()
      const mem = popMemory(paused)
      const next = mem || (await claimDueSourceStockFromPg())
      if (!next) {
        await sleep(idle * 1000)
        continue
      }
      if (paused.has(next.partnerId)) {
        memoryQueue.unshift(next)
        queuedKeys.add(memKey(next.partnerId, next.inventoryId))
        await sleep(idle * 1000)
        continue
      }
      await checkProductSourceStock(next.partnerId, next.inventoryId)
      await sleep(sourceStockCheckIntervalSeconds() * 1000)
    } catch (e) {
      console.warn('[source-stock loop]', e instanceof Error ? e.message : e)
      await sleep(idle * 1000)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function ensureSourceStockDaemon(): void {
  if (!sourceStockCheckEnabled()) return
  if (daemonStarted) return
  daemonStarted = true
  daemonPromise = workerLoop().catch((e) => {
    daemonAlive = false
    daemonStarted = false
    console.error('[source-stock daemon]', e)
  })
}

export async function resumeSourceStockAfterRestart(): Promise<{ started: boolean; claimed: boolean }> {
  if (!isPgConfigured()) return { started: false, claimed: false }
  ensureSourceStockDaemon()
  return { started: daemonStarted, claimed: true }
}

export async function getSourceStockWorkerAdminSnapshot(partnerId: string): Promise<SourceStockWorkerState> {
  const envOn = sourceStockCheckEnabled()
  const row = await ensureSourceStockWorkerStateFromPg(partnerId)
  const paused = Boolean(row.paused)
  const depth = getSourceStockMemoryQueueDepth(partnerId)
  let idle: string | null = null
  let reasonVi = ''
  if (!envOn) {
    idle = 'disabled_by_env'
    reasonVi = 'Đã tắt SOURCE_STOCK_CHECK_ENABLED — worker không được khởi động.'
  } else if (paused) {
    idle = 'paused_via_db'
    reasonVi = 'Tạm dừng qua DB — workspace này không scrape trong vòng lặp.'
  } else if (!daemonStarted) {
    idle = 'daemon_not_started'
    reasonVi = 'Daemon chưa bật trong process báo snapshot này.'
  } else if (!daemonAlive) {
    idle = 'thread_not_alive'
    reasonVi = 'Luồng worker không còn sống trong process này — cron sẽ khởi động lại.'
  }

  const peekMem = memoryQueue.filter((x) => x.partnerId === partnerId).slice(0, 8)
  const dbDue = await listDueSourceStockIdsFromPg(partnerId, 12)
  const agg = [
    row.checking_inventory_id,
    row.last_done_inventory_id,
    ...peekMem.map((x) => x.inventoryId),
    ...dbDue,
  ].filter((x): x is string => Boolean(x))
  const mins = await fetchSourceStockInventoryMiniFromPg(partnerId, agg)

  const toProgress = (id: string): SourceStockWorkerProgressRow => {
    const m = mins.get(id)
    return {
      product_db_id: id,
      product_code: (m?.remarketing_id || m?.sku || '').trim() || null,
      name: m?.name ? m.name.slice(0, 220) : null,
      link_default: m?.product_url || null,
      source_stock_check_platform: m?.source_stock_check_platform || null,
    }
  }

  let checking: SourceStockWorkerProgressRow | null = null
  if (row.checking_inventory_id) {
    checking = toProgress(row.checking_inventory_id)
    checking.checking_started_at_utc_iso = utcIso(row.checking_started_at)
  }
  let lastCompleted: SourceStockWorkerProgressRow | null = null
  if (row.last_done_inventory_id) {
    lastCompleted = toProgress(row.last_done_inventory_id)
    lastCompleted.finished_at_utc_iso = utcIso(row.last_done_finished_at)
    lastCompleted.source_stock_status = row.last_done_source_stock_status
  }

  const upcoming: SourceStockWorkerProgressRow[] = []
  const seen = new Set<string>()
  for (const it of peekMem) {
    if (seen.has(it.inventoryId)) continue
    seen.add(it.inventoryId)
    const m = toProgress(it.inventoryId)
    m.queue_hint = 'memory_fifo'
    m.queue_hint_vi = 'Đầu hàng chờ RAM của process này (ưu tiên trước scheduler DB).'
    upcoming.push(m)
  }
  for (const id of dbDue) {
    if (seen.has(id)) continue
    seen.add(id)
    const m = toProgress(id)
    m.queue_hint = 'db_due_next'
    m.queue_hint_vi = 'Dự kiến lần «claim» từ DB nếu hàng chờ RAM trống.'
    upcoming.push(m)
  }

  let productsCommitAudit: SourceStockWorkerState['products_commit_audit'] = null
  if (row.last_products_commit_at) {
    productsCommitAudit = {
      ok: row.last_products_commit_ok,
      at_utc_iso: utcIso(row.last_products_commit_at),
      detail: (row.last_products_commit_detail || '').trim() || null,
      product_db_id: row.last_done_inventory_id,
      consistency_hint_vi: null,
    }
    if (row.last_products_commit_ok === false) {
      productsCommitAudit.consistency_hint_vi =
        'Audit: lần scrape gần nhất không xác nhận được commit bảng kho — xem detail.'
    } else if (row.last_products_commit_ok === true && row.last_done_inventory_id) {
      const pr = mins.get(row.last_done_inventory_id)
      if (!pr) {
        productsCommitAudit.consistency_hint_vi = `Đối chiếu DB: không còn inventory.id=${row.last_done_inventory_id}.`
      } else if (!pr.source_stock_checked_at) {
        productsCommitAudit.consistency_hint_vi =
          `Đối chiếu DB: inventory.id=${row.last_done_inventory_id} có source_stock_checked_at = NULL — lệch với audit commit OK.`
      } else {
        productsCommitAudit.consistency_hint_vi = `Đối chiếu DB: khớp inventory.id=${row.last_done_inventory_id} (status + checked_at).`
      }
    }
  }

  return {
    env_source_stock_check_enabled: envOn,
    db_paused: paused,
    db_pause_updated_at_utc_iso: utcIso(row.updated_at),
    daemon_thread_started_flag: daemonStarted,
    daemon_thread_alive: daemonAlive,
    process_in_memory_queue_depth: depth,
    check_interval_seconds: sourceStockCheckIntervalSeconds(),
    effective_idle_reason: idle,
    effective_idle_hint_vi: reasonVi || null,
    deployment_notes_vi:
      'Mỗi process Node (PM2) có vòng worker và hàng chờ RAM riêng; cờ pause lưu DB theo workspace. Cron /api/cron/source-stock-check khởi động lại daemon sau restart.',
    checking,
    last_completed: lastCompleted,
    next_upcoming_primary: upcoming[0] ?? null,
    upcoming_candidates: upcoming.slice(0, 10),
    products_commit_audit: productsCommitAudit,
    progress_notes_vi:
      '«Đang scrape» và «Vừa xong» ghi vào DB (chia sẻ giữa mọi process). «Sắp tới» ưu tiên FIFO RAM process này, rồi SP đến hạn trong DB.',
  }
}

export async function setSourceStockPaused(partnerId: string, paused: boolean): Promise<SourceStockWorkerState> {
  await setSourceStockWorkerPausedFromPg(partnerId, paused)
  if (!paused) ensureSourceStockDaemon()
  return getSourceStockWorkerAdminSnapshot(partnerId)
}

void daemonPromise

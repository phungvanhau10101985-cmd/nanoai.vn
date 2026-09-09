import { randomUUID } from 'node:crypto'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import {
  deleteListingImportQueueFromPg,
  isListingImportQueueRevokedFromPg,
  listListingImportQueueSummariesFromPg,
  listListingImportQueuesNeedingResumeFromPg,
  loadListingImportQueueFromPg,
  saveListingImportQueueFromPg,
} from '@/lib/db/messaging-partner-listing-import-pg'
import { executeOneListingImport } from '@/lib/messaging/listing-import/execute-one'
import { inferListingImportSource } from '@/lib/messaging/listing-import/listing-import-urls'
import {
  countsFromListingItems,
  listingImportQueueTokenOk,
  newListingImportQueueSkeleton,
  type ListingImportEnqueueItem,
  type ListingImportQueueItem,
  type ListingImportQueuePayload,
  type ListingImportQueueStatus,
} from '@/lib/messaging/listing-import/listing-import-types'

const workerRegistry = new Map<string, Promise<void>>()
const lockTails = new Map<string, Promise<void>>()

function workerKey(partnerId: string, token: string): string {
  return `${partnerId}:${token}`
}

async function withQueueLock<T>(partnerId: string, token: string, fn: () => Promise<T>): Promise<T> {
  const key = workerKey(partnerId, token)
  const prev = lockTails.get(key) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  const chained = prev.then(() => next)
  lockTails.set(key, chained)
  await prev.catch(() => undefined)
  try {
    if (!isPgConfigured()) return await fn()
    const client = await getPgPool().connect()
    try {
      await client.query('begin')
      await client.query('select pg_advisory_xact_lock(hashtext($1), hashtext($2))', [partnerId, token])
      const result = await fn()
      await client.query('commit')
      return result
    } catch (e) {
      try {
        await client.query('rollback')
      } catch {
        /* ignore */
      }
      throw e
    } finally {
      client.release()
    }
  } finally {
    release()
    if (lockTails.get(key) === chained) lockTails.delete(key)
  }
}

export function listingImportWorkerAlive(partnerId: string, token: string): boolean {
  return workerRegistry.has(workerKey(partnerId, token))
}

function reconcileQueueAfterWorkerLoss(q: ListingImportQueuePayload, alive: boolean): boolean {
  if (alive) return false
  if (q.stop_requested || q.run_status === 'stopped') return false
  let changed = false
  const stale = 'Link dừng giữa chừng (restart server) — chờ chạy lại.'
  for (const it of q.items) {
    if (it.state !== 'running') continue
    it.state = 'pending'
    const prev = (it.message || '').trim()
    it.message = prev && !prev.toLowerCase().includes('restart server') ? `${prev} · ${stale}` : stale
    changed = true
  }
  if (q.current_item_id) {
    q.current_item_id = null
    changed = true
  }
  const hasPending = q.items.some((it) => it.state === 'pending')
  const hasRunning = q.items.some((it) => it.state === 'running')
  if (hasPending && !hasRunning && (q.run_status === 'running' || q.run_status === 'pausing')) {
    q.run_status = 'paused'
    if (!(q.worker_error || '').trim()) {
      q.worker_error = 'Worker dừng (restart process). Bấm Tiếp tục để chạy nốt.'
    }
    changed = true
  }
  return changed
}

async function loadQueue(partnerId: string, token: string): Promise<ListingImportQueuePayload | null> {
  if (await isListingImportQueueRevokedFromPg(partnerId, token)) return null
  return loadListingImportQueueFromPg(partnerId, token)
}

async function saveQueue(
  partnerId: string,
  q: ListingImportQueuePayload
): Promise<boolean> {
  if (await isListingImportQueueRevokedFromPg(partnerId, tokenOf(q))) return false
  return saveListingImportQueueFromPg(partnerId, q, q.created_by)
}

function tokenOf(q: ListingImportQueuePayload): string {
  return q.queue_token
}

function overlayFromItem(it: ListingImportQueueItem): Record<string, unknown> {
  const overlay: Record<string, unknown> = {}
  if (it.chinese_name) overlay.chinese_name = it.chinese_name
  if (it.shop_name_chinese) overlay.shop_name_chinese = it.shop_name_chinese
  if (it.price != null) overlay.price = it.price
  if (it.pro_lower_price) overlay.pro_lower_price = it.pro_lower_price
  if (it.pro_high_price) overlay.pro_high_price = it.pro_high_price
  return overlay
}

async function workerLoop(partnerId: string, token: string): Promise<void> {
  while (true) {
    const next = await withQueueLock(partnerId, token, async () => {
      const q = await loadQueue(partnerId, token)
      if (!q) return null
      if (q.stop_requested) {
        q.run_status = 'stopped'
        q.current_item_id = null
        await saveQueue(partnerId, q)
        return null
      }
      if (q.pause_requested) {
        q.run_status = 'paused'
        q.current_item_id = null
        await saveQueue(partnerId, q)
        return null
      }
      const pending = q.items.find((it) => it.state === 'pending')
      if (!pending) {
        q.run_status = 'completed'
        q.current_item_id = null
        await saveQueue(partnerId, q)
        return null
      }
      pending.state = 'running'
      q.run_status = 'running'
      q.current_item_id = pending.id
      q.worker_error = null
      await saveQueue(partnerId, q)
      return pending
    })
    if (!next) return

    let out: Awaited<ReturnType<typeof executeOneListingImport>>
    try {
      out = await executeOneListingImport({
        partnerId,
        url: next.url,
        source: next.source,
        overlay: overlayFromItem(next),
      })
    } catch (e) {
      out = { ok: false, error: e instanceof Error ? e.message : String(e) }
    }

    await withQueueLock(partnerId, token, async () => {
      const q = await loadQueue(partnerId, token)
      if (!q) return
      const target = q.items.find((it) => it.id === next.id)
      if (target) {
        target.state = out.ok ? 'done' : 'error'
        target.job_id = out.job_id || null
        target.draft_id = out.draft_id || null
        target.message = out.ok ? out.message || 'OK' : out.error || out.message || 'Lỗi'
        target.finished_at = new Date().toISOString()
      }
      q.current_item_id = null
      await saveQueue(partnerId, q)
    })

    const flags = await withQueueLock(partnerId, token, async () => {
      const q = await loadQueue(partnerId, token)
      if (!q) return 'gone' as const
      if (q.stop_requested) {
        q.run_status = 'stopped'
        await saveQueue(partnerId, q)
        return 'stop' as const
      }
      if (q.pause_requested) {
        q.run_status = 'paused'
        await saveQueue(partnerId, q)
        return 'pause' as const
      }
      return 'continue' as const
    })
    if (flags !== 'continue') return
  }
}

export function ensureListingImportWorker(partnerId: string, token: string): boolean {
  if (!listingImportQueueTokenOk(token)) return false
  const key = workerKey(partnerId, token)
  const existing = workerRegistry.get(key)
  if (existing) return true
  const run = workerLoop(partnerId, token).finally(() => {
    if (workerRegistry.get(key) === run) workerRegistry.delete(key)
  })
  workerRegistry.set(key, run)
  void run
  return true
}

export async function enqueueListingImport(
  partnerId: string,
  queueToken: string | null | undefined,
  tasks: ListingImportEnqueueItem[],
  createdBy?: string | null
): Promise<{ queue_token: string; added: number; message: string }> {
  if (!tasks.length) throw new Error('Không có link nào để thêm.')
  let token: string | null = null
  if (queueToken && listingImportQueueTokenOk(queueToken)) {
    const ex = await loadQueue(partnerId, queueToken)
    if (ex && ex.run_status !== 'stopped' && !ex.stop_requested) token = queueToken
  }

  let added = 0
  let finalToken = ''
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let pendingSk: ListingImportQueuePayload | null = null
    if (!token) {
      pendingSk = newListingImportQueueSkeleton(createdBy)
      token = pendingSk.queue_token
    }
    const result = await withQueueLock(partnerId, token, async () => {
      let q = await loadQueue(partnerId, token!)
      if (!q) {
        if (!pendingSk) return { retry: true as const }
        q = pendingSk
      }
      if (q.run_status === 'stopped' || q.stop_requested) {
        return { retry: true as const }
      }
      let n = 0
      for (const raw of tasks) {
        const url = (raw.url || '').trim()
        if (url.length < 10) continue
        const src = inferListingImportSource(url, raw.source)
        const priceRaw = raw.price
        let price: number | null = null
        if (priceRaw != null) {
          const p = Number(priceRaw)
          if (Number.isFinite(p) && p > 0) price = p
        }
        q.items.push({
          id: randomUUID().replace(/-/g, ''),
          url,
          source: src,
          label: (raw.label || '').trim() || null,
          chinese_name: String(raw.chinese_name || '').trim() || null,
          shop_name_chinese: String(raw.shop_name_chinese || '').trim() || null,
          price,
          pro_lower_price: String(raw.pro_lower_price || '').trim() || null,
          pro_high_price: String(raw.pro_high_price || '').trim() || null,
          state: 'pending',
          job_id: null,
          draft_id: null,
          message: null,
          finished_at: null,
        })
        n += 1
      }
      if (n === 0) throw new Error('Không có link hợp lệ (URL quá ngắn).')
      await saveQueue(partnerId, q)
      return { retry: false as const, token: q.queue_token, added: n }
    })
    if (result.retry) {
      token = null
      continue
    }
    added = result.added
    finalToken = result.token
    break
  }

  try {
    await resumeListingImport(partnerId, finalToken)
  } catch (e) {
    console.warn('[listing-import enqueue resume]', e)
  }
  return { queue_token: finalToken, added, message: `Đã thêm ${added} link vào hàng đợi.` }
}

export async function pauseListingImport(partnerId: string, token: string): Promise<{ queue_token: string; message: string }> {
  if (!listingImportQueueTokenOk(token)) throw new Error('queue_token không hợp lệ.')
  await withQueueLock(partnerId, token, async () => {
    const q = await loadQueue(partnerId, token)
    if (!q) throw new Error('Không tìm thấy hàng đợi.')
    q.pause_requested = true
    await saveQueue(partnerId, q)
  })
  return { queue_token: token, message: 'Đã yêu cầu tạm dừng sau job hiện tại.' }
}

export async function resumeListingImport(partnerId: string, token: string): Promise<{ queue_token: string; message: string }> {
  if (!listingImportQueueTokenOk(token)) throw new Error('queue_token không hợp lệ.')
  await withQueueLock(partnerId, token, async () => {
    const q = await loadQueue(partnerId, token)
    if (!q) throw new Error('Không tìm thấy hàng đợi.')
    if (q.run_status === 'stopped' || q.stop_requested) {
      throw new Error('Hàng đợi đã dừng hẳn — không thể chạy lại. Hãy thêm link để tạo hàng đợi mới.')
    }
    reconcileQueueAfterWorkerLoss(q, listingImportWorkerAlive(partnerId, token))
    q.pause_requested = false
    q.worker_error = null
    const hasPending = q.items.some((it) => it.state === 'pending')
    if (hasPending && ['paused', 'idle', 'completed', 'running', 'pausing'].includes(q.run_status)) {
      q.run_status = 'running'
    }
    await saveQueue(partnerId, q)
  })
  ensureListingImportWorker(partnerId, token)
  return { queue_token: token, message: 'Đã tiếp tục / khởi chạy worker.' }
}

export async function stopListingImport(partnerId: string, token: string): Promise<{ queue_token: string; message: string }> {
  if (!listingImportQueueTokenOk(token)) throw new Error('queue_token không hợp lệ.')
  await withQueueLock(partnerId, token, async () => {
    const q = await loadQueue(partnerId, token)
    if (!q) throw new Error('Không tìm thấy hàng đợi.')
    q.stop_requested = true
    q.pause_requested = false
    if (['idle', 'paused', 'completed'].includes(q.run_status)) {
      q.run_status = 'stopped'
      q.current_item_id = null
    }
    await saveQueue(partnerId, q)
  })
  return { queue_token: token, message: 'Đã yêu cầu dừng hẳn sau job hiện tại — không thể resume.' }
}

export async function getListingImportStatus(
  partnerId: string,
  token: string
): Promise<ListingImportQueueStatus> {
  if (!listingImportQueueTokenOk(token)) throw new Error('queue_token không hợp lệ.')
  await withQueueLock(partnerId, token, async () => {
    const q = await loadQueue(partnerId, token)
    if (!q) throw new Error('Không tìm thấy hàng đợi.')
    if (reconcileQueueAfterWorkerLoss(q, listingImportWorkerAlive(partnerId, token))) {
      await saveQueue(partnerId, q)
    }
  })
  const q = await loadQueue(partnerId, token)
  if (!q) throw new Error('Không tìm thấy hàng đợi.')
  const counts = countsFromListingItems(q.items)
  const workerAlive = listingImportWorkerAlive(partnerId, token)
  const hasPending = counts.pending > 0
  return {
    queue_token: q.queue_token,
    created_at: q.created_at,
    updated_at: q.updated_at,
    run_status: q.run_status,
    pause_requested: Boolean(q.pause_requested),
    stop_requested: Boolean(q.stop_requested),
    worker_alive: workerAlive,
    worker_error: q.worker_error,
    current_item_id: q.current_item_id,
    counts,
    items: q.items,
    can_resume: Boolean(
      !q.stop_requested &&
        hasPending &&
        q.run_status !== 'stopped' &&
        (q.run_status === 'paused' || (!workerAlive && ['running', 'pausing', 'idle'].includes(q.run_status)))
    ),
    can_pause:
      q.run_status === 'running' && workerAlive && !q.pause_requested && !q.stop_requested,
    can_stop: !q.stop_requested && q.run_status !== 'stopped',
  }
}

export async function listListingImportRuns(
  partnerId: string,
  opts?: { limit?: number; offset?: number }
) {
  const data = await listListingImportQueueSummariesFromPg(partnerId, opts)
  return {
    ...data,
    items: data.items.map((it) => ({
      ...it,
      worker_alive: listingImportWorkerAlive(partnerId, it.queue_token),
    })),
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
  }
}

export async function deleteListingImportQueue(partnerId: string, token: string) {
  if (!listingImportQueueTokenOk(token)) throw new Error('queue_token không hợp lệ.')
  const ok = await deleteListingImportQueueFromPg(partnerId, token)
  if (!ok) throw new Error('Không xóa được hàng đợi trên DB.')
  return { queue_token: token, deleted: true }
}

export function collectTerminalDraftIdsFromQueue(q: ListingImportQueuePayload): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const it of q.items) {
    if (it.state !== 'done' && it.state !== 'error') continue
    const did = String(it.draft_id || '').trim()
    if (!did || seen.has(did)) continue
    seen.add(did)
    out.push(did)
  }
  return out
}

export async function exportListingImportSnapshotCsv(
  partnerId: string,
  token: string,
  finishedOnly: boolean
): Promise<string> {
  const st = await getListingImportStatus(partnerId, token)
  let items = st.items
  if (finishedOnly) items = items.filter((it) => it.state === 'done' || it.state === 'error')
  const lines = ['label,url,source,state,job_id,draft_id,finished_at,message']
  for (const it of items) {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    lines.push(
      [
        cell(it.label),
        cell(it.url),
        cell(it.source),
        cell(it.state),
        cell(it.job_id),
        cell(it.draft_id),
        cell(it.finished_at),
        cell(it.message),
      ].join(',')
    )
  }
  return `${lines.join('\r\n')}\r\n`
}

export async function resumeListingImportQueuesAfterRestart(): Promise<{ resumed: number }> {
  const rows = await listListingImportQueuesNeedingResumeFromPg()
  let resumed = 0
  for (const row of rows) {
    if (listingImportWorkerAlive(row.partnerId, row.queueToken)) continue
    try {
      await resumeListingImport(row.partnerId, row.queueToken)
      resumed += 1
    } catch (e) {
      console.warn('[listing-import auto-resume]', row.queueToken, e)
    }
  }
  return { resumed }
}

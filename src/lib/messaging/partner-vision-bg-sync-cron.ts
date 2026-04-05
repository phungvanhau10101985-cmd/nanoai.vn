import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  VISION_BG_SYNC_REPORT_MESSAGE,
  VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR,
} from '@/lib/messaging/partner-vision-constants'
import { defaultVisionCatalogBgSyncMaxWallMs } from '@/lib/messaging/partner-vision-server-config'
import { runVisionCatalogSync } from '@/lib/messaging/partner-vision-product-search'
import { kickVisionWarehouseReindexIfPending } from '@/lib/messaging/partner-vision-warehouse-runner'

type Db = SupabaseClient<Database>
type AiRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

export type VisionBgSyncReportPayload = {
  completed: boolean
  totalRounds: number
  totalImported: number
  totalRemoved: number
  hasMore?: boolean
  lastScannedId?: string | null
  /** completed + error */
  stoppedReason?: 'completed' | 'error' | 'cron_slice' | 'bad_cursor'
  message?: string
  errorDetail?: string
  cronSliceAt?: string
}

const DEFAULT_MAX_PARTNERS = 2
const DEFAULT_MAX_ROUNDS_PER_PARTNER = 35
/** Quá ngưỡng này mà lock còn giữ => coi là treo và tự nhả. */
const AUTO_UNLOCK_IMPORT_LOCK_AFTER_SECONDS = 3 * 60

function reportJson(r: VisionBgSyncReportPayload): string {
  return JSON.stringify(r)
}

/** @returns null nếu OK, chuỗi lỗi nếu update DB thất bại */
async function persistJob(
  db: Db,
  partnerId: string,
  patch: Partial<{
    vision_bg_sync_status: string
    vision_bg_sync_resume_after_id: string | null
    vision_bg_sync_rounds: number
    vision_bg_sync_imported: number
    vision_bg_sync_removed: number
    vision_bg_sync_started_at: string | null
    vision_bg_sync_finished_at: string | null
    vision_bg_sync_error: string
    vision_bg_sync_report: string
    updated_at: string
  }>
): Promise<string | null> {
  const now = new Date().toISOString()
  const { error } = await db
    .from('messaging_partner_ai_settings')
    .update({ ...patch, updated_at: now })
    .eq('partner_id', partnerId)
  if (error) {
    console.error('[vision-bg-sync-cron] persistJob', partnerId, error.message)
    return error.message
  }
  return null
}

/**
 * Tự cứu lock import bị treo quá lâu (worker chết/timeout giữa chừng).
 * Không cần thao tác tay SQL khi `assets_import_busy` bị giữ quá ngưỡng.
 */
async function autoUnlockStaleVisionImportLock(
  db: Db,
  staleSeconds = AUTO_UNLOCK_IMPORT_LOCK_AFTER_SECONDS
): Promise<void> {
  const cutoffIso = new Date(Date.now() - staleSeconds * 1000).toISOString()
  const now = new Date().toISOString()

  // Case 1: busy=true nhưng busy_at cũ hơn ngưỡng.
  const { data: staleRow, error: staleErr } = await db
    .from('vision_warehouse_runner')
    .update({
      assets_import_busy: false,
      assets_import_busy_at: null,
      assets_import_owner: null,
      assets_import_heartbeat_at: null,
      updated_at: now,
    })
    .eq('id', 1)
    .eq('assets_import_busy', true)
    .lt('assets_import_busy_at', cutoffIso)
    .select('id')
    .maybeSingle()
  if (staleErr) {
    console.error('[vision-bg-sync-cron] auto-unlock stale lock', staleErr.message)
  } else if (staleRow) {
    console.warn('[vision-bg-sync-cron] auto-unlocked stale import lock', { staleSeconds })
  }

  // Case 2: busy=true nhưng thiếu timestamp (state không nhất quán) => cũng nhả.
  const { data: nullTsRow, error: nullTsErr } = await db
    .from('vision_warehouse_runner')
    .update({
      assets_import_busy: false,
      assets_import_busy_at: null,
      assets_import_owner: null,
      assets_import_heartbeat_at: null,
      updated_at: now,
    })
    .eq('id', 1)
    .eq('assets_import_busy', true)
    .is('assets_import_busy_at', null)
    .select('id')
    .maybeSingle()
  if (nullTsErr) {
    console.error('[vision-bg-sync-cron] auto-unlock null-ts lock', nullTsErr.message)
  } else if (nullTsRow) {
    console.warn('[vision-bg-sync-cron] auto-unlocked inconsistent import lock')
  }

  // Case 3: busy=true, busy_at mới nhưng heartbeat đã stale => owner đã chết.
  const { data: staleHeartbeatRow, error: staleHeartbeatErr } = await db
    .from('vision_warehouse_runner')
    .update({
      assets_import_busy: false,
      assets_import_busy_at: null,
      assets_import_owner: null,
      assets_import_heartbeat_at: null,
      updated_at: now,
    })
    .eq('id', 1)
    .eq('assets_import_busy', true)
    .lt('assets_import_heartbeat_at', cutoffIso)
    .select('id')
    .maybeSingle()
  if (staleHeartbeatErr) {
    console.error('[vision-bg-sync-cron] auto-unlock stale heartbeat', staleHeartbeatErr.message)
  } else if (staleHeartbeatRow) {
    console.warn('[vision-bg-sync-cron] auto-unlocked stale heartbeat import lock', { staleSeconds })
  }
}

/**
 * Cron VPS: xử lý job đồng bộ Vision đang queued/running.
 * Mỗi lần gọi chạy tối đa vài partner × vài chục lượt trong giới hạn thời gian (tránh vượt maxDuration).
 */
export async function processVisionCatalogBackgroundSyncJobs(
  db: Db,
  opts?: {
    maxWallMs?: number
    maxPartners?: number
    maxRoundsPerPartner?: number
    /** Chỉ xử lý shop này (dùng cho POST run-once theo partner). */
    onlyPartnerId?: string
  }
): Promise<{ partnersTouched: number; roundsExecuted: number; errors: string[] }> {
  await autoUnlockStaleVisionImportLock(db)

  const maxWallMs = opts?.maxWallMs ?? defaultVisionCatalogBgSyncMaxWallMs()
  const maxPartners = opts?.maxPartners ?? DEFAULT_MAX_PARTNERS
  const maxRoundsPerPartner = opts?.maxRoundsPerPartner ?? DEFAULT_MAX_ROUNDS_PER_PARTNER

  let jobQuery = db
    .from('messaging_partner_ai_settings')
    .select('partner_id')
    .eq('vision_product_search_enabled', true)
    .in('vision_bg_sync_status', ['queued', 'running'])
  const only = opts?.onlyPartnerId?.trim()
  if (only) jobQuery = jobQuery.eq('partner_id', only)

  const { data: jobs, error: qErr } = await jobQuery
    .order('vision_bg_sync_started_at', { ascending: true, nullsFirst: true })
    .limit(maxPartners)

  if (qErr) {
    return { partnersTouched: 0, roundsExecuted: 0, errors: [qErr.message] }
  }

  let partnersTouched = 0
  let roundsExecuted = 0
  const errors: string[] = []

  for (const j of jobs ?? []) {
    const partnerId = j.partner_id
    const partnerStart = Date.now()

    const { data: row, error: rowErr } = await db
      .from('messaging_partner_ai_settings')
      .select('*')
      .eq('partner_id', partnerId)
      .maybeSingle()

    if (rowErr || !row) {
      errors.push(rowErr?.message || `missing settings ${partnerId}`)
      continue
    }

    const r = row as AiRow
    if (!r.vision_product_search_enabled) continue
    if (r.vision_bg_sync_status !== 'queued' && r.vision_bg_sync_status !== 'running') continue

    if (r.vision_bg_sync_status === 'queued') {
      const startErr = await persistJob(db, partnerId, {
        vision_bg_sync_status: 'running',
        vision_bg_sync_started_at: r.vision_bg_sync_started_at ?? new Date().toISOString(),
        vision_bg_sync_error: '',
      })
      if (startErr) {
        errors.push(`${partnerId}: start: ${startErr}`)
        continue
      }
    }

    partnersTouched += 1

    let resume: string | null = r.vision_bg_sync_resume_after_id?.trim() || null
    let roundsTotal = r.vision_bg_sync_rounds ?? 0
    let impTotal = r.vision_bg_sync_imported ?? 0
    let remTotal = r.vision_bg_sync_removed ?? 0
    let roundsThisSlice = 0
    let lastHasMore = false
    let lastScanned: string | null = null

    const settings = r

    try {
      while (
        Date.now() - partnerStart < maxWallMs &&
        roundsThisSlice < maxRoundsPerPartner
      ) {
        const syncResult = await runVisionCatalogSync(db, partnerId, settings, {
          resumeAfterId: resume,
        })

        if ('error' in syncResult) {
          const msg = syncResult.error
          /** Google chỉ 1 ImportAssets / corpus — 429 tạm thời: giữ job running, cron sau thử lại. */
          const transientImport429 =
            /Too many ImportAssets/i.test(msg) ||
            (/429/.test(msg) && /ImportAssets|RESOURCE_EXHAUSTED/i.test(msg))
          /** Poll hết giờ nhưng operation có thể vẫn chạy phía Google — không đánh dấu error; lượt sau thử lại (hoặc tăng VISION_WAREHOUSE_ASSETS_IMPORT_POLL_MAX_MS / giảm batch). */
          const transientImportPollTimeout = /Vision AI operation timeout/i.test(msg)
          /** Khóa import đang bận (cron/tab khác) — giữ running để cron sau nhặt tiếp. */
          const transientImportLockBusy =
            /Vision Warehouse: corpus đang bị giữ bởi lượt import khác/i.test(msg) ||
            /Vision import lock/i.test(msg)

          if (transientImport429 || transientImportPollTimeout || transientImportLockBusy) {
            const persistErr = await persistJob(db, partnerId, {
              vision_bg_sync_status: 'running',
              vision_bg_sync_resume_after_id: resume,
              vision_bg_sync_rounds: roundsTotal,
              vision_bg_sync_imported: impTotal,
              vision_bg_sync_removed: remTotal,
              vision_bg_sync_error: '',
              vision_bg_sync_report: reportJson({
                completed: false,
                totalRounds: roundsTotal,
                totalImported: impTotal,
                totalRemoved: remTotal,
                hasMore: true,
                lastScannedId: resume,
                stoppedReason: 'cron_slice',
                message: VISION_BG_SYNC_REPORT_MESSAGE.inProgress,
                errorDetail: msg.slice(0, 800),
              }),
            })
            if (persistErr) errors.push(`${partnerId}: persist import-429: ${persistErr}`)
            break
          }

          const persistErr = await persistJob(db, partnerId, {
            vision_bg_sync_status: 'error',
            vision_bg_sync_finished_at: new Date().toISOString(),
            vision_bg_sync_error: msg.slice(0, 4000),
            vision_bg_sync_report: reportJson({
              completed: false,
              totalRounds: roundsTotal,
              totalImported: impTotal,
              totalRemoved: remTotal,
              hasMore: true,
              stoppedReason: 'error',
              errorDetail: msg,
              message: msg,
            }),
          })
          errors.push(`${partnerId}: ${msg}`)
          if (persistErr) errors.push(`${partnerId}: persist error state: ${persistErr}`)
          break
        }

        roundsThisSlice += 1
        roundsExecuted += 1
        roundsTotal += 1
        impTotal += syncResult.imported ?? 0
        remTotal += syncResult.removed ?? 0
        lastHasMore = Boolean(syncResult.hasMore)
        lastScanned = syncResult.lastScannedId ?? null

        if (!lastHasMore) {
          const persistErr = await persistJob(db, partnerId, {
            vision_bg_sync_status: 'done',
            vision_bg_sync_resume_after_id: null,
            vision_bg_sync_rounds: roundsTotal,
            vision_bg_sync_imported: impTotal,
            vision_bg_sync_removed: remTotal,
            vision_bg_sync_finished_at: new Date().toISOString(),
            vision_bg_sync_error: '',
            vision_bg_sync_report: reportJson({
              completed: true,
              totalRounds: roundsTotal,
              totalImported: impTotal,
              totalRemoved: remTotal,
              hasMore: false,
              lastScannedId: lastScanned,
              stoppedReason: 'completed',
              message: VISION_BG_SYNC_REPORT_MESSAGE.completed,
            }),
          })
          if (persistErr) errors.push(`${partnerId}: persist done: ${persistErr}`)
          try {
            await kickVisionWarehouseReindexIfPending(db, { errorScopePartnerId: partnerId })
          } catch (e) {
            console.error('[vision-bg-sync-cron] reindex kick', partnerId, e)
          }
          break
        }

        const nextResume = lastScanned?.trim() || null
        if (!nextResume) {
          const persistErr = await persistJob(db, partnerId, {
            vision_bg_sync_status: 'error',
            vision_bg_sync_finished_at: new Date().toISOString(),
            vision_bg_sync_error: VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR,
            vision_bg_sync_report: reportJson({
              completed: false,
              totalRounds: roundsTotal,
              totalImported: impTotal,
              totalRemoved: remTotal,
              hasMore: true,
              stoppedReason: 'bad_cursor',
              message: VISION_BG_SYNC_REPORT_MESSAGE.badCursor,
            }),
          })
          errors.push(`${partnerId}: bad cursor`)
          if (persistErr) errors.push(`${partnerId}: persist bad_cursor: ${persistErr}`)
          break
        }

        resume = nextResume

        const sliceErr = await persistJob(db, partnerId, {
          vision_bg_sync_status: 'running',
          vision_bg_sync_resume_after_id: nextResume,
          vision_bg_sync_rounds: roundsTotal,
          vision_bg_sync_imported: impTotal,
          vision_bg_sync_removed: remTotal,
          vision_bg_sync_report: reportJson({
            completed: false,
            totalRounds: roundsTotal,
            totalImported: impTotal,
            totalRemoved: remTotal,
            hasMore: true,
            lastScannedId: nextResume,
            stoppedReason: 'cron_slice',
            message: VISION_BG_SYNC_REPORT_MESSAGE.inProgress,
            cronSliceAt: new Date().toISOString(),
          }),
        })
        if (sliceErr) {
          errors.push(`${partnerId}: persist progress: ${sliceErr}`)
          break
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const persistErr = await persistJob(db, partnerId, {
        vision_bg_sync_status: 'error',
        vision_bg_sync_finished_at: new Date().toISOString(),
        vision_bg_sync_error: msg.slice(0, 4000),
        vision_bg_sync_report: reportJson({
          completed: false,
          totalRounds: roundsTotal,
          totalImported: impTotal,
          totalRemoved: remTotal,
          stoppedReason: 'error',
          errorDetail: msg,
          message: msg,
        }),
      })
      errors.push(`${partnerId}: ${msg}`)
      if (persistErr) errors.push(`${partnerId}: persist exception state: ${persistErr}`)
    }
  }

  return { partnersTouched, roundsExecuted, errors }
}

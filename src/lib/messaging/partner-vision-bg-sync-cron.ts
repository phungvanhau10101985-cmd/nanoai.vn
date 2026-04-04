import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  VISION_BG_SYNC_REPORT_MESSAGE,
  VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR,
} from '@/lib/messaging/partner-vision-constants'
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

const DEFAULT_MAX_WALL_MS = 270_000
const DEFAULT_MAX_PARTNERS = 2
const DEFAULT_MAX_ROUNDS_PER_PARTNER = 35

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
 * Cron VPS: xử lý job đồng bộ Vision đang queued/running.
 * Mỗi lần gọi chạy tối đa vài partner × vài chục lượt trong giới hạn thời gian (tránh vượt maxDuration).
 */
export async function processVisionCatalogBackgroundSyncJobs(
  db: Db,
  opts?: {
    maxWallMs?: number
    maxPartners?: number
    maxRoundsPerPartner?: number
  }
): Promise<{ partnersTouched: number; roundsExecuted: number; errors: string[] }> {
  const maxWallMs = opts?.maxWallMs ?? DEFAULT_MAX_WALL_MS
  const maxPartners = opts?.maxPartners ?? DEFAULT_MAX_PARTNERS
  const maxRoundsPerPartner = opts?.maxRoundsPerPartner ?? DEFAULT_MAX_ROUNDS_PER_PARTNER

  const { data: jobs, error: qErr } = await db
    .from('messaging_partner_ai_settings')
    .select('partner_id')
    .eq('vision_product_search_enabled', true)
    .in('vision_bg_sync_status', ['queued', 'running'])
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

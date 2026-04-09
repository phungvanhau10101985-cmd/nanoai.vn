import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

export type WorksheetJobClaimRowPg = {
  id: string
  user_id: string
  type: string
  params: Record<string, unknown>
}

/** Lấy 1 job pending → processing (SKIP LOCKED, an toàn đa worker). */
export async function claimNextWorksheetJobPg(): Promise<WorksheetJobClaimRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const pool = getPgPool()
    const res = await pool.query<{
      id: string
      user_id: string
      type: string
      params: unknown
    }>(
      `with picked as (
         select id from public.worksheet_jobs
         where status = 'pending'
         order by created_at asc
         for update skip locked
         limit 1
       )
       update public.worksheet_jobs j
       set status = 'processing',
           processing_started_at = timezone('utc'::text, now()),
           updated_at = timezone('utc'::text, now())
       from picked
       where j.id = picked.id
       returning j.id::text, j.user_id::text, j.type::text, j.params`,
      []
    )
    const row = res.rows[0]
    if (!row) return null
    const p = row.params
    const paramsObj =
      p && typeof p === 'object' && !Array.isArray(p) ? (p as Record<string, unknown>) : {}
    return {
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      params: paramsObj,
    }
  } catch (e) {
    console.error('[worksheet-jobs-pg] claimNextWorksheetJobPg', e)
    return null
  }
}

export async function updateWorksheetJobCompletedPg(
  jobId: string,
  result: unknown
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_jobs
       set status = 'completed',
           result = $2::jsonb,
           error_message = null,
           updated_at = timezone('utc'::text, now())
       where id = $1::uuid`,
      [jobId, JSON.stringify(result ?? null)]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-jobs-pg] updateWorksheetJobCompletedPg', e)
    return false
  }
}

export async function updateWorksheetJobFailedPg(jobId: string, errorMessage: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_jobs
       set status = 'failed',
           error_message = $2,
           updated_at = timezone('utc'::text, now())
       where id = $1::uuid`,
      [jobId, errorMessage.slice(0, 8000)]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-jobs-pg] updateWorksheetJobFailedPg', e)
    return false
  }
}

export async function markStaleWorksheetJobsProcessingPg(
  cutoffIso: string,
  timeoutMessage: string
): Promise<Array<{ id: string; user_id: string; type: string }>> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ id: string; user_id: string; type: string }>(
      `update public.worksheet_jobs
       set status = 'failed',
           error_message = $2,
           updated_at = timezone('utc'::text, now())
       where status = 'processing'
         and processing_started_at is not null
         and processing_started_at < $1::timestamptz
       returning id::text, user_id::text, type::text`,
      [cutoffIso, timeoutMessage.slice(0, 2000)]
    )
    return rows.map((r) => ({ id: r.id, user_id: r.user_id, type: r.type }))
  } catch (e) {
    console.error('[worksheet-jobs-pg] markStaleWorksheetJobsProcessingPg', e)
    return []
  }
}

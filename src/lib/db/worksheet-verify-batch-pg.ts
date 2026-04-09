import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/** Giống RPC get_worksheet_ids_pending_verify — phiếu có câu chưa verified_at. */
export async function fetchPendingWorksheetIdsPg(): Promise<Array<{ id: string; topic: string }> | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ id: string; topic: string }>(
      `select w.id::text, coalesce(w.topic, '')::text as topic
       from public.worksheet_worksheets w
       where w.question_ids is not null
         and cardinality(w.question_ids) > 0
         and exists (
           select 1 from public.worksheet_questions q
           where q.id = any (w.question_ids) and q.verified_at is null
         )
       order by w.created_at asc nulls last`,
      []
    )
    return rows.map((r) => ({ id: r.id, topic: r.topic ?? '' }))
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] fetchPendingWorksheetIdsPg', e)
    return null
  }
}

export type WorksheetVerifyBatchReportRowPg = Record<string, unknown>

export async function fetchWorksheetVerifyBatchReportByIdPg(
  id: string
): Promise<WorksheetVerifyBatchReportRowPg | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, created_at, updated_at, finished_at, status::text, triggered_by::text,
              worksheets_planned, worksheets_processed, questions_marked_verified, questions_content_updated,
              questions_skipped_invalid, error_summary::text, progress, details
       from public.worksheet_verify_batch_reports where id = $1::uuid limit 1`,
      [id]
    )
    const r = rows[0]
    if (!r) return null
    return {
      ...r,
      id: String(r.id),
      status: String(r.status ?? ''),
      triggered_by: r.triggered_by != null ? String(r.triggered_by) : null,
    }
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] fetchWorksheetVerifyBatchReportByIdPg', e)
    return null
  }
}

/** Báo cáo đang chạy (cron tiếp tục step). */
export async function fetchRunningWorksheetVerifyBatchReportIdPg(): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `select id::text from public.worksheet_verify_batch_reports
       where status = 'running' order by created_at asc limit 1`,
      []
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] fetchRunningWorksheetVerifyBatchReportIdPg', e)
    return null
  }
}

/** Danh sách ngắn cho GET admin. */
export async function listWorksheetVerifyBatchReportsPg(limit: number): Promise<Record<string, unknown>[] | null> {
  if (!isPgConfigured()) return null
  try {
    const lim = Math.min(200, Math.max(1, limit))
    return await pgQuery(
      `select id::text, created_at, updated_at, finished_at, status::text, triggered_by::text,
              worksheets_planned, worksheets_processed, questions_marked_verified, questions_content_updated,
              questions_skipped_invalid, error_summary::text
       from public.worksheet_verify_batch_reports
       order by created_at desc
       limit $1`,
      [lim]
    )
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] listWorksheetVerifyBatchReportsPg', e)
    return null
  }
}

export async function insertWorksheetVerifyBatchReportPg(input: {
  status: string
  triggeredBy: string | null
  worksheetsPlanned: number
  worksheetsProcessed: number
  questionsMarkedVerified: number
  questionsContentUpdated: number
  questionsSkippedInvalid: number
  progress: unknown
  details: unknown
  finishedAt: string | null
  updatedAt: string
  errorSummary?: string | null
}): Promise<string | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{ id: string }>(
      `insert into public.worksheet_verify_batch_reports (
         status, triggered_by, worksheets_planned, worksheets_processed,
         questions_marked_verified, questions_content_updated, questions_skipped_invalid,
         progress, details, finished_at, updated_at, error_summary
       ) values (
         $1, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::timestamptz, $11::timestamptz, $12
       )
       returning id::text`,
      [
        input.status,
        input.triggeredBy,
        input.worksheetsPlanned,
        input.worksheetsProcessed,
        input.questionsMarkedVerified,
        input.questionsContentUpdated,
        input.questionsSkippedInvalid,
        JSON.stringify(input.progress ?? {}),
        JSON.stringify(input.details ?? []),
        input.finishedAt,
        input.updatedAt,
        input.errorSummary ?? null,
      ]
    )
    return row?.id ?? null
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] insertWorksheetVerifyBatchReportPg', e)
    return null
  }
}

export async function updateWorksheetVerifyBatchReportPg(
  reportId: string,
  input: {
    updatedAt: string
    worksheetsProcessed: number
    questionsMarkedVerified: number
    questionsContentUpdated: number
    questionsSkippedInvalid: number
    progress: unknown
    details: unknown
    status: string
    finishedAt: string | null
    errorSummary: string | null
  }
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_verify_batch_reports set
         updated_at = $2::timestamptz,
         worksheets_processed = $3,
         questions_marked_verified = $4,
         questions_content_updated = $5,
         questions_skipped_invalid = $6,
         progress = $7::jsonb,
         details = $8::jsonb,
         status = $9,
         finished_at = $10::timestamptz,
         error_summary = $11
       where id = $1::uuid`,
      [
        reportId,
        input.updatedAt,
        input.worksheetsProcessed,
        input.questionsMarkedVerified,
        input.questionsContentUpdated,
        input.questionsSkippedInvalid,
        JSON.stringify(input.progress ?? {}),
        JSON.stringify(input.details ?? []),
        input.status,
        input.finishedAt,
        input.errorSummary,
      ]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] updateWorksheetVerifyBatchReportPg', e)
    return false
  }
}

export async function markWorksheetVerifyBatchReportCompletedPg(reportId: string, nowIso: string): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const pool = getPgPool()
    const res = await pool.query(
      `update public.worksheet_verify_batch_reports
       set status = 'completed', finished_at = $2::timestamptz, updated_at = $2::timestamptz
       where id = $1::uuid`,
      [reportId, nowIso]
    )
    return (res.rowCount ?? 0) > 0
  } catch (e) {
    console.error('[worksheet-verify-batch-pg] markWorksheetVerifyBatchReportCompletedPg', e)
    return false
  }
}

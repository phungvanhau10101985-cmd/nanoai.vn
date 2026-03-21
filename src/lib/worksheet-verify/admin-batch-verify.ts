import type { SupabaseClient } from '@supabase/supabase-js'
import { runWorksheetVerifyForSheet, type RunWorksheetVerifyStats } from '@/lib/worksheet-verify/run-worksheet-verify-for-sheet'

export type WorksheetVerifyDetailRow = {
  worksheetId: string
  topic: string
  contentUpdates: number
  markedVerified: number
  skippedInvalid: number
  errors: string[]
  durationMs: number
}

export type BatchProgress = {
  pendingIds: string[]
  topicsById: Record<string, string>
  nextIndex: number
}

export async function fetchPendingWorksheetIds(admin: SupabaseClient): Promise<{ id: string; topic: string }[]> {
  const { data, error } = await admin.rpc('get_worksheet_ids_pending_verify')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { worksheet_id: string; worksheet_topic: string }[]
  return rows.map((r) => ({ id: r.worksheet_id, topic: r.worksheet_topic ?? '' }))
}

export async function startNewBatchReport(
  admin: SupabaseClient,
  triggeredBy: string | null
): Promise<{ reportId: string; worksheetsPlanned: number }> {
  const pending = await fetchPendingWorksheetIds(admin)
  const pendingIds = pending.map((p) => p.id)
  const topicsById: Record<string, string> = {}
  for (const p of pending) topicsById[p.id] = p.topic

  const progress: BatchProgress = { pendingIds, topicsById, nextIndex: 0 }
  const now = new Date().toISOString()
  const emptyDone = pendingIds.length === 0

  const { data, error } = await admin
    .from('worksheet_verify_batch_reports')
    .insert({
      status: emptyDone ? 'completed' : 'running',
      triggered_by: triggeredBy,
      worksheets_planned: pendingIds.length,
      worksheets_processed: 0,
      questions_marked_verified: 0,
      questions_content_updated: 0,
      questions_skipped_invalid: 0,
      progress,
      details: [],
      finished_at: emptyDone ? now : null,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  return { reportId: data!.id as string, worksheetsPlanned: pendingIds.length }
}

export type StepResult = {
  reportId: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  worksheetsProcessedThisStep: number
  worksheetsProcessedTotal: number
  worksheetsPlanned: number
  questionsMarkedVerified: number
  questionsContentUpdated: number
  questionsSkippedInvalid: number
  lastDetails: WorksheetVerifyDetailRow[]
  errorSummary?: string
}

export async function runBatchVerifyStep(
  admin: SupabaseClient,
  reportId: string,
  batchSize: number
): Promise<StepResult> {
  const { data: rep, error: fetchErr } = await admin
    .from('worksheet_verify_batch_reports')
    .select('*')
    .eq('id', reportId)
    .single()

  if (fetchErr || !rep) throw new Error(fetchErr?.message || 'Không tìm thấy báo cáo')

  if (rep.status !== 'running') {
    return {
      reportId,
      status: rep.status as StepResult['status'],
      worksheetsProcessedThisStep: 0,
      worksheetsProcessedTotal: rep.worksheets_processed ?? 0,
      worksheetsPlanned: rep.worksheets_planned ?? 0,
      questionsMarkedVerified: rep.questions_marked_verified ?? 0,
      questionsContentUpdated: rep.questions_content_updated ?? 0,
      questionsSkippedInvalid: rep.questions_skipped_invalid ?? 0,
      lastDetails: [],
    }
  }

  const progress = rep.progress as unknown as BatchProgress
  const pendingIds = progress?.pendingIds ?? []
  const nextIndex = Math.max(0, progress?.nextIndex ?? 0)
  const topicsById = progress?.topicsById ?? {}

  if (nextIndex >= pendingIds.length) {
    const now = new Date().toISOString()
    await admin
      .from('worksheet_verify_batch_reports')
      .update({ status: 'completed', finished_at: now, updated_at: now })
      .eq('id', reportId)
    return {
      reportId,
      status: 'completed',
      worksheetsProcessedThisStep: 0,
      worksheetsProcessedTotal: rep.worksheets_processed ?? 0,
      worksheetsPlanned: rep.worksheets_planned ?? 0,
      questionsMarkedVerified: rep.questions_marked_verified ?? 0,
      questionsContentUpdated: rep.questions_content_updated ?? 0,
      questionsSkippedInvalid: rep.questions_skipped_invalid ?? 0,
      lastDetails: [],
    }
  }

  const slice = pendingIds.slice(nextIndex, nextIndex + Math.max(1, batchSize))
  const lastDetails: WorksheetVerifyDetailRow[] = []
  let qMarked = rep.questions_marked_verified ?? 0
  let qContent = rep.questions_content_updated ?? 0
  let qSkip = rep.questions_skipped_invalid ?? 0
  let processed = rep.worksheets_processed ?? 0
  const details: WorksheetVerifyDetailRow[] = Array.isArray(rep.details)
    ? (rep.details as WorksheetVerifyDetailRow[])
    : []
  let fatal: string | null = null

  for (const wid of slice) {
    const t0 = Date.now()
    try {
      const st: RunWorksheetVerifyStats = await runWorksheetVerifyForSheet(admin, wid)
      qMarked += st.markedVerified
      qContent += st.contentUpdates
      qSkip += st.skippedInvalid
      processed += 1
      const row: WorksheetVerifyDetailRow = {
        worksheetId: wid,
        topic: topicsById[wid] ?? '',
        contentUpdates: st.contentUpdates,
        markedVerified: st.markedVerified,
        skippedInvalid: st.skippedInvalid,
        errors: st.errors,
        durationMs: Date.now() - t0,
      }
      lastDetails.push(row)
      details.push(row)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      fatal = fatal ?? msg
      const row: WorksheetVerifyDetailRow = {
        worksheetId: wid,
        topic: topicsById[wid] ?? '',
        contentUpdates: 0,
        markedVerified: 0,
        skippedInvalid: 0,
        errors: [msg],
        durationMs: Date.now() - t0,
      }
      lastDetails.push(row)
      details.push(row)
      processed += 1
    }
  }

  const newIndex = nextIndex + slice.length
  const done = newIndex >= pendingIds.length
  const now = new Date().toISOString()
  const newProgress: BatchProgress = { ...progress, pendingIds, topicsById, nextIndex: newIndex }

  await admin
    .from('worksheet_verify_batch_reports')
    .update({
      updated_at: now,
      worksheets_processed: processed,
      questions_marked_verified: qMarked,
      questions_content_updated: qContent,
      questions_skipped_invalid: qSkip,
      progress: newProgress as unknown as Record<string, unknown>,
      details: details as unknown as Record<string, unknown>,
      status: done ? 'completed' : 'running',
      finished_at: done ? now : null,
      error_summary: fatal,
    })
    .eq('id', reportId)

  return {
    reportId,
    status: done ? 'completed' : 'running',
    worksheetsProcessedThisStep: slice.length,
    worksheetsProcessedTotal: processed,
    worksheetsPlanned: rep.worksheets_planned ?? 0,
    questionsMarkedVerified: qMarked,
    questionsContentUpdated: qContent,
    questionsSkippedInvalid: qSkip,
    lastDetails,
    errorSummary: fatal ?? undefined,
  }
}

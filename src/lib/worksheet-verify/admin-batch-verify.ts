import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPendingWorksheetIdsPg,
  fetchWorksheetVerifyBatchReportByIdPg,
  insertWorksheetVerifyBatchReportPg,
  markWorksheetVerifyBatchReportCompletedPg,
  updateWorksheetVerifyBatchReportPg,
} from '@/lib/db/worksheet-verify-batch-pg'
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

function repRowToCompat(rep: Record<string, unknown>) {
  return {
    status: String(rep.status ?? ''),
    worksheets_processed: Number(rep.worksheets_processed ?? 0),
    worksheets_planned: Number(rep.worksheets_planned ?? 0),
    questions_marked_verified: Number(rep.questions_marked_verified ?? 0),
    questions_content_updated: Number(rep.questions_content_updated ?? 0),
    questions_skipped_invalid: Number(rep.questions_skipped_invalid ?? 0),
    progress: rep.progress,
    details: rep.details,
  }
}

export async function startNewBatchReport(
  triggeredBy: string | null
): Promise<{ reportId: string; worksheetsPlanned: number }> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')

  const pendingRows = await fetchPendingWorksheetIdsPg()
  if (pendingRows === null) throw new Error('Không đọc được danh sách phiếu chờ verify')

  const pendingIds = pendingRows.map((p) => p.id)
  const topicsById: Record<string, string> = {}
  for (const p of pendingRows) topicsById[p.id] = p.topic

  const progress: BatchProgress = { pendingIds, topicsById, nextIndex: 0 }
  const now = new Date().toISOString()
  const emptyDone = pendingIds.length === 0

  const reportId = await insertWorksheetVerifyBatchReportPg({
    status: emptyDone ? 'completed' : 'running',
    triggeredBy,
    worksheetsPlanned: pendingIds.length,
    worksheetsProcessed: 0,
    questionsMarkedVerified: 0,
    questionsContentUpdated: 0,
    questionsSkippedInvalid: 0,
    progress,
    details: [],
    finishedAt: emptyDone ? now : null,
    updatedAt: now,
  })
  if (!reportId) throw new Error('Không tạo được báo cáo lô')
  return { reportId, worksheetsPlanned: pendingIds.length }
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

export async function runBatchVerifyStep(reportId: string, batchSize: number): Promise<StepResult> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL chưa cấu hình')

  const raw = await fetchWorksheetVerifyBatchReportByIdPg(reportId)
  if (!raw) throw new Error('Không tìm thấy báo cáo')

  const rep = repRowToCompat(raw)

  if (rep.status !== 'running') {
    return {
      reportId,
      status: rep.status as StepResult['status'],
      worksheetsProcessedThisStep: 0,
      worksheetsProcessedTotal: rep.worksheets_processed,
      worksheetsPlanned: rep.worksheets_planned,
      questionsMarkedVerified: rep.questions_marked_verified,
      questionsContentUpdated: rep.questions_content_updated,
      questionsSkippedInvalid: rep.questions_skipped_invalid,
      lastDetails: [],
    }
  }

  const progress = raw.progress as unknown as BatchProgress
  const pendingIds = progress?.pendingIds ?? []
  const nextIndex = Math.max(0, progress?.nextIndex ?? 0)
  const topicsById = progress?.topicsById ?? {}

  if (nextIndex >= pendingIds.length) {
    const now = new Date().toISOString()
    await markWorksheetVerifyBatchReportCompletedPg(reportId, now)
    return {
      reportId,
      status: 'completed',
      worksheetsProcessedThisStep: 0,
      worksheetsProcessedTotal: rep.worksheets_processed,
      worksheetsPlanned: rep.worksheets_planned,
      questionsMarkedVerified: rep.questions_marked_verified,
      questionsContentUpdated: rep.questions_content_updated,
      questionsSkippedInvalid: rep.questions_skipped_invalid,
      lastDetails: [],
    }
  }

  const slice = pendingIds.slice(nextIndex, nextIndex + Math.max(1, batchSize))
  const lastDetails: WorksheetVerifyDetailRow[] = []
  let qMarked = rep.questions_marked_verified
  let qContent = rep.questions_content_updated
  let qSkip = rep.questions_skipped_invalid
  let processed = rep.worksheets_processed
  const details: WorksheetVerifyDetailRow[] = Array.isArray(raw.details)
    ? ([...(raw.details as WorksheetVerifyDetailRow[])] as WorksheetVerifyDetailRow[])
    : []
  let fatal: string | null = null

  for (const wid of slice) {
    const t0 = Date.now()
    try {
      const st: RunWorksheetVerifyStats = await runWorksheetVerifyForSheet(wid)
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

  const ok = await updateWorksheetVerifyBatchReportPg(reportId, {
    updatedAt: now,
    worksheetsProcessed: processed,
    questionsMarkedVerified: qMarked,
    questionsContentUpdated: qContent,
    questionsSkippedInvalid: qSkip,
    progress: newProgress,
    details,
    status: done ? 'completed' : 'running',
    finishedAt: done ? now : null,
    errorSummary: fatal,
  })
  if (!ok) throw new Error('Không cập nhật được báo cáo lô')

  return {
    reportId,
    status: done ? 'completed' : 'running',
    worksheetsProcessedThisStep: slice.length,
    worksheetsProcessedTotal: processed,
    worksheetsPlanned: rep.worksheets_planned,
    questionsMarkedVerified: qMarked,
    questionsContentUpdated: qContent,
    questionsSkippedInvalid: qSkip,
    lastDetails,
    errorSummary: fatal ?? undefined,
  }
}

/** Tương thích cron — danh sách phiếu còn câu chưa verify. */
export async function fetchPendingWorksheetIds(): Promise<Array<{ id: string; topic: string }>> {
  const rows = await fetchPendingWorksheetIdsPg()
  return rows ?? []
}

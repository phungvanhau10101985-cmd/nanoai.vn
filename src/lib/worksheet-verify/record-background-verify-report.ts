import type { RunWorksheetVerifyStats } from '@/lib/worksheet-verify/run-worksheet-verify-for-sheet'
import type { WorksheetVerifyDetailRow } from '@/lib/worksheet-verify/admin-batch-verify'
import { isPgConfigured } from '@/lib/db/pool'
import { insertWorksheetVerifyBatchReportPg } from '@/lib/db/worksheet-verify-batch-pg'
import { fetchWorksheetSheetForVerifyPg } from '@/lib/db/worksheet-verify-run-pg'

/**
 * Ghi một dòng vào worksheet_verify_batch_reports sau verify ngầm (tao-giao-trinh).
 */
export async function recordBackgroundVerifyReport(params: {
  worksheetId: string
  triggeredBy: string | null
  stats: RunWorksheetVerifyStats
  durationMs: number
}): Promise<void> {
  const { worksheetId, triggeredBy, stats, durationMs } = params

  if (!isPgConfigured()) return

  const ws = await fetchWorksheetSheetForVerifyPg(worksheetId)
  const topic = ws?.topic ?? ''

  const detailRow: WorksheetVerifyDetailRow = {
    worksheetId,
    topic,
    contentUpdates: stats.contentUpdates,
    markedVerified: stats.markedVerified,
    skippedInvalid: stats.skippedInvalid,
    errors: stats.errors,
    durationMs,
  }

  const now = new Date().toISOString()
  const errorSummary =
    stats.errors.length > 0 ? stats.errors.slice(0, 5).join('; ').slice(0, 2000) : null

  const id = await insertWorksheetVerifyBatchReportPg({
    status: 'completed',
    triggeredBy,
    worksheetsPlanned: 1,
    worksheetsProcessed: 1,
    questionsMarkedVerified: stats.markedVerified,
    questionsContentUpdated: stats.contentUpdates,
    questionsSkippedInvalid: stats.skippedInvalid,
    progress: {
      source: 'background',
      pendingIds: [worksheetId],
      nextIndex: 1,
      topicsById: { [worksheetId]: topic },
    },
    details: [detailRow],
    finishedAt: now,
    updatedAt: now,
    errorSummary,
  })

  if (!id) throw new Error('Không ghi được báo cáo verify nền')
}

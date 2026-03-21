import type { SupabaseClient } from '@supabase/supabase-js'
import type { RunWorksheetVerifyStats } from '@/lib/worksheet-verify/run-worksheet-verify-for-sheet'
import type { WorksheetVerifyDetailRow } from '@/lib/worksheet-verify/admin-batch-verify'

/**
 * Ghi một dòng vào worksheet_verify_batch_reports sau verify ngầm (tao-giao-trinh).
 * Admin dashboard chỉ đọc bảng này; batch/cron cũng dùng chung.
 * Cần Supabase client service_role (bypass RLS insert).
 */
export async function recordBackgroundVerifyReport(
  admin: SupabaseClient,
  params: {
    worksheetId: string
    triggeredBy: string | null
    stats: RunWorksheetVerifyStats
    durationMs: number
  }
): Promise<void> {
  const { worksheetId, triggeredBy, stats, durationMs } = params

  const { data: ws } = await admin.from('worksheet_worksheets').select('topic').eq('id', worksheetId).maybeSingle()
  const topic = (ws?.topic as string) || ''

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

  const { error } = await admin.from('worksheet_verify_batch_reports').insert({
    status: 'completed',
    triggered_by: triggeredBy,
    worksheets_planned: 1,
    worksheets_processed: 1,
    questions_marked_verified: stats.markedVerified,
    questions_content_updated: stats.contentUpdates,
    questions_skipped_invalid: stats.skippedInvalid,
    progress: {
      source: 'background',
      pendingIds: [worksheetId],
      nextIndex: 1,
      topicsById: { [worksheetId]: topic },
    },
    details: [detailRow],
    finished_at: now,
    updated_at: now,
    error_summary: errorSummary,
  })

  if (error) throw new Error(error.message)
}

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  groupTryOnHistoryForTaskHub,
  isoDaysAgo,
  TASK_HUB_RECENT_DAYS,
  tryOnGroupIsFullyTerminal,
  type TryOnHistoryTaskRow,
  type TryOnGroupAgg,
  type WorksheetJobRow,
} from '@/lib/dashboard/task-hub'

export type TaskHubRecentLine =
  | { kind: 'tryon'; at: string; group: TryOnGroupAgg }
  | { kind: 'worksheet'; at: string; job: WorksheetJobRow }

export type TaskHubSnapshot = {
  runningTryOn: TryOnGroupAgg[]
  runningWs: WorksheetJobRow[]
  recentTop: TaskHubRecentLine[]
}

export async function buildTaskHubSnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<TaskHubSnapshot> {
  const cutoff = isoDaysAgo(TASK_HUB_RECENT_DAYS)

  const [processingRes, recentTailRes, worksheetRes] = await Promise.all([
    supabase
      .from('try_on_history')
      .select('id, feature, status, batch_id, batch_type, created_at, error_message')
      .eq('user_id', userId)
      .eq('status', 'processing'),
    supabase
      .from('try_on_history')
      .select('id, feature, status, batch_id, batch_type, created_at, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('worksheet_jobs')
      .select('id, type, status, created_at, updated_at, error_message')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ])

  const byId = new Map<string, TryOnHistoryTaskRow>()
  for (const r of processingRes.data ?? []) {
    byId.set(r.id, r as TryOnHistoryTaskRow)
  }
  for (const r of recentTailRes.data ?? []) {
    const row = r as TryOnHistoryTaskRow
    if (!byId.has(row.id)) byId.set(row.id, row)
  }
  const mergedHistory = [...byId.values()]

  const groups = groupTryOnHistoryForTaskHub(mergedHistory)
  const runningTryOn = groups.filter((g) => g.anyProcessing)
  const recentTryOn = groups.filter(
    (g) =>
      !g.anyProcessing &&
      tryOnGroupIsFullyTerminal(g) &&
      g.maxCreatedAt >= cutoff
  )

  const ws = (worksheetRes.data ?? []) as WorksheetJobRow[]
  const runningWs = ws.filter((j) => j.status === 'pending' || j.status === 'processing')
  const recentWs = ws.filter(
    (j) =>
      (j.status === 'completed' || j.status === 'failed') && j.updated_at >= cutoff
  )

  const recentLines: TaskHubRecentLine[] = [
    ...recentTryOn.map((group) => ({ kind: 'tryon' as const, at: group.maxCreatedAt, group })),
    ...recentWs.map((job) => ({ kind: 'worksheet' as const, at: job.updated_at, job })),
  ]
  recentLines.sort((a, b) => b.at.localeCompare(a.at))
  const recentTop = recentLines.slice(0, 40)

  return { runningTryOn, runningWs, recentTop }
}

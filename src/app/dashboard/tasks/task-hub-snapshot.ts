import {
  groupTryOnHistoryForTaskHub,
  isoDaysAgo,
  TASK_HUB_RECENT_DAYS,
  tryOnGroupIsFullyTerminal,
  type TryOnHistoryTaskRow,
  type TryOnGroupAgg,
  type WorksheetJobRow,
} from '@/lib/dashboard/task-hub'
import { pgFetchTaskHubRaw } from '@/lib/db/dashboard-user-pg'
import { isPgConfigured } from '@/lib/db/pool'

export type TaskHubRecentLine =
  | { kind: 'tryon'; at: string; group: TryOnGroupAgg }
  | { kind: 'worksheet'; at: string; job: WorksheetJobRow }

export type TaskHubSnapshot = {
  runningTryOn: TryOnGroupAgg[]
  runningWs: WorksheetJobRow[]
  recentTop: TaskHubRecentLine[]
}

export async function buildTaskHubSnapshot(userId: string): Promise<TaskHubSnapshot> {
  const empty: TaskHubSnapshot = { runningTryOn: [], runningWs: [], recentTop: [] }
  if (!isPgConfigured()) return empty

  const raw = await pgFetchTaskHubRaw(userId)
  if (!raw) return empty

  const cutoff = isoDaysAgo(TASK_HUB_RECENT_DAYS)

  const byId = new Map<string, TryOnHistoryTaskRow>()
  for (const r of raw.processing) {
    byId.set(r.id, r)
  }
  for (const r of raw.recentTail) {
    if (!byId.has(r.id)) byId.set(r.id, r)
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

  const ws = raw.worksheet
  const runningWs = ws.filter((j) => j.status === 'pending' || j.status === 'processing')
  const recentWs = ws.filter(
    (j) => (j.status === 'completed' || j.status === 'failed') && j.updated_at >= cutoff
  )

  const recentLines: TaskHubRecentLine[] = [
    ...recentTryOn.map((group) => ({ kind: 'tryon' as const, at: group.maxCreatedAt, group })),
    ...recentWs.map((job) => ({ kind: 'worksheet' as const, at: job.updated_at, job })),
  ]
  recentLines.sort((a, b) => b.at.localeCompare(a.at))
  const recentTop = recentLines.slice(0, 40)

  return { runningTryOn, runningWs, recentTop }
}

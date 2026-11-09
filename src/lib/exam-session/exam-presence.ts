/** Nhịp sống và ngưỡng rời trang — chỉ bài thi tính điểm. */

export const EXAM_HEARTBEAT_INTERVAL_MS = 10_000
export const EXAM_SIGNAL_LOST_MS = 25_000
export const EXAM_HIDDEN_GRACE_MS = 3_000

export type ExamAutoSubmitReason = 'deadline' | 'hidden' | 'signal_lost'

export function parseExamAutoSubmitReason(value: unknown): ExamAutoSubmitReason | null {
  if (value === 'deadline' || value === 'hidden' || value === 'signal_lost') return value
  return null
}

/** `true` khi lần báo sống cuối đã quá ngưỡng mất tín hiệu. `null` không tính là mất (bài cũ / bài tập). */
export function isExamSignalLost(lastSeenAtIso: string | null | undefined, serverNowMs: number): boolean {
  if (!lastSeenAtIso) return false
  const seen = Date.parse(lastSeenAtIso)
  if (!Number.isFinite(seen)) return false
  return serverNowMs - seen > EXAM_SIGNAL_LOST_MS
}

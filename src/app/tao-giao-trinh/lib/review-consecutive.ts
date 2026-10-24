/** Một phía phải đúng 7 lần liền nhau. Phiếu ngược lại thì chuỗi đó về 1. */
export const REVIEW_CONSECUTIVE_PASSES = 7

export type ReviewTail = { action: 'agree' | 'reject'; count: number }

/**
 * Mỗi người một phiếu mới nhất. Chuỗi tính từ phiếu cuối đi ngược lên,
 * dừng khi gặp phía kia.
 */
export function consecutiveReviewTail(
  votes: Array<{ userId: string; action: 'agree' | 'reject'; at: number }>
): ReviewTail | null {
  const ordered = votes
    .map((vote, index) => ({ ...vote, index }))
    .sort((a, b) => a.at - b.at || a.index - b.index)
  const latest = new Map<string, { action: 'agree' | 'reject'; at: number; index: number }>()
  for (const vote of ordered) {
    const id = vote.userId.trim().toLowerCase()
    if (!id) continue
    latest.set(id, { action: vote.action, at: vote.at, index: vote.index })
  }
  const sequence = [...latest.values()].sort((a, b) => a.at - b.at || a.index - b.index)
  if (sequence.length === 0) return null
  const action = sequence[sequence.length - 1].action
  let count = 0
  for (let i = sequence.length - 1; i >= 0; i--) {
    if (sequence[i].action !== action) break
    count += 1
  }
  return { action, count }
}

export function consecutiveReviewCounts(
  votes: Array<{ userId: string; action: 'agree' | 'reject'; at: number }>
): { agreeCount: number; rejectCount: number; closed: boolean } {
  const tail = consecutiveReviewTail(votes)
  const agreeCount = tail?.action === 'agree' ? tail.count : 0
  const rejectCount = tail?.action === 'reject' ? tail.count : 0
  return {
    agreeCount,
    rejectCount,
    closed: (tail?.count ?? 0) >= REVIEW_CONSECUTIVE_PASSES,
  }
}

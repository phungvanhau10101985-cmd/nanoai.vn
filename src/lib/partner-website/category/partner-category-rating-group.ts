/** 0/888/1000 = trống. 88/99/100 là nhóm câu hỏi, không cấp làm nhóm đánh giá. */
const RATING_GROUP_ID_SKIP = new Set([0, 88, 99, 100, 888, 1000])
const RATING_GROUP_ID_START = 101

/** Mã mới từ 101 trở đi, luôn lớn hơn mã đã dùng, không đụng nhóm câu hỏi / mã trống. */
export function nextSharedRatingGroupId(used: Iterable<number>): number {
  const taken = new Set(RATING_GROUP_ID_SKIP)
  let max = 0
  for (const raw of used) {
    const n = Math.round(Number(raw))
    if (!Number.isFinite(n) || n <= 0) continue
    taken.add(n)
    if (!RATING_GROUP_ID_SKIP.has(n) && n > max) max = n
  }
  let next = Math.max(RATING_GROUP_ID_START, max + 1)
  while (taken.has(next)) {
    next += 1
    if (next > 1_000_000) throw new Error('rating group id exhausted')
  }
  return next
}

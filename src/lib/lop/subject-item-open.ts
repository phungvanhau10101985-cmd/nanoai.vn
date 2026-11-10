/** Phần trong môn mà học sinh mở từng bài. File này không đụng Postgres — client được import. */

export const SUBJECT_ITEM_KINDS = ['review', 'exam', 'homework', 'score'] as const

export type SubjectItemKind = (typeof SUBJECT_ITEM_KINDS)[number]

export type StudentSubjectInbox = {
  openedAtByKey: Record<string, string>
  reviewItems: { id: string; taughtAt: string }[]
}

export type SubjectItemOpenBody = {
  classId: string
  subjectId: string
  teacherId: string
  kind: SubjectItemKind
  itemId: string
}

export function subjectItemKey(kind: SubjectItemKind, itemId: string): string {
  return `${kind}:${itemId}`
}

export function reviewLessonItemId(curriculumId: string, lessonNo: number): string {
  return `${curriculumId}:${lessonNo}`
}

/** Chưa có mốc mở, hoặc nội dung mới hơn lần mở gần nhất. */
export function isSubjectItemUnopened(
  openedAt: string | undefined,
  sourceAt: string | null | undefined
): boolean {
  if (!openedAt) return true
  const openedMs = Date.parse(openedAt)
  if (Number.isNaN(openedMs)) return true
  if (!sourceAt) return false
  const sourceMs = Date.parse(sourceAt)
  if (Number.isNaN(sourceMs)) return false
  return sourceMs > openedMs
}

/**
 * Dòng điểm: mới khi chưa mở bài vừa giao, hoặc đã nộp sau lần mở trước
 * (có kết quả mới).
 */
export function isScoreRowUnopened(
  openedAt: string | undefined,
  createdAt: string | null | undefined,
  submittedAt: string | null | undefined
): boolean {
  if (isSubjectItemUnopened(openedAt, createdAt)) return true
  return Boolean(submittedAt) && isSubjectItemUnopened(openedAt, submittedAt)
}

/** Ghi đã mở. keepalive để request còn chạy khi chuyển sang trang làm bài. */
export function markSubjectItemOpened(body: SubjectItemOpenBody): void {
  void fetch('/api/lop/subject-item-open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {})
}

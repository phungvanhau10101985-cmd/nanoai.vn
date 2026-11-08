/** Nút tạo từ một môn trong lớp. Form đích đọc classId, subject, và grade nếu có. */
export function createFromClassHref(
  path: '/tao-bai-thi' | '/tao-bai-tap-ve-nha' | '/giao-trinh',
  input: { classId: string; subjectId?: string | null; gradeLevelId?: string | null }
): string {
  const q = new URLSearchParams()
  const classId = input.classId.trim()
  if (classId) q.set('classId', classId)
  const subject = String(input.subjectId ?? '').trim()
  if (subject) q.set('subject', subject)
  const grade = String(input.gradeLevelId ?? '').trim()
  if (grade) q.set('grade', grade)
  const qs = q.toString()
  return qs ? `${path}?${qs}` : path
}

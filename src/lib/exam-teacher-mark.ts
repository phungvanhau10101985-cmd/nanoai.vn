const EXAM_TEACHER_MARK_KEY = 'nanoai-exam-teacher'

/** Người bấm tạo đề, dùng đề có sẵn, hoặc mở giáo trình được đánh dấu là giáo viên. */
export function markExamTeacher(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(EXAM_TEACHER_MARK_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isMarkedExamTeacher(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(EXAM_TEACHER_MARK_KEY) === '1'
  } catch {
    return false
  }
}

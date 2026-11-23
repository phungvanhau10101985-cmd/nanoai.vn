export type ExamClassPreset = {
  classId: string
  subjectId: string
  gradeLevelId: string
}

/** `?classId=&subject=&grade=` trên /tao-bai-thi và /tao-bai-tap-ve-nha. */
export function classPresetFromSearch(search: string): ExamClassPreset | null {
  const raw = search.startsWith('?') ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  const classId = (params.get('classId') ?? '').trim()
  if (!classId) return null
  return {
    classId,
    subjectId: (params.get('subject') ?? '').trim(),
    gradeLevelId: (params.get('grade') ?? '').trim(),
  }
}

/** Thanh địa chỉ thắng query hook cũ và props của lần mở trước. */
export function resolveExamClassPreset(input: {
  searchParams: { get(name: string): string | null }
  windowSearch: string | null
  fromProps?: { classId?: string; subjectId?: string; gradeLevelId?: string } | null
}): ExamClassPreset | null {
  if (input.windowSearch != null) {
    const fromWindow = classPresetFromSearch(input.windowSearch)
    if (fromWindow) return fromWindow
  }
  const hookId = (input.searchParams.get('classId') ?? '').trim()
  if (hookId) {
    return {
      classId: hookId,
      subjectId: (input.searchParams.get('subject') ?? '').trim(),
      gradeLevelId: (input.searchParams.get('grade') ?? '').trim(),
    }
  }
  const id = (input.fromProps?.classId ?? '').trim()
  if (!id) return null
  return {
    classId: id,
    subjectId: (input.fromProps?.subjectId ?? '').trim(),
    gradeLevelId: (input.fromProps?.gradeLevelId ?? '').trim(),
  }
}

export function examClassPresetFromPageSearch(sp: {
  classId?: string | string[]
  subject?: string | string[]
  grade?: string | string[]
} | null | undefined): ExamClassPreset {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? ''
  return {
    classId: String(one(sp?.classId)).trim(),
    subjectId: String(one(sp?.subject)).trim(),
    gradeLevelId: String(one(sp?.grade)).trim(),
  }
}

/**
 * Lớp trên URL thắng lớp form vừa nhớ và lớp mới nhất trong danh sách.
 * Danh sách chưa về thì giữ id trên URL, không nhảy sang lớp khác.
 */
export function pickClassIdForExamForm(input: {
  urlClassId: string
  previousClassId: string
  classIds: readonly string[]
}): string {
  const url = input.urlClassId.trim()
  const prev = input.previousClassId.trim()
  const ids = input.classIds
  if (url) {
    if (ids.length === 0 || ids.includes(url)) return url
    if (prev && ids.includes(prev)) return prev
    return ''
  }
  if (prev && (ids.length === 0 || ids.includes(prev))) return prev
  return ids[0] ?? ''
}

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

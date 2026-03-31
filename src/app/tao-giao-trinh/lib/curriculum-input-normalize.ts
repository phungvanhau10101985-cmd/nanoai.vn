/**
 * Chuẩn hóa thông tin đầu vào trước khi tra DB / tạo giáo trình.
 * Đảm bảo khóa tra cứu khớp với dữ liệu trong DB.
 */

import { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS, LESSON_TYPES } from './curriculum-subjects'

const VALID_SUBJECT_IDS = new Set(SUBJECTS.map((s) => s.id)) as ReadonlySet<string>
const VALID_GRADE_IDS = new Set(GRADE_LEVELS.map((g) => g.id)) as ReadonlySet<string>
const VALID_TEXTBOOK_IDS = new Set(TEXTBOOK_SETS.map((t) => t.id)) as ReadonlySet<string>
const VALID_LESSON_TYPE_IDS = new Set(LESSON_TYPES.map((l) => l.id)) as ReadonlySet<string>

export interface NormalizedCurriculumInput {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  /** Số bài SGK: 1, 2 hoặc 1.5, 2.5 (lưu DB numeric) */
  lessonNumber: number | null
  numLessons: number
  lessonDurationMinutes: number
  lessonTypeId: string
}

/** Parse "1", "2", "1.5", "2,5" → số hợp lệ 1–999.99 (tối đa 2 chữ số thập phân). */
export function parseCurriculumLessonNumber(raw: string | number | undefined | null): number | null {
  if (raw === '' || raw === undefined || raw === null) return null
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 1 || raw > 999.99) return null
    return Math.round(raw * 100) / 100
  }
  const s = String(raw).trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = parseFloat(s)
  if (!Number.isFinite(n) || n < 1 || n > 999.99) return null
  return Math.round(n * 100) / 100
}

/** Hiển thị: 2 → "2", 1.5 → "1.5" */
export function formatCurriculumLessonNoDisplay(n: number): string {
  const r = Math.round(n * 100) / 100
  if (Number.isInteger(r)) return String(r)
  return r.toFixed(2).replace(/\.?0+$/, '')
}

export interface RawCurriculumInput {
  subjectId?: string
  gradeLevelId?: string
  textbookSetId?: string
  textbookVolume?: string
  lessonNumber?: string | number
  numLessons?: string | number
  lessonDurationMinutes?: string | number
  lessonTypeId?: string
}

/**
 * Chuẩn hóa thông tin đầu vào để tra DB / tạo giáo trình.
 * Dùng chung cho checkCurriculumExists và createCurriculum.
 */
export function normalizeCurriculumInput(raw: RawCurriculumInput): NormalizedCurriculumInput {
  const subjectId = (raw.subjectId ?? '').trim() || 'toan'
  const gradeLevelId = (raw.gradeLevelId ?? '').trim() || 'lop-6'
  const textbookSetId = (raw.textbookSetId ?? '').trim() || 'ket-noi-tri-thuc'
  const lessonTypeId = (raw.lessonTypeId ?? '').trim() || 'hinh-thanh-kien-thuc'

  const subjectIdNorm = VALID_SUBJECT_IDS.has(subjectId) ? subjectId : 'toan'
  const gradeLevelIdNorm = VALID_GRADE_IDS.has(gradeLevelId) ? gradeLevelId : 'lop-6'
  const textbookSetIdNorm = VALID_TEXTBOOK_IDS.has(textbookSetId) ? textbookSetId : 'ket-noi-tri-thuc'
  const lessonTypeIdNorm = VALID_LESSON_TYPE_IDS.has(lessonTypeId) ? lessonTypeId : 'hinh-thanh-kien-thuc'

  const textbookVolumeRaw = (raw.textbookVolume ?? '').trim()
  const textbookVolume: string | null =
    textbookVolumeRaw === '1' || textbookVolumeRaw === '2' ? textbookVolumeRaw : null

  const lessonNumber = parseCurriculumLessonNumber(raw.lessonNumber)

  const numLessons = Math.min(10, Math.max(1, parseInt(String(raw.numLessons ?? 3), 10) || 3))
  const lessonDurationMinutes = Math.min(
    120,
    Math.max(15, parseInt(String(raw.lessonDurationMinutes ?? 45), 10) || 45)
  )

  return {
    subjectId: subjectIdNorm,
    gradeLevelId: gradeLevelIdNorm,
    textbookSetId: textbookSetIdNorm,
    textbookVolume,
    lessonNumber,
    numLessons,
    lessonDurationMinutes,
    lessonTypeId: lessonTypeIdNorm,
  }
}

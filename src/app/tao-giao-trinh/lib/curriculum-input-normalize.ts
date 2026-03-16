/**
 * Chuẩn hóa thông tin đầu vào trước khi tra DB / tạo giáo trình.
 * Đảm bảo khóa tra cứu khớp với dữ liệu trong DB.
 */

import { SUBJECTS, GRADE_LEVELS, TEXTBOOK_SETS, LESSON_TYPES } from './curriculum-subjects'

const VALID_SUBJECT_IDS = new Set(SUBJECTS.map((s) => s.id))
const VALID_GRADE_IDS = new Set(GRADE_LEVELS.map((g) => g.id))
const VALID_TEXTBOOK_IDS = new Set(TEXTBOOK_SETS.map((t) => t.id))
const VALID_LESSON_TYPE_IDS = new Set(LESSON_TYPES.map((l) => l.id))

export interface NormalizedCurriculumInput {
  subjectId: string
  gradeLevelId: string
  textbookSetId: string
  textbookVolume: string | null
  lessonNumber: number | null
  numLessons: number
  lessonDurationMinutes: number
  lessonTypeId: string
}

export interface RawCurriculumInput {
  subjectId?: string
  gradeLevelId?: string
  textbookSetId?: string
  textbookVolume?: string
  lessonNumber?: string | number
  numLessons?: number
  lessonDurationMinutes?: number
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

  const lessonNumberRaw = raw.lessonNumber
  const parsed =
    typeof lessonNumberRaw === 'number'
      ? lessonNumberRaw
      : parseInt(String(lessonNumberRaw ?? '').trim(), 10)
  const lessonNumber: number | null =
    !Number.isNaN(parsed) && parsed >= 1 && parsed <= 999 ? parsed : null

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

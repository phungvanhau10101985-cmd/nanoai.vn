import { getThinkingGuide } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { fetchExamSessionForTeacherReviewPg } from '@/lib/db/exam-session-pg'
import { pgQueryOne } from '@/lib/db/pg-query'
import { fetchWorksheetQuestionsTypeContentByIdsFromPg } from '@/lib/db/worksheet-pg'
import { thinkingLinesFromGuide } from '@/lib/homework-help/homework-help-from-exercise'
import { resolveExamActor } from '@/lib/lop/lop-viewer'
import { isValidUuidString } from '@/lib/validate-uuid'

export type StoredThinkingResult =
  | { ok: true; lines: string[] }
  | { ok: false; code: 'unauthorized' | 'empty' }

/** Hướng tư duy đã ghi trên câu lúc tạo. Không gọi AI. */
export async function readStoredTeacherThinking(input: {
  examCode: string
  questionId: string
}): Promise<StoredThinkingResult> {
  const actor = await resolveExamActor()
  if (!actor) return { ok: false, code: 'unauthorized' }
  const questionId = input.questionId.trim()
  const examCode = input.examCode.trim().toUpperCase()
  if (!isValidUuidString(questionId) || !examCode) return { ok: false, code: 'unauthorized' }
  const session = await fetchExamSessionForTeacherReviewPg(examCode, actor.id)
  if (!session || session === 'not_found' || session === 'forbidden' || !session.is_practice_homework) {
    return { ok: false, code: 'unauthorized' }
  }
  const row = await pgQueryOne<{ worksheet_question_id: string | null }>(
    `select worksheet_question_id::text
     from public.exam_questions
     where id = $1::uuid and session_id = $2::uuid
     limit 1`,
    [questionId, session.id]
  )
  if (!row) return { ok: false, code: 'unauthorized' }
  const worksheetId = String(row.worksheet_question_id ?? '').trim()
  if (!isValidUuidString(worksheetId)) return { ok: true, lines: [] }
  const sheets = await fetchWorksheetQuestionsTypeContentByIdsFromPg([worksheetId])
  const sheet = sheets?.get(worksheetId)
  const lines = thinkingLinesFromGuide(sheet ? getThinkingGuide(sheet.content_json) : '')
  return { ok: true, lines }
}

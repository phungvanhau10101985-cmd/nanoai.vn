import { getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'
import { cleanQuizSolution } from '@/app/tao-giao-trinh/lib/worksheet-quiz-solution'
import {
  parseLayoutSnapshot,
  rebuildPublicFromSnapshot,
  type ExamQuestionRow,
  type PublicExamQuestion,
} from '@/lib/exam-session/student-exam-layout'

/** Câu trên đề học sinh đã thấy, kèm phương án đúng và lời giải sau khi đã nộp. */
export type SubmittedWorkQuestion = PublicExamQuestion & {
  correctDisplayIndex: number | null
  /** Lời giải chi tiết. Rỗng khi ngân hàng câu chưa có. */
  solution: string
}

/** Bài học sinh đã nộp, đúng thứ tự lúc làm, kèm kết quả trắc nghiệm. */
export type SubmittedWorkReview = {
  questions: SubmittedWorkQuestion[]
  savedAnswers: Record<string, number | string>
  essaySubmission: Record<string, { text: string; imageUrls: string[] }>
}

function correctDisplayIndexForRow(
  row: ExamQuestionRow,
  perm: number[] | undefined
): number | null {
  const rawOpts = Array.isArray(row.options) ? row.options : []
  if (rawOpts.length < 2) return null
  const ciRaw = typeof row.correct_index === 'number' ? row.correct_index : Number(row.correct_index)
  if (!Number.isFinite(ciRaw)) return null
  const safe = Math.max(0, Math.min(rawOpts.length - 1, Math.floor(ciRaw)))
  if (!perm || perm.length !== rawOpts.length) return null
  const at = perm.findIndex((orig) => orig === safe)
  return at >= 0 ? at : null
}

function solutionTextForQuestion(type: 'quiz' | 'essay', contentJson: unknown): string {
  const raw = getEssaySolution(contentJson).trim()
  if (!raw) return ''
  if (type === 'quiz') return cleanQuizSolution(raw)
  return raw
}

export function buildSubmittedWorkReview(params: {
  questions: ExamQuestionRow[]
  layoutSnapshot: unknown
  answers: unknown
  essaySubmission: unknown
  solutionByQuestionId?: ReadonlyMap<string, string>
}): SubmittedWorkReview | null {
  const snap = parseLayoutSnapshot(params.layoutSnapshot)
  if (!snap || params.questions.length === 0) return null
  const publicQuestions = rebuildPublicFromSnapshot(params.questions, snap)
  if (!publicQuestions?.length) return null
  const byId = new Map(params.questions.map((q) => [String(q.id), q]))
  const questions: SubmittedWorkQuestion[] = publicQuestions.map((q) => {
    const row = byId.get(q.id)
    return {
      ...q,
      correctDisplayIndex:
        q.type === 'quiz' && row
          ? correctDisplayIndexForRow(row, snap.optionPerms[q.id])
          : null,
      solution: params.solutionByQuestionId?.get(q.id)?.trim() ?? '',
    }
  })

  const savedAnswers: Record<string, number | string> = {}
  if (params.answers && typeof params.answers === 'object' && !Array.isArray(params.answers)) {
    for (const [k, v] of Object.entries(params.answers as Record<string, unknown>)) {
      if (typeof v === 'number' && Number.isFinite(v)) savedAnswers[k] = v
      else if (typeof v === 'string') savedAnswers[k] = v
    }
  }

  const essaySubmission: Record<string, { text: string; imageUrls: string[] }> = {}
  if (
    params.essaySubmission &&
    typeof params.essaySubmission === 'object' &&
    !Array.isArray(params.essaySubmission)
  ) {
    for (const [qid, rec] of Object.entries(params.essaySubmission as Record<string, unknown>)) {
      if (!rec || typeof rec !== 'object') continue
      const o = rec as Record<string, unknown>
      const text = typeof o.text === 'string' ? o.text : ''
      const imageUrls = Array.isArray(o.imageUrls)
        ? o.imageUrls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        : []
      if (text.trim() && savedAnswers[qid] == null) savedAnswers[qid] = text
      essaySubmission[qid] = { text, imageUrls }
    }
  }

  return { questions, savedAnswers, essaySubmission }
}

async function solutionByExamQuestionIdPg(sessionId: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  try {
    const { pgQuery } = await import('@/lib/db/pg-query')
    const { fetchWorksheetQuestionsTypeContentByIdsFromPg } = await import('@/lib/db/worksheet-pg')
    const links = await pgQuery<{ id: string; worksheet_question_id: string | null }>(
      `select id::text, worksheet_question_id::text
       from public.exam_questions
       where session_id = $1::uuid`,
      [sessionId]
    )
    const wsIds = Array.from(
      new Set(
        links
          .map((row) => String(row.worksheet_question_id ?? '').trim())
          .filter((id) => id.length > 0)
      )
    )
    if (wsIds.length === 0) return out
    const wsMap = await fetchWorksheetQuestionsTypeContentByIdsFromPg(wsIds)
    if (!wsMap) return out
    for (const link of links) {
      const wsId = String(link.worksheet_question_id ?? '').trim()
      const ws = wsId ? wsMap.get(wsId) : undefined
      if (!ws) continue
      const text = solutionTextForQuestion(ws.type === 'essay' ? 'essay' : 'quiz', ws.content_json)
      if (text) out.set(String(link.id), text)
    }
  } catch (e) {
    console.error('[submitted-work-review] solutionByExamQuestionIdPg', e)
  }
  return out
}

export async function loadSubmittedWorkReviewPg(
  sessionId: string,
  layoutSnapshot: unknown,
  answers: unknown,
  essaySubmission: unknown
): Promise<SubmittedWorkReview | null> {
  const { fetchExamQuestionsFullOrderedForSessionPg } = await import('@/lib/db/exam-session-pg')
  const rows = await fetchExamQuestionsFullOrderedForSessionPg(sessionId)
  if (!rows?.length) return null
  const solutionByQuestionId = await solutionByExamQuestionIdPg(sessionId)
  return buildSubmittedWorkReview({
    questions: rows,
    layoutSnapshot,
    answers,
    essaySubmission,
    solutionByQuestionId,
  })
}

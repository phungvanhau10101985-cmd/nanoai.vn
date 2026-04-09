import {
  getExamAttemptFeedbackWithMeta,
  parseExamGradingMeta,
  type ExamGradingMeta,
} from '@/lib/exam-feedback'
import { parseLayoutSnapshot } from '@/lib/exam-session/student-exam-layout'
import { gradeExamFromStoredAnswers, type ExamQuestionGradeRow } from '@/lib/exam-session/grade-exam-from-sources'

export type FinalizedExamSummary = {
  practiceHomework: boolean
  title: string
  durationMinutes: number
  score: number
  maxScore: number
  grade10: number
  scoreOn100: number
  comment: string
  shareHint: string
  scoringBreakdown: ExamGradingMeta
  submittedDueToServerDeadline: true
}

export function resolveDeadlineEndMs(
  deadlineAtIso: string | null | undefined,
  startedAtIso: string | null | undefined,
  durationMinutes: number
): number | null {
  if (deadlineAtIso && typeof deadlineAtIso === 'string') {
    const t = Date.parse(deadlineAtIso)
    if (Number.isFinite(t)) return t
  }
  if (startedAtIso && typeof startedAtIso === 'string') {
    const s = Date.parse(startedAtIso)
    if (Number.isFinite(s)) return s + Math.max(1, durationMinutes) * 60_000
  }
  return null
}

/** `true` nếu đã quá hạn làm bài (theo đồng hồ server). */
export function isServerDeadlinePassed(
  deadlineAtIso: string | null | undefined,
  startedAtIso: string | null | undefined,
  durationMinutes: number,
  serverNowMs: number
): boolean {
  const end = resolveDeadlineEndMs(deadlineAtIso, startedAtIso, durationMinutes)
  if (end == null) return false
  return serverNowMs >= end
}

/**
 * Chấm và nộp attempt đang mở khi đã quá deadline. Idempotent (chỉ cập nhật khi submitted_at null).
 * Trả về payload hiển thị kết quả hoặc null nếu không xử lý được.
 */
export async function tryFinalizeOverdueExamAttemptPg(params: {
  sessionId: string
  sessionTitle: string
  durationMinutes: number
  practiceHomework: boolean
  attemptId: string
  layoutSnapshot: unknown
  answers: unknown
  essaySubmission: unknown
  serverNowMs: number
}): Promise<FinalizedExamSummary | null> {
  const {
    fetchExamQuestionsForGradingPg,
    updateExamAttemptOverdueFinalizePg,
  } = await import('@/lib/db/exam-session-pg')

  const snap = parseLayoutSnapshot(params.layoutSnapshot)
  if (!snap) return null

  const answersObj =
    params.answers && typeof params.answers === 'object' && !Array.isArray(params.answers)
      ? (params.answers as Record<string, unknown>)
      : {}

  const questions = await fetchExamQuestionsForGradingPg(params.sessionId)
  if (!questions?.length) return null

  const graded = gradeExamFromStoredAnswers(
    questions as ExamQuestionGradeRow[],
    snap,
    answersObj,
    params.essaySubmission
  )
  if ('error' in graded) {
    console.error('[finalize-overdue-pg]', graded.error)
    return null
  }

  const metaWithFlag: ExamGradingMeta = {
    ...graded.gradingMeta,
    submittedByServerDeadline: true,
  }

  const feedback = getExamAttemptFeedbackWithMeta(graded.finalScore, graded.maxScore, metaWithFlag)

  const submittedIso = new Date(params.serverNowMs).toISOString()

  const updated = await updateExamAttemptOverdueFinalizePg({
    attemptId: params.attemptId,
    answers: answersObj,
    essaySubmission: graded.essaySubmission,
    score: graded.finalScore,
    maxScore: graded.maxScore,
    gradingMeta: metaWithFlag,
    submittedIso,
  })

  if (!updated) {
    return null
  }

  return {
    practiceHomework: params.practiceHomework,
    title: params.sessionTitle,
    durationMinutes: params.durationMinutes,
    score: graded.finalScore,
    maxScore: graded.maxScore,
    grade10: feedback.grade10,
    scoreOn100: feedback.scoreOn100,
    comment: feedback.comment,
    shareHint: feedback.shareHint,
    scoringBreakdown: metaWithFlag,
    submittedDueToServerDeadline: true,
  }
}

export async function fetchAlreadySubmittedPayloadForAttemptPg(
  attemptId: string,
  practiceHomework: boolean,
  title: string,
  durationMinutes: number
): Promise<Record<string, unknown> | null> {
  const { fetchExamAttemptSubmittedSummaryRowPg } = await import('@/lib/db/exam-session-pg')
  const data = await fetchExamAttemptSubmittedSummaryRowPg(attemptId)
  if (!data?.submitted_at) return null
  const sc = Number(data.score ?? 0)
  const mx = Number(data.max_score ?? 0)
  const meta = parseExamGradingMeta(data.grading_meta)
  const feedback = getExamAttemptFeedbackWithMeta(sc, mx, meta)
  return {
    alreadySubmitted: true,
    practiceHomework,
    title,
    durationMinutes,
    score: sc,
    maxScore: mx,
    grade10: feedback.grade10,
    scoreOn100: feedback.scoreOn100,
    comment: feedback.comment,
    shareHint: feedback.shareHint,
    scoringBreakdown: meta ?? undefined,
    submittedDueToServerDeadline: meta?.submittedByServerDeadline === true,
  }
}

import {
  getExamAttemptFeedbackWithMeta,
  parseExamGradingMeta,
  type ExamGradingMeta,
} from '@/lib/exam-feedback'
import { parseLayoutSnapshot } from '@/lib/exam-session/student-exam-layout'
import { gradeExamFromStoredAnswers, type ExamQuestionGradeRow } from '@/lib/exam-session/grade-exam-from-sources'
import {
  loadSubmittedWorkReviewPg,
  type SubmittedWorkReview,
} from '@/lib/exam-session/submitted-work-review'
import {
  isExamSignalLost,
  type ExamAutoSubmitReason,
} from '@/lib/exam-session/exam-presence'

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
  autoSubmitReason: ExamAutoSubmitReason
  submittedDueToServerDeadline: boolean
  submittedWork: SubmittedWorkReview | null
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
 * Chấm và nộp attempt đang mở. Idempotent (chỉ cập nhật khi submitted_at null).
 * `deadline` = hết giờ. `signal_lost` = quá ngưỡng không thấy trang.
 */
export async function tryFinalizeOpenExamAttemptPg(params: {
  sessionId: string
  sessionTitle: string
  durationMinutes: number
  practiceHomework: boolean
  attemptId: string
  layoutSnapshot: unknown
  answers: unknown
  essaySubmission: unknown
  serverNowMs: number
  reason: Extract<ExamAutoSubmitReason, 'deadline' | 'signal_lost'>
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
    console.error('[finalize-open-exam-pg]', graded.error)
    return null
  }

  const metaWithFlag: ExamGradingMeta = {
    ...graded.gradingMeta,
    autoSubmitReason: params.reason,
    submittedByServerDeadline: params.reason === 'deadline',
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

  const submittedWork = await loadSubmittedWorkReviewPg(
    params.sessionId,
    params.layoutSnapshot,
    answersObj,
    graded.essaySubmission
  )

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
    autoSubmitReason: params.reason,
    submittedDueToServerDeadline: params.reason === 'deadline',
    submittedWork,
  }
}

/** Chấm và nộp attempt đang mở khi đã quá deadline. */
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
  return tryFinalizeOpenExamAttemptPg({ ...params, reason: 'deadline' })
}

export function finalizedAttemptClientJson(
  finalized: FinalizedExamSummary,
  classId: string | null
): Record<string, unknown> {
  return {
    alreadySubmitted: true,
    practiceHomework: finalized.practiceHomework,
    title: finalized.title,
    durationMinutes: finalized.durationMinutes,
    score: finalized.score,
    maxScore: finalized.maxScore,
    grade10: finalized.grade10,
    scoreOn100: finalized.scoreOn100,
    comment: finalized.comment,
    shareHint: finalized.shareHint,
    scoringBreakdown: finalized.scoringBreakdown,
    autoSubmitReason: finalized.autoSubmitReason,
    submittedDueToServerDeadline: finalized.submittedDueToServerDeadline,
    submittedWork: finalized.submittedWork,
    classId,
  }
}

/** Bài thi tính điểm: không thấy tín hiệu quá ngưỡng thì nộp nháp đã lưu. */
export async function tryFinalizeSignalLostExamAttemptPg(params: {
  sessionId: string
  sessionTitle: string
  durationMinutes: number
  practiceHomework: boolean
  attemptId: string
  layoutSnapshot: unknown
  answers: unknown
  essaySubmission: unknown
  lastSeenAt: string | null
  serverNowMs: number
}): Promise<FinalizedExamSummary | null> {
  if (params.practiceHomework) return null
  if (!isExamSignalLost(params.lastSeenAt, params.serverNowMs)) return null
  return tryFinalizeOpenExamAttemptPg({ ...params, reason: 'signal_lost' })
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
  const submittedWork = await loadSubmittedWorkReviewPg(
    data.session_id,
    data.layout_snapshot,
    data.answers,
    data.essay_submission
  )
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
    autoSubmitReason: meta?.autoSubmitReason ?? (meta?.submittedByServerDeadline ? 'deadline' : null),
    submittedDueToServerDeadline:
      meta?.autoSubmitReason === 'deadline' || meta?.submittedByServerDeadline === true,
    submittedWork,
  }
}

import type { SupabaseClient } from '@supabase/supabase-js'
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

/** Đọc attempt đã nộp → payload `alreadySubmitted` cho API (sau race finalize / refetch). */
export async function fetchAlreadySubmittedPayloadForAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  practiceHomework: boolean,
  title: string,
  durationMinutes: number
): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('exam_attempts')
    .select('submitted_at, score, max_score, grading_meta')
    .eq('id', attemptId)
    .maybeSingle()
  if (error || !data?.submitted_at) return null
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

/**
 * Chấm và nộp attempt đang mở khi đã quá deadline. Idempotent (chỉ cập nhật khi submitted_at null).
 * Trả về payload hiển thị kết quả hoặc null nếu không xử lý được.
 */
export async function tryFinalizeOverdueExamAttempt(params: {
  supabase: SupabaseClient
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
  const snap = parseLayoutSnapshot(params.layoutSnapshot)
  if (!snap) return null

  const answersObj =
    params.answers && typeof params.answers === 'object' && !Array.isArray(params.answers)
      ? (params.answers as Record<string, unknown>)
      : {}

  const { data: questions, error: qErr } = await params.supabase
    .from('exam_questions')
    .select('id, correct_index, options, points')
    .eq('session_id', params.sessionId)

  if (qErr || !questions?.length) return null

  const graded = gradeExamFromStoredAnswers(
    questions as ExamQuestionGradeRow[],
    snap,
    answersObj,
    params.essaySubmission
  )
  if ('error' in graded) {
    console.error('[finalize-overdue]', graded.error)
    return null
  }

  const metaWithFlag: ExamGradingMeta = {
    ...graded.gradingMeta,
    submittedByServerDeadline: true,
  }

  const feedback = getExamAttemptFeedbackWithMeta(graded.finalScore, graded.maxScore, metaWithFlag)

  const submittedIso = new Date(params.serverNowMs).toISOString()

  const { data: updated, error: upErr } = await params.supabase
    .from('exam_attempts')
    .update({
      answers: answersObj,
      essay_submission: graded.essaySubmission,
      score: graded.finalScore,
      max_score: graded.maxScore,
      grading_meta: metaWithFlag,
      submitted_at: submittedIso,
    })
    .eq('id', params.attemptId)
    .is('submitted_at', null)
    .select('id')

  if (upErr) {
    console.error('[finalize-overdue] update:', upErr.message)
    return null
  }
  if (!updated?.length) {
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

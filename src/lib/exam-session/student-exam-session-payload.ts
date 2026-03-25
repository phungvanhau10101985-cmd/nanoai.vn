import type { PublicExamQuestion } from '@/lib/exam-session/student-exam-layout'

type SessionRow = {
  id: string
  code: string
  title: string | null
  duration_minutes: number | null
  class_id: string | null
  school_id: string | null
  is_practice_homework?: boolean | null
}

/** Payload JSON khi HS đã có attempt đang làm (GET resume / POST begin). */
export function buildActiveAttemptSessionJson(params: {
  session: SessionRow
  resolvedTitle: string
  practiceHomework: boolean
  className: string | null
  schoolName: string | null
  classExamIdentity: { displayName: string; birthDate: string } | null
  layoutToken: string
  publicQuestions: PublicExamQuestion[]
  attemptRow: {
    answers: unknown
    essay_submission: unknown
    started_at: string | null
    deadline_at?: string | null
  }
  resumeInProgress: boolean
}) {
  const s = params.session
  const durationMin = typeof s.duration_minutes === 'number' ? s.duration_minutes : 15
  const serverNowIso = new Date().toISOString()
  let deadlineAtIso: string | null =
    typeof params.attemptRow.deadline_at === 'string' && params.attemptRow.deadline_at.trim()
      ? params.attemptRow.deadline_at.trim()
      : null
  if (!deadlineAtIso && params.attemptRow.started_at) {
    const st = Date.parse(String(params.attemptRow.started_at))
    if (Number.isFinite(st)) {
      deadlineAtIso = new Date(st + durationMin * 60_000).toISOString()
    }
  }
  return {
    resumeInProgress: params.resumeInProgress,
    code: s.code,
    title: params.resolvedTitle,
    durationMinutes: durationMin,
    classId: s.class_id ?? null,
    schoolId: s.school_id ?? null,
    className: params.className,
    schoolName: params.schoolName,
    classExamIdentity: params.classExamIdentity,
    layoutToken: params.layoutToken,
    questions: params.publicQuestions,
    practiceHomework: params.practiceHomework,
    savedAnswers:
      params.attemptRow.answers && typeof params.attemptRow.answers === 'object'
        ? params.attemptRow.answers
        : {},
    essaySubmission:
      params.attemptRow.essay_submission && typeof params.attemptRow.essay_submission === 'object'
        ? params.attemptRow.essay_submission
        : {},
    examStartedAtIso: params.attemptRow.started_at,
    deadlineAtIso,
    serverNowIso,
  }
}

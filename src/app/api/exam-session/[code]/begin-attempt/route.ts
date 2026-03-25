import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { resolveWebLocaleFromAcceptLanguage } from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { signExamLayoutToken } from '@/lib/exam-layout-token'
import {
  getClassMemberExamIdentity,
  hasCompleteClassEnrollment,
  CLASS_ENROLLMENT_ERROR_VI,
} from '@/lib/lop/require-class-enrollment'
import { isValidStudentDobIso } from '@/lib/student-dob'
import {
  buildFreshExamLayout,
  parseLayoutSnapshot,
  rebuildPublicFromSnapshot,
  type ExamLayoutSnapshotV1,
  type ExamQuestionRow,
} from '@/lib/exam-session/student-exam-layout'
import { buildActiveAttemptSessionJson } from '@/lib/exam-session/student-exam-session-payload'
import {
  tryFinalizeOverdueExamAttempt,
  isServerDeadlinePassed,
  resolveDeadlineEndMs,
  fetchAlreadySubmittedPayloadForAttempt,
} from '@/lib/exam-session/finalize-overdue-exam-attempt'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
}

const ATTEMPT_SELECT_WITH_DEADLINE =
  'id, submitted_at, layout_snapshot, answers, essay_submission, started_at, deadline_at' as const
const ATTEMPT_SELECT_NO_DEADLINE =
  'id, submitted_at, layout_snapshot, answers, essay_submission, started_at' as const

type ExamAttemptInsertPayload = {
  session_id: string
  user_id: string
  class_id: string | null
  school_id: string | null
  student_name: string | null
  student_code: string | null
  answers: Record<string, never>
  essay_submission: Record<string, never>
  score: number
  max_score: number
  started_at: string
  submitted_at: null
  deadline_at: string
  layout_snapshot: ExamLayoutSnapshotV1
}

/** DB chưa chạy migration `deadline_at` — PostgREST / Postgres báo lỗi cột. */
function isDeadlineColumnError(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false
  const m = String(err.message ?? '').toLowerCase()
  if (!m.includes('deadline_at')) return false
  if (String(err.code ?? '') === '42703') return true
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find')
  )
}

/** PostgREST PGRST204 / Postgres 42703 — cột chưa có trên DB hoặc schema cache chưa reload. */
function isPostgrestSchemaMissingColumn(
  err: { message?: string; code?: string } | null | undefined,
  columnName: string
): boolean {
  if (!err) return false
  const code = String(err.code ?? '')
  const m = String(err.message ?? '').toLowerCase()
  const col = columnName.toLowerCase()
  if (!m.includes(col)) return false
  if (code === 'PGRST204') return true
  if (code === '42703') return true
  return m.includes('schema cache') || m.includes('could not find')
}

function examDbSchemaNotReadyResponse(opts: {
  examCode: string
  err: { message?: string; code?: string }
  context: 'select' | 'insert'
}): NextResponse {
  const { examCode, err, context } = opts
  console.error('[exam-session begin-attempt] DB schema:', examCode, context, err?.code, err?.message)
  return NextResponse.json(
    {
      error:
        'Hệ thống làm bài chưa sẵn sàng: cơ sở dữ liệu thiếu cột bắt buộc (ví dụ layout_snapshot). Chạy: npx supabase db push (migration repair 20260330100000_exam_attempts_repair_schema_drift.sql nếu repo đã có). Sau đó Supabase Dashboard → Settings → API → Reload schema.',
      errorCode: err.code ?? 'PGRST204',
      errorDetails: err.message ?? null,
      migrationHint:
        'Nếu db push báo up to date mà vẫn lỗi: drift schema — cần file 20260330100000_exam_attempts_repair_schema_drift.sql rồi db push + Reload schema.',
    },
    { status: 503, headers: NO_STORE_HEADERS }
  )
}

type ExistingAttemptRow = {
  id: string
  submitted_at: string | null
  layout_snapshot: unknown
  answers: unknown
  essay_submission: unknown
  started_at: string | null
  deadline_at?: string | null
}

/** HS bấm Bắt đầu — tạo attempt chưa nộp + snapshot; idempotent nếu đã có attempt đang làm. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const serverSupabase = createServerClient()
    const { data: authData } = await serverSupabase.auth.getUser()
    const user = authData.user
    if (!user) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập để làm bài thi.' },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }

    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json(
        { error: 'Mã bài thi không hợp lệ.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const body = await req.json().catch(() => ({}))
    const studentName = String(body?.studentName ?? '').trim()
    const studentDob = String(body?.studentDob ?? '').trim()
    if (!studentName) {
      return NextResponse.json(
        { error: 'Vui lòng nhập họ tên học sinh.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }
    if (!isValidStudentDobIso(studentDob)) {
      return NextResponse.json(
        { error: 'Vui lòng chọn ngày sinh hợp lệ.' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, code, title, exam_type, duration_minutes, status, class_id, school_id, is_practice_homework')
      .eq('code', code.toUpperCase())
      .single()

    if (sessionErr || !session || session.status !== 'active') {
      return NextResponse.json(
        { error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const sess = session
    const userId = user.id

    const practiceHomework = Boolean((sess as { is_practice_homework?: boolean }).is_practice_homework)
    const reqLocale = resolveWebLocaleFromAcceptLanguage(req.headers.get('accept-language'))
    const sessionTitleFallback = resolveDefaultExamSessionTitle(reqLocale, practiceHomework)
    const resolvedSessionTitle =
      String(sess.title ?? '').trim() || sessionTitleFallback

    if (sess.class_id) {
      const ok = await hasCompleteClassEnrollment(supabase, String(sess.class_id), userId)
      if (!ok) {
        return NextResponse.json(
          { error: CLASS_ENROLLMENT_ERROR_VI },
          { status: 403, headers: NO_STORE_HEADERS }
        )
      }
    }

    let className: string | null = null
    let schoolName: string | null = null
    if (sess.class_id) {
      const { data: cls } = await supabase
        .from('classes')
        .select('name, school_id')
        .eq('id', sess.class_id)
        .maybeSingle()
      className = cls?.name ?? null
      const schoolId = String(sess.school_id ?? cls?.school_id ?? '').trim()
      if (schoolId) {
        const { data: school } = await supabase
          .from('schools')
          .select('name')
          .eq('id', schoolId)
          .maybeSingle()
        schoolName = school?.name ?? null
      }
    }

    let classExamIdentity: { displayName: string; birthDate: string } | null = null
    if (sess.class_id) {
      classExamIdentity = await getClassMemberExamIdentity(
        supabase,
        String(sess.class_id),
        userId
      )
    }

    let attemptSelectForQueries: string = ATTEMPT_SELECT_WITH_DEADLINE

    let existingRows: ExistingAttemptRow[] | null = null
    let exErr: { message: string; code?: string } | null = null
    {
      let res = await supabase
        .from('exam_attempts')
        .select(attemptSelectForQueries)
        .eq('session_id', sess.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      if (res.error && isDeadlineColumnError(res.error)) {
        attemptSelectForQueries = ATTEMPT_SELECT_NO_DEADLINE
        res = await supabase
          .from('exam_attempts')
          .select(attemptSelectForQueries)
          .eq('session_id', sess.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
      }
      existingRows = (res.data as ExistingAttemptRow[] | null) ?? null
      exErr = res.error
    }

    if (exErr) {
      if (
        isPostgrestSchemaMissingColumn(exErr, 'layout_snapshot') ||
        isPostgrestSchemaMissingColumn(exErr, 'essay_submission')
      ) {
        return examDbSchemaNotReadyResponse({
          examCode: code.toUpperCase(),
          err: exErr,
          context: 'select',
        })
      }
      console.error(
        '[exam-session begin-attempt] select attempts:',
        code.toUpperCase(),
        exErr.message,
        exErr.code
      )
      return NextResponse.json(
        {
          error: 'Không thể kiểm tra phiên làm bài trước đó.',
          errorCode: exErr.code ?? null,
          errorDetails: exErr.message ?? null,
        },
        { status: 500, headers: NO_STORE_HEADERS }
      )
    }

    const existingAttempt: ExistingAttemptRow | null = existingRows?.[0] ?? null

    if (existingAttempt?.submitted_at) {
      return NextResponse.json(
        { error: 'Bạn đã nộp bài thi này rồi.' },
        { status: 409, headers: NO_STORE_HEADERS }
      )
    }

    const durationMin = typeof sess.duration_minutes === 'number' ? sess.duration_minutes : 15

    async function buildResumeFromRow(
      attemptRow: {
        layout_snapshot: unknown
        answers: unknown
        essay_submission: unknown
        started_at: string | null
        deadline_at?: string | null
      },
      resumeInProgress: boolean
    ) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (!snap) return null
      const { data: questions, error: questionsErr } = await supabase
        .from('exam_questions')
        .select('id, question_text, options, correct_index, source, order')
        .eq('session_id', sess.id)
        .order('order', { ascending: true })
      if (questionsErr || !questions?.length) return null
      const publicQuestions = rebuildPublicFromSnapshot(questions as ExamQuestionRow[], snap)
      if (!publicQuestions) return null
      const serverNowMs = Date.now()
      const endMs =
        resolveDeadlineEndMs(attemptRow.deadline_at, attemptRow.started_at, durationMin) ??
        serverNowMs + durationMin * 60_000
      const expJwt = Math.max(300, Math.floor((endMs - serverNowMs) / 1000) + 7200)
      const layoutToken = await signExamLayoutToken(
        { sessionId: String(sess.id), userId: userId, optionPerms: snap.optionPerms },
        expJwt
      )
      return buildActiveAttemptSessionJson({
        session: sess,
        resolvedTitle: resolvedSessionTitle,
        practiceHomework,
        className,
        schoolName,
        classExamIdentity,
        layoutToken,
        publicQuestions,
        attemptRow,
        resumeInProgress,
      })
    }

    if (existingAttempt && !existingAttempt.submitted_at) {
      const serverNowMs = Date.now()
      if (
        isServerDeadlinePassed(
          existingAttempt.deadline_at,
          existingAttempt.started_at,
          durationMin,
          serverNowMs
        )
      ) {
        const finalized = await tryFinalizeOverdueExamAttempt({
          supabase,
          sessionId: String(sess.id),
          sessionTitle: resolvedSessionTitle,
          durationMinutes: durationMin,
          practiceHomework,
          attemptId: String(existingAttempt.id),
          layoutSnapshot: existingAttempt.layout_snapshot,
          answers: existingAttempt.answers,
          essaySubmission: existingAttempt.essay_submission,
          serverNowMs,
        })
        if (finalized) {
          return NextResponse.json(
            {
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
              submittedDueToServerDeadline: true,
            },
            { headers: NO_STORE_HEADERS }
          )
        }
        const reopenedMain = await fetchAlreadySubmittedPayloadForAttempt(
          supabase,
          String(existingAttempt.id),
          practiceHomework,
          resolvedSessionTitle,
          durationMin
        )
        if (reopenedMain) {
          return NextResponse.json(reopenedMain, { headers: NO_STORE_HEADERS })
        }
        return NextResponse.json(
          {
            error:
              'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
          },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }
      const resumed = await buildResumeFromRow(existingAttempt, false)
      if (resumed) {
        return NextResponse.json(resumed, { headers: NO_STORE_HEADERS })
      }
      await supabase.from('exam_attempts').delete().eq('id', existingAttempt.id)
    }

    const { data: questions, error: questionsErr } = await supabase
      .from('exam_questions')
      .select('id, question_text, options, correct_index, source, order')
      .eq('session_id', sess.id)
      .order('order', { ascending: true })

    if (questionsErr || !questions?.length) {
      return NextResponse.json(
        { error: 'Bài thi chưa có câu hỏi.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    const { snapshot, publicQuestions } = buildFreshExamLayout(questions as ExamQuestionRow[])
    const startedDate = new Date()
    const startedIso = startedDate.toISOString()
    const deadlineIso = new Date(startedDate.getTime() + durationMin * 60_000).toISOString()
    const expJwt = Math.max(300, Math.floor((Date.parse(deadlineIso) - Date.now()) / 1000) + 7200)
    const layoutToken = await signExamLayoutToken(
      {
        sessionId: String(sess.id),
        userId: userId,
        optionPerms: snapshot.optionPerms,
      },
      expJwt
    )

    const insertPayload: ExamAttemptInsertPayload = {
      session_id: sess.id,
      user_id: userId,
      class_id: sess.class_id ?? null,
      school_id: sess.school_id ?? null,
      student_name: studentName || null,
      student_code: studentDob || null,
      answers: {},
      essay_submission: {},
      score: 0,
      max_score: 0,
      started_at: startedIso,
      submitted_at: null,
      deadline_at: deadlineIso,
      layout_snapshot: snapshot,
    }

    async function insertExamAttemptRow(
      full: ExamAttemptInsertPayload
    ): Promise<
      | { ok: true; storedDeadlineInDb: boolean }
      | { ok: false; error: { message: string; code?: string } }
    > {
      const r = await supabase.from('exam_attempts').insert(full)
      if (!r.error) return { ok: true, storedDeadlineInDb: true }
      if (isDeadlineColumnError(r.error)) {
        const { deadline_at, ...rest } = full
        void deadline_at
        const r2 = await supabase
          .from('exam_attempts')
          .insert(rest as Omit<ExamAttemptInsertPayload, 'deadline_at'>)
        if (!r2.error) return { ok: true, storedDeadlineInDb: false }
        return { ok: false, error: r2.error }
      }
      return { ok: false, error: r.error }
    }

    let lastInsertErr: { message: string; code?: string } | null = null

    for (let insertRound = 0; insertRound < 2; insertRound++) {
      const ins = await insertExamAttemptRow(insertPayload)

      if (ins.ok) {
        return NextResponse.json(
          buildActiveAttemptSessionJson({
            session: sess,
            resolvedTitle: resolvedSessionTitle,
            practiceHomework,
            className,
            schoolName,
            classExamIdentity,
            layoutToken,
            publicQuestions,
            attemptRow: {
              answers: {},
              essay_submission: {},
              started_at: startedIso,
              deadline_at: ins.storedDeadlineInDb ? deadlineIso : null,
            },
            resumeInProgress: false,
          }),
          { headers: NO_STORE_HEADERS }
        )
      }

      const insertErr = ins.error
      if (
        isPostgrestSchemaMissingColumn(insertErr, 'layout_snapshot') ||
        isPostgrestSchemaMissingColumn(insertErr, 'essay_submission')
      ) {
        return examDbSchemaNotReadyResponse({
          examCode: code.toUpperCase(),
          err: insertErr,
          context: 'insert',
        })
      }
      lastInsertErr = insertErr
      const codePg = (insertErr as { code?: string }).code
      if (codePg !== '23505' || insertRound === 1) {
        break
      }

      const { data: againRows } = await supabase
        .from('exam_attempts')
        .select(attemptSelectForQueries)
        .eq('session_id', sess.id)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)

      const again: ExistingAttemptRow | null = (againRows?.[0] as ExistingAttemptRow | undefined) ?? null

      if (again?.submitted_at) {
        return NextResponse.json(
          { error: 'Bạn đã nộp bài thi này rồi.' },
          { status: 409, headers: NO_STORE_HEADERS }
        )
      }

      if (!again) {
        break
      }

      const nowMs = Date.now()
      if (isServerDeadlinePassed(again.deadline_at, again.started_at, durationMin, nowMs)) {
        const finalized = await tryFinalizeOverdueExamAttempt({
          supabase,
          sessionId: String(sess.id),
          sessionTitle: resolvedSessionTitle,
          durationMinutes: durationMin,
          practiceHomework,
          attemptId: String(again.id),
          layoutSnapshot: again.layout_snapshot,
          answers: again.answers,
          essaySubmission: again.essay_submission,
          serverNowMs: nowMs,
        })
        if (finalized) {
          return NextResponse.json(
            {
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
              submittedDueToServerDeadline: true,
            },
            { headers: NO_STORE_HEADERS }
          )
        }
        const reopenedRace = await fetchAlreadySubmittedPayloadForAttempt(
          supabase,
          String(again.id),
          practiceHomework,
          resolvedSessionTitle,
          durationMin
        )
        if (reopenedRace) {
          return NextResponse.json(reopenedRace, { headers: NO_STORE_HEADERS })
        }
        return NextResponse.json(
          {
            error:
              'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
          },
          { status: 503, headers: NO_STORE_HEADERS }
        )
      }

      const resumed = await buildResumeFromRow(again, true)
      if (resumed) {
        return NextResponse.json(resumed, { headers: NO_STORE_HEADERS })
      }

      await supabase.from('exam_attempts').delete().eq('id', again.id)
    }

    console.error(
      '[exam-session begin-attempt] insert:',
      code.toUpperCase(),
      lastInsertErr?.message,
      lastInsertErr?.code
    )
    return NextResponse.json(
      {
        error: 'Không thể bắt đầu phiên làm bài.',
        errorCode: lastInsertErr?.code ?? null,
        errorDetails: lastInsertErr?.message ?? null,
      },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session begin-attempt] error:', msg)
    return NextResponse.json(
      { error: `Lỗi: ${msg}` },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { resolveWebLocaleFromAcceptLanguage } from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { getExamAttemptFeedbackWithMeta, parseExamGradingMeta } from '@/lib/exam-feedback'
import { signExamLayoutToken } from '@/lib/exam-layout-token'
import { getClassMemberExamIdentity } from '@/lib/lop/require-class-enrollment'
import {
  parseLayoutSnapshot,
  rebuildPublicFromSnapshot,
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

/** Lấy thông tin phiên thi theo mã. Câu hỏi chỉ trả khi đã có attempt đang làm (GET resume) hoặc sau POST begin-attempt. */
export async function GET(
  _req: NextRequest,
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

    const practiceHomework = Boolean((session as { is_practice_homework?: boolean }).is_practice_homework)
    const reqLocale = resolveWebLocaleFromAcceptLanguage(_req.headers.get('accept-language'))
    const sessionTitleFallback = resolveDefaultExamSessionTitle(reqLocale, practiceHomework)
    const resolvedSessionTitle =
      String(session.title ?? '').trim() || sessionTitleFallback

    const { data: priorAttempt, error: priorErr } = await supabase
      .from('exam_attempts')
      .select(
        'id, submitted_at, score, max_score, grading_meta, layout_snapshot, answers, essay_submission, student_name, student_code, started_at, deadline_at'
      )
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    let attemptRow = !priorErr ? priorAttempt : null

    if (attemptRow && attemptRow.submitted_at == null) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (!snap) {
        await supabase.from('exam_attempts').delete().eq('id', attemptRow.id)
        attemptRow = null
      }
    }

    if (attemptRow && attemptRow.submitted_at != null) {
      const sc = Number(attemptRow.score ?? 0)
      const mx = Number(attemptRow.max_score ?? 0)
      const meta = parseExamGradingMeta(attemptRow.grading_meta)
      const feedback = getExamAttemptFeedbackWithMeta(sc, mx, meta)
      const durationMin = typeof session.duration_minutes === 'number' ? session.duration_minutes : 15
      return NextResponse.json(
        {
          alreadySubmitted: true,
          practiceHomework,
          title: resolvedSessionTitle,
          durationMinutes: durationMin,
          score: sc,
          maxScore: mx,
          grade10: feedback.grade10,
          scoreOn100: feedback.scoreOn100,
          comment: feedback.comment,
          shareHint: feedback.shareHint,
          scoringBreakdown: meta ?? undefined,
          submittedDueToServerDeadline: meta?.submittedByServerDeadline === true,
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    let className: string | null = null
    let schoolName: string | null = null
    if (session.class_id) {
      const { data: cls } = await supabase
        .from('classes')
        .select('name, school_id')
        .eq('id', session.class_id)
        .maybeSingle()
      className = cls?.name ?? null
      const schoolId = String(session.school_id ?? cls?.school_id ?? '').trim()
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
    if (session.class_id) {
      classExamIdentity = await getClassMemberExamIdentity(
        supabase,
        String(session.class_id),
        user.id
      )
      if (!classExamIdentity) {
        return NextResponse.json(
          {
            needsEnrollment: true,
            practiceHomework,
            title: resolvedSessionTitle,
            durationMinutes:
              typeof session.duration_minutes === 'number' ? session.duration_minutes : 15,
            className,
            schoolName,
          },
          { headers: NO_STORE_HEADERS }
        )
      }
    }

    const durationMin = typeof session.duration_minutes === 'number' ? session.duration_minutes : 15
    const serverNowMs = Date.now()

    if (attemptRow && attemptRow.submitted_at == null) {
      const snap = parseLayoutSnapshot(attemptRow.layout_snapshot)
      if (snap) {
        if (
          isServerDeadlinePassed(
            attemptRow.deadline_at,
            attemptRow.started_at,
            durationMin,
            serverNowMs
          )
        ) {
          const finalized = await tryFinalizeOverdueExamAttempt({
            supabase,
            sessionId: String(session.id),
            sessionTitle: resolvedSessionTitle,
            durationMinutes: durationMin,
            practiceHomework,
            attemptId: String(attemptRow.id),
            layoutSnapshot: attemptRow.layout_snapshot,
            answers: attemptRow.answers,
            essaySubmission: attemptRow.essay_submission,
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
          const reopened = await fetchAlreadySubmittedPayloadForAttempt(
            supabase,
            String(attemptRow.id),
            practiceHomework,
            resolvedSessionTitle,
            durationMin
          )
          if (reopened) {
            return NextResponse.json(reopened, { headers: NO_STORE_HEADERS })
          }
          return NextResponse.json(
            {
              error:
                'Đã hết giờ làm bài nhưng hệ thống chưa ghi nhận xong. Vui lòng tải lại trang sau vài giây.',
            },
            { status: 503, headers: NO_STORE_HEADERS }
          )
        }

        const { data: questions, error: questionsErr } = await supabase
          .from('exam_questions')
          .select('id, question_text, options, correct_index, source, order')
          .eq('session_id', session.id)
          .order('order', { ascending: true })

        if (!questionsErr && questions?.length) {
          const publicQuestions = rebuildPublicFromSnapshot(questions as ExamQuestionRow[], snap)
          if (publicQuestions?.length) {
            const endMs =
              resolveDeadlineEndMs(
                attemptRow.deadline_at,
                attemptRow.started_at,
                durationMin
              ) ?? serverNowMs + durationMin * 60_000
            const expJwt = Math.max(300, Math.floor((endMs - serverNowMs) / 1000) + 7200)
            const layoutToken = await signExamLayoutToken(
              { sessionId: String(session.id), userId: user.id, optionPerms: snap.optionPerms },
              expJwt
            )
            return NextResponse.json(
              buildActiveAttemptSessionJson({
                session,
                resolvedTitle: resolvedSessionTitle,
                practiceHomework,
                className,
                schoolName,
                classExamIdentity,
                layoutToken,
                publicQuestions,
                attemptRow,
                resumeInProgress: true,
              }),
              { headers: NO_STORE_HEADERS }
            )
          }
        }
      }
    }

    const { data: anyQuestion, error: anyQErr } = await supabase
      .from('exam_questions')
      .select('id')
      .eq('session_id', session.id)
      .limit(1)
      .maybeSingle()

    if (anyQErr || !anyQuestion) {
      return NextResponse.json(
        { error: 'Bài thi chưa có câu hỏi.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        mustBegin: true,
        code: session.code,
        title: resolvedSessionTitle,
        durationMinutes: session.duration_minutes,
        classId: session.class_id ?? null,
        schoolId: session.school_id ?? null,
        className,
        schoolName,
        classExamIdentity,
        practiceHomework,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] GET error:', msg)
    return NextResponse.json(
      { error: `Lỗi: ${msg}` },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}

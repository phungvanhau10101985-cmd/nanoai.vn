import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { resolveWebLocaleFromAcceptLanguage } from '@/lib/i18n/config'
import { resolveDefaultExamSessionTitle } from '@/lib/i18n/exam-session-default-titles'
import { getExamAttemptFeedbackWithMeta, parseExamGradingMeta } from '@/lib/exam-feedback'
import { shuffleArray, signExamLayoutToken } from '@/lib/exam-layout-token'
import { getClassMemberExamIdentity } from '@/lib/lop/require-class-enrollment'

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
}

/** Lấy thông tin phiên thi và câu hỏi theo mã (public – học sinh mở link). */
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
      .select('score, max_score, grading_meta')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!priorErr && priorAttempt) {
      const sc = Number(priorAttempt.score ?? 0)
      const mx = Number(priorAttempt.max_score ?? 0)
      const meta = parseExamGradingMeta(priorAttempt.grading_meta)
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

    const { data: questions, error: questionsErr } = await supabase
      .from('exam_questions')
      .select('id, question_text, options, correct_index, source, order')
      .eq('session_id', session.id)
      .order('order', { ascending: true })

    if (questionsErr || !questions?.length) {
      return NextResponse.json(
        { error: 'Bài thi chưa có câu hỏi.' },
        { status: 404, headers: NO_STORE_HEADERS }
      )
    }

    type QRow = (typeof questions)[number]
    const isEssayRow = (q: QRow) =>
      String(q.source ?? '').toLowerCase().includes('essay') ||
      !Array.isArray(q.options) ||
      (q.options as unknown[]).length < 2

    const quizRows = (questions ?? []).filter((q) => !isEssayRow(q))
    const essayRows = (questions ?? []).filter((q) => isEssayRow(q))
    const orderedRows = [...shuffleArray(quizRows), ...shuffleArray(essayRows)]

    const optionPerms: Record<string, number[]> = {}
    const publicQuestions = orderedRows.map((q, i) => {
      const rawOpts = Array.isArray(q.options) ? (q.options as string[]) : []
      if (rawOpts.length >= 2) {
        const n = rawOpts.length
        const perm = shuffleArray([...Array.from({ length: n }, (_, k) => k)])
        const displayOpts = perm.map((origIdx) => String(rawOpts[origIdx] ?? ''))
        optionPerms[String(q.id)] = perm
        return {
          id: q.id,
          index: i + 1,
          type: 'quiz' as const,
          question_text: q.question_text,
          options: displayOpts,
        }
      }
      return {
        id: q.id,
        index: i + 1,
        type: 'essay' as const,
        question_text: q.question_text,
        options: [] as string[],
      }
    })

    const durationMin = typeof session.duration_minutes === 'number' ? session.duration_minutes : 15
    const layoutToken = await signExamLayoutToken(
      {
        sessionId: String(session.id),
        userId: user.id,
        optionPerms,
      },
      Math.max(86400, durationMin * 180 + 7200)
    )

    return NextResponse.json(
      {
        code: session.code,
        title: resolvedSessionTitle,
        durationMinutes: session.duration_minutes,
        classId: session.class_id ?? null,
        schoolId: session.school_id ?? null,
        className,
        schoolName,
        classExamIdentity,
        layoutToken,
        questions: publicQuestions,
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

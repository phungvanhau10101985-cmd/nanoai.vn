import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { parseExamGradingMeta } from '@/lib/exam-feedback'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params
    if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
      return NextResponse.json({ error: 'Thiếu mã bài làm.' }, { status: 400 })
    }

    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const db = admin()
    const { data: att, error: aErr } = await db
      .from('exam_attempts')
      .select(
        'id, session_id, user_id, student_name, answers, essay_submission, score, max_score, grading_meta, submitted_at'
      )
      .eq('id', attemptId)
      .maybeSingle()

    if (aErr || !att) return NextResponse.json({ error: 'Không tìm thấy bài làm.' }, { status: 404 })

    const { data: session, error: sErr } = await db
      .from('exam_sessions')
      .select('id, code, title, teacher_id')
      .eq('id', att.session_id)
      .maybeSingle()

    if (sErr || !session) return NextResponse.json({ error: 'Không tìm thấy phiên thi.' }, { status: 404 })
    if (String(session.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xem bài làm này.' }, { status: 403 })
    }

    const { data: questions, error: qErr } = await db
      .from('exam_questions')
      .select('id, question_text, options, correct_index, order')
      .eq('session_id', session.id)
      .order('order', { ascending: true })

    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    const items = (questions ?? []).map((q, idx) => {
      const opts = Array.isArray(q.options) ? q.options : []
      const hasChoice = opts.length >= 2
      return {
        id: String(q.id),
        index: idx + 1,
        questionText: String(q.question_text ?? ''),
        isEssay: !hasChoice,
      }
    })

    const essaySubmission =
      att.essay_submission && typeof att.essay_submission === 'object'
        ? (att.essay_submission as Record<string, { text?: string; imageUrls?: string[] }>)
        : {}

    return NextResponse.json({
      examCode: String(session.code ?? ''),
      examTitle: String(session.title ?? 'Bài thi'),
      attempt: {
        id: att.id,
        studentName: String(att.student_name ?? ''),
        userId: att.user_id ? String(att.user_id) : null,
        submittedAt: att.submitted_at,
        score: Number(att.score ?? 0),
        maxScore: Number(att.max_score ?? 0),
        answers: att.answers && typeof att.answers === 'object' ? att.answers : {},
        essaySubmission,
        gradingMeta: parseExamGradingMeta(att.grading_meta),
      },
      questions: items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

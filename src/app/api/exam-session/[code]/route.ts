import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Lấy thông tin phiên thi và câu hỏi theo mã (public – học sinh mở link). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id, code, title, exam_type, duration_minutes, status')
      .eq('code', code.toUpperCase())
      .single()

    if (sessionErr || !session || session.status !== 'active') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' }, { status: 404 })
    }

    const { data: questions, error: questionsErr } = await supabase
      .from('exam_questions')
      .select('id, question_text, options, correct_index, order')
      .eq('session_id', session.id)
      .order('order', { ascending: true })

    if (questionsErr || !questions?.length) {
      return NextResponse.json({ error: 'Bài thi chưa có câu hỏi.' }, { status: 404 })
    }

    const shuffled = [...questions].sort(() => Math.random() - 0.5)
    const publicQuestions = shuffled.map((q, i) => ({
      id: q.id,
      index: i + 1,
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
    }))

    return NextResponse.json({
      code: session.code,
      title: session.title,
      durationMinutes: session.duration_minutes,
      questions: publicQuestions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] GET error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

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
      return NextResponse.json({ error: 'Vui lòng đăng nhập để làm bài thi.' }, { status: 401 })
    }

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
      .select('id, code, title, exam_type, duration_minutes, status, class_id, school_id')
      .eq('code', code.toUpperCase())
      .single()

    if (sessionErr || !session || session.status !== 'active') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi hoặc bài thi đã đóng.' }, { status: 404 })
    }

    const { data: questions, error: questionsErr } = await supabase
      .from('exam_questions')
      .select('id, question_text, options, correct_index, source, order')
      .eq('session_id', session.id)
      .order('order', { ascending: true })

    if (questionsErr || !questions?.length) {
      return NextResponse.json({ error: 'Bài thi chưa có câu hỏi.' }, { status: 404 })
    }

    if (session.class_id) {
      await supabase.from('class_members').upsert(
        { class_id: session.class_id, user_id: user.id },
        { onConflict: 'class_id,user_id' }
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

    const shuffled = [...questions].sort(() => Math.random() - 0.5)
    const publicQuestions = shuffled.map((q, i) => ({
      id: q.id,
      index: i + 1,
      type: String(q.source ?? '').includes('essay') ? 'essay' : 'quiz',
      question_text: q.question_text,
      options: Array.isArray(q.options) ? q.options : [],
    }))

    return NextResponse.json({
      code: session.code,
      title: session.title,
      durationMinutes: session.duration_minutes,
      classId: session.class_id ?? null,
      schoolId: session.school_id ?? null,
      className,
      schoolName,
      questions: publicQuestions,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-session] GET error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/** Nộp bài – lưu exam_attempts, chấm điểm. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    if (!code || code.length < 4) {
      return NextResponse.json({ error: 'Mã bài thi không hợp lệ.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const studentName = String(body?.studentName ?? '').trim()
    const studentCode = String(body?.studentCode ?? '').trim()
    const answers = body?.answers
    if (!answers || typeof answers !== 'object') {
      return NextResponse.json({ error: 'Thiếu đáp án.' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    const { data: session, error: sessionErr } = await supabase
      .from('exam_sessions')
      .select('id')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, correct_index')
      .eq('session_id', session.id)

    const qMap = new Map((questions ?? []).map((q) => [q.id, q]))
    let score = 0
    const maxScore = qMap.size
    for (const [id, userAnswer] of Object.entries(answers)) {
      const q = qMap.get(id)
      if (!q) continue
      const correctIdx = q.correct_index ?? 0
      const userIdx = typeof userAnswer === 'number' ? userAnswer : parseInt(String(userAnswer), 10)
      if (userIdx === correctIdx) score++
    }

    const { error: insertErr } = await supabase.from('exam_attempts').insert({
      session_id: session.id,
      student_name: studentName || null,
      student_code: studentCode || null,
      answers,
      score,
      max_score: maxScore,
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
    })

    if (insertErr) {
      console.error('[exam-submit] Insert failed:', insertErr.message)
      return NextResponse.json({ error: 'Lưu bài làm thất bại.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      score,
      maxScore,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-submit] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}

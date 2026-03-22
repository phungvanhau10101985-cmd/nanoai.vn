import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

/** Nhận xét khích lệ theo % đúng – thang điểm 10 */
function getFeedback(score: number, maxScore: number): { grade10: number; comment: string; shareHint: string } {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0
  const grade10 = maxScore > 0 ? Math.round((score / maxScore) * 10 * 10) / 10 : 0

  if (pct >= 90) {
    return {
      grade10,
      comment: `Xuất sắc! Điểm ${grade10}/10. Em đã nắm vững kiến thức. Tiếp tục phát huy nhé!`,
      shareHint: 'Chia sẻ kết quả với bạn bè!',
    }
  }
  if (pct >= 80) {
    return {
      grade10,
      comment: `Rất tốt! Điểm ${grade10}/10. Em làm bài rất tốt. Hãy giữ vững phong độ!`,
      shareHint: 'Chia sẻ thành tích với mọi người.',
    }
  }
  if (pct >= 70) {
    return {
      grade10,
      comment: `Tốt! Điểm ${grade10}/10. Em đã hoàn thành tốt. Ôn thêm một chút sẽ càng giỏi hơn!`,
      shareHint: '',
    }
  }
  if (pct >= 50) {
    return {
      grade10,
      comment: `Điểm ${grade10}/10. Em đã cố gắng. Hãy xem lại các câu sai và ôn tập thêm nhé!`,
      shareHint: '',
    }
  }
  return {
    grade10,
    comment: `Điểm ${grade10}/10. Đừng nản lòng! Mỗi lần sai là một cơ hội để học hỏi. Em hãy ôn lại và thử lại lần sau nhé!`,
    shareHint: '',
  }
}

/** Nộp bài – lưu exam_attempts, chấm thang 10, mỗi người chỉ làm một lần. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const serverSupabase = createServerClient()
    const { data: authData } = await serverSupabase.auth.getUser()
    const user = authData.user
    if (!user) {
      return NextResponse.json({ error: 'Vui lòng đăng nhập để nộp bài thi.' }, { status: 401 })
    }

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
      .select('id, class_id, school_id')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    if (session.class_id) {
      await supabase.from('class_members').upsert(
        { class_id: session.class_id, user_id: user.id },
        { onConflict: 'class_id,user_id' }
      )
    }

    const { data: existing } = await supabase
      .from('exam_attempts')
      .select('id')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .limit(1)

    if (existing?.length) {
      return NextResponse.json({ error: 'Bạn đã nộp bài thi này rồi. Mỗi tài khoản chỉ được làm một lần.' }, { status: 409 })
    }

    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, correct_index, options')
      .eq('session_id', session.id)

    const qMap = new Map((questions ?? []).map((q) => [q.id, q]))
    let score = 0
    const scorableQuestionIds = new Set(
      (questions ?? [])
        .filter((q) => Array.isArray(q.options) && q.options.length >= 2 && typeof q.correct_index === 'number')
        .map((q) => q.id)
    )
    const maxScore = scorableQuestionIds.size
    for (const [id, userAnswer] of Object.entries(answers)) {
      const q = qMap.get(id)
      if (!q) continue
      if (!scorableQuestionIds.has(id)) continue
      const correctIdx = q.correct_index ?? 0
      const userIdx = typeof userAnswer === 'number' ? userAnswer : parseInt(String(userAnswer), 10)
      if (userIdx === correctIdx) score++
    }

    const feedback = getFeedback(score, maxScore)

    const { error: insertErr } = await supabase.from('exam_attempts').insert({
      session_id: session.id,
      user_id: user.id,
      class_id: session.class_id ?? null,
      school_id: session.school_id ?? null,
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
      grade10: feedback.grade10,
      comment: feedback.comment,
      shareHint: feedback.shareHint,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-submit] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}

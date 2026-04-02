import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getExamAttemptFeedbackWithMeta, parseExamGradingMeta, type ExamGradingMeta } from '@/lib/exam-feedback'
import { notifyExamEssayGraded } from '@/lib/notifications/notify-job-events'

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ attemptId: string }> }
) {
  try {
    const { attemptId } = await params
    if (!attemptId || !/^[0-9a-f-]{36}$/i.test(attemptId)) {
      return NextResponse.json({ error: 'Thiếu mã bài làm.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const essayPointsAwarded = Number(body?.essayPointsAwarded)
    if (!Number.isFinite(essayPointsAwarded) || essayPointsAwarded < 0) {
      return NextResponse.json({ error: 'Điểm tự luận không hợp lệ.' }, { status: 400 })
    }

    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const db = admin()
    const { data: att, error: aErr } = await db
      .from('exam_attempts')
      .select('id, session_id, user_id, score, max_score, grading_meta')
      .eq('id', attemptId)
      .maybeSingle()

    if (aErr || !att) return NextResponse.json({ error: 'Không tìm thấy bài làm.' }, { status: 404 })

    const { data: session, error: sErr } = await db
      .from('exam_sessions')
      .select('teacher_id, code')
      .eq('id', att.session_id)
      .maybeSingle()

    if (sErr || !session) return NextResponse.json({ error: 'Không tìm thấy phiên thi.' }, { status: 404 })
    if (String(session.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền chấm bài này.' }, { status: 403 })
    }

    const meta = parseExamGradingMeta(att.grading_meta)
    if (!meta || meta.essayPointsMax <= 0) {
      return NextResponse.json({ error: 'Bài thi không có phần tự luận để chấm.' }, { status: 400 })
    }

    const awarded = Math.round(Math.min(meta.essayPointsMax, essayPointsAwarded) * 100) / 100
    const quizPts = Math.round(meta.quizPoints * 100) / 100
    const newScore = Math.round(Math.min(Number(att.max_score ?? 0), quizPts + awarded) * 100) / 100

    const newMeta: ExamGradingMeta = {
      ...meta,
      essayPointsAwarded: awarded,
      essayGradedAt: new Date().toISOString(),
    }

    const { error: uErr } = await db
      .from('exam_attempts')
      .update({
        score: newScore,
        grading_meta: newMeta,
      })
      .eq('id', attemptId)

    if (uErr) {
      console.error('[essay-grade]', uErr.message)
      return NextResponse.json({ error: 'Cập nhật điểm thất bại.' }, { status: 500 })
    }

    const studentId = att.user_id ? String(att.user_id) : ''
    const sessionCode = session.code ? String(session.code) : ''
    if (studentId && sessionCode) {
      await notifyExamEssayGraded(db, {
        studentUserId: studentId,
        sessionCode,
        attemptId,
        essayPoints: awarded,
        essayMax: meta.essayPointsMax,
        totalScore: newScore,
        maxScore: Number(att.max_score ?? 0),
      })
    }

    const maxScore = Number(att.max_score ?? 0)
    const fb = getExamAttemptFeedbackWithMeta(newScore, maxScore, newMeta)

    return NextResponse.json({
      success: true,
      score: newScore,
      maxScore,
      grade10: fb.grade10,
      scoreOn100: fb.scoreOn100,
      comment: fb.comment,
      gradingMeta: newMeta,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

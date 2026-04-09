import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import {
  fetchExamAttemptEssayGradeBundlePg,
  updateExamAttemptEssayGradeScoresPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getExamAttemptFeedbackWithMeta, parseExamGradingMeta, type ExamGradingMeta } from '@/lib/exam-feedback'
import { notifyExamEssayGraded } from '@/lib/notifications/notify-job-events'

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

    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const bundle = await fetchExamAttemptEssayGradeBundlePg(attemptId, user.id)
    if (bundle === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài làm.' }, { status: 500 })
    }
    if (bundle === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài làm.' }, { status: 404 })
    }
    if (bundle === 'forbidden') {
      return NextResponse.json({ error: 'Bạn không có quyền chấm bài này.' }, { status: 403 })
    }

    const { attempt: att, session } = bundle

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

    const ok = await updateExamAttemptEssayGradeScoresPg(attemptId, user.id, newScore, newMeta)
    if (ok === null || !ok) {
      console.error('[essay-grade] update failed')
      return NextResponse.json({ error: 'Cập nhật điểm thất bại.' }, { status: 500 })
    }

    const studentId = att.user_id ? String(att.user_id) : ''
    const sessionCode = session.code ? String(session.code) : ''
    if (studentId && sessionCode) {
      await notifyExamEssayGraded({
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

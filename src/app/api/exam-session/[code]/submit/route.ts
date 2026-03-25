import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { getExamAttemptFeedbackWithMeta } from '@/lib/exam-feedback'
import { CLASS_ENROLLMENT_ERROR_VI, hasCompleteClassEnrollment } from '@/lib/lop/require-class-enrollment'
import { isValidStudentDobIso } from '@/lib/student-dob'
import type { ExamLayoutSnapshotV1 } from '@/lib/exam-session/student-exam-layout'
import { gradeExamFromStoredAnswers } from '@/lib/exam-session/grade-exam-from-sources'
import { isServerDeadlinePassed } from '@/lib/exam-session/finalize-overdue-exam-attempt'

/** Nộp bài – điểm TN theo trọng số; TL chưa chấm. Một attempt / user; hết giờ server thì từ chối (tải lại để hệ thống nộp tự động). */
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
    const studentDob = String(body?.studentDob ?? '').trim()
    const layoutToken = String(body?.layoutToken ?? '').trim()
    const answers = body?.answers
    if (!studentName) {
      return NextResponse.json({ error: 'Vui lòng nhập họ tên học sinh.' }, { status: 400 })
    }
    if (!isValidStudentDobIso(studentDob)) {
      return NextResponse.json({ error: 'Vui lòng chọn ngày sinh hợp lệ.' }, { status: 400 })
    }
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
      .select('id, class_id, school_id, is_practice_homework, duration_minutes')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const practiceHomework = Boolean((session as { is_practice_homework?: boolean }).is_practice_homework)
    const durationMin =
      typeof session.duration_minutes === 'number' ? session.duration_minutes : 15

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(session.id) || layout.userId !== user.id) {
      return NextResponse.json(
        {
          error:
            'Phiên làm bài không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang đề thi rồi làm bài.',
        },
        { status: 400 }
      )
    }

    if (session.class_id) {
      const ok = await hasCompleteClassEnrollment(supabase, String(session.class_id), user.id)
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const { data: attemptRow } = await supabase
      .from('exam_attempts')
      .select('id, submitted_at, deadline_at, started_at')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (attemptRow?.submitted_at != null) {
      return NextResponse.json({ error: 'Bạn đã nộp bài thi này rồi. Mỗi tài khoản chỉ được làm một lần.' }, { status: 409 })
    }

    if (!attemptRow?.id) {
      return NextResponse.json(
        {
          error:
            'Chưa có phiên làm bài. Vui lòng tải lại trang và bấm Bắt đầu để làm bài.',
        },
        { status: 400 }
      )
    }

    const serverNowMs = Date.now()
    if (
      isServerDeadlinePassed(
        attemptRow.deadline_at,
        attemptRow.started_at,
        durationMin,
        serverNowMs
      )
    ) {
      return NextResponse.json(
        {
          error:
            'Đã hết thời gian làm bài trên hệ thống. Vui lòng tải lại trang để xem kết quả đã được ghi nhận.',
          errorCode: 'exam_deadline_passed',
        },
        { status: 400 }
      )
    }

    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, correct_index, options, points')
      .eq('session_id', session.id)

    const layoutSnap: ExamLayoutSnapshotV1 = {
      v: 1,
      questionOrder: [],
      optionPerms: layout.optionPerms,
    }

    const graded = gradeExamFromStoredAnswers(
      questions ?? [],
      layoutSnap,
      answers as Record<string, unknown>,
      body?.essaySubmission
    )
    if ('error' in graded) {
      return NextResponse.json({ error: graded.error }, { status: 400 })
    }

    const feedback = getExamAttemptFeedbackWithMeta(graded.finalScore, graded.maxScore, graded.gradingMeta)

    const submittedIso = new Date().toISOString()
    const { data: updatedRows, error: updateErr } = await supabase
      .from('exam_attempts')
      .update({
        student_name: studentName || null,
        student_code: studentDob || null,
        answers,
        essay_submission: graded.essaySubmission,
        score: graded.finalScore,
        max_score: graded.maxScore,
        grading_meta: graded.gradingMeta,
        submitted_at: submittedIso,
      })
      .eq('id', attemptRow.id)
      .is('submitted_at', null)
      .select('id')

    if (updateErr) {
      console.error('[exam-submit] Update failed:', updateErr.message)
      return NextResponse.json({ error: 'Lưu bài làm thất bại.' }, { status: 500 })
    }
    if (!updatedRows?.length) {
      return NextResponse.json(
        { error: 'Bạn đã nộp bài thi này rồi. Mỗi tài khoản chỉ được làm một lần.' },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      practiceHomework,
      score: graded.finalScore,
      maxScore: graded.maxScore,
      grade10: feedback.grade10,
      scoreOn100: feedback.scoreOn100,
      comment: feedback.comment,
      shareHint: feedback.shareHint,
      scoringBreakdown: graded.gradingMeta,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[exam-submit] Error:', msg)
    return NextResponse.json({ error: `Lỗi: ${msg}` }, { status: 500 })
  }
}

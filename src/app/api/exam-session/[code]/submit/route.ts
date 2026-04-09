import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { hasCompleteClassMemberProfileForExamPg } from '@/lib/db/classes-pg'
import {
  fetchExamAttemptOpenForDraftPg,
  fetchExamQuestionsForGradingPg,
  fetchExamSessionActiveForStudentFlowPg,
  finalizeSubmitExamAttemptPg,
} from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { verifyExamLayoutToken } from '@/lib/exam-layout-token'
import { getExamAttemptFeedbackWithMeta } from '@/lib/exam-feedback'
import { CLASS_ENROLLMENT_ERROR_VI } from '@/lib/lop/require-class-enrollment'
import { isValidStudentDobIso } from '@/lib/student-dob'
import type { ExamLayoutSnapshotV1 } from '@/lib/exam-session/student-exam-layout'
import {
  gradeExamFromStoredAnswers,
  type ExamQuestionGradeRow,
} from '@/lib/exam-session/grade-exam-from-sources'
import { isServerDeadlinePassed } from '@/lib/exam-session/finalize-overdue-exam-attempt'

/** Nộp bài – điểm TN theo trọng số; TL chưa chấm. Một attempt / user; hết giờ server thì từ chối (tải lại để hệ thống nộp tự động). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const auth = await getUserForAction('Vui lòng đăng nhập để nộp bài thi.')
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }
    const user = auth.user

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

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const sessionRow = await fetchExamSessionActiveForStudentFlowPg(code.toUpperCase())
    if (sessionRow === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài thi.' }, { status: 500 })
    }
    if (sessionRow === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }

    const practiceHomework = sessionRow.is_practice_homework
    const durationMin = sessionRow.duration_minutes

    const layout = await verifyExamLayoutToken(layoutToken)
    if (!layout || layout.sessionId !== String(sessionRow.id) || layout.userId !== user.id) {
      return NextResponse.json(
        {
          error:
            'Phiên làm bài không hợp lệ hoặc đã hết hạn. Vui lòng tải lại trang đề thi rồi làm bài.',
        },
        { status: 400 }
      )
    }

    if (sessionRow.class_id) {
      const ok = await hasCompleteClassMemberProfileForExamPg(String(sessionRow.class_id), user.id)
      if (ok === null) {
        return NextResponse.json({ error: 'Lỗi kiểm tra tham gia lớp.' }, { status: 500 })
      }
      if (!ok) {
        return NextResponse.json({ error: CLASS_ENROLLMENT_ERROR_VI }, { status: 403 })
      }
    }

    const attemptState = await fetchExamAttemptOpenForDraftPg(sessionRow.id, user.id)
    if (attemptState === null) {
      return NextResponse.json({ error: 'Lỗi đọc phiên làm bài.' }, { status: 500 })
    }
    if (attemptState === 'submitted') {
      return NextResponse.json(
        { error: 'Bạn đã nộp bài thi này rồi. Mỗi tài khoản chỉ được làm một lần.' },
        { status: 409 }
      )
    }
    if (attemptState === 'missing') {
      return NextResponse.json(
        {
          error:
            'Chưa có phiên làm bài. Vui lòng tải lại trang và bấm Bắt đầu để làm bài.',
        },
        { status: 400 }
      )
    }
    const attemptRow = attemptState

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

    const questions = await fetchExamQuestionsForGradingPg(sessionRow.id)
    if (questions === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }
    if (questions.length === 0) {
      return NextResponse.json({ error: 'Bài thi chưa có câu hỏi.' }, { status: 400 })
    }

    const layoutSnap: ExamLayoutSnapshotV1 = {
      v: 1,
      questionOrder: [],
      optionPerms: layout.optionPerms,
    }

    const graded = gradeExamFromStoredAnswers(
      questions as ExamQuestionGradeRow[],
      layoutSnap,
      answers as Record<string, unknown>,
      body?.essaySubmission
    )
    if ('error' in graded) {
      return NextResponse.json({ error: graded.error }, { status: 400 })
    }

    const feedback = getExamAttemptFeedbackWithMeta(graded.finalScore, graded.maxScore, graded.gradingMeta)

    const submittedIso = new Date().toISOString()
    const updated = await finalizeSubmitExamAttemptPg({
      attemptId: attemptRow.id,
      studentName: studentName || null,
      studentCode: studentDob || null,
      answers,
      essaySubmission: graded.essaySubmission,
      score: graded.finalScore,
      maxScore: graded.maxScore,
      gradingMeta: graded.gradingMeta,
      submittedIso,
    })
    if (updated === null) {
      return NextResponse.json({ error: 'Lưu bài làm thất bại.' }, { status: 500 })
    }
    if (!updated) {
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

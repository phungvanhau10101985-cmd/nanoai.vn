import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchExamAttemptDetailForTeacherPg, fetchExamQuestionsForReviewPg } from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { parseExamGradingMeta } from '@/lib/exam-feedback'

type ExamQuestionRow = {
  id: string
  question_text?: unknown
  options?: unknown
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

    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const bundle = await fetchExamAttemptDetailForTeacherPg(attemptId, user.id)
    if (bundle === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài làm.' }, { status: 500 })
    }
    if (bundle === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài làm.' }, { status: 404 })
    }
    if (bundle === 'forbidden') {
      return NextResponse.json({ error: 'Bạn không có quyền xem bài làm này.' }, { status: 403 })
    }

    const { attempt: att, session } = bundle

    const questions = await fetchExamQuestionsForReviewPg(session.id)
    if (questions === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }

    const questionRows = questions as ExamQuestionRow[]
    const items = questionRows.map((q, idx) => {
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

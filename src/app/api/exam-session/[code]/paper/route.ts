import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchExamQuestionsForReviewPg, fetchExamSessionForTeacherReviewPg } from '@/lib/db/exam-session-pg'
import { isPgConfigured } from '@/lib/db/pool'

type ExamQuestionRow = {
  question_text?: unknown
  options?: unknown
}

/** Đề giáo viên chiếu: chỉ nội dung câu, không lời giải. Chỉ giáo viên sở hữu phiên. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const authResult = await getUserForAction()
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const sessionRes = await fetchExamSessionForTeacherReviewPg(String(code || '').trim().toUpperCase(), user.id)
    if (sessionRes === null) {
      return NextResponse.json({ error: 'Lỗi đọc bài thi.' }, { status: 500 })
    }
    if (sessionRes === 'not_found') {
      return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    }
    if (sessionRes === 'forbidden') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const questions = await fetchExamQuestionsForReviewPg(sessionRes.id)
    if (questions === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }

    const items = (questions as ExamQuestionRow[]).map((q, idx) => {
      const options = Array.isArray(q.options)
        ? q.options.map((x: unknown) => String(x ?? '').trim()).filter(Boolean)
        : []
      return {
        index: idx + 1,
        questionText: String(q.question_text ?? ''),
        options: options.length >= 2 ? options : [],
      }
    })

    return NextResponse.json({
      code: sessionRes.code,
      title: sessionRes.title,
      practiceHomework: sessionRes.is_practice_homework,
      durationMinutes: sessionRes.duration_minutes,
      questions: items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

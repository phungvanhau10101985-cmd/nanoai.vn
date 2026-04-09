import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { fetchExamQuestionsForReviewPg, fetchExamSessionForTeacherReviewPg } from '@/lib/db/exam-session-pg'
import { fetchWorksheetQuestionsTypeContentByIdsFromPg } from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

type ExamQuestionRow = {
  id: string
  question_text?: unknown
  options?: unknown
  correct_index?: unknown
  order?: unknown
  source?: unknown
  worksheet_question_id?: string | null
}

function indexToLetter(index: number): string {
  if (index === 0) return 'A'
  if (index === 1) return 'B'
  if (index === 2) return 'C'
  if (index === 3) return 'D'
  return '?'
}

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
      return NextResponse.json({ error: 'Bạn không có quyền xem chữa bài của đề này.' }, { status: 403 })
    }

    const session = sessionRes
    const questions = await fetchExamQuestionsForReviewPg(session.id)
    if (questions === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }

    const questionRows = questions as ExamQuestionRow[]
    const wsIds = Array.from(
      new Set(
        questionRows
          .map((q) => q.worksheet_question_id)
          .filter((id): id is string => Boolean(id && String(id).trim()))
      )
    )
    const solutionByWorksheetQid = new Map<string, string>()
    if (wsIds.length > 0) {
      const wsMap = await fetchWorksheetQuestionsTypeContentByIdsFromPg(wsIds)
      if (wsMap === null) {
        return NextResponse.json({ error: 'Lỗi đọc lời giải.' }, { status: 500 })
      }
      for (const [id, row] of wsMap) {
        const type = row.type
        if (type === 'essay') {
          const sol = getEssaySolution(row.content_json).trim()
          if (sol) solutionByWorksheetQid.set(id, sol)
        }
      }
    }

    const items = questionRows.map((q, idx) => {
      const options = Array.isArray(q.options) ? q.options.map((x: unknown) => String(x ?? '').trim()).filter(Boolean) : []
      const ci = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index ?? -1)
      const hasChoice = options.length >= 2
      const correctIndex = hasChoice && Number.isFinite(ci) ? Math.max(0, Math.min(options.length - 1, Math.floor(ci))) : -1
      const correctLabel = correctIndex >= 0 ? indexToLetter(correctIndex) : null
      let correctOption = correctIndex >= 0 ? options[correctIndex] ?? '' : ''
      const wsq = String(q.worksheet_question_id ?? '').trim()
      if (!hasChoice && wsq) {
        const fromDb = solutionByWorksheetQid.get(wsq)
        if (fromDb) correctOption = fromDb
      }
      return {
        id: String(q.id),
        index: idx + 1,
        questionText: String(q.question_text ?? ''),
        options,
        source: String(q.source ?? ''),
        correctIndex,
        correctLabel,
        correctOption,
      }
    })

    return NextResponse.json({
      code: session.code,
      title: session.title,
      practiceHomework: session.is_practice_homework,
      questions: items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

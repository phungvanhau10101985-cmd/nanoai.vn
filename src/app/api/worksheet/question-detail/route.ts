/**
 * Chi tiết một câu hỏi worksheet (đề + đáp án TN / đề + lời giải tự luận).
 * Chỉ khi câu thuộc giáo trình (curriculum_id hoặc nằm trong phiếu của curriculum).
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchWorksheetQuestionDetailRowPg,
  isWorksheetQuestionLinkedToCurriculumPg,
} from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
import { getEssayProblem, getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

export async function GET(req: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const { searchParams } = req.nextUrl
    const curriculumId = (searchParams.get('curriculumId') ?? '').trim()
    const questionId = (searchParams.get('questionId') ?? '').trim()
    if (!curriculumId || !questionId) {
      return NextResponse.json({ error: 'Thiếu curriculumId hoặc questionId.' }, { status: 400 })
    }

    const linked = await isWorksheetQuestionLinkedToCurriculumPg(curriculumId, questionId)
    if (linked === null) {
      return NextResponse.json({ error: 'Không kiểm tra được liên kết câu hỏi.' }, { status: 500 })
    }
    if (!linked) {
      return NextResponse.json({ error: 'Không tìm thấy câu hoặc không thuộc giáo trình này.' }, { status: 404 })
    }

    const row = await fetchWorksheetQuestionDetailRowPg(questionId)
    if (!row) {
      return NextResponse.json({ error: 'Không đọc được câu hỏi.' }, { status: 500 })
    }

    if (row.user_id !== auth.user.id) {
      return NextResponse.json({ error: 'Không có quyền xem câu này.' }, { status: 403 })
    }

    const type = String(row.type ?? '')
    const topic = (row.topic as string | null) ?? ''
    const cj = row.content_json

    if (type === 'quiz') {
      const c = cj as { question?: string; options?: string[]; correctIndex?: number }
      const options = (c.options ?? []).slice(0, 4).map((o) => String(o ?? '').replace(/^[A-D]\.\s*/i, '').trim())
      while (options.length < 4) options.push('')
      const correctIndex = Math.max(0, Math.min(Number(c.correctIndex) || 0, 3))
      return NextResponse.json({
        type: 'quiz' as const,
        topic,
        question: String(c.question ?? ''),
        options,
        correctIndex,
        correctLabel: String.fromCharCode(65 + correctIndex),
      })
    }

    if (type === 'essay') {
      const problem = getEssayProblem(cj) || String((cj as { problem?: string }).problem ?? '')
      const solution = getEssaySolution(cj) || String((cj as { solution?: string }).solution ?? '')
      return NextResponse.json({
        type: 'essay' as const,
        topic,
        problem,
        solution,
      })
    }

    return NextResponse.json({ error: 'Loại câu không hỗ trợ.' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

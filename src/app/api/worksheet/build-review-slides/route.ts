/**
 * Tạo phiếu bài tập từ các câu đã chọn (giáo viên) → mở /giao-trinh/giao-vien?worksheetId=…
 * Thứ tự: hết trắc nghiệm rồi tự luận.
 */
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchWorksheetCurriculumSubjectGradeFromPg,
  fetchWorksheetQuestionsMarkdownRowsOrderedFromPg,
  insertWorksheetSheetSlideBuildFromPg,
} from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'

function orderQuizThenEssay(
  selectedOrder: string[],
  rows: Array<{ id: string; type: string }>
): string[] {
  const typeById = new Map(rows.map((r) => [r.id, r.type]))
  const quiz: string[] = []
  const essay: string[] = []
  for (const id of selectedOrder) {
    const t = typeById.get(id)
    if (t === 'quiz') quiz.push(id)
    else if (t === 'essay') essay.push(id)
  }
  return [...quiz, ...essay]
}

export async function POST(req: NextRequest) {
  try {
    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 })
    }

    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const rawIds = body?.questionIds
    const questionIds = Array.isArray(rawIds) ? rawIds.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'Thiếu questionIds.' }, { status: 400 })
    }

    const curriculumId =
      typeof body?.curriculumId === 'string' && body.curriculumId.trim() ? body.curriculumId.trim() : null

    type QRow = {
      id: string
      type: string
      content_json: unknown
      difficulty?: string
      source?: string
      verified_at?: string | null
      subject_id?: string
      grade_level_id?: string
    }

    const fromPg = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(questionIds)
    if (
      fromPg === null ||
      (fromPg.length === 0 && questionIds.length > 0) ||
      fromPg.length !== questionIds.length
    ) {
      return NextResponse.json(
        { error: 'Không tìm thấy đủ câu hỏi hoặc không đọc được cơ sở dữ liệu.' },
        { status: 404 }
      )
    }

    const rows: QRow[] = fromPg.map((r) => ({
      id: r.id,
      type: r.type,
      content_json: r.content_json,
      difficulty: r.difficulty ?? undefined,
      source: r.source ?? undefined,
      verified_at: r.verified_at,
      subject_id: r.subject_id,
      grade_level_id: r.grade_level_id,
    }))

    const found = new Set(rows.map((r) => r.id))
    const missing = questionIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      return NextResponse.json({ error: `Một số id không tồn tại: ${missing.slice(0, 5).join(', ')}` }, { status: 400 })
    }

    const orderedIds = orderQuizThenEssay(questionIds, rows as Array<{ id: string; type: string }>)
    const ordered = orderedIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as QRow[]

    const contentMarkdown = questionsToMarkdown(ordered)
    const first = ordered[0]
    const topic =
      typeof body?.topic === 'string' && body.topic.trim()
        ? body.topic.trim()
        : 'Slide chữa bài tập'

    let subjectId = first?.subject_id ?? 'toan'
    let gradeLevelId = first?.grade_level_id ?? 'lop-6'
    if (curriculumId) {
      const cur = await fetchWorksheetCurriculumSubjectGradeFromPg(curriculumId)
      if (cur) {
        subjectId = cur.subject_id || subjectId
        gradeLevelId = cur.grade_level_id || gradeLevelId
      }
    }

    const worksheetId = await insertWorksheetSheetSlideBuildFromPg({
      userId: auth.user.id,
      topic,
      subjectId,
      gradeLevelId,
      contentMarkdown,
      questionIds: orderedIds,
      curriculumId: null,
    })
    if (!worksheetId) {
      return NextResponse.json({ error: 'Không tạo được phiếu bài tập.' }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      worksheetId,
      teacherPath: `/giao-trinh/giao-vien?worksheetId=${encodeURIComponent(worksheetId)}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

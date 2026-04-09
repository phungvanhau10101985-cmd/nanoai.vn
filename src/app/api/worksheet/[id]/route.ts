import { NextRequest, NextResponse } from 'next/server'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'
import {
  fetchWorksheetQuestionsMarkdownRowsOrderedFromPg,
  fetchWorksheetQuestionsTypeContentOrderedFromPg,
  fetchWorksheetSheetMinimalByIdFromPg,
} from '@/lib/db/worksheet-pg'
import { isPgConfigured } from '@/lib/db/pool'

/** Lấy phiếu bài tập theo id – dùng cho giao-vien mở trình chiếu phiếu.
 * Trả về content_markdown (build từ worksheet_questions khi có question_ids) và questions – để build slides chuẩn mỗi câu 1 slide, đáp án riêng ẩn/hiện được. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
  }

  const data = await fetchWorksheetSheetMinimalByIdFromPg(id)
  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const questionIds = data.question_ids.filter(Boolean)
  let contentMarkdown = data.content_markdown

  if (questionIds.length) {
    const mdRows = await fetchWorksheetQuestionsMarkdownRowsOrderedFromPg(questionIds)
    if (mdRows === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }
    if (mdRows.length > 0) {
      contentMarkdown = questionsToMarkdown(
        mdRows as Parameters<typeof questionsToMarkdown>[0]
      )
    }

    let questions: Array<{ type: string; content_json: unknown }> | undefined
    const typeRows = await fetchWorksheetQuestionsTypeContentOrderedFromPg(questionIds)
    if (typeRows === null) {
      return NextResponse.json({ error: 'Lỗi đọc câu hỏi.' }, { status: 500 })
    }
    if (typeRows.length > 0) {
      questions = typeRows.map((r) => ({ type: r.type, content_json: r.content_json }))
    }
    return NextResponse.json({
      id: data.id,
      topic: data.topic,
      content_markdown: contentMarkdown,
      questions,
    })
  }

  return NextResponse.json({
    id: data.id,
    topic: data.topic,
    content_markdown: contentMarkdown,
    questions: undefined,
  })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { worksheetDisplayMarkdownFromDb } from '@/app/tao-giao-trinh/lib/merge-worksheet-content'

/** Lấy phiếu bài tập theo id – dùng cho giao-vien mở trình chiếu phiếu.
 * Trả về content_markdown (build từ worksheet_questions khi có question_ids) và questions – để build slides chuẩn mỗi câu 1 slide, đáp án riêng ẩn/hiện được. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = createClient()
  const { data, error } = await supabase
    .from('worksheet_worksheets')
    .select('id, topic, content_markdown, question_ids')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const questionIds = (data.question_ids ?? []) as string[]
  let contentMarkdown = (data.content_markdown ?? '') as string
  if (questionIds.length) {
    contentMarkdown = await worksheetDisplayMarkdownFromDb(supabase, contentMarkdown, questionIds)
  }
  let questions: Array<{ type: string; content_json: unknown }> | undefined
  if (questionIds.length > 0) {
    const { data: qRows } = await supabase
      .from('worksheet_questions')
      .select('id, type, content_json')
      .in('id', questionIds)
    const ordered = questionIds.map((qid) => qRows?.find((r) => r.id === qid)).filter(Boolean) as Array<{ id: string; type: string; content_json: unknown }>
    if (ordered.length > 0) questions = ordered.map((r) => ({ type: r.type, content_json: r.content_json }))
  }
  return NextResponse.json({
    id: data.id,
    topic: data.topic,
    content_markdown: contentMarkdown,
    questions,
  })
}

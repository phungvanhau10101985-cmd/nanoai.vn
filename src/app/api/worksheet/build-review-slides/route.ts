/**
 * Tạo phiếu bài tập từ các câu đã chọn (giáo viên) → mở /tao-giao-trinh/giao-vien?worksheetId=…
 * Thứ tự: hết trắc nghiệm rồi tự luận.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const rawIds = body?.questionIds
    const questionIds = Array.isArray(rawIds) ? rawIds.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'Thiếu questionIds.' }, { status: 400 })
    }

    const curriculumId =
      typeof body?.curriculumId === 'string' && body.curriculumId.trim() ? body.curriculumId.trim() : null

    const { data: rows, error: fetchErr } = await supabase
      .from('worksheet_questions')
      .select('id, type, content_json, difficulty, source, verified_at, subject_id, grade_level_id')
      .in('id', questionIds)

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    if (!rows?.length) return NextResponse.json({ error: 'Không tìm thấy câu hỏi.' }, { status: 404 })

    const found = new Set(rows.map((r) => r.id as string))
    const missing = questionIds.filter((id) => !found.has(id))
    if (missing.length > 0) {
      return NextResponse.json({ error: `Một số id không tồn tại: ${missing.slice(0, 5).join(', ')}` }, { status: 400 })
    }

    const orderedIds = orderQuizThenEssay(questionIds, rows as Array<{ id: string; type: string }>)
    const ordered = orderedIds
      .map((id) => rows.find((r) => r.id === id))
      .filter(Boolean) as Array<{
      id: string
      type: string
      content_json: unknown
      difficulty?: string
      source?: string
      verified_at?: string | null
      subject_id?: string
      grade_level_id?: string
    }>

    const contentMarkdown = questionsToMarkdown(ordered)
    const first = ordered[0]
    const topic =
      typeof body?.topic === 'string' && body.topic.trim()
        ? body.topic.trim()
        : 'Slide chữa bài tập'

    let subjectId = first?.subject_id ?? 'toan'
    let gradeLevelId = first?.grade_level_id ?? 'lop-6'
    if (curriculumId) {
      const { data: cur } = await supabase
        .from('worksheet_curricula')
        .select('subject_id, grade_level_id')
        .eq('id', curriculumId)
        .maybeSingle()
      if (cur) {
        subjectId = (cur.subject_id as string) || subjectId
        gradeLevelId = (cur.grade_level_id as string) || gradeLevelId
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from('worksheet_worksheets')
      .insert({
        user_id: auth.user.id,
        curriculum_id: null,
        topic,
        subject_id: subjectId,
        grade_level_id: gradeLevelId,
        content_markdown: contentMarkdown,
        question_ids: orderedIds,
      })
      .select('id')
      .single()

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    const worksheetId = inserted?.id as string
    return NextResponse.json({
      ok: true,
      worksheetId,
      teacherPath: `/tao-giao-trinh/giao-vien?worksheetId=${encodeURIComponent(worksheetId)}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

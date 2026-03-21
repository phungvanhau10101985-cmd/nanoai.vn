/**
 * Chi tiết một câu hỏi worksheet (đề + đáp án TN / đề + lời giải tự luận).
 * Chỉ khi câu thuộc giáo trình (curriculum_id hoặc nằm trong phiếu của curriculum).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { getEssayProblem, getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

async function questionLinkedToCurriculum(
  supabase: ReturnType<typeof createClient>,
  curriculumId: string,
  questionId: string
): Promise<boolean> {
  const { data: q } = await supabase
    .from('worksheet_questions')
    .select('curriculum_id')
    .eq('id', questionId)
    .maybeSingle()
  if (!q) return false
  if (q.curriculum_id === curriculumId) return true
  const { data: sheets } = await supabase
    .from('worksheet_worksheets')
    .select('question_ids')
    .eq('curriculum_id', curriculumId)
  for (const s of sheets ?? []) {
    const ids = (s.question_ids ?? []) as string[]
    if (ids.includes(questionId)) return true
  }
  return false
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = req.nextUrl
    const curriculumId = (searchParams.get('curriculumId') ?? '').trim()
    const questionId = (searchParams.get('questionId') ?? '').trim()
    if (!curriculumId || !questionId) {
      return NextResponse.json({ error: 'Thiếu curriculumId hoặc questionId.' }, { status: 400 })
    }

    const linked = await questionLinkedToCurriculum(supabase, curriculumId, questionId)
    if (!linked) {
      return NextResponse.json({ error: 'Không tìm thấy câu hoặc không thuộc giáo trình này.' }, { status: 404 })
    }

    const { data: row, error } = await supabase
      .from('worksheet_questions')
      .select('id, type, topic, content_json, user_id')
      .eq('id', questionId)
      .maybeSingle()

    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? 'Không đọc được câu hỏi.' }, { status: 500 })
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

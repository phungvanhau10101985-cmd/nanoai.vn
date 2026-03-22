import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getEssaySolution } from '@/app/tao-giao-trinh/lib/worksheet-content-json'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
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
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })
    const { user } = authResult

    const admin = getAdminClient()
    const { data: session, error: sessionErr } = await admin
      .from('exam_sessions')
      .select('id, code, title, teacher_id')
      .eq('code', String(code || '').trim().toUpperCase())
      .single()
    if (sessionErr || !session) return NextResponse.json({ error: 'Không tìm thấy bài thi.' }, { status: 404 })
    if (String(session.teacher_id ?? '') !== user.id) {
      return NextResponse.json({ error: 'Bạn không có quyền xem chữa bài của đề này.' }, { status: 403 })
    }

    const { data: questions, error: qErr } = await admin
      .from('exam_questions')
      .select('id, question_text, options, correct_index, order, source, worksheet_question_id')
      .eq('session_id', session.id)
      .order('order', { ascending: true })
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 })

    const wsIds = Array.from(
      new Set(
        (questions ?? [])
          .map((q) => (q as { worksheet_question_id?: string | null }).worksheet_question_id)
          .filter((id): id is string => Boolean(id && String(id).trim()))
      )
    )
    const solutionByWorksheetQid = new Map<string, string>()
    if (wsIds.length > 0) {
      const { data: wsRows, error: wsErr } = await admin
        .from('worksheet_questions')
        .select('id, type, content_json')
        .in('id', wsIds)
      if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 500 })
      for (const row of wsRows ?? []) {
        const id = String((row as { id?: string }).id ?? '')
        if (!id) continue
        const type = String((row as { type?: string }).type ?? '')
        const cj = (row as { content_json?: unknown }).content_json
        if (type === 'essay') {
          const sol = getEssaySolution(cj).trim()
          if (sol) solutionByWorksheetQid.set(id, sol)
        }
      }
    }

    const items = (questions ?? []).map((q, idx) => {
      const options = Array.isArray(q.options) ? q.options.map((x) => String(x ?? '').trim()).filter(Boolean) : []
      const ci = typeof q.correct_index === 'number' ? q.correct_index : Number(q.correct_index ?? -1)
      const hasChoice = options.length >= 2
      const correctIndex = hasChoice && Number.isFinite(ci) ? Math.max(0, Math.min(options.length - 1, Math.floor(ci))) : -1
      const correctLabel = correctIndex >= 0 ? indexToLetter(correctIndex) : null
      let correctOption = correctIndex >= 0 ? options[correctIndex] ?? '' : ''
      const wsq = String((q as { worksheet_question_id?: string | null }).worksheet_question_id ?? '').trim()
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
      questions: items,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

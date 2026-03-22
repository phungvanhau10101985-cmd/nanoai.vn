import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { questionsToMarkdown } from '@/app/tao-giao-trinh/lib/questions-to-markdown'

function getAdminServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createClient(url, key)
}

async function requireAdmin() {
  const supabase = createServerClient()
  const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
  if ('error' in auth) {
    return { error: NextResponse.json({ error: auth.error }, { status: 401 }) }
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).single()
  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Chỉ quản trị viên.' }, { status: 403 }) }
  }
  return { user: auth.user }
}

/** Thứ tự phiếu: hết trắc nghiệm rồi tới tự luận (giữ thứ tự chọn trong từng nhóm). */
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

/**
 * POST body: { questionIds: string[], topic?: string }
 * Tạo phiếu bài tập từ các câu đã chọn → mở /giao-trinh/giao-vien?worksheetId=… để trình chiếu chữa bài.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin()
    if ('error' in gate) return gate.error

    const admin = getAdminServiceClient()
    if (!admin) {
      return NextResponse.json({ error: 'Thiếu SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
    }

    const body = await req.json().catch(() => ({}))
    const rawIds = body?.questionIds
    const questionIds = Array.isArray(rawIds) ? rawIds.map((x: unknown) => String(x).trim()).filter(Boolean) : []
    if (questionIds.length === 0) {
      return NextResponse.json({ error: 'Thiếu questionIds.' }, { status: 400 })
    }

    const { data: rows, error: fetchErr } = await admin
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

    const { data: inserted, error: insErr } = await admin
      .from('worksheet_worksheets')
      .insert({
        user_id: gate.user.id,
        curriculum_id: null,
        topic,
        subject_id: first?.subject_id ?? 'toan',
        grade_level_id: first?.grade_level_id ?? 'lop-6',
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
      teacherPath: `/giao-trinh/giao-vien?worksheetId=${encodeURIComponent(worksheetId)}`,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

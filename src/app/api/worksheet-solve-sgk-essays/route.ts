import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

/** Endpoint 2: chỉ giải các bài tự luận SGK còn thiếu lời giải. */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const userId = auth.user?.id

    const body = await req.json().catch(() => ({}))
    const worksheetId = String(body?.worksheetId ?? '').trim()
    const curriculumMarkdown = String(body?.curriculumMarkdown ?? '').trim()
    if (!worksheetId) return NextResponse.json({ error: 'Thiếu worksheetId.' }, { status: 400 })

    const { data: job, error } = await supabase
      .from('worksheet_jobs')
      .insert({
        user_id: userId,
        type: 'solve_sgk_essays',
        status: 'pending',
        params: { worksheetId, curriculumMarkdown },
      })
      .select('id')
      .single()
    if (error || !job?.id) return NextResponse.json({ error: error?.message || 'Lỗi tạo job.' }, { status: 500 })

    return NextResponse.json({ jobId: job.id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

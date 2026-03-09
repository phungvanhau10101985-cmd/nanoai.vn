import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function GET(
  _req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toUpperCase()
  if (!code) {
    return NextResponse.json({ error: 'Thiếu mã.' }, { status: 400 })
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: session } = await admin
    .from('slide_quiz_sessions')
    .select('id, created_by')
    .eq('code', code)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Không tìm thấy phiên.' }, { status: 404 })
  }
  if (session.created_by !== user?.id) {
    return NextResponse.json({ error: 'Chỉ giáo viên tạo phiên mới xem được kết quả.' }, { status: 403 })
  }

  const { data: responses } = await admin
    .from('slide_quiz_responses')
    .select('answer_index')
    .eq('session_id', session.id)

  const counts: Record<number, number> = {}
  for (const r of responses ?? []) {
    const i = r.answer_index
    counts[i] = (counts[i] ?? 0) + 1
  }
  const total = responses?.length ?? 0

  return NextResponse.json({
    counts,
    total,
    byIndex: counts,
  })
}

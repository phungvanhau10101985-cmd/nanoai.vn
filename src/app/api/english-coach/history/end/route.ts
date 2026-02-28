import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

function adminClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as { sessionId?: string }
    const sessionId = String(payload.sessionId || '').trim()
    if (!sessionId) {
      return NextResponse.json({ error: 'Thiếu sessionId.' }, { status: 400 })
    }
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để kết thúc buổi học.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth
    const adminSupabase = adminClient()

    const { error } = await adminSupabase.from('language_coach_ended_sessions').upsert(
      { user_id: user.id, session_id: sessionId },
      { onConflict: 'user_id,session_id' }
    )

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Không đánh dấu kết thúc được.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

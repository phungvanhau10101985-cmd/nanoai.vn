import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'

/** Lấy danh sách thông báo của user */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const authResult = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập.')
    if ('error' in authResult) return NextResponse.json({ error: authResult.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)
    const unreadOnly = searchParams.get('unread') === '1'

    let q = supabase
      .from('notifications')
      .select('id, type, title, body, read_at, created_at, meta')
      .eq('user_id', authResult.user!.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      q = q.is('read_at', null)
    }

    const { data, error } = await q

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[notifications] GET:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

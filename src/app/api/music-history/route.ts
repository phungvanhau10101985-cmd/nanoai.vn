import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

type Mode = 'background' | 'dj' | 'image' | 'realtime'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem lịch sử tạo nhạc.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await adminSupabase
      .from('music_generations')
      .select('id, mode, title, style, duration_seconds, charged_credits, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message || 'Không tải được lịch sử tạo nhạc.' }, { status: 500 })
    return NextResponse.json({ items: data ?? [] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as {
      mode?: Mode
      title?: string
      style?: string
      durationSeconds?: number
      chargedCredits?: number
    }

    const mode = String(payload?.mode || '') as Mode
    const title = String(payload?.title || '').trim()
    const style = String(payload?.style || '').trim()
    const durationSeconds = Number(payload?.durationSeconds || 0)
    const chargedCredits = Number(payload?.chargedCredits || 0)

    if (!['background', 'dj', 'image', 'realtime'].includes(mode)) {
      return NextResponse.json({ error: 'mode không hợp lệ.' }, { status: 400 })
    }
    if (!title || !style || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(chargedCredits) || chargedCredits < 0) {
      return NextResponse.json({ error: 'Dữ liệu lịch sử không hợp lệ.' }, { status: 400 })
    }

    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để lưu lịch sử tạo nhạc.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { user } = auth

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await adminSupabase.from('music_generations').insert({
      user_id: user.id,
      mode,
      title: title.slice(0, 160),
      style: style.slice(0, 120),
      duration_seconds: Math.floor(durationSeconds),
      charged_credits: Math.round(chargedCredits * 10) / 10,
    })

    if (error) return NextResponse.json({ error: error.message || 'Không lưu được lịch sử tạo nhạc.' }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}


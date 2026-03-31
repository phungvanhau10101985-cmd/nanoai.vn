import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserForAction } from '@/lib/auth'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/** Các mode đã lưu trong DB (Lyria RealTime cũ + Lyria 3). */
type Mode = 'background' | 'dj' | 'image' | 'realtime' | 'lyria3'

const HISTORY_MODES: Mode[] = ['background', 'dj', 'image', 'realtime', 'lyria3']

function isHistoryMode(v: string): v is Mode {
  return (HISTORY_MODES as string[]).includes(v)
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const auth = await getUserForAction(() => supabase.auth.getUser(), 'Vui lòng đăng nhập để xem lịch sử tạo nhạc.')
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30
    const modeParam = String(request.nextUrl.searchParams.get('mode') || '').trim()

    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = adminSupabase
      .from('music_generations')
      .select('id, mode, title, style, duration_seconds, charged_credits, audio_url, created_at')
      .eq('user_id', user.id)

    if (modeParam && isHistoryMode(modeParam)) {
      query = query.eq('mode', modeParam)
    }

    const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)

    if (error) return NextResponse.json({ error: error.message || 'Không tải được lịch sử tạo nhạc.' }, { status: 500 })
    const items = (data ?? []).map((row) => ({
      id: row.id,
      mode: row.mode,
      title: row.title,
      style: row.style,
      durationSeconds: row.duration_seconds,
      chargedCredits: row.charged_credits,
      audioUrl: row.audio_url,
      createdAt: row.created_at,
    }))
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Lỗi không xác định.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

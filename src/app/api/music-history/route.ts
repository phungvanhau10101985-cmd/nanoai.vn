import { NextRequest, NextResponse } from 'next/server'
import { fetchMusicGenerationsForUserFromPg } from '@/lib/db/music-generations-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { getUserForAction } from '@/lib/auth'
/** Các mode đã lưu trong DB (Lyria RealTime cũ + Lyria 3). */
type Mode = 'background' | 'dj' | 'image' | 'realtime' | 'lyria3'

const HISTORY_MODES: Mode[] = ['background', 'dj', 'image', 'realtime', 'lyria3']

function isHistoryMode(v: string): v is Mode {
  return (HISTORY_MODES as string[]).includes(v)
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getUserForAction()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user } = auth
    const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 30)
    const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30
    const modeParam = String(request.nextUrl.searchParams.get('mode') || '').trim()

    if (!isPgConfigured()) {
      return NextResponse.json({ error: 'Chưa cấu hình cơ sở dữ liệu.' }, { status: 503 })
    }

    const rows = await fetchMusicGenerationsForUserFromPg(user.id, {
      limit,
      mode: modeParam && isHistoryMode(modeParam) ? modeParam : undefined,
    })
    if (rows === null) {
      return NextResponse.json({ error: 'Không tải được lịch sử tạo nhạc.' }, { status: 500 })
    }

    const items = rows.map((row) => ({
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

import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

const ROOM_CODE_RE = /^[a-f0-9]{8}$/i

export function isValidScreenLiveRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(String(code || '').trim())
}

export type ScreenLiveSignalRow = {
  id: string
  event: string
  payload: unknown
}

export async function insertScreenLiveSignalPg(
  roomCode: string,
  eventType: string,
  payload: unknown
): Promise<{ error?: string }> {
  if (!isPgConfigured()) return { error: 'DATABASE_URL is not set' }
  if (!isValidScreenLiveRoomCode(roomCode)) return { error: 'Invalid room code' }
  const allowed = new Set(['offer', 'answer', 'ice', 'request-offer'])
  if (!allowed.has(eventType)) return { error: 'Invalid event type' }
  try {
    await pgQuery(
      `insert into public.screen_live_signals (room_code, event_type, payload)
       values ($1::text, $2::text, $3::jsonb)`,
      [roomCode, eventType, JSON.stringify(payload ?? {})]
    )
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export async function fetchScreenLiveSignalsAfterPg(
  roomCode: string,
  afterId: number
): Promise<ScreenLiveSignalRow[]> {
  if (!isPgConfigured()) return []
  if (!isValidScreenLiveRoomCode(roomCode)) return []
  const safeAfter = Number.isFinite(afterId) && afterId >= 0 ? Math.floor(afterId) : 0
  try {
    const rows = await pgQuery<{ id: string; event: string; payload: unknown }>(
      `select id::text as id,
              event_type::text as event,
              payload
       from public.screen_live_signals
       where room_code = $1::text
         and id > $2::bigint
       order by id asc
       limit 200`,
      [roomCode, safeAfter]
    )
    return rows.map((r) => ({ id: r.id, event: r.event, payload: r.payload }))
  } catch (e) {
    console.error('[screen-live-pg] fetchScreenLiveSignalsAfterPg', e)
    return []
  }
}

/** Xóa bản ghi cũ để bảng không phình (gọi thưa từ API). */
export async function pruneScreenLiveSignalsOlderThanPg(minutes: number): Promise<void> {
  if (!isPgConfigured()) return
  const m = Math.min(120, Math.max(5, Math.floor(minutes)))
  try {
    await pgQuery(
      `delete from public.screen_live_signals
       where created_at < now() - ($1::int * interval '1 minute')`,
      [m]
    )
  } catch (e) {
    console.warn('[screen-live-pg] pruneScreenLiveSignalsOlderThanPg', e)
  }
}

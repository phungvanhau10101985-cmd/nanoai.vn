import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

const ROOM_CODE_RE = /^[a-f0-9]{8}$/i
let screenLiveSchemaEnsured = false

export function isValidScreenLiveRoomCode(code: string): boolean {
  return ROOM_CODE_RE.test(String(code || '').trim())
}

function pgErrorCode(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null
  const code = (err as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function isMissingScreenLiveRelation(err: unknown): boolean {
  return pgErrorCode(err) === '42P01'
}

async function ensureScreenLiveSchemaPg(): Promise<void> {
  if (screenLiveSchemaEnsured) return
  await pgQuery(
    `create table if not exists public.screen_live_signals (
       id bigserial primary key,
       room_code text not null,
       event_type text not null check (event_type in ('offer', 'answer', 'ice', 'request-offer')),
       payload jsonb not null default '{}'::jsonb,
       created_at timestamptz not null default now()
     )`,
    []
  )
  await pgQuery(
    `create index if not exists idx_screen_live_signals_room_id
       on public.screen_live_signals (room_code, id)`,
    []
  )
  await pgQuery(
    `create index if not exists idx_screen_live_signals_created_at
       on public.screen_live_signals (created_at)`,
    []
  )
  screenLiveSchemaEnsured = true
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
    if (isMissingScreenLiveRelation(e)) {
      try {
        await ensureScreenLiveSchemaPg()
        await pgQuery(
          `insert into public.screen_live_signals (room_code, event_type, payload)
           values ($1::text, $2::text, $3::jsonb)`,
          [roomCode, eventType, JSON.stringify(payload ?? {})]
        )
        return {}
      } catch (retryErr) {
        return { error: retryErr instanceof Error ? retryErr.message : String(retryErr) }
      }
    }
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
    if (isMissingScreenLiveRelation(e)) {
      try {
        await ensureScreenLiveSchemaPg()
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
      } catch (retryErr) {
        console.error('[screen-live-pg] fetchScreenLiveSignalsAfterPg(retry)', retryErr)
        return []
      }
    }
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
    if (isMissingScreenLiveRelation(e)) {
      try {
        await ensureScreenLiveSchemaPg()
      } catch (retryErr) {
        console.warn('[screen-live-pg] pruneScreenLiveSignalsOlderThanPg(ensure)', retryErr)
      }
      return
    }
    console.warn('[screen-live-pg] pruneScreenLiveSignalsOlderThanPg', e)
  }
}

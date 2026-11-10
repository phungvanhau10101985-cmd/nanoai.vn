import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'
import { FREE_LIVE_LESSON_LIMIT } from '@/lib/english-coach-free-lessons'

const LIVE_START = 'english_coach_live_start'

function requirePg(): void {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
}

export async function pgCountFreeLiveStarts(userId: string): Promise<number> {
  requirePg()
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c
     from public.language_coach_credit_events
     where user_id = $1::uuid
       and charge_type = $2
       and amount = 0`,
    [userId, LIVE_START]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Số credit đã ghi cho buổi này. null nếu buổi chưa mở. 0 nghĩa là buổi miễn phí. */
export async function pgReadLiveStartAmount(userId: string, sessionId: string): Promise<number | null> {
  requirePg()
  const row = await pgQueryOne<{ amount: string | number | null }>(
    `select amount
     from public.language_coach_credit_events
     where user_id = $1::uuid
       and session_id = $2::uuid
       and charge_type = $3
     order by created_at asc
     limit 1`,
    [userId, sessionId, LIVE_START]
  )
  if (!row || row.amount == null) return null
  const n = Number(row.amount)
  return Number.isFinite(n) ? n : null
}

export type FreeLiveGrant =
  | { status: 'granted'; freeUsed: number }
  | { status: 'needs_payment'; freeUsed: number }
  | { status: 'already'; amount: number; freeUsed: number }

/**
 * Ghi buổi live miễn phí (amount = 0) nếu tài khoản còn suất.
 * Khóa theo user để hai buổi mở cùng lúc không lấy quá suất.
 */
export async function pgTryGrantFreeLiveStart(input: {
  userId: string
  sessionId: string
  eventKey: string
}): Promise<FreeLiveGrant> {
  requirePg()
  const client = await getPgPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(`select pg_advisory_xact_lock(hashtext($1::text)::bigint)`, [`free-live:${input.userId}`])
    const existing = await client.query<{ amount: string | number | null }>(
      `select amount
       from public.language_coach_credit_events
       where event_key = $1
       limit 1`,
      [input.eventKey]
    )
    const countRow = await client.query<{ c: string }>(
      `select count(*)::text as c
       from public.language_coach_credit_events
       where user_id = $1::uuid
         and charge_type = $2
         and amount = 0`,
      [input.userId, LIVE_START]
    )
    const freeUsed = Number(countRow.rows[0]?.c ?? 0)
    const used = Number.isFinite(freeUsed) ? freeUsed : 0
    const existingAmount = existing.rows[0]?.amount
    if (existingAmount != null) {
      const amount = Number(existingAmount)
      await client.query('COMMIT')
      return { status: 'already', amount: Number.isFinite(amount) ? amount : 0, freeUsed: used }
    }
    if (used >= FREE_LIVE_LESSON_LIMIT) {
      await client.query('COMMIT')
      return { status: 'needs_payment', freeUsed: used }
    }
    await client.query(
      `insert into public.language_coach_credit_events (
         user_id, session_id, event_key, charge_type, amount, metadata_json
       ) values ($1::uuid, $2::uuid, $3, $4, 0, $5)`,
      [
        input.userId,
        input.sessionId,
        input.eventKey,
        LIVE_START,
        JSON.stringify({
          product: 'english_coach',
          event: 'live_start_free',
          sessionId: input.sessionId,
          priceCredits: 0,
          freeLesson: true,
        }),
      ]
    )
    await client.query('COMMIT')
    return { status: 'granted', freeUsed: used + 1 }
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* transaction already closed */
    }
    const message = error instanceof Error ? error.message : String(error)
    if (/amount_check|check constraint/i.test(message)) {
      throw new Error(
        'Chưa cho ghi buổi live miễn phí. Chạy db/migrations/20261110200000_language_coach_free_live_amount.sql.'
      )
    }
    throw error
  } finally {
    client.release()
  }
}

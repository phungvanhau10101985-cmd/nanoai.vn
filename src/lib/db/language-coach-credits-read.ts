import { isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

export async function pgHasLanguageCoachCreditEvent(
  userId: string,
  sessionId: string,
  chargeType: string
): Promise<boolean> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c
     from public.language_coach_credit_events
     where user_id = $1::uuid and session_id = $2::uuid and charge_type = $3`,
    [userId, sessionId, chargeType]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) && n > 0
}

export async function pgCountLanguageCoachCreditEvents(
  userId: string,
  sessionId: string,
  chargeType: string
): Promise<number> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c
     from public.language_coach_credit_events
     where user_id = $1::uuid and session_id = $2::uuid and charge_type = $3`,
    [userId, sessionId, chargeType]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function pgCountLanguageCoachStudentTurns(userId: string, sessionId: string): Promise<number> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
  const row = await pgQueryOne<{ c: string }>(
    `select count(*)::text as c
     from public.language_coach_messages
     where user_id = $1::uuid and session_id = $2::uuid and role = 'student'`,
    [userId, sessionId]
  )
  const n = Number(row?.c ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Đọc `lesson_credit_billing.turnsUsed` từ pinned_facts_json nếu có. */
/** Đã có bản ghi `language_coach_credit_events` với `event_key` (idempotency phí tháng / v.v.). */
export async function pgHasLanguageCoachEventKey(userId: string, eventKey: string): Promise<boolean> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
  const row = await pgQueryOne<{ e: boolean }>(
    `select exists(
       select 1 from public.language_coach_credit_events
       where user_id = $1::uuid and event_key = $2
     ) as e`,
    [userId, eventKey]
  )
  return Boolean(row?.e)
}

export async function pgReadTurnsUsedFromSessionMemory(
  userId: string,
  sessionId: string
): Promise<number | null> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL required')
  const row = await pgQueryOne<{ pinned_facts_json: string | null }>(
    `select pinned_facts_json from public.language_coach_session_memories
     where user_id = $1::uuid and session_id = $2::uuid limit 1`,
    [userId, sessionId]
  )
  if (!row?.pinned_facts_json) return null
  try {
    const root = JSON.parse(String(row.pinned_facts_json || '{}')) as Record<string, unknown>
    const billing = root.lesson_credit_billing
    if (!billing || typeof billing !== 'object') return null
    const turnsUsed = Math.max(0, Math.floor(Number((billing as Record<string, unknown>).turnsUsed || 0) || 0))
    return turnsUsed
  } catch {
    return null
  }
}

import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type LanguageCoachCreditEventRow = {
  charge_type: string
  amount: number | string | null
}

/**
 * Doanh thu (tổng amount) từ giao dịch `payments` đã hoàn thành,
 * có thời điểm tính = coalesce(completed_at, created_at) trong [fromIso, toIso].
 */
export async function fetchRevenueFromCompletedPaymentsInRange(fromIso: string, toIso: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ s: string | null }>(
    `select coalesce(sum(amount::numeric), 0)::text as s
     from public.payments
     where status = 'completed'
       and coalesce(completed_at, created_at) >= $1::timestamptz
       and coalesce(completed_at, created_at) <= $2::timestamptz`,
    [fromIso, toIso]
  )
  const n = Number(row?.s ?? 0)
  return Number.isFinite(n) ? n : 0
}

export async function fetchLanguageCoachCreditEventsInRange(
  fromIso: string,
  toIso: string
): Promise<LanguageCoachCreditEventRow[]> {
  if (!isPgConfigured()) return []
  return pgQuery<LanguageCoachCreditEventRow>(
    `select charge_type, amount::float8 as amount
     from public.language_coach_credit_events
     where created_at >= $1::timestamptz and created_at <= $2::timestamptz`,
    [fromIso, toIso]
  )
}

export async function sumMusicChargedCreditsInRange(fromIso: string, toIso: string): Promise<number> {
  if (!isPgConfigured()) return 0
  const row = await pgQueryOne<{ s: string | null }>(
    `select coalesce(sum(charged_credits::numeric), 0)::text as s
     from public.music_generations
     where created_at >= $1::timestamptz and created_at <= $2::timestamptz`,
    [fromIso, toIso]
  )
  const n = Number(row?.s ?? 0)
  return Number.isFinite(n) ? n : 0
}

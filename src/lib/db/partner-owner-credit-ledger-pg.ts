import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'

function rowCreatedAtRangeSql(alias: string): string {
  return `and ${alias}.created_at >= $2::timestamptz
        and ($3::timestamptz is null or ${alias}.created_at < $3::timestamptz)`
}

export type OwnerCreditEventSummaryRow = {
  charge_type: string
  event_count: number
  sum_amount: number
}

export type OwnerCreditEventDetailRow = {
  id: string
  charge_type: string
  amount: number
  created_at: string
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString()
  return String(v ?? '')
}

/**
 * Gom các khoản trừ credit có nhật ký (`language_coach_credit_events`) — spend idempotent.
 * Gồm giáo trình, English coach, v.v. trên cùng tài khoản chủ shop.
 */
export async function fetchOwnerCreditEventSummariesFromPg(
  userId: string,
  sinceIso: string,
  untilIsoExclusive?: string | null
): Promise<OwnerCreditEventSummaryRow[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      charge_type: string | null
      event_count: string | number | null
      sum_amount: string | number | null
    }>(
      `select
        e.charge_type,
        count(*)::bigint as event_count,
        coalesce(sum(e.amount), 0)::numeric as sum_amount
      from public.language_coach_credit_events e
      where e.user_id = $1::uuid
        ${rowCreatedAtRangeSql('e')}
      group by e.charge_type
      order by sum(e.amount) desc nulls last, e.charge_type asc`,
      [userId, sinceIso, untilIsoExclusive ?? null]
    )
    return rows.map((r) => ({
      charge_type: String(r.charge_type ?? ''),
      event_count: Math.max(0, Math.floor(Number(r.event_count ?? 0))),
      sum_amount: Math.max(0, Number(r.sum_amount ?? 0)),
    }))
  } catch (e) {
    console.warn('[fetchOwnerCreditEventSummariesFromPg]', e)
    return null
  }
}

export async function fetchOwnerCreditEventDetailsFromPg(
  userId: string,
  sinceIso: string,
  limit: number,
  untilIsoExclusive?: string | null
): Promise<OwnerCreditEventDetailRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.min(200, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      charge_type: string | null
      amount: string | number | null
      created_at: unknown
    }>(
      `select e.id::text, e.charge_type, e.amount, e.created_at
       from public.language_coach_credit_events e
       where e.user_id = $1::uuid
         ${rowCreatedAtRangeSql('e')}
       order by e.created_at desc
       limit $4`,
      [userId, sinceIso, untilIsoExclusive ?? null, lim]
    )
    return rows.map((r) => ({
      id: r.id,
      charge_type: String(r.charge_type ?? ''),
      amount: Math.max(0, Number(r.amount ?? 0)),
      created_at: toIso(r.created_at),
    }))
  } catch (e) {
    console.warn('[fetchOwnerCreditEventDetailsFromPg]', e)
    return null
  }
}

export type PartnerLogoCreditRow = {
  id: string
  charged_credits: number
  model: string
  status: string
  created_at: string
}

/** Chuẩn hóa logo workspace — trừ credit trực tiếp, không qua language_coach_credit_events. */
export async function fetchPartnerLogoCreditRowsInRangeFromPg(
  partnerId: string,
  sinceIso: string,
  limit: number,
  untilIsoExclusive?: string | null
): Promise<PartnerLogoCreditRow[] | null> {
  if (!isPgConfigured()) return null
  const lim = Math.min(200, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      charged_credits: string | number | null
      model: string | null
      status: string | null
      created_at: unknown
    }>(
      `select id::text, charged_credits, model, status, created_at
       from public.messaging_partner_logo_versions
       where partner_id = $1::uuid
         and coalesce(charged_credits, 0) > 0
         and created_at >= $2::timestamptz
         and ($3::timestamptz is null or created_at < $3::timestamptz)
       order by created_at desc
       limit $4`,
      [partnerId, sinceIso, untilIsoExclusive ?? null, lim]
    )
    return rows.map((r) => ({
      id: r.id,
      charged_credits: Math.max(0, Number(r.charged_credits ?? 0)),
      model: String(r.model ?? ''),
      status: String(r.status ?? ''),
      created_at: toIso(r.created_at),
    }))
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code || '') : ''
    if (code === '42P01') return []
    console.warn('[fetchPartnerLogoCreditRowsInRangeFromPg]', e)
    return null
  }
}

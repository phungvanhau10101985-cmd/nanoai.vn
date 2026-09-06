import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export type CreditSpendBucket = 'day' | 'month' | 'year'

export type AdminCreditSpendAggregate = {
  eventCount: number
  distinctUsers: number
  distinctFeatures: number
  sumCredits: number
}

export type AdminCreditSpendFeatureRow = {
  feature: string
  eventCount: number
  distinctUsers: number
  sumCredits: number
}

export type AdminCreditSpendPeriodRow = {
  periodKey: string
  eventCount: number
  distinctUsers: number
  sumCredits: number
}

export type AdminCreditSpendEventRow = {
  id: string
  created_at: string | null
  email: string | null
  feature: string
  amount: number
  source: string
}

function parseNum(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isUndefinedTableError(e: unknown): boolean {
  return Boolean(e && typeof e === 'object' && 'code' in e && String((e as { code?: string }).code) === '42P01')
}

function mapQueryError(e: unknown): string {
  if (isUndefinedTableError(e)) {
    return 'Chưa có bảng credit_spend_events — chạy migration 20260906183000_credit_spend_events.sql'
  }
  return e instanceof Error ? e.message : String(e)
}

/** Khoảng ngày theo lịch Việt Nam (YMD hoặc ISO đều lấy 10 ký tự đầu). */
function vnRangeIso(from: string, to: string): [string, string] {
  const fromYmd = String(from || '').slice(0, 10)
  const toYmd = String(to || '').slice(0, 10)
  return [`${fromYmd}T00:00:00+07:00`, `${toYmd}T23:59:59.999+07:00`]
}

export async function fetchAdminCreditSpendAggregateInRange(
  from: string,
  to: string
): Promise<{ data: AdminCreditSpendAggregate | null; error: string | null }> {
  if (!isPgConfigured()) {
    return { data: null, error: 'DATABASE_URL not set' }
  }
  const [fromIso, toIso] = vnRangeIso(from, to)
  try {
    const row = await pgQueryOne<{
      event_count: string | number | null
      distinct_users: string | number | null
      distinct_features: string | number | null
      sum_credits: string | number | null
    }>(
      `select
         count(*) filter (where amount > 0)::text as event_count,
         count(distinct user_id) filter (where amount > 0)::text as distinct_users,
         count(distinct feature) filter (where amount > 0)::text as distinct_features,
         coalesce(sum(amount), 0)::text as sum_credits
       from public.credit_spend_events
       where created_at >= $1::timestamptz
         and created_at <= $2::timestamptz`,
      [fromIso, toIso]
    )
    return {
      data: {
        eventCount: Math.max(0, Math.floor(parseNum(row?.event_count))),
        distinctUsers: Math.max(0, Math.floor(parseNum(row?.distinct_users))),
        distinctFeatures: Math.max(0, Math.floor(parseNum(row?.distinct_features))),
        sumCredits: parseNum(row?.sum_credits),
      },
      error: null,
    }
  } catch (e) {
    return { data: null, error: mapQueryError(e) }
  }
}

export async function fetchAdminCreditSpendByFeatureInRange(
  from: string,
  to: string
): Promise<{ rows: AdminCreditSpendFeatureRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const [fromIso, toIso] = vnRangeIso(from, to)
  try {
    const rows = await pgQuery<{
      feature: string | null
      event_count: string | number | null
      distinct_users: string | number | null
      sum_credits: string | number | null
    }>(
      `select
         feature,
         count(*) filter (where amount > 0)::bigint as event_count,
         count(distinct user_id) filter (where amount > 0)::bigint as distinct_users,
         coalesce(sum(amount), 0)::numeric as sum_credits
       from public.credit_spend_events
       where created_at >= $1::timestamptz
         and created_at <= $2::timestamptz
       group by feature
       having count(*) filter (where amount > 0) > 0 or sum(amount) <> 0
       order by sum(amount) desc, count(*) filter (where amount > 0) desc, feature asc`,
      [fromIso, toIso]
    )
    return {
      rows: rows.map((r) => ({
        feature: String(r.feature ?? '').trim() || 'unknown',
        eventCount: Math.max(0, Math.floor(parseNum(r.event_count))),
        distinctUsers: Math.max(0, Math.floor(parseNum(r.distinct_users))),
        sumCredits: parseNum(r.sum_credits),
      })),
      error: null,
    }
  } catch (e) {
    return { rows: [], error: mapQueryError(e) }
  }
}

function periodTruncSql(bucket: CreditSpendBucket): string {
  if (bucket === 'year') return `to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY')`
  if (bucket === 'month') return `to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM')`
  return `to_char(created_at at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`
}

export async function fetchAdminCreditSpendByPeriodInRange(
  from: string,
  to: string,
  bucket: CreditSpendBucket
): Promise<{ rows: AdminCreditSpendPeriodRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const [fromIso, toIso] = vnRangeIso(from, to)
  const trunc = periodTruncSql(bucket)
  try {
    const rows = await pgQuery<{
      period_key: string | null
      event_count: string | number | null
      distinct_users: string | number | null
      sum_credits: string | number | null
    }>(
      `select
         ${trunc} as period_key,
         count(*) filter (where amount > 0)::bigint as event_count,
         count(distinct user_id) filter (where amount > 0)::bigint as distinct_users,
         coalesce(sum(amount), 0)::numeric as sum_credits
       from public.credit_spend_events
       where created_at >= $1::timestamptz
         and created_at <= $2::timestamptz
       group by 1
       having count(*) filter (where amount > 0) > 0 or sum(amount) <> 0
       order by 1 asc`,
      [fromIso, toIso]
    )
    return {
      rows: rows.map((r) => ({
        periodKey: String(r.period_key ?? ''),
        eventCount: Math.max(0, Math.floor(parseNum(r.event_count))),
        distinctUsers: Math.max(0, Math.floor(parseNum(r.distinct_users))),
        sumCredits: parseNum(r.sum_credits),
      })),
      error: null,
    }
  } catch (e) {
    return { rows: [], error: mapQueryError(e) }
  }
}

export async function fetchAdminCreditSpendEventsInRange(
  from: string,
  to: string,
  limit: number
): Promise<{ rows: AdminCreditSpendEventRow[]; error: string | null }> {
  if (!isPgConfigured()) {
    return { rows: [], error: 'DATABASE_URL not set' }
  }
  const [fromIso, toIso] = vnRangeIso(from, to)
  const lim = Math.min(2000, Math.max(1, Math.floor(limit)))
  try {
    const rows = await pgQuery<{
      id: string
      created_at: string | null
      email: string | null
      feature: string | null
      amount: string | number | null
      source: string | null
    }>(
      `select
         e.id::text as id,
         e.created_at::text as created_at,
         nullif(au.email, '') as email,
         e.feature,
         e.amount::float8 as amount,
         e.source
       from public.credit_spend_events e
       left join auth.users au on au.id = e.user_id
       where e.created_at >= $1::timestamptz
         and e.created_at <= $2::timestamptz
       order by e.created_at desc
       limit $3`,
      [fromIso, toIso, lim]
    )
    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        created_at: r.created_at ?? null,
        email: r.email ? String(r.email) : null,
        feature: String(r.feature ?? '').trim() || 'unknown',
        amount: parseNum(r.amount),
        source: String(r.source ?? 'deduct'),
      })),
      error: null,
    }
  } catch (e) {
    return { rows: [], error: mapQueryError(e) }
  }
}

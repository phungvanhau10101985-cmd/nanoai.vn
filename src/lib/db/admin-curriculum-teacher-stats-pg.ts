import { MONTHLY_SERVICE_CHARGE_TYPES } from '@/lib/monthly-service-credits'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

export const ADMIN_CURRICULUM_TEACHER_STATS_LIMIT = 500

const GUEST_EMAIL = 'guest-trial-%@guest.nanoai.local'

export type AdminCurriculumTeacherStatRow = {
  userId: string
  fullName: string | null
  email: string | null
  createdCount: number
  openedCount: number
  purchaseCount: number
  lastActivityAt: string
}

export type AdminCurriculumTeacherStatSummary = {
  creators: number
  curricula: number
  openers: number
  opens: number
  teachers: number
  purchases: number
}

type SummaryQueryRow = {
  creators: number | string
  curricula: number | string
  openers: number | string
  opens: number | string
  teachers: number | string
  purchases: number | string
}

type StatQueryRow = {
  user_id: string
  full_name: string | null
  email: string | null
  created_count: number | string
  opened_count: number | string
  purchase_count: number | string
  last_activity_at: Date | string
}

const EMPTY_SUMMARY: AdminCurriculumTeacherStatSummary = {
  creators: 0,
  curricula: 0,
  openers: 0,
  opens: 0,
  teachers: 0,
  purchases: 0,
}

function asInt(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

function buildQuery(query: string): { searchSql: string; params: unknown[] } {
  const params: unknown[] = ['from-placeholder', 'to-placeholder', MONTHLY_SERVICE_CHARGE_TYPES.curriculum]
  const trimmed = query.trim().slice(0, 80)
  if (!trimmed) return { searchSql: '', params }
  params.push(`%${trimmed.replace(/[%_\\]/g, '')}%`)
  const index = params.length
  return {
    searchSql: `and (
      coalesce(au.email, '') ilike $${index}
      or coalesce(p.full_name, '') ilike $${index}
    )`,
    params,
  }
}

/**
 * Mở và tạo giáo trình = thêm giỏ. Mua gói tháng giáo viên (`monthly_service_curriculum`) = mua hàng.
 * `opened_at` chỉ giữ lần mở gần nhất của từng giáo trình.
 */
function activityCte(): string {
  return `
    with created as (
      select c.user_id,
             count(*)::int as created_count,
             max(c.created_at) as last_created_at
      from public.worksheet_curricula c
      where c.user_id is not null
        and c.created_at >= $1::timestamptz
        and c.created_at <= $2::timestamptz
      group by c.user_id
    ),
    opened as (
      select o.user_id,
             count(*)::int as opened_count,
             max(o.opened_at) as last_opened_at
      from public.user_opened_curricula o
      where o.opened_at >= $1::timestamptz
        and o.opened_at <= $2::timestamptz
      group by o.user_id
    ),
    bought as (
      select e.user_id,
             count(*)::int as purchase_count,
             max(e.created_at) as last_purchase_at
      from public.language_coach_credit_events e
      where e.charge_type = $3::text
        and e.created_at >= $1::timestamptz
        and e.created_at <= $2::timestamptz
      group by e.user_id
    ),
    people as (
      select
        ids.user_id,
        coalesce(created.created_count, 0)::int as created_count,
        coalesce(opened.opened_count, 0)::int as opened_count,
        coalesce(bought.purchase_count, 0)::int as purchase_count,
        greatest(
          created.last_created_at,
          opened.last_opened_at,
          bought.last_purchase_at
        ) as last_activity_at
      from (
        select user_id from created
        union
        select user_id from opened
        union
        select user_id from bought
      ) ids
      left join created on created.user_id = ids.user_id
      left join opened on opened.user_id = ids.user_id
      left join bought on bought.user_id = ids.user_id
    )
  `
}

const PEOPLE_FROM = `
  from people
  left join public.profiles p on p.id = people.user_id
  left join auth.users au on au.id = people.user_id
  where lower(coalesce(au.email, '')) not like '${GUEST_EMAIL}'
`

export async function fetchAdminCurriculumTeacherStats(input: {
  fromIso: string
  toIso: string
  query?: string
}): Promise<{
  summary: AdminCurriculumTeacherStatSummary
  rows: AdminCurriculumTeacherStatRow[]
  truncated: boolean
  error: string | null
}> {
  if (!isPgConfigured()) {
    return { summary: EMPTY_SUMMARY, rows: [], truncated: false, error: 'DATABASE_URL not set' }
  }

  const { searchSql, params } = buildQuery(input.query ?? '')
  params[0] = input.fromIso
  params[1] = input.toIso
  const cte = activityCte()

  try {
    const summaryRow = await pgQueryOne<SummaryQueryRow>(
      `${cte}
       select
         count(*) filter (where people.created_count > 0)::int as creators,
         coalesce(sum(people.created_count), 0)::int as curricula,
         count(*) filter (where people.opened_count > 0)::int as openers,
         coalesce(sum(people.opened_count), 0)::int as opens,
         count(*) filter (where people.purchase_count > 0)::int as teachers,
         coalesce(sum(people.purchase_count), 0)::int as purchases
       ${PEOPLE_FROM}
       ${searchSql}`,
      params
    )
    const list = await pgQuery<StatQueryRow>(
      `${cte}
       select
         people.user_id::text as user_id,
         p.full_name,
         nullif(au.email, '') as email,
         people.created_count,
         people.opened_count,
         people.purchase_count,
         people.last_activity_at
       ${PEOPLE_FROM}
       ${searchSql}
       order by (people.purchase_count > 0) desc, people.last_activity_at desc nulls last
       limit ${ADMIN_CURRICULUM_TEACHER_STATS_LIMIT + 1}`,
      params
    )
    const truncated = list.length > ADMIN_CURRICULUM_TEACHER_STATS_LIMIT
    const rows = (truncated ? list.slice(0, ADMIN_CURRICULUM_TEACHER_STATS_LIMIT) : list).map((row) => ({
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      createdCount: asInt(row.created_count),
      openedCount: asInt(row.opened_count),
      purchaseCount: asInt(row.purchase_count),
      lastActivityAt: asIso(row.last_activity_at),
    }))
    return {
      summary: {
        creators: asInt(summaryRow?.creators),
        curricula: asInt(summaryRow?.curricula),
        openers: asInt(summaryRow?.openers),
        opens: asInt(summaryRow?.opens),
        teachers: asInt(summaryRow?.teachers),
        purchases: asInt(summaryRow?.purchases),
      },
      rows,
      truncated,
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { summary: EMPTY_SUMMARY, rows: [], truncated: false, error: msg }
  }
}

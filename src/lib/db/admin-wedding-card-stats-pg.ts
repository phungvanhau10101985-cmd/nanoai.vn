import { countWeddingCardAdVisits } from '@/lib/db/wedding-card-ad-visits-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import {
  weddingCardCompletionMissingSql,
  weddingCardCompletionPercent,
  weddingCardCompletionScoreSql,
} from '@/lib/wedding/wedding-card-completion'
import { emptyWeddingAdVisitCounts, type WeddingAdVisitCounts } from '@/lib/wedding/wedding-ad-source'

export const ADMIN_WEDDING_CARD_STATS_LIMIT = 500

export type AdminWeddingCardStatRow = {
  id: string
  userId: string
  slug: string
  occasionKey: string
  groomName: string
  brideName: string
  isPublished: boolean
  createdAt: string
  fullName: string | null
  email: string | null
  completionPercent: number
  missingKeys: string[]
  adVisits: WeddingAdVisitCounts
}

export type AdminWeddingCardStatSummary = {
  people: number
  cards: number
  published: number
  avgCompletion: number
}

type StatQueryRow = {
  id: string
  user_id: string
  slug: string
  occasion_key: string
  groom_name: string
  bride_name: string
  is_published: boolean
  created_at: Date | string
  full_name: string | null
  email: string | null
  done_count: number | string
  missing_keys: string[] | null
}

type SummaryQueryRow = {
  people: number | string
  cards: number | string
  published: number | string
  avg_done: number | string | null
}

function asIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString()
  return String(value ?? '')
}

function asInt(value: number | string | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function buildFilter(fromIso: string, toIso: string, query: string): { where: string; params: unknown[] } {
  const params: unknown[] = [fromIso, toIso]
  let search = ''
  const trimmed = query.trim().slice(0, 80)
  if (trimmed) {
    params.push(`%${trimmed.replace(/[%_\\]/g, '')}%`)
    const index = params.length
    search = `and (
      coalesce(au.email, '') ilike $${index}
      or coalesce(p.full_name, '') ilike $${index}
      or c.groom_name ilike $${index}
      or c.bride_name ilike $${index}
      or c.slug ilike $${index}
    )`
  }
  const where = `
    where c.created_at >= $1::timestamptz
      and c.created_at <= $2::timestamptz
      and lower(coalesce(au.email, '')) not like 'guest-trial-%@guest.nanoai.local'
      ${search}
  `
  return { where, params }
}

const FROM = `
  from public.wedding_cards c
  left join public.profiles p on p.id = c.user_id
  left join auth.users au on au.id = c.user_id
`

export async function fetchAdminWeddingCardStats(input: {
  fromIso: string
  toIso: string
  query?: string
}): Promise<{
  summary: AdminWeddingCardStatSummary
  rows: AdminWeddingCardStatRow[]
  truncated: boolean
  error: string | null
}> {
  if (!isPgConfigured()) {
    return {
      summary: { people: 0, cards: 0, published: 0, avgCompletion: 0 },
      rows: [],
      truncated: false,
      error: 'DATABASE_URL not set',
    }
  }

  const { where, params } = buildFilter(input.fromIso, input.toIso, input.query ?? '')
  const scoreSql = weddingCardCompletionScoreSql('c')
  const missingSql = weddingCardCompletionMissingSql('c')

  try {
    const [summaryRows, listRows] = await Promise.all([
      pgQuery<SummaryQueryRow>(
        `select count(distinct c.user_id)::int as people,
                count(*)::int as cards,
                count(*) filter (where c.is_published)::int as published,
                avg(${scoreSql})::float8 as avg_done
         ${FROM}
         ${where}`,
        params,
      ),
      pgQuery<StatQueryRow>(
        `select c.id::text as id,
                c.user_id::text as user_id,
                c.slug,
                c.occasion_key,
                c.groom_name,
                c.bride_name,
                c.is_published,
                c.created_at,
                nullif(p.full_name, '') as full_name,
                nullif(au.email, '') as email,
                ${scoreSql}::int as done_count,
                ${missingSql} as missing_keys
         ${FROM}
         ${where}
         order by c.created_at desc, c.id desc
         limit ${ADMIN_WEDDING_CARD_STATS_LIMIT}`,
        params,
      ),
    ])

    const summaryRow = summaryRows[0]
    const cards = asInt(summaryRow?.cards)
    const summary: AdminWeddingCardStatSummary = {
      people: asInt(summaryRow?.people),
      cards,
      published: asInt(summaryRow?.published),
      avgCompletion: weddingCardCompletionPercent(Number(summaryRow?.avg_done ?? 0)),
    }

    const mapped = listRows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      slug: String(row.slug ?? ''),
      occasionKey: String(row.occasion_key ?? 'wedding'),
      groomName: String(row.groom_name ?? ''),
      brideName: String(row.bride_name ?? ''),
      isPublished: Boolean(row.is_published),
      createdAt: asIso(row.created_at),
      fullName: row.full_name ? String(row.full_name) : null,
      email: row.email ? String(row.email) : null,
      completionPercent: weddingCardCompletionPercent(Number(row.done_count ?? 0)),
      missingKeys: Array.isArray(row.missing_keys) ? row.missing_keys.map(String) : [],
    }))
    const adVisits = await countWeddingCardAdVisits(mapped.map((row) => row.id))
    const rows = mapped.map((row) => ({
      ...row,
      adVisits: adVisits.get(row.id) ?? emptyWeddingAdVisitCounts(),
    }))

    return {
      summary,
      rows,
      truncated: cards > rows.length,
      error: null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      summary: { people: 0, cards: 0, published: 0, avgCompletion: 0 },
      rows: [],
      truncated: false,
      error: message,
    }
  }
}

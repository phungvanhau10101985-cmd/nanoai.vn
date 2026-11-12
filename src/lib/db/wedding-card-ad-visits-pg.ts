import { createHash } from 'node:crypto'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery } from '@/lib/db/pg-query'
import {
  emptyWeddingAdVisitCounts,
  type WeddingAdSource,
  type WeddingAdVisitCounts,
} from '@/lib/wedding/wedding-ad-source'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function weddingAdVisitorKey(cookieId: string, ip: string): string {
  return createHash('sha256').update(`${cookieId}\n${ip}`).digest('hex').slice(0, 40)
}

function isUndefinedTable(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '42P01')
}

export async function recordWeddingCardAdVisit(input: {
  cardId: string
  source: WeddingAdSource
  visitorKey: string
}): Promise<'recorded' | 'ignored' | 'unavailable'> {
  if (!isPgConfigured()) return 'unavailable'
  if (!UUID_RE.test(input.cardId)) return 'ignored'
  if (input.visitorKey.length < 8 || input.visitorKey.length > 80) return 'ignored'
  try {
    const rows = await pgQuery<{ wedding_card_id: string }>(
      `insert into public.wedding_card_ad_visits (wedding_card_id, source, visitor_key, visited_on)
       select c.id, $2, $3, (timezone('Asia/Ho_Chi_Minh', now()))::date
       from public.wedding_cards c
       where c.id = $1::uuid
         and c.is_published = true
       on conflict (wedding_card_id, source, visitor_key, visited_on) do nothing
       returning wedding_card_id::text`,
      [input.cardId, input.source, input.visitorKey],
    )
    return rows.length > 0 ? 'recorded' : 'ignored'
  } catch (error) {
    if (isUndefinedTable(error)) return 'unavailable'
    throw error
  }
}

type CountRow = {
  wedding_card_id: string
  source: string
  visits: number | string
}

export async function countWeddingCardAdVisits(cardIds: string[]): Promise<Map<string, WeddingAdVisitCounts>> {
  const ids = [...new Set(cardIds.map((id) => id.trim()).filter((id) => UUID_RE.test(id)))]
  const counts = new Map<string, WeddingAdVisitCounts>()
  if (!ids.length || !isPgConfigured()) return counts
  let rows: CountRow[]
  try {
    rows = await pgQuery<CountRow>(
      `select wedding_card_id::text as wedding_card_id,
              source,
              count(*)::int as visits
       from public.wedding_card_ad_visits
       where wedding_card_id = any($1::uuid[])
       group by wedding_card_id, source`,
      [ids],
    )
  } catch (error) {
    if (isUndefinedTable(error)) return counts
    throw error
  }
  for (const row of rows) {
    const id = String(row.wedding_card_id)
    const current = counts.get(id) ?? emptyWeddingAdVisitCounts()
    const visits = Number(row.visits)
    const safe = Number.isFinite(visits) ? Math.max(0, Math.round(visits)) : 0
    if (row.source === 'facebook') current.facebook = safe
    else if (row.source === 'tiktok') current.tiktok = safe
    else if (row.source === 'google_ads') current.googleAds = safe
    counts.set(id, current)
  }
  return counts
}

import type { Json } from '@/types/database.types'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQueryOne } from '@/lib/db/pg-query'

const MAX_RECENTLY_VIEWED = 40
const MAX_FAVORITES = 48
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PartnerVisitorUtmContext = {
  utm_source?: string
  utm_medium?: string
  utm_campaign?: string
  utm_content?: string
  utm_term?: string
  captured_at?: string
}

export type PartnerVisitorPersonalizationRow = {
  recently_viewed_ids: string[]
  favorite_ids: string[]
  utm_context: PartnerVisitorUtmContext
}

function parseInventoryIdList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const id = typeof item === 'string' ? item.trim() : ''
    if (!UUID_RE.test(id)) continue
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
    if (out.length >= max) break
  }
  return out
}

function parseRecentlyViewedIds(raw: unknown): string[] {
  return parseInventoryIdList(raw, MAX_RECENTLY_VIEWED)
}

function parseFavoriteIds(raw: unknown): string[] {
  return parseInventoryIdList(raw, MAX_FAVORITES)
}

function parseUtmContext(raw: unknown): PartnerVisitorUtmContext {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const o = raw as Record<string, unknown>
  const pick = (k: keyof PartnerVisitorUtmContext) => {
    const v = o[k]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : undefined
  }
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
    utm_content: pick('utm_content'),
    utm_term: pick('utm_term'),
    captured_at: pick('captured_at'),
  }
}

export async function fetchPartnerVisitorPersonalizationFromPg(input: {
  partnerId: string
  accountKey: string
}): Promise<PartnerVisitorPersonalizationRow | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  if (!accountKey) return null
  try {
    const row = await pgQueryOne<{ recently_viewed_ids: Json; favorite_ids: Json; utm_context: Json }>(
      `select recently_viewed_ids, favorite_ids, utm_context
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid and account_key = $2
       limit 1`,
      [input.partnerId, accountKey]
    )
    if (!row) return { recently_viewed_ids: [], favorite_ids: [], utm_context: {} }
    return {
      recently_viewed_ids: parseRecentlyViewedIds(row.recently_viewed_ids),
      favorite_ids: parseFavoriteIds(row.favorite_ids),
      utm_context: parseUtmContext(row.utm_context),
    }
  } catch (e) {
    console.warn('[fetchPartnerVisitorPersonalizationFromPg]', e)
    return null
  }
}

export async function clearPartnerVisitorRecentlyViewedFromPg(input: {
  partnerId: string
  accountKey: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const accountKey = input.accountKey.trim()
  if (!accountKey) return false
  const existing = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey,
  })
  const utm = existing?.utm_context ?? {}
  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, utm_context, updated_at)
       values ($1::uuid, $2, '[]'::jsonb, $3::jsonb, now())
       on conflict (partner_id, account_key) do update set
         recently_viewed_ids = '[]'::jsonb,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(utm)]
    )
    return true
  } catch (e) {
    console.warn('[clearPartnerVisitorRecentlyViewedFromPg]', e)
    return false
  }
}

export async function upsertPartnerVisitorRecentlyViewedFromPg(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
}): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  const inventoryId = input.inventoryId.trim()
  if (!accountKey || !UUID_RE.test(inventoryId)) return null

  const existing = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey,
  })
  const prev = existing?.recently_viewed_ids ?? []
  const next = [inventoryId, ...prev.filter((id) => id.toLowerCase() !== inventoryId.toLowerCase())].slice(
    0,
    MAX_RECENTLY_VIEWED
  )
  const utm = existing?.utm_context ?? {}

  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, utm_context, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::jsonb, now())
       on conflict (partner_id, account_key) do update set
         recently_viewed_ids = excluded.recently_viewed_ids,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(next), JSON.stringify(utm)]
    )
    return next
  } catch (e) {
    console.warn('[upsertPartnerVisitorRecentlyViewedFromPg]', e)
    return null
  }
}

export async function upsertPartnerVisitorUtmContextFromPg(input: {
  partnerId: string
  accountKey: string
  utm: PartnerVisitorUtmContext
}): Promise<PartnerVisitorUtmContext | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  if (!accountKey) return null

  const existing = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey,
  })
  const recently = existing?.recently_viewed_ids ?? []
  const utm: PartnerVisitorUtmContext = {
    ...input.utm,
    captured_at: new Date().toISOString(),
  }

  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, utm_context, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::jsonb, now())
       on conflict (partner_id, account_key) do update set
         utm_context = excluded.utm_context,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(recently), JSON.stringify(utm)]
    )
    return utm
  } catch (e) {
    console.warn('[upsertPartnerVisitorUtmContextFromPg]', e)
    return null
  }
}

export async function appendPartnerVisitorEventInventoryIdsFromPg(input: {
  partnerId: string
  accountKey: string
  inventoryIds: string[]
}): Promise<string[] | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  if (!accountKey) return null
  const ids = input.inventoryIds.filter((id) => UUID_RE.test(id.trim())).map((id) => id.trim())
  if (!ids.length) return null

  const existing = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey,
  })
  const prev = existing?.recently_viewed_ids ?? []
  const seen = new Set<string>()
  const next: string[] = []
  for (const id of [...ids, ...prev]) {
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    next.push(id)
    if (next.length >= MAX_RECENTLY_VIEWED) break
  }
  const utm = existing?.utm_context ?? {}

  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, utm_context, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::jsonb, now())
       on conflict (partner_id, account_key) do update set
         recently_viewed_ids = excluded.recently_viewed_ids,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(next), JSON.stringify(utm)]
    )
    return next
  } catch (e) {
    console.warn('[appendPartnerVisitorEventInventoryIdsFromPg]', e)
    return null
  }
}

export async function mutatePartnerVisitorFavoriteFromPg(input: {
  partnerId: string
  accountKey: string
  inventoryId: string
  action: 'add' | 'remove' | 'toggle'
}): Promise<{ favorite_ids: string[]; is_favorite: boolean } | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  const inventoryId = input.inventoryId.trim()
  if (!accountKey || !UUID_RE.test(inventoryId)) return null

  const existing = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: input.partnerId,
    accountKey,
  })
  const recently = existing?.recently_viewed_ids ?? []
  const utm = existing?.utm_context ?? {}
  const prev = existing?.favorite_ids ?? []
  const key = inventoryId.toLowerCase()
  const has = prev.some((id) => id.toLowerCase() === key)

  let next: string[]
  let isFavorite: boolean
  if (input.action === 'add') {
    isFavorite = true
    next = has ? prev : [inventoryId, ...prev].slice(0, MAX_FAVORITES)
  } else if (input.action === 'remove') {
    isFavorite = false
    next = prev.filter((id) => id.toLowerCase() !== key)
  } else {
    isFavorite = !has
    next = isFavorite
      ? [inventoryId, ...prev.filter((id) => id.toLowerCase() !== key)].slice(0, MAX_FAVORITES)
      : prev.filter((id) => id.toLowerCase() !== key)
  }

  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, favorite_ids, utm_context, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::jsonb, now())
       on conflict (partner_id, account_key) do update set
         favorite_ids = excluded.favorite_ids,
         updated_at = now()`,
      [input.partnerId, accountKey, JSON.stringify(recently), JSON.stringify(next), JSON.stringify(utm)]
    )
    return { favorite_ids: next, is_favorite: isFavorite }
  } catch (e) {
    console.warn('[mutatePartnerVisitorFavoriteFromPg]', e)
    return null
  }
}

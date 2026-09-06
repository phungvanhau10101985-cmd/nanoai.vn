import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import {
  fetchPartnerInventoryCardsByIdsInOrderFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerInventoryShopCardRow } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import {
  inferApparelGenderFromName,
  normalizeSameShopKey,
  SAME_SHOP_MAX_POOL,
  shopL3PairKey,
} from '@/lib/partner-website/shop/partner-site-home-recommendation-mix'
import { mergeSearchQueries } from '@/lib/partner-website/shop/partner-site-search-history'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type InventoryCategorySignal = {
  inventoryId: string
  shopKey: string
  subKey: string
  gender: 'male' | 'female' | null
}

/** 188 same-shop pool: Chinese source shop + level-3 category text. */
export type InventorySameShopSignal = {
  inventoryId: string
  sourceShopKey: string
  l3Key: string
}

export type CohortViewSample = {
  inventoryIds: string[]
  matchedVisitors: number
}

function asUuidList(ids: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of ids) {
    const id = raw.trim()
    if (!UUID_RE.test(id)) continue
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

export async function fetchInventoryCategorySignalsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, InventoryCategorySignal>> {
  const out = new Map<string, InventoryCategorySignal>()
  const ids = asUuidList(inventoryIds)
  if (!isPgConfigured() || !ids.length) return out
  try {
    const cats = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
    const byId = new Map((cats ?? []).map((c) => [c.id.toLowerCase(), c]))
    const links = await pgQuery<{
      inventory_id: string
      category_id: string
      is_primary: boolean
      category_name: string
    }>(
      `select pic.inventory_id::text, pic.category_id::text, pic.is_primary, coalesce(c.name, '') as category_name
       from public.messaging_partner_inventory_categories pic
       join public.messaging_partner_categories c on c.id = pic.category_id
       where c.partner_id = $1::uuid
         and pic.inventory_id = any($2::uuid[])`,
      [partnerId, ids]
    )
    const best = new Map<
      string,
      { shopKey: string; subKey: string; gender: 'male' | 'female' | null; primary: boolean; depth: number }
    >()
    for (const link of links) {
      const inv = link.inventory_id.toLowerCase()
      const cat = byId.get(link.category_id.toLowerCase())
      const subKey = (cat?.id || link.category_id).toLowerCase()
      const parentId = cat?.parentId?.toLowerCase() || ''
      const shopKey = parentId && byId.has(parentId) ? parentId : subKey
      const gender = inferApparelGenderFromName(link.category_name) || inferApparelGenderFromName(cat?.name ?? '')
      const depth = cat?.depth ?? 0
      const prev = best.get(inv)
      if (!prev || (link.is_primary && !prev.primary) || (link.is_primary === prev.primary && depth > prev.depth)) {
        best.set(inv, { shopKey, subKey, gender, primary: Boolean(link.is_primary), depth })
      }
    }
    for (const id of ids) {
      const hit = best.get(id.toLowerCase())
      if (!hit) continue
      out.set(id.toLowerCase(), {
        inventoryId: id,
        shopKey: hit.shopKey,
        subKey: hit.subKey,
        gender: hit.gender,
      })
    }
  } catch (e) {
    console.warn('[fetchInventoryCategorySignalsFromPg]', e)
  }
  return out
}

function sourceShopKeyFromRow(row: {
  source_shop_name_chinese?: string | null
  catalog_shop_chinese?: string | null
  source_shop_id?: string | null
  source_shop_name?: string | null
}): string {
  return (
    normalizeSameShopKey(row.source_shop_name_chinese) ||
    normalizeSameShopKey(row.catalog_shop_chinese) ||
    normalizeSameShopKey(row.source_shop_id) ||
    normalizeSameShopKey(row.source_shop_name)
  )
}

function l3KeyFromRow(row: { category_l3?: string | null; catalog_l3?: string | null }): string {
  return normalizeSameShopKey(row.category_l3) || normalizeSameShopKey(row.catalog_l3)
}

const SAME_SHOP_SQL_KEY = `lower(trim(coalesce(
  nullif(trim(coalesce(mpi.source_shop_name_chinese, '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'shop_name_chinese', '')), ''),
  nullif(trim(coalesce(mpi.source_shop_id, '')), ''),
  nullif(trim(coalesce(mpi.source_shop_name, '')), '')
)))`

const SAME_SHOP_SQL_L3 = `lower(trim(coalesce(
  nullif(trim(coalesce(mpi.category_l3, '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'sub_subcategory', '')), ''),
  nullif(trim(coalesce(mpi.catalog_json->>'category_l3', '')), '')
)))`

export async function fetchInventorySameShopSignalsFromPg(
  partnerId: string,
  inventoryIds: string[]
): Promise<Map<string, InventorySameShopSignal>> {
  const out = new Map<string, InventorySameShopSignal>()
  const ids = asUuidList(inventoryIds)
  if (!isPgConfigured() || !ids.length) return out
  try {
    const rows = await pgQuery<{
      id: string
      source_shop_name_chinese: string | null
      catalog_shop_chinese: string | null
      source_shop_id: string | null
      source_shop_name: string | null
      category_l3: string | null
      catalog_l3: string | null
    }>(
      `select mpi.id::text as id,
              mpi.source_shop_name_chinese,
              mpi.catalog_json->>'shop_name_chinese' as catalog_shop_chinese,
              mpi.source_shop_id,
              mpi.source_shop_name,
              mpi.category_l3,
              coalesce(mpi.catalog_json->>'sub_subcategory', mpi.catalog_json->>'category_l3') as catalog_l3
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and mpi.id = any($2::uuid[])`,
      [partnerId, ids]
    )
    for (const row of rows) {
      const sourceShopKey = sourceShopKeyFromRow(row)
      const l3Key = l3KeyFromRow(row)
      if (!sourceShopKey && !l3Key) continue
      out.set(row.id.toLowerCase(), {
        inventoryId: row.id,
        sourceShopKey,
        l3Key,
      })
    }

    const missingL3 = ids.filter((id) => !normalizeSameShopKey(out.get(id.toLowerCase())?.l3Key))
    if (missingL3.length) {
      const cats = await fetchPartnerCategoriesFlatFromPg(partnerId, { activeOnly: false })
      const byId = new Map((cats ?? []).map((c) => [c.id.toLowerCase(), c]))
      const links = await pgQuery<{
        inventory_id: string
        category_id: string
        is_primary: boolean
      }>(
        `select pic.inventory_id::text, pic.category_id::text, pic.is_primary
         from public.messaging_partner_inventory_categories pic
         join public.messaging_partner_categories c on c.id = pic.category_id
         where c.partner_id = $1::uuid
           and pic.inventory_id = any($2::uuid[])`,
        [partnerId, missingL3]
      )
      const best = new Map<string, { name: string; depth: number; primary: boolean }>()
      for (const link of links) {
        const cat = byId.get(link.category_id.toLowerCase())
        const depth = cat?.depth ?? 0
        if (depth < 3) continue
        const name = normalizeSameShopKey(cat?.name)
        if (!name) continue
        const prev = best.get(link.inventory_id.toLowerCase())
        if (!prev || (link.is_primary && !prev.primary) || (link.is_primary === prev.primary && depth > prev.depth)) {
          best.set(link.inventory_id.toLowerCase(), { name, depth, primary: Boolean(link.is_primary) })
        }
      }
      for (const [id, hit] of best) {
        const prev = out.get(id)
        out.set(id, {
          inventoryId: prev?.inventoryId || id,
          sourceShopKey: prev?.sourceShopKey || '',
          l3Key: hit.name,
        })
      }
    }
  } catch (e) {
    console.warn('[fetchInventorySameShopSignalsFromPg]', e)
  }
  return out
}

export async function fetchActiveInventoryByShopL3PairsFromPg(input: {
  partnerId: string
  pairs: Array<{ shop: string; l3: string }>
  limit?: number
}): Promise<PartnerInventoryShopCardRow[]> {
  const shops: string[] = []
  const l3s: string[] = []
  const seen = new Set<string>()
  for (const pair of input.pairs) {
    const key = shopL3PairKey(pair.shop, pair.l3)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const [shop, l3] = key.split('\t')
    if (!shop || !l3) continue
    shops.push(shop)
    l3s.push(l3)
  }
  if (!isPgConfigured() || !shops.length) return []
  const lim = Math.max(1, Math.min(SAME_SHOP_MAX_POOL, Math.floor(Number(input.limit) || SAME_SHOP_MAX_POOL)))
  try {
    const rows = await pgQuery<{ id: string }>(
      `with pairs(shop, l3) as (
         select * from unnest($2::text[], $3::text[]) as t(shop, l3)
       )
       select mpi.id::text
       from public.messaging_partner_inventory mpi
       join pairs p
         on ${SAME_SHOP_SQL_KEY} = p.shop
        and (
          ${SAME_SHOP_SQL_L3} = p.l3
          or exists (
            select 1
            from public.messaging_partner_inventory_categories pic
            join public.messaging_partner_categories c on c.id = pic.category_id
            where pic.inventory_id = mpi.id
              and c.partner_id = $1::uuid
              and c.depth >= 3
              and lower(trim(c.name)) = p.l3
          )
        )
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
       order by mpi.id
       limit $4`,
      [input.partnerId, shops, l3s, lim]
    )
    return (
      (await fetchPartnerInventoryCardsByIdsInOrderFromPg(
        input.partnerId,
        rows.map((row) => row.id)
      )) ?? []
    )
  } catch (e) {
    console.warn('[fetchActiveInventoryByShopL3PairsFromPg]', e)
    return []
  }
}

export async function fetchActiveInventoryByShopKeysFromPg(input: {
  partnerId: string
  shopKeys: string[]
  limit?: number
}): Promise<PartnerInventoryShopCardRow[]> {
  const keys = [...new Set(input.shopKeys.map((k) => k.trim().toLowerCase()).filter(Boolean))]
  if (!isPgConfigured() || !keys.length) return []
  const lim = Math.max(1, Math.min(1500, Math.floor(Number(input.limit) || 400)))
  try {
    const rows = await pgQuery<{ id: string }>(
      `select mpi.id::text
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         and exists (
           select 1
           from public.messaging_partner_inventory_categories pic
           join public.messaging_partner_categories c on c.id = pic.category_id
           where pic.inventory_id = mpi.id
             and c.partner_id = $1::uuid
             and (
               lower(c.id::text) = any($2::text[])
               or lower(coalesce(c.parent_id::text, '')) = any($2::text[])
             )
         )
       order by mpi.sort_order asc, mpi.updated_at desc
       limit $3`,
      [input.partnerId, keys, lim]
    )
    return (
      (await fetchPartnerInventoryCardsByIdsInOrderFromPg(
        input.partnerId,
        rows.map((row) => row.id)
      )) ?? []
    )
  } catch (e) {
    console.warn('[fetchActiveInventoryByShopKeysFromPg]', e)
    return []
  }
}

export async function fetchPopularInventoryIdsFromPg(input: {
  partnerId: string
  excludeIds?: string[]
  limit: number
}): Promise<string[]> {
  if (!isPgConfigured()) return []
  const exclude = asUuidList(input.excludeIds ?? [])
  const lim = Math.max(1, Math.min(60, Math.floor(input.limit)))
  try {
    const rows = await pgQuery<{ inventory_id: string; hits: number }>(
      `select lower(trim(item)) as inventory_id, count(*)::int as hits
       from public.messaging_partner_visitor_personalization v
       cross join lateral jsonb_array_elements_text(coalesce(v.recently_viewed_ids, '[]'::jsonb)) as item
       where v.partner_id = $1::uuid
         and item ~* '^[0-9a-f-]{36}$'
         ${exclude.length ? 'and not (lower(trim(item)) = any($3::text[]))' : ''}
       group by 1
       order by hits desc
       limit $2`,
      exclude.length ? [input.partnerId, lim * 3, exclude.map((id) => id.toLowerCase())] : [input.partnerId, lim * 3]
    )
    const viewed = rows.map((r) => r.inventory_id).filter((id) => UUID_RE.test(id))
    if (viewed.length >= lim) return viewed.slice(0, lim)

    const extra = await pgQuery<{ id: string }>(
      `select mpi.id::text
       from public.messaging_partner_inventory mpi
       where mpi.partner_id = $1::uuid
         and coalesce(mpi.is_active, true) = true
         ${exclude.length ? 'and not (mpi.id = any($3::uuid[]))' : ''}
       order by mpi.sort_order asc, mpi.updated_at desc
       limit $2`,
      exclude.length ? [input.partnerId, lim, exclude] : [input.partnerId, lim]
    )
    const seen = new Set(viewed.map((id) => id.toLowerCase()))
    for (const row of extra) {
      const key = row.id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      viewed.push(row.id)
      if (viewed.length >= lim) break
    }
    return viewed.slice(0, lim)
  } catch (e) {
    console.warn('[fetchPopularInventoryIdsFromPg]', e)
    return []
  }
}

export async function fetchCohortViewedInventoryIdsFromPg(input: {
  partnerId: string
  excludeAccountKey: string
  gender: 'male' | 'female'
  birthYear?: number | null
  limit: number
}): Promise<CohortViewSample> {
  if (!isPgConfigured()) return { inventoryIds: [], matchedVisitors: 0 }
  const exclude = input.excludeAccountKey.trim()
  if (!exclude) return { inventoryIds: [], matchedVisitors: 0 }
  const lim = Math.max(1, Math.min(100, Math.floor(input.limit)))
  const year = input.birthYear && Number.isFinite(input.birthYear) ? Math.floor(input.birthYear) : null
  try {
    const rows = await pgQuery<{ recently_viewed_ids: unknown }>(
      `select recently_viewed_ids
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid
         and account_key <> $2
         and lower(coalesce(profile_gender, '')) = $3
         ${year != null ? 'and profile_birth_year = $4' : ''}
         and jsonb_typeof(recently_viewed_ids) = 'array'
         and jsonb_array_length(recently_viewed_ids) > 0
       order by updated_at desc
       limit 80`,
      year != null ? [input.partnerId, exclude, input.gender, year] : [input.partnerId, exclude, input.gender]
    )
    const ids: string[] = []
    const seen = new Set<string>()
    for (const row of rows) {
      const list = Array.isArray(row.recently_viewed_ids) ? row.recently_viewed_ids : []
      for (const item of list) {
        const id = typeof item === 'string' ? item.trim() : ''
        if (!UUID_RE.test(id)) continue
        const key = id.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        ids.push(id)
        if (ids.length >= lim) break
      }
      if (ids.length >= lim) break
    }
    return { inventoryIds: ids, matchedVisitors: rows.length }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/profile_gender|profile_birth_year/i.test(msg)) return { inventoryIds: [], matchedVisitors: 0 }
    console.warn('[fetchCohortViewedInventoryIdsFromPg]', e)
    return { inventoryIds: [], matchedVisitors: 0 }
  }
}

export async function upsertVisitorProfileHintFromPg(input: {
  partnerId: string
  accountKey: string
  gender: 'male' | 'female'
  birthYear?: number | null
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const accountKey = input.accountKey.trim()
  if (!accountKey) return false
  const year =
    input.birthYear && Number.isFinite(input.birthYear) && input.birthYear >= 1900 && input.birthYear <= 2100
      ? Math.floor(input.birthYear)
      : null
  try {
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, utm_context, profile_gender, profile_birth_year, updated_at)
       values ($1::uuid, $2, '[]'::jsonb, '{}'::jsonb, $3, $4, now())
       on conflict (partner_id, account_key) do update set
         profile_gender = excluded.profile_gender,
         profile_birth_year = excluded.profile_birth_year,
         updated_at = now()`,
      [input.partnerId, accountKey, input.gender, year]
    )
    return true
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/profile_gender|profile_birth_year/i.test(msg)) return false
    console.warn('[upsertVisitorProfileHintFromPg]', e)
    return false
  }
}

export async function fetchVisitorProfileHintFromPg(input: {
  partnerId: string
  accountKey: string
}): Promise<{ gender: 'male' | 'female' | null; birthYear: number | null } | null> {
  if (!isPgConfigured()) return null
  const accountKey = input.accountKey.trim()
  if (!accountKey) return null
  try {
    const row = await pgQueryOne<{ profile_gender: string | null; profile_birth_year: number | null }>(
      `select profile_gender, profile_birth_year
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid and account_key = $2
       limit 1`,
      [input.partnerId, accountKey]
    )
    if (!row) return { gender: null, birthYear: null }
    const g = row.profile_gender?.trim().toLowerCase()
    return {
      gender: g === 'male' || g === 'female' ? g : null,
      birthYear: Number.isFinite(Number(row.profile_birth_year)) ? Number(row.profile_birth_year) : null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/profile_gender|profile_birth_year/i.test(msg)) return { gender: null, birthYear: null }
    console.warn('[fetchVisitorProfileHintFromPg]', e)
    return null
  }
}

export async function mergePartnerVisitorPersonalizationFromPg(input: {
  partnerId: string
  fromAccountKey: string
  toAccountKey: string
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  const fromKey = input.fromAccountKey.trim()
  const toKey = input.toAccountKey.trim()
  if (!fromKey || !toKey || fromKey === toKey) return false
  try {
    const from = await pgQueryOne<{
      recently_viewed_ids: unknown
      favorite_ids: unknown
      search_queries: unknown
      utm_context: unknown
      profile_gender: string | null
      profile_birth_year: number | null
    }>(
      `select recently_viewed_ids, favorite_ids, search_queries, utm_context, profile_gender, profile_birth_year
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid and account_key = $2
       limit 1`,
      [input.partnerId, fromKey]
    )
    if (!from) return true
    const to = await pgQueryOne<{
      recently_viewed_ids: unknown
      favorite_ids: unknown
      search_queries: unknown
      utm_context: unknown
      profile_gender: string | null
      profile_birth_year: number | null
    }>(
      `select recently_viewed_ids, favorite_ids, search_queries, utm_context, profile_gender, profile_birth_year
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid and account_key = $2
       limit 1`,
      [input.partnerId, toKey]
    )
    const mergeIds = (a: unknown, b: unknown, max: number) => {
      const out: string[] = []
      const seen = new Set<string>()
      for (const item of [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]) {
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
    const recently = mergeIds(from.recently_viewed_ids, to?.recently_viewed_ids, 40)
    const favorites = mergeIds(from.favorite_ids, to?.favorite_ids, 48)
    const searches = mergeSearchQueries(from.search_queries, to?.search_queries)
    const utm =
      to?.utm_context && typeof to.utm_context === 'object' && to.utm_context
        ? to.utm_context
        : from.utm_context ?? {}
    const gender = to?.profile_gender || from.profile_gender || null
    const birthYear = to?.profile_birth_year ?? from.profile_birth_year ?? null
    await getPgPool().query(
      `insert into public.messaging_partner_visitor_personalization
         (partner_id, account_key, recently_viewed_ids, favorite_ids, search_queries, utm_context, profile_gender, profile_birth_year, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, now())
       on conflict (partner_id, account_key) do update set
         recently_viewed_ids = excluded.recently_viewed_ids,
         favorite_ids = excluded.favorite_ids,
         search_queries = excluded.search_queries,
         utm_context = excluded.utm_context,
         profile_gender = coalesce(excluded.profile_gender, messaging_partner_visitor_personalization.profile_gender),
         profile_birth_year = coalesce(excluded.profile_birth_year, messaging_partner_visitor_personalization.profile_birth_year),
         updated_at = now()`,
      [
        input.partnerId,
        toKey,
        JSON.stringify(recently),
        JSON.stringify(favorites),
        JSON.stringify(searches),
        JSON.stringify(utm),
        gender,
        birthYear,
      ]
    )
    return true
  } catch (e) {
    console.warn('[mergePartnerVisitorPersonalizationFromPg]', e)
    return false
  }
}

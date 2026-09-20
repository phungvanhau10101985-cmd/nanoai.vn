/**
 * Admin list/delete PG L2 listing caches (facet + id list) + thống kê từ khóa khách.
 * Redis L1 vẫn bust bằng bumpInventoryCache — caller gọi bump sau delete/rebuild.
 */

import { partnerInventoryCacheVersion } from '@/lib/cache/partner-shop-cache'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  FACET_REBUILD_CATEGORY_CAP,
  FACET_REBUILD_SEARCH_CAP,
  jsonArrayLen,
  type ListingFacetCacheScopeType,
  type ListingIdListCacheScopeType,
} from '@/lib/partner-website/shop/partner-listing-cache-admin'

export type ListingFacetCacheAdminRow = {
  scopeType: ListingFacetCacheScopeType
  scopeKey: string
  displayLabel: string
  cacheVer: number
  currentVer: number
  stale: boolean
  productCount: number
  sizeCount: number
  colorCount: number
  styleTagCount: number
  priceMin: number | null
  priceMax: number | null
  updatedAt: string | null
}

export type ListingIdListCacheAdminRow = {
  scopeType: ListingIdListCacheScopeType
  scopeKey: string
  cacheVer: number
  currentVer: number
  stale: boolean
  productCount: number
  idCount: number
  updatedAt: string | null
}

export type SearchKeywordStatRow = {
  keyword: string
  hits: number
}

function missingTable(e: unknown): boolean {
  const code = e && typeof e === 'object' ? String((e as { code?: string }).code ?? '') : ''
  return code === '42P01'
}

function toIso(raw: unknown): string | null {
  if (!raw) return null
  if (raw instanceof Date) return raw.toISOString()
  const s = String(raw)
  return s || null
}

export async function listPartnerListingFacetCacheFromPg(input: {
  partnerId: string
  scopeType?: ListingFacetCacheScopeType | null
  offset: number
  limit: number
}): Promise<{ rows: ListingFacetCacheAdminRow[]; total: number; countsByType: Record<string, number> } | null> {
  if (!isPgConfigured()) return null
  const currentVer = await partnerInventoryCacheVersion(input.partnerId)
  const scope = input.scopeType ?? null
  try {
    const countRow = await pgQueryOne<{ c: string | number }>(
      `select count(*)::int as c
       from public.messaging_partner_listing_facet_cache
       where partner_id = $1::uuid
         and ($2::text is null or scope_type = $2)`,
      [input.partnerId, scope]
    )
    const typeRows = await pgQuery<{ scope_type: string; c: string | number }>(
      `select scope_type, count(*)::int as c
       from public.messaging_partner_listing_facet_cache
       where partner_id = $1::uuid
       group by scope_type`,
      [input.partnerId]
    )
    const rows = await pgQuery<{
      scope_type: ListingFacetCacheScopeType
      scope_key: string
      cache_ver: number | string
      product_count: number | string | null
      sizes_json: unknown
      colors_json: unknown
      style_tags_json: unknown
      price_min: string | number | null
      price_max: string | number | null
      updated_at: Date | string | null
      category_name: string | null
    }>(
      `select f.scope_type, f.scope_key, f.cache_ver, f.product_count,
              f.sizes_json, f.colors_json, f.style_tags_json, f.price_min, f.price_max, f.updated_at,
              c.name as category_name
       from public.messaging_partner_listing_facet_cache f
       left join public.messaging_partner_categories c
         on c.partner_id = f.partner_id and c.id::text = f.scope_key
       where f.partner_id = $1::uuid
         and ($2::text is null or f.scope_type = $2)
       order by f.updated_at desc nulls last
       limit $3 offset $4`,
      [input.partnerId, scope, input.limit, input.offset]
    )
    const countsByType: Record<string, number> = {}
    for (const r of typeRows) countsByType[r.scope_type] = Number(r.c) || 0
    return {
      total: Number(countRow?.c) || 0,
      countsByType,
      rows: rows.map((r) => {
        const cacheVer = Number(r.cache_ver) || 0
        const label =
          r.scope_type === 'search_q'
            ? r.scope_key
            : String(r.category_name ?? '').trim() || r.scope_key
        return {
          scopeType: r.scope_type,
          scopeKey: r.scope_key,
          displayLabel: label,
          cacheVer,
          currentVer,
          stale: cacheVer !== currentVer,
          productCount: Number(r.product_count) || 0,
          sizeCount: jsonArrayLen(r.sizes_json),
          colorCount: jsonArrayLen(r.colors_json),
          styleTagCount: jsonArrayLen(r.style_tags_json),
          priceMin: r.price_min == null ? null : Number(r.price_min),
          priceMax: r.price_max == null ? null : Number(r.price_max),
          updatedAt: toIso(r.updated_at),
        }
      }),
    }
  } catch (e) {
    if (missingTable(e)) return { rows: [], total: 0, countsByType: {} }
    console.warn('[listPartnerListingFacetCacheFromPg]', e)
    return null
  }
}

export async function deletePartnerListingFacetCacheFromPg(input: {
  partnerId: string
  scopeType?: ListingFacetCacheScopeType | null
  scopeKey?: string | null
}): Promise<number> {
  if (!isPgConfigured()) return 0
  const key = String(input.scopeKey ?? '').trim()
  try {
    if (input.scopeType && key) {
      const row = await pgQueryOne<{ c: string | number }>(
        `with d as (
           delete from public.messaging_partner_listing_facet_cache
           where partner_id = $1::uuid and scope_type = $2 and scope_key = $3
           returning 1
         )
         select count(*)::int as c from d`,
        [input.partnerId, input.scopeType, key]
      )
      return Number(row?.c) || 0
    }
    const row = await pgQueryOne<{ c: string | number }>(
      `with d as (
         delete from public.messaging_partner_listing_facet_cache
         where partner_id = $1::uuid
         returning 1
       )
       select count(*)::int as c from d`,
      [input.partnerId]
    )
    return Number(row?.c) || 0
  } catch (e) {
    if (missingTable(e)) return 0
    console.warn('[deletePartnerListingFacetCacheFromPg]', e)
    return 0
  }
}

export async function listPartnerFacetSearchKeysFromPg(partnerId: string, limit = FACET_REBUILD_SEARCH_CAP): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ scope_key: string }>(
      `select scope_key
       from public.messaging_partner_listing_facet_cache
       where partner_id = $1::uuid and scope_type = 'search_q'
       order by updated_at desc nulls last
       limit $2`,
      [partnerId, Math.min(FACET_REBUILD_SEARCH_CAP, Math.max(1, limit))]
    )
    return rows.map((r) => String(r.scope_key ?? '').trim()).filter(Boolean)
  } catch (e) {
    if (missingTable(e)) return []
    console.warn('[listPartnerFacetSearchKeysFromPg]', e)
    return []
  }
}

export async function listPartnerCategoryIdsForFacetRebuildFromPg(
  partnerId: string,
  limit = FACET_REBUILD_CATEGORY_CAP
): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ id: string }>(
      `select id::text as id
       from public.messaging_partner_categories
       where partner_id = $1::uuid
       order by depth asc, sort_order asc, name asc
       limit $2`,
      [partnerId, Math.min(FACET_REBUILD_CATEGORY_CAP, Math.max(1, limit))]
    )
    return rows.map((r) => String(r.id ?? '').trim()).filter(Boolean)
  } catch (e) {
    if (missingTable(e)) return []
    console.warn('[listPartnerCategoryIdsForFacetRebuildFromPg]', e)
    return []
  }
}

export async function listPartnerListingIdListCacheFromPg(input: {
  partnerId: string
  scopeType?: ListingIdListCacheScopeType | null
  offset: number
  limit: number
}): Promise<{ rows: ListingIdListCacheAdminRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const currentVer = await partnerInventoryCacheVersion(input.partnerId)
  const scope = input.scopeType ?? null
  try {
    const countRow = await pgQueryOne<{ c: string | number }>(
      `select count(*)::int as c
       from public.messaging_partner_listing_id_cache
       where partner_id = $1::uuid
         and ($2::text is null or scope_type = $2)`,
      [input.partnerId, scope]
    )
    const rows = await pgQuery<{
      scope_type: ListingIdListCacheScopeType
      scope_key: string
      cache_ver: number | string
      product_count: number | string | null
      ids_json: unknown
      updated_at: Date | string | null
    }>(
      `select scope_type, scope_key, cache_ver, product_count, ids_json, updated_at
       from public.messaging_partner_listing_id_cache
       where partner_id = $1::uuid
         and ($2::text is null or scope_type = $2)
       order by updated_at desc nulls last
       limit $3 offset $4`,
      [input.partnerId, scope, input.limit, input.offset]
    )
    return {
      total: Number(countRow?.c) || 0,
      rows: rows.map((r) => {
        const cacheVer = Number(r.cache_ver) || 0
        return {
          scopeType: r.scope_type,
          scopeKey: r.scope_key,
          cacheVer,
          currentVer,
          stale: cacheVer !== currentVer,
          productCount: Number(r.product_count) || 0,
          idCount: jsonArrayLen(r.ids_json),
          updatedAt: toIso(r.updated_at),
        }
      }),
    }
  } catch (e) {
    if (missingTable(e)) return { rows: [], total: 0 }
    console.warn('[listPartnerListingIdListCacheFromPg]', e)
    return null
  }
}

export async function deletePartnerListingIdListCacheFromPg(input: {
  partnerId: string
  scopeType?: ListingIdListCacheScopeType | null
  scopeKey?: string | null
}): Promise<number> {
  if (!isPgConfigured()) return 0
  const key = String(input.scopeKey ?? '').trim()
  try {
    if (input.scopeType && key) {
      const row = await pgQueryOne<{ c: string | number }>(
        `with d as (
           delete from public.messaging_partner_listing_id_cache
           where partner_id = $1::uuid and scope_type = $2 and scope_key = $3
           returning 1
         )
         select count(*)::int as c from d`,
        [input.partnerId, input.scopeType, key]
      )
      return Number(row?.c) || 0
    }
    const row = await pgQueryOne<{ c: string | number }>(
      `with d as (
         delete from public.messaging_partner_listing_id_cache
         where partner_id = $1::uuid
         returning 1
       )
       select count(*)::int as c from d`,
      [input.partnerId]
    )
    return Number(row?.c) || 0
  } catch (e) {
    if (missingTable(e)) return 0
    console.warn('[deletePartnerListingIdListCacheFromPg]', e)
    return 0
  }
}

export async function listPartnerSearchKeywordStatsFromPg(input: {
  partnerId: string
  days: number
  offset: number
  limit: number
}): Promise<{ rows: SearchKeywordStatRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const days = Math.min(365, Math.max(1, Math.floor(input.days) || 30))
  try {
    const countRow = await pgQueryOne<{ c: string | number }>(
      `select count(*)::int as c from (
         select trim(q) as keyword
         from public.messaging_partner_visitor_personalization v
         cross join lateral jsonb_array_elements_text(coalesce(v.search_queries, '[]'::jsonb)) as q
         where v.partner_id = $1::uuid
           and v.updated_at >= now() - ($2::text || ' days')::interval
           and char_length(trim(q)) between 2 and 80
         group by trim(q)
       ) s`,
      [input.partnerId, String(days)]
    )
    const rows = await pgQuery<{ keyword: string; hits: string | number }>(
      `select trim(q) as keyword, count(*)::int as hits
       from public.messaging_partner_visitor_personalization v
       cross join lateral jsonb_array_elements_text(coalesce(v.search_queries, '[]'::jsonb)) as q
       where v.partner_id = $1::uuid
         and v.updated_at >= now() - ($2::text || ' days')::interval
         and char_length(trim(q)) between 2 and 80
       group by trim(q)
       order by hits desc, keyword asc
       limit $3 offset $4`,
      [input.partnerId, String(days), input.limit, input.offset]
    )
    return {
      total: Number(countRow?.c) || 0,
      rows: rows.map((r) => ({
        keyword: String(r.keyword ?? '').trim(),
        hits: Number(r.hits) || 0,
      })),
    }
  } catch (e) {
    if (missingTable(e)) return { rows: [], total: 0 }
    console.warn('[listPartnerSearchKeywordStatsFromPg]', e)
    return null
  }
}

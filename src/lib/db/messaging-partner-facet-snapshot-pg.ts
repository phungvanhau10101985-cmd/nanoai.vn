/**
 * Snapshot facet gốc (chưa chọn size/màu/giá) — SQL aggregate, không LIMIT 500.
 * Redis L1 (caller) + Postgres L2 theo cache_ver / partner_id.
 */

import { partnerInventoryCacheVersion } from '@/lib/cache/partner-shop-cache'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { PARTNER_CATEGORY_SUBTREE_IN_SQL } from '@/lib/partner-website/shop/partner-catalog-scale'
import {
  allowedStyleTagsForListingL1,
  foldStyleTagText,
  MIN_STYLE_TAG_FACET_PRODUCTS,
  PARTNER_STYLE_TAG_ALIASES,
  styleTagsMeetingMinCount,
} from '@/lib/partner-website/shop/partner-shop-style-tags'
import { PARTNER_SEARCH_DOCUMENT_HAYSTACK_SQL } from '@/lib/partner-website/shop/partner-site-text-search'
import { escapeIlikeToken, tokenizePartnerTextSearch } from '@/lib/partner-website/shop/partner-site-text-search'

export type PartnerCategoryFacetCounts = {
  sizes: Array<{ value: string; count: number }>
  colors: Array<{ value: string; count: number }>
  styleTags: Array<{ value: string; count: number }>
  priceMin?: number | null
  priceMax?: number | null
  productCount?: number
}

type FacetValueRow = { value: string; count: number | string }

function toFacetList(rows: FacetValueRow[], limit = 40): Array<{ value: string; count: number }> {
  return rows
    .map((r) => ({ value: String(r.value ?? '').trim(), count: Number(r.count) || 0 }))
    .filter((r) => r.value && r.count > 0)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'vi'))
    .slice(0, limit)
}

function styleTagHaystackSql(): string {
  return `lower(unaccent(concat_ws(' ',
    coalesce(mpi.name, ''),
    coalesce(mpi.style, ''),
    coalesce(mpi.material_note, ''),
    coalesce(mpi.features_json::text, ''),
    coalesce(mpi.category_l1, ''),
    coalesce(mpi.category_l2, ''),
    coalesce(mpi.category_l3, '')
  )))`
}

function styleTagCountSelect(params: unknown[]): string {
  const haystack = styleTagHaystackSql()
  const parts: string[] = []
  for (const [label, aliases] of Object.entries(PARTNER_STYLE_TAG_ALIASES)) {
    const needles = [...aliases, label].map((a) => `%${foldStyleTagText(a)}%`).filter((n) => n.length > 2)
    if (!needles.length) continue
    params.push(needles)
    const idx = params.length
    parts.push(`count(*) filter (where ${haystack} like any($${idx}::text[]))::int as ${JSON.stringify(label)}`)
  }
  return parts.join(',\n       ')
}

async function loadStyleTagCounts(
  whereSql: string,
  baseParams: unknown[],
  listingL1: string
): Promise<Array<{ value: string; count: number }>> {
  const params = [...baseParams]
  const select = styleTagCountSelect(params)
  if (!select) return []
  try {
    const row = await pgQueryOne<Record<string, number | string>>(
      `select ${select}
       from public.messaging_partner_inventory mpi
       where ${whereSql}`,
      params
    )
    const map = new Map<string, number>()
    if (row) {
      for (const [label, raw] of Object.entries(row)) {
        const n = Number(raw) || 0
        if (n > 0) map.set(label, n)
      }
    }
    const allowed = allowedStyleTagsForListingL1(listingL1)
    return styleTagsMeetingMinCount(map, { allowed, minCount: MIN_STYLE_TAG_FACET_PRODUCTS })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/unaccent/i.test(msg) || /42703/.test(msg)) return []
    console.warn('[loadStyleTagCounts]', e)
    return []
  }
}

async function loadSizeColorPrice(
  whereSql: string,
  params: unknown[]
): Promise<Pick<PartnerCategoryFacetCounts, 'sizes' | 'colors' | 'priceMin' | 'priceMax' | 'productCount'>> {
  const [sizes, colors, stats] = await Promise.all([
    pgQuery<FacetValueRow>(
      `select trim(coalesce(el->>'name', trim(both '"' from el::text))) as value, count(*)::int as count
       from public.messaging_partner_inventory mpi
       cross join lateral jsonb_array_elements(case when jsonb_typeof(mpi.sizes_json) = 'array' then mpi.sizes_json else '[]'::jsonb end) el
       where ${whereSql}
         and trim(coalesce(el->>'name', trim(both '"' from el::text))) <> ''
       group by 1
       order by count desc, value asc
       limit 40`,
      params
    ),
    pgQuery<FacetValueRow>(
      `select trim(coalesce(el->>'name', el->>'label', trim(both '"' from el::text))) as value, count(*)::int as count
       from public.messaging_partner_inventory mpi
       cross join lateral jsonb_array_elements(case when jsonb_typeof(mpi.colors_json) = 'array' then mpi.colors_json else '[]'::jsonb end) el
       where ${whereSql}
         and trim(coalesce(el->>'name', el->>'label', trim(both '"' from el::text))) <> ''
       group by 1
       order by count desc, value asc
       limit 40`,
      params
    ),
    pgQueryOne<{ c: number | string; min_price: string | number | null; max_price: string | number | null }>(
      `select count(*)::int as c,
              min(mpi.price_amount) as min_price,
              max(mpi.price_amount) as max_price
       from public.messaging_partner_inventory mpi
       where ${whereSql}`,
      params
    ),
  ])
  return {
    sizes: toFacetList(sizes),
    colors: toFacetList(colors),
    priceMin: stats?.min_price == null ? null : Number(stats.min_price),
    priceMax: stats?.max_price == null ? null : Number(stats.max_price),
    productCount: Number(stats?.c) || 0,
  }
}

async function readFacetSnapshotFromPg(
  partnerId: string,
  scopeType: 'category' | 'search_q',
  scopeKey: string,
  cacheVer: number
): Promise<PartnerCategoryFacetCounts | null> {
  try {
    const row = await pgQueryOne<{
      sizes_json: unknown
      colors_json: unknown
      style_tags_json: unknown
      price_min: string | number | null
      price_max: string | number | null
      product_count: number | string | null
    }>(
      `select sizes_json, colors_json, style_tags_json, price_min, price_max, product_count
       from public.messaging_partner_listing_facet_cache
       where partner_id = $1::uuid and scope_type = $2 and scope_key = $3 and cache_ver = $4`,
      [partnerId, scopeType, scopeKey, cacheVer]
    )
    if (!row) return null
    const sizes = Array.isArray(row.sizes_json) ? (row.sizes_json as PartnerCategoryFacetCounts['sizes']) : []
    const colors = Array.isArray(row.colors_json) ? (row.colors_json as PartnerCategoryFacetCounts['colors']) : []
    const styleTags = Array.isArray(row.style_tags_json)
      ? (row.style_tags_json as PartnerCategoryFacetCounts['styleTags'])
      : []
    return {
      sizes,
      colors,
      styleTags,
      priceMin: row.price_min == null ? null : Number(row.price_min),
      priceMax: row.price_max == null ? null : Number(row.price_max),
      productCount: Number(row.product_count) || 0,
    }
  } catch (e) {
    const code = e && typeof e === 'object' ? String((e as { code?: string }).code ?? '') : ''
    if (code === '42P01') return null
    console.warn('[readFacetSnapshotFromPg]', e instanceof Error ? e.message : e)
    return null
  }
}

async function writeFacetSnapshotToPg(input: {
  partnerId: string
  scopeType: 'category' | 'search_q'
  scopeKey: string
  cacheVer: number
  snapshot: PartnerCategoryFacetCounts
}): Promise<void> {
  try {
    await pgQuery(
      `insert into public.messaging_partner_listing_facet_cache (
         partner_id, scope_type, scope_key, cache_ver,
         sizes_json, colors_json, style_tags_json, price_min, price_max, product_count, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, now()
       )
       on conflict (partner_id, scope_type, scope_key) do update set
         cache_ver = excluded.cache_ver,
         sizes_json = excluded.sizes_json,
         colors_json = excluded.colors_json,
         style_tags_json = excluded.style_tags_json,
         price_min = excluded.price_min,
         price_max = excluded.price_max,
         product_count = excluded.product_count,
         updated_at = now()`,
      [
        input.partnerId,
        input.scopeType,
        input.scopeKey,
        input.cacheVer,
        JSON.stringify(input.snapshot.sizes ?? []),
        JSON.stringify(input.snapshot.colors ?? []),
        JSON.stringify(input.snapshot.styleTags ?? []),
        input.snapshot.priceMin ?? null,
        input.snapshot.priceMax ?? null,
        input.snapshot.productCount ?? 0,
      ]
    )
    await pgQuery(
      `delete from public.messaging_partner_listing_facet_cache
       where partner_id = $1::uuid and cache_ver <> $2`,
      [input.partnerId, input.cacheVer]
    )
  } catch (e) {
    const code = e && typeof e === 'object' ? String((e as { code?: string }).code ?? '') : ''
    if (code === '42P01') return
    console.warn('[writeFacetSnapshotToPg]', e instanceof Error ? e.message : e)
  }
}

export async function computePartnerCategoryFacetSnapshotFromPg(
  partnerId: string,
  categoryId: string,
  listingL1: string
): Promise<PartnerCategoryFacetCounts> {
  const whereSql = [
    'mpi.partner_id = $1::uuid',
    'coalesce(mpi.is_active, true) = true',
    PARTNER_CATEGORY_SUBTREE_IN_SQL,
  ].join(' and ')
  const params: unknown[] = [partnerId, categoryId]
  const base = await loadSizeColorPrice(whereSql, params)
  const styleTags = await loadStyleTagCounts(whereSql, params, listingL1)
  return { ...base, styleTags }
}

export async function computePartnerTextSearchFacetSnapshotFromPg(
  partnerId: string,
  q: string
): Promise<PartnerCategoryFacetCounts> {
  const words = tokenizePartnerTextSearch(q)
  if (!words.length) return { sizes: [], colors: [], styleTags: [], productCount: 0 }
  const params: unknown[] = [partnerId]
  const conditions = ['mpi.partner_id = $1::uuid', 'coalesce(mpi.is_active, true) = true']
  for (const w of words) {
    params.push(`%${escapeIlikeToken(w.toLowerCase())}%`)
    conditions.push(`${PARTNER_SEARCH_DOCUMENT_HAYSTACK_SQL} ilike $${params.length} escape chr(92)`)
  }
  const whereSql = conditions.join(' and ')
  const base = await loadSizeColorPrice(whereSql, params)
  const styleTags = await loadStyleTagCounts(whereSql, params, '')
  return { ...base, styleTags }
}

export async function loadPartnerFacetSnapshotCachedLayerFromPg(
  partnerId: string,
  scopeType: 'category' | 'search_q',
  scopeKey: string,
  compute: () => Promise<PartnerCategoryFacetCounts>
): Promise<PartnerCategoryFacetCounts> {
  if (!isPgConfigured()) return compute()
  const cacheVer = await partnerInventoryCacheVersion(partnerId)
  const hit = await readFacetSnapshotFromPg(partnerId, scopeType, scopeKey, cacheVer)
  if (hit) return hit
  const snapshot = await compute()
  await writeFacetSnapshotToPg({ partnerId, scopeType, scopeKey, cacheVer, snapshot })
  return snapshot
}

export function emptyFacetCounts(): PartnerCategoryFacetCounts {
  return { sizes: [], colors: [], styleTags: [], productCount: 0 }
}

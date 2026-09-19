/**
 * PG L2 id list cho listing danh mục / catalog shop (không tìm chữ q).
 * Redis L1 (caller) + Postgres theo cache_ver / partner_id.
 */

import { partnerInventoryCacheVersion } from '@/lib/cache/partner-shop-cache'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { SEARCH_ID_LIST_MAX, type PartnerInventoryIdList } from '@/lib/partner-website/shop/partner-catalog-scale'

function parseIdList(raw: unknown, count: number): PartnerInventoryIdList | null {
  if (!Array.isArray(raw)) return null
  const ids = raw.map((x) => String(x ?? '').trim()).filter(Boolean).slice(0, SEARCH_ID_LIST_MAX)
  return { ids, count: Math.max(count, ids.length) }
}

async function readIdListFromPg(
  partnerId: string,
  scopeType: 'category' | 'shop',
  scopeKey: string,
  cacheVer: number
): Promise<PartnerInventoryIdList | null> {
  try {
    const row = await pgQueryOne<{ ids_json: unknown; product_count: number | string | null }>(
      `select ids_json, product_count
       from public.messaging_partner_listing_id_cache
       where partner_id = $1::uuid and scope_type = $2 and scope_key = $3 and cache_ver = $4`,
      [partnerId, scopeType, scopeKey, cacheVer]
    )
    if (!row) return null
    return parseIdList(row.ids_json, Number(row.product_count) || 0)
  } catch (e) {
    const code = e && typeof e === 'object' ? String((e as { code?: string }).code ?? '') : ''
    if (code === '42P01') return null
    console.warn('[readIdListFromPg]', e instanceof Error ? e.message : e)
    return null
  }
}

async function writeIdListToPg(input: {
  partnerId: string
  scopeType: 'category' | 'shop'
  scopeKey: string
  cacheVer: number
  list: PartnerInventoryIdList
}): Promise<void> {
  try {
    await pgQuery(
      `insert into public.messaging_partner_listing_id_cache (
         partner_id, scope_type, scope_key, cache_ver, ids_json, product_count, updated_at
       ) values (
         $1::uuid, $2, $3, $4, $5::jsonb, $6, now()
       )
       on conflict (partner_id, scope_type, scope_key) do update set
         cache_ver = excluded.cache_ver,
         ids_json = excluded.ids_json,
         product_count = excluded.product_count,
         updated_at = now()`,
      [
        input.partnerId,
        input.scopeType,
        input.scopeKey,
        input.cacheVer,
        JSON.stringify(input.list.ids.slice(0, SEARCH_ID_LIST_MAX)),
        Math.max(0, Math.floor(input.list.count) || 0),
      ]
    )
    await pgQuery(
      `delete from public.messaging_partner_listing_id_cache
       where partner_id = $1::uuid and cache_ver <> $2`,
      [input.partnerId, input.cacheVer]
    )
  } catch (e) {
    const code = e && typeof e === 'object' ? String((e as { code?: string }).code ?? '') : ''
    if (code === '42P01') return
    console.warn('[writeIdListToPg]', e instanceof Error ? e.message : e)
  }
}

export async function loadPartnerIdListCachedLayerFromPg(
  partnerId: string,
  scopeType: 'category' | 'shop',
  scopeKey: string,
  compute: () => Promise<PartnerInventoryIdList | null>
): Promise<PartnerInventoryIdList | null> {
  if (!isPgConfigured()) return compute()
  const cacheVer = await partnerInventoryCacheVersion(partnerId)
  const hit = await readIdListFromPg(partnerId, scopeType, scopeKey, cacheVer)
  if (hit) return hit
  const list = await compute()
  if (list) {
    await writeIdListToPg({ partnerId, scopeType, scopeKey, cacheVer, list })
  }
  return list
}

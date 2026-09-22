/**
 * Catalog 100k / tenant — id list pagination + JSON size/màu filters.
 * Một engine mọi shop. Không cache JSON card béo; chỉ UUID rồi hydrate.
 */

import { styleTagFilterAliases } from '@/lib/partner-website/shop/partner-shop-style-tags'

export const SEARCH_ID_LIST_MAX = 5000
/** Sitemap sản phẩm giống 188 (5k/file); 20 trang = 100k URL. */
export const SITEMAP_PRODUCT_PAGE_SIZE = 5000
export const SITEMAP_PRODUCT_MAX_PAGES = 20

/** Danh mục + nhánh con — IN (id) thay EXISTS tương quan, planner materialize tập nhỏ. */
export const PARTNER_CATEGORY_SUBTREE_IN_SQL = `mpi.id in (
      select pic.inventory_id
      from public.messaging_partner_inventory_categories pic
      inner join public.messaging_partner_categories cat
        on cat.id = pic.category_id
       and cat.partner_id = $1::uuid
      where cat.id = $2::uuid
         or cat.path like (
           select trim(trailing '/' from c2.path) || '/%'
           from public.messaging_partner_categories c2
           where c2.id = $2::uuid and c2.partner_id = $1::uuid
         )
    )`

export const PARTNER_CATEGORY_DIRECT_IN_SQL = `mpi.id in (
      select pic.inventory_id
      from public.messaging_partner_inventory_categories pic
      where pic.category_id = $2::uuid
    )`

export type PartnerInventoryIdList = {
  ids: string[]
  count: number
}

export function slicePartnerInventoryIdListPage(
  list: PartnerInventoryIdList,
  offset: number,
  limit: number
): { ids: string[]; count: number; beyondCachedIds: boolean } {
  const off = Math.max(0, Math.floor(offset))
  const lim = Math.max(1, Math.floor(limit))
  const count = Math.max(0, Math.floor(Number(list.count) || 0))
  const ids = Array.isArray(list.ids) ? list.ids.filter(Boolean) : []
  const end = off + lim
  return {
    ids: ids.slice(off, end),
    count,
    beyondCachedIds: end > ids.length && count > ids.length,
  }
}

/** Sort random: không gắn seed vào cache key — cùng id list đến khi bump tồn kho (188). */
export function partnerListingIdListCachePayload(input: {
  kind: 'text' | 'cat' | 'shop'
  q?: string
  categoryId?: string
  sort?: string
  minPrice?: number | null
  maxPrice?: number | null
  size?: string
  color?: string
  styleTag?: string
  material?: string
  descendants?: boolean
  collection?: string
  sale?: boolean
  warehouse?: boolean
}): Record<string, unknown> {
  const sort = String(input.sort || '').trim() || (input.kind === 'text' ? 'random' : 'newest')
  return {
    k: input.kind,
    q: String(input.q || '').trim().toLowerCase(),
    cat: String(input.categoryId || '').trim(),
    sort,
    min: input.minPrice ?? null,
    max: input.maxPrice ?? null,
    size: String(input.size || '').trim(),
    color: String(input.color || '').trim(),
    style: String(input.styleTag || '').trim(),
    material: String(input.material || '').trim(),
    desc: input.descendants !== false,
    collection: String(input.collection || '').trim(),
    sale: Boolean(input.sale),
    warehouse: Boolean(input.warehouse),
  }
}

/**
 * Lọc size/màu trên sizes_json / colors_json; hàng cũ chưa có cột thì LIKE description/stock_note.
 */

export type PartnerListingFacetFilters = {
  minPrice?: number | null
  maxPrice?: number | null
  size?: string
  color?: string
  styleTag?: string
}

export function partnerListingFacetFiltersActive(
  f?: PartnerListingFacetFilters | null
): boolean {
  if (!f) return false
  return (
    (typeof f.minPrice === 'number' && Number.isFinite(f.minPrice)) ||
    (typeof f.maxPrice === 'number' && Number.isFinite(f.maxPrice)) ||
    Boolean(String(f.size || '').trim()) ||
    Boolean(String(f.color || '').trim()) ||
    Boolean(String(f.styleTag || '').trim())
  )
}

export function appendPartnerListingPriceFilter(input: {
  params: unknown[]
  conditions: string[]
  minPrice?: number | null
  maxPrice?: number | null
}): void {
  const minPrice =
    typeof input.minPrice === 'number' && Number.isFinite(input.minPrice) ? Math.max(0, input.minPrice) : null
  const maxPrice =
    typeof input.maxPrice === 'number' && Number.isFinite(input.maxPrice) ? Math.max(0, input.maxPrice) : null
  if (minPrice !== null) {
    input.params.push(minPrice)
    input.conditions.push(`mpi.price_amount >= $${input.params.length}::numeric`)
  }
  if (maxPrice !== null) {
    input.params.push(maxPrice)
    input.conditions.push(`mpi.price_amount <= $${input.params.length}::numeric`)
  }
}

export function appendPartnerListingSizeColorFilters(input: {
  params: unknown[]
  conditions: string[]
  size?: string
  color?: string
}): void {
  appendPartnerSizeOrColorJsonFilter({
    params: input.params,
    conditions: input.conditions,
    column: 'sizes_json',
    value: String(input.size ?? ''),
    legacyColumn: 'description',
  })
  appendPartnerSizeOrColorJsonFilter({
    params: input.params,
    conditions: input.conditions,
    column: 'colors_json',
    value: String(input.color ?? ''),
    legacyColumn: 'stock_note',
  })
}

export function appendPartnerListingStyleTagFilter(input: {
  params: unknown[]
  conditions: string[]
  styleTag?: string
}): void {
  const aliases = styleTagFilterAliases(String(input.styleTag ?? ''))
    .map((a) => `%${a.toLowerCase()}%`)
    .filter(Boolean)
  if (!aliases.length) return
  input.params.push(aliases)
  input.conditions.push(`lower(
          coalesce(mpi.name, '') || ' ' ||
          coalesce(mpi.description, '') || ' ' ||
          coalesce(mpi.material_note, '') || ' ' ||
          coalesce(mpi.style, '') || ' ' ||
          coalesce(mpi.catalog_json::text, '') || ' ' ||
          coalesce(mpi.product_info_json::text, '') || ' ' ||
          coalesce(mpi.features_json::text, '') || ' ' ||
          coalesce(mpi.category_l1, '') || ' ' ||
          coalesce(mpi.category_l2, '') || ' ' ||
          coalesce(mpi.category_l3, '')
        ) like any($${input.params.length}::text[])`)
}

export const PARTNER_SHOP_WAREHOUSE_SQL = `position('/' in coalesce(mpi.remarketing_id, '')) > 0`

export function appendPartnerSizeOrColorJsonFilter(input: {
  params: unknown[]
  conditions: string[]
  column: 'sizes_json' | 'colors_json'
  value: string
  legacyColumn: 'description' | 'stock_note'
}): void {
  const value = String(input.value ?? '').trim().slice(0, 40)
  if (!value) return
  input.params.push(value.toLowerCase())
  const p = `$${input.params.length}`
  const jsonCol = `mpi.${input.column}`
  const nameExpr =
    input.column === 'colors_json'
      ? `lower(trim(coalesce(el->>'name', el->>'label', trim(both '"' from el::text))))`
      : `lower(trim(coalesce(el->>'name', trim(both '"' from el::text))))`
  input.conditions.push(`(
    (
      jsonb_typeof(coalesce(${jsonCol}, 'null'::jsonb)) = 'array'
      and exists (
        select 1 from jsonb_array_elements(${jsonCol}) el
        where ${nameExpr} = ${p}
      )
    )
    or (
      ${jsonCol} is null
      and lower(coalesce(mpi.${input.legacyColumn}, '')) like '%' || ${p} || '%'
    )
  )`)
}

export function countPartnerProductSitemapPages(total: number): number {
  const n = Math.max(0, Math.floor(Number(total) || 0))
  if (n <= 0) return 1
  return Math.min(SITEMAP_PRODUCT_MAX_PAGES, Math.ceil(n / SITEMAP_PRODUCT_PAGE_SIZE))
}

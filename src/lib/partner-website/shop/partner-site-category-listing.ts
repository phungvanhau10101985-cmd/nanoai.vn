/**
 * W4.14 — query listing danh mục khớp cấu trúc 188 (`CategoryProductFilters`).
 * URL dùng snake_case: min_price, max_price, size, color, sort, page.
 * Canonical whitelist theo alphabet — bỏ page=1 và seed `r`.
 */

export const PARTNER_CATEGORY_PAGE_SIZE = 48

export const PARTNER_CATEGORY_LISTING_SORTS = [
  'newest',
  'oldest',
  'views_desc',
  'price_asc',
  'price_desc',
  'random',
] as const

export type PartnerCategoryListingSort = (typeof PARTNER_CATEGORY_LISTING_SORTS)[number]

export type PartnerCategoryListingQuery = {
  sort: PartnerCategoryListingSort
  page: number
  minPrice: number | null
  maxPrice: number | null
  size: string
  color: string
  /** Seed random — không đưa vào canonical. */
  randomSeed: string
}

const SORT_SET = new Set<string>(PARTNER_CATEGORY_LISTING_SORTS)

export function parsePartnerCategoryListingSort(raw: string | null | undefined): PartnerCategoryListingSort {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === '' || v === 'random') return 'random'
  return SORT_SET.has(v) ? (v as PartnerCategoryListingSort) : 'newest'
}

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '').trim()
  return String(value ?? '').trim()
}

function parsePrice(raw: string): number | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function parsePartnerCategoryListingFromRecord(
  record: Record<string, string | string[] | undefined> | URLSearchParams
): PartnerCategoryListingQuery {
  const get = (key: string) => {
    if (record instanceof URLSearchParams) return record.get(key) ?? ''
    return firstParam(record[key])
  }
  const sortRaw = get('sort')
  const pageRaw = Number(get('page') || '1')
  const minRaw = get('min_price') || get('minPrice')
  const maxRaw = get('max_price') || get('maxPrice')
  return {
    sort: parsePartnerCategoryListingSort(sortRaw === '' && !get('page') ? 'newest' : sortRaw || 'newest'),
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
    minPrice: parsePrice(minRaw),
    maxPrice: parsePrice(maxRaw),
    size: get('size').slice(0, 40),
    color: get('color').slice(0, 40),
    randomSeed: get('r').slice(0, 32),
  }
}

/** `sort=` trống trên URL 188 = Ngẫu nhiên. NanoAI mặc định newest khi không có query. */
export function parsePartnerCategoryListingFromSearchParams(
  searchParams: URLSearchParams,
  opts?: { defaultSort?: PartnerCategoryListingSort }
): PartnerCategoryListingQuery {
  const parsed = parsePartnerCategoryListingFromRecord(searchParams)
  if (!searchParams.get('sort') && opts?.defaultSort) {
    parsed.sort = opts.defaultSort
  }
  return parsed
}

export function partnerCategoryListingHasFilters(q: PartnerCategoryListingQuery): boolean {
  return q.minPrice !== null || q.maxPrice !== null || Boolean(q.size) || Boolean(q.color) || q.sort !== 'newest'
}

export function buildPartnerCategoryListingSearch(
  q: Partial<PartnerCategoryListingQuery>,
  opts?: { defaultSort?: PartnerCategoryListingSort }
): string {
  const defaultSort = opts?.defaultSort ?? 'newest'
  const params = new URLSearchParams()
  if (q.minPrice != null) params.set('min_price', String(q.minPrice))
  if (q.maxPrice != null) params.set('max_price', String(q.maxPrice))
  if (q.size) params.set('size', q.size)
  if (q.color) params.set('color', q.color)
  if (q.sort && q.sort !== defaultSort) {
    params.set('sort', q.sort === 'random' ? '' : q.sort)
    if (q.sort === 'random') params.set('sort', 'random')
  }
  if (q.page && q.page > 1) params.set('page', String(q.page))
  if (q.sort === 'random' && q.randomSeed) params.set('r', q.randomSeed)
  return params.toString()
}

const CANONICAL_KEYS = ['color', 'max_price', 'min_price', 'page', 'size', 'sort'] as const

export function buildPartnerCategoryCanonicalQuery(q: PartnerCategoryListingQuery): string {
  const raw: Record<(typeof CANONICAL_KEYS)[number], string | null> = {
    color: q.color || null,
    max_price: q.maxPrice != null ? String(q.maxPrice) : null,
    min_price: q.minPrice != null ? String(q.minPrice) : null,
    page: q.page > 1 ? String(q.page) : null,
    size: q.size || null,
    sort: q.sort && q.sort !== 'newest' ? q.sort : null,
  }
  const params = new URLSearchParams()
  for (const key of CANONICAL_KEYS) {
    const v = raw[key]
    if (v) params.set(key, v)
  }
  return params.toString()
}

export function partnerCategoryListingOffset(q: PartnerCategoryListingQuery, pageSize = PARTNER_CATEGORY_PAGE_SIZE): number {
  return Math.max(0, (q.page - 1) * pageSize)
}

export function partnerCategoryListingPageCount(total: number, pageSize = PARTNER_CATEGORY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}

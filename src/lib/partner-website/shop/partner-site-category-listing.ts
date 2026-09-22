/**
 * W4.14 — query listing danh mục khớp cấu trúc 188 (`CategoryProductFilters`).
 * URL dùng snake_case: min_price, max_price, size, style_tag, color, sort, page.
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
  /** Tag kiểu chuẩn 188 (`?style_tag=Váy`) — không phải cột Style thô. */
  styleTag: string
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
  const size = get('size').slice(0, 40)
  const color = get('color').slice(0, 40)
  const styleTag = (get('style_tag') || get('styleTag')).slice(0, 40)
  const minPrice = parsePrice(minRaw)
  const maxPrice = parsePrice(maxRaw)
  const hasFacetFilters =
    minPrice !== null || maxPrice !== null || Boolean(size) || Boolean(color) || Boolean(styleTag)
  return {
    sort: sortRaw
      ? parsePartnerCategoryListingSort(sortRaw)
      : hasFacetFilters
        ? 'newest'
        : 'random',
    page: Number.isFinite(pageRaw) && pageRaw > 1 ? Math.floor(pageRaw) : 1,
    minPrice,
    maxPrice,
    size,
    color,
    styleTag,
    randomSeed: get('r').slice(0, 32),
  }
}

/** `sort=` trống: danh mục chưa lọc = ngẫu nhiên; đang lọc = newest. Tìm `q` luôn random. */
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

export function partnerCategoryListingHasFacetFilters(
  q: Pick<PartnerCategoryListingQuery, 'minPrice' | 'maxPrice' | 'size' | 'color' | 'styleTag'>
): boolean {
  return (
    q.minPrice != null ||
    q.maxPrice != null ||
    Boolean(q.size) ||
    Boolean(q.color) ||
    Boolean(q.styleTag)
  )
}

/** 188: tìm `q` luôn random; danh mục/kho chưa lọc = random; đang lọc + sort trống = newest. */
export function partnerCategoryListingImplicitSort(
  q: Pick<PartnerCategoryListingQuery, 'minPrice' | 'maxPrice' | 'size' | 'color' | 'styleTag'>,
  opts?: { search?: boolean }
): PartnerCategoryListingSort {
  if (opts?.search) return 'random'
  return partnerCategoryListingHasFacetFilters(q) ? 'newest' : 'random'
}

/** Đổi size/kiểu/màu/giá: nếu sort đang là mặc định cũ thì chuyển sang mặc định mới. Sort user chọn thì giữ. */
export function partnerCategoryListingMergeQuery(
  current: PartnerCategoryListingQuery,
  next: Partial<PartnerCategoryListingQuery>,
  opts?: { search?: boolean }
): PartnerCategoryListingQuery {
  const prevImplicit = partnerCategoryListingImplicitSort(current, opts)
  const merged: PartnerCategoryListingQuery = { ...current, page: 1, ...next }
  if (next.sort == null && current.sort === prevImplicit) {
    merged.sort = partnerCategoryListingImplicitSort(merged, opts)
  }
  return merged
}

export function partnerCategoryListingHasFilters(
  q: PartnerCategoryListingQuery,
  opts?: { defaultSort?: PartnerCategoryListingSort }
): boolean {
  const defaultSort = opts?.defaultSort ?? 'newest'
  return (
    q.minPrice !== null ||
    q.maxPrice !== null ||
    Boolean(q.size) ||
    Boolean(q.color) ||
    Boolean(q.styleTag) ||
    q.sort !== defaultSort
  )
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
  if (q.styleTag) params.set('style_tag', q.styleTag)
  if (q.sort && q.sort !== defaultSort) {
    params.set('sort', q.sort === 'random' ? '' : q.sort)
    if (q.sort === 'random') params.set('sort', 'random')
  }
  if (q.page && q.page > 1) params.set('page', String(q.page))
  if (q.sort === 'random' && q.randomSeed) params.set('r', q.randomSeed)
  return params.toString()
}

const CANONICAL_KEYS = ['color', 'max_price', 'min_price', 'page', 'size', 'sort', 'style_tag'] as const

export function buildPartnerCategoryCanonicalQuery(q: PartnerCategoryListingQuery): string {
  const raw: Record<(typeof CANONICAL_KEYS)[number], string | null> = {
    color: q.color || null,
    max_price: q.maxPrice != null ? String(q.maxPrice) : null,
    min_price: q.minPrice != null ? String(q.minPrice) : null,
    page: q.page > 1 ? String(q.page) : null,
    size: q.size || null,
    sort: q.sort && q.sort !== 'newest' && q.sort !== 'random' ? q.sort : null,
    style_tag: q.styleTag || null,
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

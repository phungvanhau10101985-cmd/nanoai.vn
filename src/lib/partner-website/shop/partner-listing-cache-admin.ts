/** Nhãn / parse cache bộ lọc + cache tìm kiếm — một engine mọi shop. */

export const LISTING_FACET_CACHE_PAGE_SIZE = 40
export const SEARCH_CACHE_ID_LIST_PAGE_SIZE = 40
export const SEARCH_KEYWORD_STATS_PAGE_SIZE = 100
export const FACET_REBUILD_CATEGORY_CAP = 400
export const FACET_REBUILD_SEARCH_CAP = 80

export type ListingFacetCacheScopeType = 'category' | 'search_q'

export type ListingIdListCacheScopeType = 'category' | 'shop'

export function listingFacetCacheScopeLabel(scopeType: string): 'category' | 'search' | 'other' {
  if (scopeType === 'category') return 'category'
  if (scopeType === 'search_q') return 'search'
  return 'other'
}

export function listingIdListCacheScopeLabel(scopeType: string): 'category' | 'shop' | 'other' {
  if (scopeType === 'category') return 'category'
  if (scopeType === 'shop') return 'shop'
  return 'other'
}

export function jsonArrayLen(raw: unknown): number {
  if (!Array.isArray(raw)) return 0
  return raw.length
}

export function parseListingCacheLimit(raw: unknown, fallback: number, max: number): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(max, n)
}

export function parseListingCacheOffset(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function isListingFacetCacheScopeType(value: string | null | undefined): value is ListingFacetCacheScopeType {
  return value === 'category' || value === 'search_q'
}

export function isListingIdListCacheScopeType(value: string | null | undefined): value is ListingIdListCacheScopeType {
  return value === 'category' || value === 'shop'
}

export function pinSearchKeyword(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80)
}

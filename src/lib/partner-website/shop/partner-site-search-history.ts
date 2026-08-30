export const PARTNER_SITE_SEARCH_HISTORY_MAX = 12
export const PARTNER_SITE_SEARCH_HISTORY_QUERY_MAX = 80
export const PW_SEARCH_HISTORY_EVENT = 'pw-search-history'

export function partnerSiteSearchHistoryStorageKey(siteSlug: string): string {
  return `pw-search-history:${siteSlug.trim()}`
}

export function normalizeSearchQuery(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, PARTNER_SITE_SEARCH_HISTORY_QUERY_MAX)
}

export function mergeSearchQueries(...lists: unknown[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const list of lists) {
    if (!Array.isArray(list)) continue
    for (const item of list) {
      const q = normalizeSearchQuery(item)
      if (!q) continue
      const key = q.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(q)
      if (out.length >= PARTNER_SITE_SEARCH_HISTORY_MAX) return out
    }
  }
  return out
}

export function prependSearchQuery(query: unknown, existing: unknown): string[] {
  const q = normalizeSearchQuery(query)
  if (!q) return mergeSearchQueries(existing)
  return mergeSearchQueries([q], existing)
}

export function removeSearchQuery(query: unknown, existing: unknown): string[] {
  const q = normalizeSearchQuery(query).toLowerCase()
  if (!q) return mergeSearchQueries(existing)
  return mergeSearchQueries(existing).filter((item) => item.toLowerCase() !== q)
}

export function parseSearchQueries(raw: unknown): string[] {
  return mergeSearchQueries(raw)
}

export function siteVisitorHasShopAccount(thread: {
  guestAccountId?: string | null
  linkedUserId?: string | null
}): boolean {
  return Boolean(String(thread.guestAccountId || '').trim() || String(thread.linkedUserId || '').trim())
}

export function emitPartnerSiteSearchHistory(query: unknown): void {
  if (typeof document === 'undefined') return
  const q = normalizeSearchQuery(query)
  if (!q) return
  document.dispatchEvent(new CustomEvent(PW_SEARCH_HISTORY_EVENT, { detail: { query: q } }))
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  SEARCH_CACHE_ID_LIST_PAGE_SIZE,
  SEARCH_KEYWORD_STATS_PAGE_SIZE,
  listingIdListCacheScopeLabel,
} from '@/lib/partner-website/shop/partner-listing-cache-admin'
import { Loader2, Trash2 } from 'lucide-react'

type KeywordRow = { keyword: string; hits: number }
type IdListRow = {
  scopeType: 'category' | 'shop'
  scopeKey: string
  cacheVer: number
  currentVer: number
  stale: boolean
  productCount: number
  idCount: number
  updatedAt: string | null
}

function formatDt(iso: string | null, locale: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

export function PartnerSearchCachePanel({
  t,
  partnerId,
  locale,
  onToast,
}: {
  t: PartnerWebsiteCopy
  partnerId: string
  locale: string
  onToast?: (message: string, variant?: 'default' | 'destructive') => void
}) {
  const [kwDays, setKwDays] = useState(30)
  const [kwPage, setKwPage] = useState(1)
  const [keywords, setKeywords] = useState<KeywordRow[]>([])
  const [kwTotal, setKwTotal] = useState(0)
  const [kwLoading, setKwLoading] = useState(true)

  const [cachePage, setCachePage] = useState(1)
  const [rows, setRows] = useState<IdListRow[]>([])
  const [cacheTotal, setCacheTotal] = useState(0)
  const [cacheLoading, setCacheLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/search-cache`

  const loadKeywords = useCallback(async () => {
    setKwLoading(true)
    try {
      const qs = new URLSearchParams({
        view: 'keywords',
        days: String(kwDays),
        skip: String((kwPage - 1) * SEARCH_KEYWORD_STATS_PAGE_SIZE),
        limit: String(SEARCH_KEYWORD_STATS_PAGE_SIZE),
      })
      const res = await fetch(`${base}?${qs}`)
      const json = (await res.json()) as { keywords?: KeywordRow[]; total?: number; error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.searchCacheLoadError, 'destructive')
        return
      }
      setKeywords(json.keywords ?? [])
      setKwTotal(json.total ?? 0)
    } catch {
      onToast?.(t.searchCacheLoadError, 'destructive')
    } finally {
      setKwLoading(false)
    }
  }, [base, kwDays, kwPage, onToast, t.searchCacheLoadError])

  const loadCache = useCallback(async () => {
    setCacheLoading(true)
    try {
      const qs = new URLSearchParams({
        skip: String((cachePage - 1) * SEARCH_CACHE_ID_LIST_PAGE_SIZE),
        limit: String(SEARCH_CACHE_ID_LIST_PAGE_SIZE),
      })
      const res = await fetch(`${base}?${qs}`)
      const json = (await res.json()) as { rows?: IdListRow[]; total?: number; error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.searchCacheLoadError, 'destructive')
        return
      }
      setRows(json.rows ?? [])
      setCacheTotal(json.total ?? 0)
    } catch {
      onToast?.(t.searchCacheLoadError, 'destructive')
    } finally {
      setCacheLoading(false)
    }
  }, [base, cachePage, onToast, t.searchCacheLoadError])

  useEffect(() => {
    setKwPage(1)
  }, [kwDays])

  useEffect(() => {
    void loadKeywords()
  }, [loadKeywords])

  useEffect(() => {
    void loadCache()
  }, [loadCache])

  const kwPages = useMemo(
    () => Math.max(1, Math.ceil(kwTotal / SEARCH_KEYWORD_STATS_PAGE_SIZE)),
    [kwTotal]
  )
  const cachePages = useMemo(
    () => Math.max(1, Math.ceil(cacheTotal / SEARCH_CACHE_ID_LIST_PAGE_SIZE)),
    [cacheTotal]
  )

  const clearAll = async () => {
    if (!window.confirm(t.searchCacheClearAllConfirm)) return
    setClearing(true)
    try {
      const res = await fetch(base, { method: 'DELETE' })
      const json = (await res.json()) as { deleted?: number; error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.searchCacheClearError, 'destructive')
        return
      }
      onToast?.(t.searchCacheClearOk.replace('{count}', String(json.deleted ?? 0)))
      await loadCache()
    } catch {
      onToast?.(t.searchCacheClearError, 'destructive')
    } finally {
      setClearing(false)
    }
  }

  const removeRow = async (row: IdListRow) => {
    if (!window.confirm(t.searchCacheDeleteConfirm.replace('{key}', row.scopeKey))) return
    try {
      const qs = new URLSearchParams({ scope_type: row.scopeType, scope_key: row.scopeKey })
      const res = await fetch(`${base}?${qs}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.searchCacheClearError, 'destructive')
        return
      }
      onToast?.(t.searchCacheDeleteOk)
      await loadCache()
    } catch {
      onToast?.(t.searchCacheClearError, 'destructive')
    }
  }

  const scopeName = (scopeType: string) => {
    const kind = listingIdListCacheScopeLabel(scopeType)
    if (kind === 'category') return t.searchCacheScopeCategory
    if (kind === 'shop') return t.searchCacheScopeShop
    return scopeType
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="px-4 py-3 pb-2">
          <CardTitle className="text-base">{t.searchCacheTitle}</CardTitle>
          <CardDescription className="text-xs leading-relaxed">{t.searchCacheHint}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-0">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-xs">{t.searchCacheKeywordDays}</Label>
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={kwDays}
                onChange={(e) => setKwDays(Number(e.target.value))}
              >
                {[7, 30, 90, 180, 365].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{t.searchCacheKeywordHint}</p>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[24rem] text-left text-xs">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">{t.searchCacheColKeyword}</th>
                  <th className="px-2 py-2">{t.searchCacheColHits}</th>
                </tr>
              </thead>
              <tbody>
                {kwLoading ? (
                  <tr>
                    <td colSpan={2} className="px-2 py-6 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : keywords.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-2 py-6 text-center text-muted-foreground">
                      {t.searchCacheKeywordsEmpty}
                    </td>
                  </tr>
                ) : (
                  keywords.map((row) => (
                    <tr key={row.keyword} className="border-t">
                      <td className="px-2 py-2 font-medium">{row.keyword}</td>
                      <td className="px-2 py-2 tabular-nums">{row.hits}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {kwPages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-xs">
              <Button type="button" size="sm" variant="outline" disabled={kwPage <= 1} onClick={() => setKwPage((p) => p - 1)}>
                ‹
              </Button>
              <span>
                {kwPage}/{kwPages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={kwPage >= kwPages}
                onClick={() => setKwPage((p) => p + 1)}
              >
                ›
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 pb-2">
          <div>
            <CardTitle className="text-base">{t.searchCacheIdListTitle}</CardTitle>
            <CardDescription className="text-xs leading-relaxed">{t.searchCacheIdListHint}</CardDescription>
          </div>
          <Button type="button" size="sm" variant="destructive" disabled={clearing} onClick={() => void clearAll()}>
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t.searchCacheClearAll}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[40rem] text-left text-xs">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">{t.searchCacheColScope}</th>
                  <th className="px-2 py-2">{t.searchCacheColKey}</th>
                  <th className="px-2 py-2">{t.searchCacheColProducts}</th>
                  <th className="px-2 py-2">{t.searchCacheColIds}</th>
                  <th className="px-2 py-2">{t.searchCacheColUpdated}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {cacheLoading ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center">
                      <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                      {t.searchCacheIdListEmpty}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.scopeType}:${row.scopeKey}`} className="border-t">
                      <td className="px-2 py-2">
                        {scopeName(row.scopeType)}
                        {row.stale ? (
                          <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                            {t.searchCacheStale}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[14rem] truncate px-2 py-2 font-mono text-[11px]" title={row.scopeKey}>
                        {row.scopeKey}
                      </td>
                      <td className="px-2 py-2 tabular-nums">{row.productCount}</td>
                      <td className="px-2 py-2 tabular-nums">{row.idCount}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{formatDt(row.updatedAt, locale)}</td>
                      <td className="px-2 py-2 text-right">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void removeRow(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {cachePages > 1 ? (
            <div className="flex items-center justify-end gap-2 text-xs">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cachePage <= 1}
                onClick={() => setCachePage((p) => p - 1)}
              >
                ‹
              </Button>
              <span>
                {cachePage}/{cachePages}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={cachePage >= cachePages}
                onClick={() => setCachePage((p) => p + 1)}
              >
                ›
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

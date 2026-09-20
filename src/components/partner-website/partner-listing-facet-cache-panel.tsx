'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  LISTING_FACET_CACHE_PAGE_SIZE,
  listingFacetCacheScopeLabel,
} from '@/lib/partner-website/shop/partner-listing-cache-admin'
import { Filter, Loader2, Pin, RefreshCw, Trash2 } from 'lucide-react'

type FacetRow = {
  scopeType: 'category' | 'search_q'
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

function formatPrice(v: number | null, locale: string): string {
  if (v == null || Number.isNaN(v)) return '—'
  return `${Math.round(v).toLocaleString(locale)}`
}

export function PartnerListingFacetCachePanel({
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
  const [scopeFilter, setScopeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<FacetRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [rebuilding, setRebuilding] = useState<string | null>(null)
  const [pinKeyword, setPinKeyword] = useState('')
  const [pinning, setPinning] = useState(false)

  const base = `/api/messaging/partners/${encodeURIComponent(partnerId)}/listing-facet-cache`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        skip: String((page - 1) * LISTING_FACET_CACHE_PAGE_SIZE),
        limit: String(LISTING_FACET_CACHE_PAGE_SIZE),
      })
      if (scopeFilter) qs.set('scope_type', scopeFilter)
      const res = await fetch(`${base}?${qs}`)
      const json = (await res.json()) as {
        rows?: FacetRow[]
        total?: number
        countsByType?: Record<string, number>
        error?: string
      }
      if (!res.ok) {
        onToast?.(json.error || t.listingFacetCacheLoadError, 'destructive')
        return
      }
      setRows(json.rows ?? [])
      setTotal(json.total ?? 0)
      setCounts(json.countsByType ?? {})
    } catch {
      onToast?.(t.listingFacetCacheLoadError, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [base, onToast, page, scopeFilter, t.listingFacetCacheLoadError])

  useEffect(() => {
    setPage(1)
  }, [scopeFilter])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / LISTING_FACET_CACHE_PAGE_SIZE)),
    [total]
  )

  const rebuild = async (scope: 'category' | 'search' | 'all') => {
    if (scope === 'all' && !window.confirm(t.listingFacetCacheRebuildAllConfirm)) return
    setRebuilding(scope)
    try {
      const res = await fetch(`${base}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const json = (await res.json()) as { rebuilt?: number; error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.listingFacetCacheRebuildError, 'destructive')
        return
      }
      onToast?.(t.listingFacetCacheRebuildOk.replace('{count}', String(json.rebuilt ?? 0)))
      await load()
    } catch {
      onToast?.(t.listingFacetCacheRebuildError, 'destructive')
    } finally {
      setRebuilding(null)
    }
  }

  const pin = async () => {
    const kw = pinKeyword.trim()
    if (!kw) {
      onToast?.(t.listingFacetCachePinRequired, 'destructive')
      return
    }
    setPinning(true)
    try {
      const res = await fetch(`${base}/rebuild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: 'pin', keyword: kw }),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.listingFacetCachePinError, 'destructive')
        return
      }
      onToast?.(t.listingFacetCachePinOk.replace('{keyword}', kw))
      setPinKeyword('')
      await load()
    } catch {
      onToast?.(t.listingFacetCachePinError, 'destructive')
    } finally {
      setPinning(false)
    }
  }

  const remove = async (row: FacetRow) => {
    if (!window.confirm(t.listingFacetCacheDeleteConfirm.replace('{label}', row.displayLabel))) return
    try {
      const qs = new URLSearchParams({ scope_type: row.scopeType, scope_key: row.scopeKey })
      const res = await fetch(`${base}?${qs}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        onToast?.(json.error || t.listingFacetCacheDeleteError, 'destructive')
        return
      }
      onToast?.(t.listingFacetCacheDeleteOk)
      await load()
    } catch {
      onToast?.(t.listingFacetCacheDeleteError, 'destructive')
    }
  }

  const scopeName = (scopeType: string) => {
    const kind = listingFacetCacheScopeLabel(scopeType)
    if (kind === 'category') return t.listingFacetCacheScopeCategory
    if (kind === 'search') return t.listingFacetCacheScopeSearch
    return scopeType
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="px-4 py-3 pb-2">
        <CardTitle className="text-base">{t.listingFacetCacheTitle}</CardTitle>
        <CardDescription className="text-xs leading-relaxed">{t.listingFacetCacheHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 pt-0">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {t.listingFacetCacheCountCategory}: {counts.category ?? 0}
          </span>
          <span>
            {t.listingFacetCacheCountSearch}: {counts.search_q ?? 0}
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={Boolean(rebuilding)}
            onClick={() => void rebuild('category')}
          >
            {rebuilding === 'category' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t.listingFacetCacheRebuildCategory}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={Boolean(rebuilding)}
            onClick={() => void rebuild('search')}
          >
            {rebuilding === 'search' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t.listingFacetCacheRebuildSearch}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={Boolean(rebuilding)}
            onClick={() => void rebuild('all')}
          >
            {rebuilding === 'all' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Filter className="h-3.5 w-3.5" />}
            {t.listingFacetCacheRebuildAll}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label className="text-xs">{t.listingFacetCachePinLabel}</Label>
            <Input
              className="h-9 text-sm"
              value={pinKeyword}
              onChange={(e) => setPinKeyword(e.target.value)}
              placeholder={t.listingFacetCachePinPlaceholder}
            />
          </div>
          <Button type="button" size="sm" disabled={pinning} onClick={() => void pin()}>
            {pinning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pin className="h-3.5 w-3.5" />}
            {t.listingFacetCachePin}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">{t.listingFacetCacheFilter}</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={scopeFilter}
            onChange={(e) => setScopeFilter(e.target.value)}
          >
            <option value="">{t.listingFacetCacheFilterAll}</option>
            <option value="category">{t.listingFacetCacheScopeCategory}</option>
            <option value="search_q">{t.listingFacetCacheScopeSearch}</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[48rem] text-left text-xs">
            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-2 py-2">{t.listingFacetCacheColScope}</th>
                <th className="px-2 py-2">{t.listingFacetCacheColLabel}</th>
                <th className="px-2 py-2">{t.listingFacetCacheColProducts}</th>
                <th className="px-2 py-2">{t.listingFacetCacheColFacets}</th>
                <th className="px-2 py-2">{t.listingFacetCacheColPrice}</th>
                <th className="px-2 py-2">{t.listingFacetCacheColUpdated}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-2 py-6 text-center text-muted-foreground">
                    {t.listingFacetCacheEmpty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={`${row.scopeType}:${row.scopeKey}`} className="border-t">
                    <td className="px-2 py-2">
                      {scopeName(row.scopeType)}
                      {row.stale ? (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-800">
                          {t.listingFacetCacheStale}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 font-medium">{row.displayLabel}</td>
                    <td className="px-2 py-2 tabular-nums">{row.productCount}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.sizeCount}/{row.colorCount}/{row.styleTagCount}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatPrice(row.priceMin, locale)} – {formatPrice(row.priceMax, locale)}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatDt(row.updatedAt, locale)}</td>
                    <td className="px-2 py-2 text-right">
                      <Button type="button" size="sm" variant="ghost" onClick={() => void remove(row)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 text-xs">
            <Button type="button" size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹
            </Button>
            <span>
              {page}/{totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

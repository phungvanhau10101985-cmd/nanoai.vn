'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  exportPartnerInventoryEmbeddingErrorsCsv,
  getPartnerInventoryEmbeddingErrors,
  type PartnerInventoryEmbeddingErrorClientRow,
} from '@/app/dashboard/messaging/actions'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Download } from 'lucide-react'

type AiT = Dictionary['partnerMessagingAi']

function formatErrorAt(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function latestAttemptAt(row: PartnerInventoryEmbeddingErrorClientRow): string {
  const a = row.imageErrorAt ? Date.parse(row.imageErrorAt) : 0
  const b = row.textErrorAt ? Date.parse(row.textErrorAt) : 0
  const max = Math.max(a, b)
  if (!max) return '—'
  return formatErrorAt(new Date(max).toISOString())
}

export function PartnerInventoryEmbeddingErrorsPanel({
  partnerId,
  t,
  toast,
  refreshKey = 0,
}: {
  partnerId: string
  t: AiT
  toast: (opts: { title: string; description?: string; variant?: 'default' | 'destructive' }) => void
  /** Tăng sau mỗi lần load/sync để làm mới danh sách lỗi. */
  refreshKey?: number
}) {
  const pageSize = 50
  const [rows, setRows] = useState<PartnerInventoryEmbeddingErrorClientRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [exporting, setExporting] = useState(false)

  const loadPage = useCallback(
    async (pageIndex: number, append: boolean) => {
      const res = await getPartnerInventoryEmbeddingErrors(partnerId, pageIndex, pageSize)
      if ('error' in res && res.error) {
        toast({ title: t.inventoryEmbeddingErrorsLoadFailed, description: res.error, variant: 'destructive' })
        return false
      }
      const nextRows = res.rows ?? []
      setRows((prev) => (append ? [...prev, ...nextRows] : nextRows))
      setTotalCount(Math.max(0, Number(res.totalCount ?? 0)))
      setPage(Math.max(0, Number(res.page ?? pageIndex)))
      setHasMore(Boolean(res.hasMore))
      return true
    },
    [partnerId, t.inventoryEmbeddingErrorsLoadFailed, toast]
  )

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setRows([])
    setPage(0)
    void loadPage(0, false)
      .catch(() => {
        if (!cancelled) {
          toast({ title: t.inventoryEmbeddingErrorsLoadFailed, variant: 'destructive' })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [partnerId, refreshKey, loadPage, t.inventoryEmbeddingErrorsLoadFailed, toast])

  const summary = useMemo(
    () => t.inventoryEmbeddingErrorsSummary.replace('{count}', String(totalCount)),
    [t.inventoryEmbeddingErrorsSummary, totalCount]
  )

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await loadPage(page + 1, true)
    } finally {
      setLoadingMore(false)
    }
  }

  const onExportCsv = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const res = await exportPartnerInventoryEmbeddingErrorsCsv(partnerId)
      if ('error' in res && res.error) {
        const msg =
          res.error === 'NO_EXPORT_ROWS' ? t.inventoryEmbeddingErrorsExportEmpty : String(res.error)
        toast({ title: msg, variant: 'destructive' })
        return
      }
      if (!('ok' in res) || !res.ok) return
      const bin = atob(res.base64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: t.inventoryEmbeddingErrorsExportDone
          .replace('{count}', String(res.count))
          .replace('{filename}', res.filename),
      })
    } finally {
      setExporting(false)
    }
  }

  if (!loading && totalCount === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-foreground">{t.inventoryEmbeddingErrorsTitle}</p>
          <p className="text-muted-foreground">{loading ? '...' : summary}</p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={exporting || loading || totalCount === 0}
          onClick={() => void onExportCsv()}
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {exporting ? t.inventoryEmbeddingErrorsExporting : t.inventoryEmbeddingErrorsExportCsv}
        </Button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-md border border-border/60 bg-background/80">
        <table className="min-w-full text-left text-[11px]">
          <thead className="border-b bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2 py-2 font-medium">{t.inventoryEmbeddingErrorsColSku}</th>
              <th className="px-2 py-2 font-medium">{t.inventoryEmbeddingErrorsColName}</th>
              <th className="px-2 py-2 font-medium">{t.inventoryEmbeddingErrorsColImageError}</th>
              <th className="px-2 py-2 font-medium">{t.inventoryEmbeddingErrorsColTextError}</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">{t.inventoryEmbeddingErrorsColUpdatedAt}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                  ...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                  {t.inventoryEmbeddingErrorsEmpty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/40 align-top last:border-b-0">
                  <td className="px-2 py-2 font-mono text-[10px] whitespace-nowrap">{row.sku || '—'}</td>
                  <td className="px-2 py-2 max-w-[180px]">
                    <p className="line-clamp-2 break-words">{row.name || '—'}</p>
                  </td>
                  <td className="px-2 py-2 max-w-[220px]">
                    <p className="break-words text-destructive">{row.imageError || '—'}</p>
                  </td>
                  <td className="px-2 py-2 max-w-[220px]">
                    <p className="break-words text-destructive">{row.textError || '—'}</p>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap tabular-nums text-muted-foreground">
                    {latestAttemptAt(row)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div className="mt-2 flex justify-center">
          <Button type="button" size="sm" variant="ghost" disabled={loadingMore} onClick={() => void onLoadMore()}>
            {loadingMore ? '...' : t.inventoryEmbeddingErrorsLoadMore}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

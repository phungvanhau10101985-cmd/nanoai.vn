'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2, Table2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { GradebookPayload } from '@/lib/lop/class-gradebook'
import { cn } from '@/lib/utils'

const pageSectionCard =
  'overflow-hidden rounded-2xl border border-border/90 bg-card shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.06]'
const pageSectionHead =
  'flex flex-wrap items-center gap-2.5 border-b border-border/80 bg-gradient-to-r from-muted/55 via-muted/35 to-transparent px-4 py-3 sm:px-5'
const pageSectionTitle = 'text-base font-semibold tracking-tight text-foreground'

export function ClassGradebookSection({
  classId,
  t,
}: {
  classId: string
  t: Dictionary['classes']
}) {
  const { toast } = useToast()
  const [data, setData] = useState<GradebookPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    void fetch(`/api/lop/${encodeURIComponent(classId)}/gradebook`)
      .then(async (res) => {
        if (!res.ok) throw new Error('bad')
        return res.json() as Promise<GradebookPayload>
      })
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) {
          setError(true)
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  const exportExcel = useCallback(async () => {
    setExporting(true)
    try {
      const res = await fetch(`/api/lop/${encodeURIComponent(classId)}/gradebook/export`)
      if (!res.ok) throw new Error('bad')
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition')
      const m = cd?.match(/filename="([^"]+)"/)
      const fname = m?.[1] ?? 'bang_diem.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast({ variant: 'destructive', description: t.gradebookExportFailed })
    } finally {
      setExporting(false)
    }
  }, [classId, t.gradebookExportFailed, toast])

  if (loading) {
    return (
      <section className="mb-8" aria-busy="true" aria-label={t.gradebookTitle}>
        <div className={pageSectionCard}>
          <div className={pageSectionHead}>
            <Table2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 className={pageSectionTitle}>{t.gradebookTitle}</h2>
          </div>
          <div className="flex items-center gap-2 bg-muted/10 px-4 py-5 text-sm text-muted-foreground sm:px-5">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            {t.gradebookLoading}
          </div>
        </div>
      </section>
    )
  }

  if (error || !data) {
    return (
      <section className="mb-8" aria-label={t.gradebookTitle}>
        <div className={pageSectionCard}>
          <div className={pageSectionHead}>
            <Table2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <h2 className={pageSectionTitle}>{t.gradebookTitle}</h2>
          </div>
          <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-4 sm:px-5">
            <p className="text-sm text-destructive">{t.gradebookFetchError}</p>
          </div>
        </div>
      </section>
    )
  }

  const { columns, rows } = data

  return (
    <section className="mb-8" aria-labelledby="class-gradebook-heading">
      <div className={pageSectionCard}>
        <div
          className={cn(
            pageSectionHead,
            'flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between'
          )}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <Table2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <h2 id="class-gradebook-heading" className={pageSectionTitle}>
                {t.gradebookTitle}
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                {t.gradebookDescription}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 touch-manipulation gap-1.5 sm:mt-0.5"
            disabled={exporting || rows.length === 0}
            onClick={() => void exportExcel()}
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {t.gradebookExportExcel}
          </Button>
        </div>

        <div className="space-y-3 bg-muted/10 p-3 sm:p-4">
          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border/80 bg-card/80 px-3 py-4 text-sm text-muted-foreground">
              {t.noStudents}
            </p>
          ) : (
            <>
              {columns.length === 0 ? (
                <p className="rounded-lg border border-amber-300/60 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
                  {t.gradebookEmptyColumns}
                </p>
              ) : null}
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-sm">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/50">
                      <th className="w-10 whitespace-nowrap px-2 py-2.5 text-left font-medium">
                        {t.gradebookColNo}
                      </th>
                      <th className="min-w-[140px] px-2 py-2.5 text-left font-medium">{t.gradebookColName}</th>
                      <th className="whitespace-nowrap px-2 py-2.5 text-left font-medium">{t.gradebookColDob}</th>
                      {columns.map((c) => (
                        <th
                          key={c.key}
                          className="min-w-[100px] max-w-[200px] px-2 py-2.5 text-left font-medium"
                          title={
                            c.kind === 'worksheet'
                              ? `${t.gradebookKindWorksheet}: ${c.header}`
                              : `${t.gradebookKindExam}: ${c.header}`
                          }
                        >
                          <span className="line-clamp-2 break-words text-xs font-medium leading-snug">
                            {c.kind === 'worksheet' ? (
                              <>
                                <span className="text-muted-foreground">{t.gradebookKindWorksheet}: </span>
                                {c.header}
                              </>
                            ) : (
                              <>
                                <span className="text-muted-foreground">{t.gradebookKindExam}: </span>
                                {c.header}
                              </>
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="whitespace-nowrap bg-primary/5 px-2 py-2.5 text-right font-semibold text-foreground dark:bg-primary/10">
                        {t.gradebookColTotal}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={r.userId}
                        className={cn('border-b border-border/60', i % 2 === 1 && 'bg-muted/25')}
                      >
                        <td className="px-2 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-2 font-medium">{r.displayName}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{r.dob}</td>
                        {columns.map((c) => (
                          <td key={c.key} className="px-2 py-2 text-center tabular-nums text-muted-foreground">
                            {r.cells[c.key] ?? '—'}
                          </td>
                        ))}
                        <td className="bg-primary/[0.04] px-2 py-2 text-right text-base font-semibold tabular-nums text-foreground dark:bg-primary/[0.08]">
                          {r.total10}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import { RefreshCw, ShieldCheck, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Labels = Dictionary['adminWorksheetVerify']

type ReportRow = {
  id: string
  created_at: string
  updated_at: string
  finished_at: string | null
  status: string
  triggered_by: string | null
  worksheets_planned: number
  worksheets_processed: number
  questions_marked_verified: number
  questions_content_updated: number
  questions_skipped_invalid: number
  error_summary: string | null
}

type DetailRow = {
  worksheetId: string
  topic: string
  contentUpdates: number
  markedVerified: number
  skippedInvalid: number
  errors: string[]
  durationMs: number
}

export function WorksheetVerifyReportsClient({ labels: t }: { labels: Labels }) {
  const { toast } = useToast()
  const [items, setItems] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [batchSize, setBatchSize] = useState(1)
  const [runningPoll, setRunningPoll] = useState(false)
  const pollAbortRef = useRef(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, { details: DetailRow[]; progress: unknown }>>({})

  const fetchList = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/worksheet-verify-batch')
      .then((res) => res.json())
      .then((data) => {
        if (data.items) setItems(data.items)
        else {
          setItems([])
          if (data.error) toast({ title: t.toastErr, description: data.error, variant: 'destructive' })
        }
      })
      .catch((e) => {
        setItems([])
        toast({ title: t.toastErr, description: e?.message ?? '…', variant: 'destructive' })
      })
      .finally(() => setLoading(false))
  }, [toast, t.toastErr])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const loadDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    if (!detailCache[id]) {
      const res = await fetch(`/api/admin/worksheet-verify-batch?id=${encodeURIComponent(id)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.item) {
        toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
        return
      }
      const details = (Array.isArray(data.item.details) ? data.item.details : []) as DetailRow[]
      setDetailCache((c) => ({ ...c, [id]: { details, progress: data.item.progress } }))
    }
    setExpandedId(id)
  }

  const runStepLoop = useCallback(
    async (reportId: string) => {
      pollAbortRef.current = false
      setRunningPoll(true)
      try {
        // eslint-disable-next-line no-constant-condition
        while (!pollAbortRef.current) {
          const res = await fetch('/api/admin/worksheet-verify-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'step', reportId, batchSize }),
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
            break
          }
          if (data.status !== 'running') {
            toast({
              title: t.toastDone,
              description: `${t.worksheetsProcessed}: ${data.worksheetsProcessedTotal ?? 0} / ${data.worksheetsPlanned ?? '?'}`,
            })
            break
          }
          await new Promise((r) => setTimeout(r, 800))
        }
      } finally {
        setRunningPoll(false)
        fetchList()
      }
    },
    [batchSize, fetchList, t.toastDone, t.toastErr, t.worksheetsProcessed, toast]
  )

  const handleStart = async () => {
    try {
      const res = await fetch('/api/admin/worksheet-verify-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: t.toastErr, description: data.error ?? String(res.status), variant: 'destructive' })
        return
      }
      if (data.worksheetsPlanned === 0) {
        toast({ title: t.nonePending, description: '' })
        fetchList()
        return
      }
      toast({ title: t.toastStarted, description: `${t.worksheetsPlanned}: ${data.worksheetsPlanned}` })
      await runStepLoop(data.reportId)
    } catch (e) {
      toast({ title: t.toastErr, description: e instanceof Error ? e.message : String(e), variant: 'destructive' })
    }
  }

  const handleStopPoll = () => {
    pollAbortRef.current = true
  }

  const statusLabel = (s: string) => {
    if (s === 'running') return t.running
    if (s === 'completed') return t.completed
    if (s === 'failed') return t.failed
    if (s === 'cancelled') return t.cancelled
    return s
  }

  return (
    <div className="space-y-6 p-6">
      <Toaster />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-emerald-600" />
            {t.pageTitle}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl">{t.pageDescription}</p>
          <p className="mt-2 text-sm text-muted-foreground max-w-2xl border-l-2 border-emerald-500/40 pl-3">
            {t.reportScopeNote}
          </p>
          <p className="mt-2 text-xs text-muted-foreground font-mono break-all">{t.cronDoc}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <label className="text-sm whitespace-nowrap">{t.batchSize}</label>
            <Input
              type="number"
              min={1}
              max={10}
              className="w-20"
              value={batchSize}
              onChange={(e) => setBatchSize(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void handleStart()} disabled={runningPoll}>
              {t.newScan}
            </Button>
            {runningPoll && (
              <Button variant="outline" onClick={handleStopPoll}>
                {t.stopPoll}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchList} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.details}</CardTitle>
          <CardDescription>
            {statusLabel('running')} / {statusLabel('completed')}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {items.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t.noReports}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>{t.status}</TableHead>
                  <TableHead>{t.worksheetsPlanned}</TableHead>
                  <TableHead>{t.worksheetsProcessed}</TableHead>
                  <TableHead>{t.qsMarked}</TableHead>
                  <TableHead>{t.qsPatched}</TableHead>
                  <TableHead>{t.qsSkipped}</TableHead>
                  <TableHead>{t.reportUpdatedAt}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <Fragment key={row.id}>
                    <TableRow className="cursor-pointer" onClick={() => void loadDetail(row.id)}>
                      <TableCell>
                        {expandedId === row.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </TableCell>
                      <TableCell>{statusLabel(row.status)}</TableCell>
                      <TableCell>{row.worksheets_planned}</TableCell>
                      <TableCell>{row.worksheets_processed}</TableCell>
                      <TableCell>{row.questions_marked_verified}</TableCell>
                      <TableCell>{row.questions_content_updated}</TableCell>
                      <TableCell>{row.questions_skipped_invalid}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(row.updated_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                    {expandedId === row.id && detailCache[row.id] && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-muted/40 align-top">
                          <div className="py-3 space-y-2 text-sm">
                            {detailCache[row.id].details.length === 0 ? (
                              <p className="text-muted-foreground">—</p>
                            ) : (
                              <ul className="space-y-2">
                                {detailCache[row.id].details.map((d) => (
                                  <li key={d.worksheetId} className="border rounded-md p-2 bg-background">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <a
                                        href={`/phieu-bai-tap/${encodeURIComponent(d.worksheetId)}`}
                                        className="font-mono text-xs text-primary inline-flex items-center gap-1 hover:underline"
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        {d.worksheetId.slice(0, 8)}… <ExternalLink className="h-3 w-3" />
                                      </a>
                                      <span className="text-muted-foreground truncate max-w-md">{d.topic}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                                      <span>✓ {d.markedVerified}</span>
                                      <span>patch {d.contentUpdates}</span>
                                      <span>skip {d.skippedInvalid}</span>
                                      <span>
                                        {t.durationMs}: {d.durationMs}
                                      </span>
                                    </div>
                                    {d.errors?.length > 0 && (
                                      <p className="mt-1 text-xs text-destructive">
                                        {t.errors}: {d.errors.join('; ')}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {row.error_summary && <p className="text-destructive text-xs">{row.error_summary}</p>}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

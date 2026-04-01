'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import { getDictionary } from '@/lib/i18n/dictionaries'
import {
  aggregateTryOnGroupStatus,
  openHrefForTryOnGroup,
  tryOnFeatureToToolKey,
  worksheetTypeToTaskHubLabel,
} from '@/lib/dashboard/task-hub'
import { refreshTaskHubSnapshot } from './actions'
import type { TaskHubSnapshot } from './task-hub-snapshot'

const POLL_MS = 8000

function statusBadgeVariant(
  s: ReturnType<typeof aggregateTryOnGroupStatus>
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'processing') return 'secondary'
  if (s === 'failed') return 'destructive'
  if (s === 'cancelled') return 'outline'
  if (s === 'mixed') return 'outline'
  return 'default'
}

export function TaskHubPoll({ locale, initial }: { locale: WebLocale; initial: TaskHubSnapshot }) {
  const t = getDictionary(locale)
  const th = t.taskHub
  const [snap, setSnap] = useState<TaskHubSnapshot>(initial)
  const pullInFlight = useRef(false)

  const hasRunning = useMemo(
    () => snap.runningTryOn.length > 0 || snap.runningWs.length > 0,
    [snap.runningTryOn.length, snap.runningWs.length]
  )

  const pull = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (pullInFlight.current) return
    pullInFlight.current = true
    try {
      const res = await refreshTaskHubSnapshot()
      if (res.ok) setSnap(res.data)
    } finally {
      pullInFlight.current = false
    }
  }, [])

  /** Khi chuyển lại tab: luôn tải lại (kể cả khi không còn tác vụ chạy — cập nhật mục “gần đây”). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [pull])

  /** Chỉ poll định kỳ khi còn tác vụ đang chạy — giảm tải server khi hàng đợi trống. */
  useEffect(() => {
    if (!hasRunning) return
    const id = window.setInterval(() => {
      void pull()
    }, POLL_MS)
    return () => window.clearInterval(id)
  }, [hasRunning, pull])

  const aggLabel = (s: ReturnType<typeof aggregateTryOnGroupStatus>) => {
    if (s === 'processing') return th.statusProcessing
    if (s === 'failed') return th.statusFailed
    if (s === 'completed') return th.statusCompleted
    if (s === 'cancelled') return th.statusCancelled
    return th.statusMixed
  }

  const wsStatusLabel = (s: string) => {
    if (s === 'processing' || s === 'pending') return th.statusProcessing
    if (s === 'failed') return th.statusFailed
    if (s === 'completed') return th.statusCompleted
    return s
  }

  const { runningTryOn, runningWs, recentTop } = snap

  return (
    <>
      <p className="text-xs text-muted-foreground -mt-2 mb-4">{th.autoRefreshNote}</p>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{th.sectionRunning}</h2>
        {runningTryOn.length === 0 && runningWs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">{th.emptyRunning}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {runningTryOn.map((g) => {
              const toolKey = tryOnFeatureToToolKey(g.feature)
              const title = t.tool[toolKey]
              const href = openHrefForTryOnGroup(g)
              const done = g.counts.completed ?? 0
              const total = g.rows.length
              const agg = aggregateTryOnGroupStatus(g)
              return (
                <Card key={g.key}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{title}</CardTitle>
                      <Badge variant={statusBadgeVariant(agg)}>{aggLabel(agg)}</Badge>
                    </div>
                    {g.isBatch ? (
                      <CardDescription>
                        {th.batchSummary.replace('{done}', String(done)).replace('{total}', String(total))} ·{' '}
                        {th.itemsCount.replace('{n}', String(total))}
                      </CardDescription>
                    ) : (
                      <CardDescription>{new Date(g.maxCreatedAt).toLocaleString()}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {g.feature === 'translate' && g.batchId ? (
                      <p className="text-xs text-muted-foreground">{th.hintTranslateProgress}</p>
                    ) : null}
                    {g.rows[0]?.error_message && agg !== 'processing' ? (
                      <p className="text-xs text-destructive line-clamp-2">{g.rows[0].error_message}</p>
                    ) : null}
                    <Button size="sm" asChild>
                      <Link href={href}>
                        {th.openTool}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
            {runningWs.map((job) => {
              const labelKey = worksheetTypeToTaskHubLabel(job.type)
              return (
                <Card key={job.id}>
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="text-base">{th[labelKey]}</CardTitle>
                      <Badge variant="secondary">{wsStatusLabel(job.status)}</Badge>
                    </div>
                    <CardDescription>
                      {th.worksheetSection} · {new Date(job.updated_at).toLocaleString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button size="sm" asChild>
                      <Link href="/tao-giao-trinh">
                        {th.openTool}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{th.sectionRecent}</h2>
        {recentTop.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">{th.emptyRecent}</CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentTop.map((line) => {
              if (line.kind === 'tryon') {
                const g = line.group
                const toolKey = tryOnFeatureToToolKey(g.feature)
                const title = t.tool[toolKey]
                const href = openHrefForTryOnGroup(g)
                const done = g.counts.completed ?? 0
                const total = g.rows.length
                const agg = aggregateTryOnGroupStatus(g)
                return (
                  <li key={`t-${g.key}`}>
                    <Card>
                      <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
                        <div className="space-y-1 min-w-0">
                          <p className="font-medium truncate">{title}</p>
                          <p className="text-xs text-muted-foreground">
                            {g.isBatch
                              ? `${th.batchSummary.replace('{done}', String(done)).replace('{total}', String(total))} · ${new Date(line.at).toLocaleString()}`
                              : new Date(line.at).toLocaleString()}
                          </p>
                          <Badge variant={statusBadgeVariant(agg)} className="w-fit">
                            {aggLabel(agg)}
                          </Badge>
                        </div>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={href}>{th.openTool}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </li>
                )
              }
              const job = line.job
              const labelKey = worksheetTypeToTaskHubLabel(job.type)
              return (
                <li key={`w-${job.id}`}>
                  <Card>
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
                      <div className="space-y-1 min-w-0">
                        <p className="font-medium">{th[labelKey]}</p>
                        <p className="text-xs text-muted-foreground">
                          {th.worksheetSection} · {new Date(line.at).toLocaleString()}
                        </p>
                        <Badge variant={job.status === 'failed' ? 'destructive' : 'default'} className="w-fit">
                          {wsStatusLabel(job.status)}
                        </Badge>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link href="/tao-giao-trinh">{th.openTool}</Link>
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { sourceStockClient } from '@/lib/messaging/source-stock-check/source-stock-client'
import type {
  SourceStockActivityReport,
  SourceStockActivityReportSampleRow,
  SourceStockDomain,
  SourceStockPreviewUrlResult,
  SourceStockQueueStats,
  SourceStockWorkerProgressRow,
  SourceStockWorkerState,
} from '@/lib/messaging/source-stock-check/source-stock-types'

const SOURCE_STOCK_REPORT_SAMPLE_PAGE_SIZE = 200
const RESET_PDP_CONFIRM_PROMPT_VI = 'đồng ý reset tất cả'

function normalizeResetPdpConfirmInput(raw: string): string {
  return raw
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const RESET_PDP_CONFIRM_TARGET_NORM = normalizeResetPdpConfirmInput(RESET_PDP_CONFIRM_PROMPT_VI)

function resetPdpTypedPhraseMatchesConfirm(raw: string): boolean {
  return normalizeResetPdpConfirmInput(raw) === RESET_PDP_CONFIRM_TARGET_NORM
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 shrink-0 ${className ?? ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  )
}

function ExternalHttpLink({ url }: { url: string }) {
  const u = url.trim()
  if (!u) return '—'
  if (!/^https?:\/\//i.test(u)) return <span className="font-mono text-xs break-all">{u}</span>
  return (
    <a href={u} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-orange-700 underline break-all">
      {u}
    </a>
  )
}

function formatReportTimestampUtc(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleString('vi-VN', { timeZone: 'UTC' })} UTC`
}

function formatReportAge(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return 'vừa ghi'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return minutes <= 1 ? 'vừa ghi' : `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

function PreviewStockBranchCard({ title, branch }: { title: string; branch: { status: string; error?: string | null; checked_via?: string | null } }) {
  const st = (branch.status || '').trim().toLowerCase()
  const skin =
    st === 'in_stock'
      ? 'border-emerald-300 bg-emerald-50/95 text-emerald-950'
      : st === 'out_of_stock'
        ? 'border-rose-300 bg-rose-50/95 text-rose-950'
        : st === 'skipped'
          ? 'border-slate-200 bg-white text-slate-700'
          : st === 'blocked'
            ? 'border-violet-400 bg-violet-50 text-violet-950'
            : st === 'error'
              ? 'border-amber-400 bg-amber-50 text-amber-950'
              : 'border-slate-200 bg-slate-50 text-slate-900'
  const msg = typeof branch.error === 'string' ? branch.error.trim() : ''
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${skin}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-85">{title}</p>
      <p className="text-sm font-semibold mt-1">
        status: <code className="text-[12px] bg-white/60 px-1 rounded">{branch.status || '—'}</code>
      </p>
      {branch.checked_via ? (
        <p className="text-[10px] mt-1">
          nền: <code className="bg-white/60 px-1 rounded font-mono">{branch.checked_via}</code>
        </p>
      ) : null}
      {msg ? <p className="text-[11px] mt-1.5 whitespace-pre-wrap leading-snug opacity-95">{msg}</p> : null}
    </div>
  )
}

function WorkerStockProgressCard({
  title,
  subtitle,
  tone,
  row,
  emptyHint,
  mode,
}: {
  title: string
  subtitle: string
  tone: 'sky' | 'emerald' | 'slate'
  row: SourceStockWorkerProgressRow | null | undefined
  emptyHint: string
  mode: 'checking' | 'completed' | 'upcoming'
}) {
  const skin = tone === 'sky' ? 'border-sky-200/90 bg-white/85' : tone === 'emerald' ? 'border-emerald-200/90 bg-white/85' : 'border-slate-200/90 bg-white/85'
  const titleColor = tone === 'sky' ? 'text-sky-950' : tone === 'emerald' ? 'text-emerald-950' : 'text-slate-900'
  return (
    <div className={`rounded-lg border px-2.5 py-2 min-w-0 ${skin}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${titleColor}`}>{title}</p>
      <p className="text-[10px] text-slate-600 leading-snug mt-0.5">{subtitle}</p>
      {!row ? (
        <p className="text-[11px] text-slate-500 mt-2 leading-snug">{emptyHint}</p>
      ) : (
        <div className="mt-2 space-y-1 text-[11px] text-slate-800">
          <p>
            <span className="font-mono tabular-nums">DB #{row.product_db_id.slice(0, 8)}</span>
            {row.product_code ? (
              <>
                {' · '}
                <span className="font-mono">{row.product_code}</span>
              </>
            ) : null}
          </p>
          {row.name ? <p className="line-clamp-2 text-slate-700">{row.name}</p> : null}
          <p className="break-all">
            <span className="text-slate-500">Link: </span>
            <ExternalHttpLink url={row.link_default ?? ''} />
          </p>
          {mode === 'checking' && row.checking_started_at_utc_iso ? (
            <p className="text-slate-600">
              Bắt đầu: <span className="font-mono text-[10px]">{formatReportTimestampUtc(row.checking_started_at_utc_iso)}</span>{' '}
              <span className="text-slate-400">{formatReportAge(row.checking_started_at_utc_iso)}</span>
            </p>
          ) : null}
          {mode === 'completed' && row.source_stock_status ? (
            <p>
              Trạng thái: <code className="text-[10px] bg-slate-100 px-1 rounded border">{row.source_stock_status}</code>
            </p>
          ) : null}
          {mode === 'upcoming' && row.queue_hint_vi ? (
            <p className="text-[10px] text-indigo-950/90 bg-indigo-50/80 border border-indigo-100 rounded px-1.5 py-1">{row.queue_hint_vi}</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, variant = 'slate' }: { label: string; value: number | string; variant?: 'slate' | 'emerald' | 'violet' | 'amber' | 'rose' | 'teal' }) {
  const skin: Record<string, string> = {
    slate: 'border-slate-200 bg-slate-50/90 text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50/90 text-emerald-950',
    violet: 'border-violet-200 bg-violet-50/90 text-violet-950',
    amber: 'border-amber-200 bg-amber-50/90 text-amber-950',
    rose: 'border-rose-200 bg-rose-50/90 text-rose-950',
    teal: 'border-teal-200 bg-teal-50/90 text-teal-950',
  }
  const display = typeof value === 'number' ? value.toLocaleString('vi-VN') : value
  return (
    <div className={`rounded-lg border px-2.5 py-2 text-center min-w-0 ${skin[variant]}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80 font-medium leading-tight line-clamp-2">{label}</div>
      <div className="text-base sm:text-lg font-semibold tabular-nums mt-0.5">{display}</div>
    </div>
  )
}

export function PartnerSourceStockCheckCard({ partnerId, t }: { partnerId: string; t: Dictionary['partnerMessagingAi'] }) {
  const [domain, setDomain] = useState<SourceStockDomain>('cssbuy')
  const [queueStats, setQueueStats] = useState<SourceStockQueueStats | null>(null)
  const [queueStatsLoading, setQueueStatsLoading] = useState(false)
  const [workerState, setWorkerState] = useState<SourceStockWorkerState | null>(null)
  const [activityReport, setActivityReport] = useState<SourceStockActivityReport | null>(null)
  const [activityReportLoading, setActivityReportLoading] = useState(false)
  const [activityReportError, setActivityReportError] = useState<string | null>(null)
  const [reportSamplePages, setReportSamplePages] = useState({ oos: 1, in_stock: 1, batch_ttl_recent: 1 })
  const [lastError, setLastError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'err' | 'warn'; msg: string } | null>(null)
  const [testLinkInput, setTestLinkInput] = useState('')
  const [testLinkBusy, setTestLinkBusy] = useState(false)
  const [testLinkResult, setTestLinkResult] = useState<SourceStockPreviewUrlResult | null>(null)
  const [pauseActionBusy, setPauseActionBusy] = useState(false)
  const [resetPdpConfirmOpen, setResetPdpConfirmOpen] = useState(false)
  const [resetPdpTypedPhrase, setResetPdpTypedPhrase] = useState('')
  const [resetPdpBusy, setResetPdpBusy] = useState(false)
  const [oosBusy, setOosBusy] = useState<Record<string, string>>({})
  const [selectedOos, setSelectedOos] = useState<string[]>([])
  const [oosDeleteIds, setOosDeleteIds] = useState<string[] | null>(null)
  const [oosDeleting, setOosDeleting] = useState(false)
  const headerCheckboxRef = useRef<HTMLInputElement>(null)

  const cooldownDays = queueStats?.admin_batch_scan_cooldown_days ?? 30

  const showToast = (type: 'ok' | 'err' | 'warn', msg: string) => {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 4200)
  }

  const refreshQueueStats = useCallback(async () => {
    setQueueStatsLoading(true)
    try {
      const [stats, worker] = await Promise.all([
        sourceStockClient.queueStats(partnerId, domain),
        sourceStockClient.workerState(partnerId),
      ])
      setQueueStats(stats)
      setWorkerState(worker)
      setLastError(null)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setQueueStatsLoading(false)
    }
  }, [partnerId, domain])

  const refreshActivityReport = useCallback(async () => {
    setActivityReportLoading(true)
    setActivityReportError(null)
    try {
      const report = await sourceStockClient.report(partnerId, {
        domain,
        oosPage: reportSamplePages.oos,
        inStockPage: reportSamplePages.in_stock,
        ttlPage: reportSamplePages.batch_ttl_recent,
        pageSize: SOURCE_STOCK_REPORT_SAMPLE_PAGE_SIZE,
      })
      setActivityReport(report)
    } catch (e) {
      setActivityReportError(e instanceof Error ? e.message : String(e))
    } finally {
      setActivityReportLoading(false)
    }
  }, [partnerId, domain, reportSamplePages])

  useEffect(() => {
    void refreshQueueStats()
  }, [refreshQueueStats])

  useEffect(() => {
    void refreshActivityReport()
  }, [refreshActivityReport])

  useEffect(() => {
    const id = window.setInterval(() => void refreshQueueStats(), 90_000)
    return () => window.clearInterval(id)
  }, [refreshQueueStats])

  const runTestLinkPreview = async () => {
    setTestLinkBusy(true)
    try {
      const out = await sourceStockClient.previewUrl(partnerId, testLinkInput)
      setTestLinkResult(out)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setTestLinkBusy(false)
    }
  }

  const togglePause = async (paused: boolean) => {
    setPauseActionBusy(true)
    try {
      const snap = await sourceStockClient.workerPause(partnerId, paused)
      setWorkerState(snap)
      showToast('ok', paused ? t.sourceStockPausedOk : t.sourceStockResumedOk)
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setPauseActionBusy(false)
    }
  }

  const runResetPdpCycle = async () => {
    setResetPdpBusy(true)
    try {
      const out = await sourceStockClient.resetPdp(partnerId, domain)
      showToast('ok', t.sourceStockResetOk.replace('{n}', String(out.products_updated)))
      setResetPdpConfirmOpen(false)
      setResetPdpTypedPhrase('')
      await refreshQueueStats()
      await refreshActivityReport()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setResetPdpBusy(false)
    }
  }

  const oosRows = activityReport?.samples.oos ?? []
  const selectedSet = useMemo(() => new Set(selectedOos), [selectedOos])
  const allDisplayedSelected = oosRows.length > 0 && oosRows.every((r) => selectedSet.has(r.id))
  const someDisplayedSelected = oosRows.some((r) => selectedSet.has(r.id))

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el) return
    el.indeterminate = someDisplayedSelected && !allDisplayedSelected
  }, [someDisplayedSelected, allDisplayedSelected])

  const runOosAction = async (ids: string[], kind: 'delete' | 'clear' | 'recheck') => {
    if (!ids.length) return
    const busy: Record<string, string> = {}
    for (const id of ids) busy[id] = kind
    setOosBusy((s) => ({ ...s, ...busy }))
    try {
      if (kind === 'delete') {
        await sourceStockClient.deleteByIds(partnerId, ids)
        showToast('ok', t.sourceStockDeletedOk.replace('{n}', String(ids.length)))
      } else if (kind === 'clear') {
        await sourceStockClient.clearOosFlagBulk(partnerId, { db_ids: ids })
        showToast('ok', t.sourceStockClearedOk)
      } else {
        for (const id of ids) await sourceStockClient.forceRecheck(partnerId, id)
        showToast('ok', t.sourceStockRecheckOk)
      }
      setSelectedOos([])
      await refreshActivityReport()
      await refreshQueueStats()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setOosBusy({})
      setOosDeleteIds(null)
      setOosDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{t.sourceStockTitle}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">{t.sourceStockIntro}</p>
      </header>

      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-[130] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border px-3 py-2 text-sm shadow-lg ${
            toast.type === 'err' ? 'bg-red-50 border-red-200 text-red-800' : toast.type === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      {lastError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p className="font-medium">{t.sourceStockApiError}</p>
          <p className="mt-1 whitespace-pre-wrap">{lastError}</p>
          <button type="button" onClick={() => setLastError(null)} className="mt-3 text-sm font-semibold underline">
            {t.sourceStockClose}
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-1 flex-1 min-w-[12rem] max-w-md">
        <label htmlFor="source-domain-select" className="text-xs font-medium text-muted-foreground">
          {t.sourceStockDomainLabel}
        </label>
        <select
          id="source-domain-select"
          className="border border-border rounded-lg px-3 h-10 text-sm w-full bg-background"
          value={domain}
          onChange={(e) => {
            setDomain(e.target.value as SourceStockDomain)
            setReportSamplePages({ oos: 1, in_stock: 1, batch_ttl_recent: 1 })
          }}
        >
          <option value="cssbuy">{t.sourceStockDomainCssbuy}</option>
          <option value="vipomall">{t.sourceStockDomainVipomall}</option>
        </select>
      </div>

      <section className="rounded-lg border border-teal-200 bg-teal-50/55 px-3 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-teal-950 uppercase tracking-wide">{t.sourceStockTestHeading}</h3>
            <p className="text-[11px] text-teal-900/85 mt-1 max-w-[42rem] leading-snug">{t.sourceStockTestHint}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-teal-700 text-white px-3 py-2 text-xs font-semibold hover:bg-teal-800 disabled:opacity-45 flex items-center gap-2"
            disabled={testLinkBusy}
            onClick={() => void runTestLinkPreview()}
          >
            {testLinkBusy ? (
              <>
                <SpinnerIcon className="text-white" />
                {t.sourceStockTestRunning}
              </>
            ) : (
              t.sourceStockTestRun
            )}
          </button>
        </div>
        <textarea
          rows={2}
          className="w-full mt-1 border border-teal-200 rounded-lg px-3 py-2 text-sm"
          placeholder={t.sourceStockTestPlaceholder}
          value={testLinkInput}
          disabled={testLinkBusy}
          onChange={(e) => setTestLinkInput(e.target.value)}
        />
        {testLinkResult?.ok ? (
          <div className="rounded-lg border border-white/80 bg-white/90 px-2.5 py-2 space-y-2">
            <p className="text-[11px] text-slate-700 leading-snug">
              <span className="text-slate-500">Chuẩn hoá:</span>{' '}
              <code className="text-[10px] break-all bg-slate-100 px-1 rounded">{testLinkResult.canonical_input}</code>
              {' · '}
              <span className={`font-semibold ${testLinkResult.link_eligible ? 'text-emerald-800' : 'text-amber-800'}`}>
                {testLinkResult.link_eligible ? t.sourceStockEligible : t.sourceStockIneligible}
              </span>
            </p>
            <PreviewStockBranchCard title="CSSBuy" branch={testLinkResult.cssbuy} />
            <PreviewStockBranchCard title="Vipomall" branch={testLinkResult.vipomall ?? { status: 'skipped' }} />
            <PreviewStockBranchCard title="PandaMall" branch={testLinkResult.pandamall ?? { status: 'skipped' }} />
            <PreviewStockBranchCard title={t.sourceStockMerged} branch={testLinkResult.merged} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-indigo-950 uppercase tracking-wide">{t.sourceStockWorkerHeading}</p>
            {workerState ? (
              <p className="text-[11px] text-indigo-950/85 leading-snug">
                ENV <strong>{workerState.env_source_stock_check_enabled ? t.sourceStockOn : t.sourceStockOff}</strong>
                {' · '}
                {t.sourceStockPauseFlag}: <strong>{workerState.db_paused ? t.sourceStockOn : t.sourceStockOff}</strong>
                <br />
                {t.sourceStockDaemon}: <strong>{workerState.daemon_thread_alive ? t.sourceStockRunning : t.sourceStockIdle}</strong>
                {' · '}
                RAM: <strong className="tabular-nums">{workerState.process_in_memory_queue_depth}</strong>
                {' · '}~{workerState.check_interval_seconds}s
              </p>
            ) : (
              <p className="text-[11px]">{t.sourceStockWorkerLoading}</p>
            )}
            {workerState?.effective_idle_reason ? (
              <p className="text-[11px] text-amber-950 bg-amber-50/95 border border-amber-100 rounded-md px-2 py-1.5">
                {workerState.effective_idle_hint_vi}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              disabled={pauseActionBusy || !workerState || workerState.db_paused || !workerState.env_source_stock_check_enabled}
              className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-950 hover:bg-amber-50 disabled:opacity-45"
              onClick={() => void togglePause(true)}
            >
              {pauseActionBusy ? t.sourceStockWriting : t.sourceStockPause}
            </button>
            <button
              type="button"
              disabled={pauseActionBusy || !workerState || !workerState.db_paused}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-45"
              onClick={() => void togglePause(false)}
            >
              {t.sourceStockResume}
            </button>
          </div>
        </div>
        {workerState ? (
          <div className="grid md:grid-cols-3 gap-2 pt-2 border-t border-indigo-100/80">
            <WorkerStockProgressCard tone="sky" title={t.sourceStockChecking} subtitle={t.sourceStockCheckingHint} row={workerState.checking} emptyHint={t.sourceStockCheckingEmpty} mode="checking" />
            <WorkerStockProgressCard tone="emerald" title={t.sourceStockLastDone} subtitle={t.sourceStockLastDoneHint} row={workerState.last_completed} emptyHint={t.sourceStockLastDoneEmpty} mode="completed" />
            <WorkerStockProgressCard tone="slate" title={t.sourceStockUpcoming} subtitle={t.sourceStockUpcomingHint} row={workerState.next_upcoming_primary} emptyHint={t.sourceStockUpcomingEmpty} mode="upcoming" />
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-2 py-2 border-y border-border">
        <button type="button" disabled={queueStatsLoading} className="text-xs font-semibold text-indigo-700 underline" onClick={() => void refreshQueueStats()}>
          {queueStatsLoading ? t.sourceStockRefreshingQueue : t.sourceStockRefreshQueue}
        </button>
        <button type="button" disabled={activityReportLoading} className="text-xs font-semibold text-indigo-700 underline" onClick={() => void refreshActivityReport()}>
          {activityReportLoading ? t.sourceStockRefreshingReport : t.sourceStockRefreshReport}
        </button>
        <button type="button" className="text-xs font-semibold text-rose-800 underline" onClick={() => setResetPdpConfirmOpen(true)}>
          {t.sourceStockResetPdp}
        </button>
      </div>

      {queueStats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <MiniStat label={t.sourceStockStatTotal} value={queueStats.total_in_scope} variant="slate" />
          <MiniStat label={t.sourceStockStatEligible} value={queueStats.eligible_now} variant="emerald" />
          <MiniStat label={t.sourceStockStatTraffic} value={queueStats.eligible_with_recent_customer_view} variant="violet" />
          <MiniStat label={t.sourceStockStatCooldown} value={queueStats.in_cooldown} variant="amber" />
          <MiniStat label={t.sourceStockStatNever} value={queueStats.eligible_never_scanned} variant="slate" />
          <MiniStat label={t.sourceStockStatRescan} value={queueStats.eligible_rescan_after_ttl} variant="teal" />
          <MiniStat label={t.sourceStockStatNoPdp} value={queueStats.eligible_without_recent_customer_view} variant="slate" />
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">{t.sourceStockTtlHint.replace('{n}', String(cooldownDays))}</p>

      {activityReportError ? (
        <p className="text-sm text-red-800">{activityReportError}</p>
      ) : null}

      {activityReport ? (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-3 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-950">
            {t.sourceStockReportHeading.replace('{n}', String(activityReport.window_days))}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
            <MiniStat label={t.sourceStockStatEligible} value={activityReport.queue.eligible_now} variant="emerald" />
            <MiniStat label={t.sourceStockCountTtl} value={activityReport.counts.batch_ttl_stamped_in_window} variant="slate" />
            <MiniStat label={t.sourceStockCountChecked} value={activityReport.counts.source_stock_checked_any_in_window} variant="slate" />
            <MiniStat label={t.sourceStockCountOos} value={activityReport.counts.source_stock_oos_signal_in_window} variant="rose" />
            <MiniStat label={t.sourceStockCountIn} value={activityReport.counts.source_stock_in_stock_signal_in_window} variant="teal" />
            <MiniStat label={t.sourceStockCountQtyPos} value={activityReport.counts.checked_available_positive_in_window} variant="emerald" />
            <MiniStat label={t.sourceStockCountQtyZero} value={activityReport.counts.checked_available_zero_or_negative_in_window} variant="amber" />
          </div>
          <ul className="flex flex-wrap gap-1.5 text-[11px]">
            {Object.entries(activityReport.checked_in_window_by_source_stock_status)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <li key={k} className="rounded-full bg-white/95 border border-slate-200 px-2 py-0.5 font-mono text-[10px]">
                  {k}: <strong>{v.toLocaleString('vi-VN')}</strong>
                </li>
              ))}
          </ul>

          <details className="rounded-lg border border-slate-200 bg-white" open>
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              {t.sourceStockOosTable} ({activityReport.samples_pagination.oos.total.toLocaleString('vi-VN')})
            </summary>
            {oosRows.length ? (
              <>
                <div className="px-2.5 py-2 flex flex-wrap gap-1.5 text-[11px] border-t">
                  <button type="button" className="underline" onClick={() => setSelectedOos(oosRows.map((r) => r.id))}>
                    {t.sourceStockSelectAll}
                  </button>
                  <button type="button" className="underline" onClick={() => setSelectedOos([])}>
                    {t.sourceStockClearSel}
                  </button>
                  <button type="button" disabled={!selectedOos.length} className="rounded-md border border-red-200 px-2 py-1 font-semibold disabled:opacity-45" onClick={() => setOosDeleteIds([...selectedOos])}>
                    {t.sourceStockDeleteDb}
                  </button>
                  <button type="button" disabled={!selectedOos.length} className="rounded-md border px-2 py-1 font-semibold disabled:opacity-45" onClick={() => void runOosAction(selectedOos, 'clear')}>
                    {t.sourceStockClearFlag}
                  </button>
                  <button type="button" disabled={!selectedOos.length} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-semibold disabled:opacity-45" onClick={() => void runOosAction(selectedOos, 'recheck')}>
                    {t.sourceStockRecheck}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-red-400 bg-red-50 px-2 py-1 font-semibold"
                    onClick={async () => {
                      const ids = (await sourceStockClient.oosIds(partnerId, domain)).ids
                      setOosDeleteIds(ids)
                    }}
                  >
                    {t.sourceStockDeleteAllWindow}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border px-2 py-1 font-semibold"
                    onClick={async () => {
                      const ids = (await sourceStockClient.oosIds(partnerId, domain)).ids
                      await runOosAction(ids, 'clear')
                    }}
                  >
                    {t.sourceStockClearAllWindow}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 font-semibold"
                    onClick={async () => {
                      const ids = (await sourceStockClient.oosIds(partnerId, domain)).ids
                      await runOosAction(ids, 'recheck')
                    }}
                  >
                    {t.sourceStockRecheckAllWindow}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px]">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-1">
                          <input
                            ref={headerCheckboxRef}
                            type="checkbox"
                            checked={allDisplayedSelected}
                            onChange={() => setSelectedOos(allDisplayedSelected ? [] : oosRows.map((r) => r.id))}
                          />
                        </th>
                        <th className="px-2 py-1">SKU</th>
                        <th className="px-2 py-1">{t.sourceStockColName}</th>
                        <th className="px-2 py-1">Link</th>
                        <th className="px-2 py-1">Vipomall</th>
                        <th className="px-2 py-1">CSSBuy</th>
                        <th className="px-2 py-1">status</th>
                        <th className="px-2 py-1">{t.sourceStockColQty}</th>
                        <th className="px-2 py-1" />
                      </tr>
                    </thead>
                    <tbody>
                      {oosRows.map((row: SourceStockActivityReportSampleRow) => (
                        <tr key={row.id} className="border-b align-top">
                          <td className="px-2 py-1">
                            <input type="checkbox" checked={selectedSet.has(row.id)} onChange={(e) => setSelectedOos((s) => (e.target.checked ? [...s, row.id] : s.filter((x) => x !== row.id)))} />
                          </td>
                          <td className="px-2 py-1 font-mono">{row.product_id || row.slug || '—'}</td>
                          <td className="px-2 py-1">{row.name}</td>
                          <td className="px-2 py-1">
                            <ExternalHttpLink url={row.link_default} />
                          </td>
                          <td className="px-2 py-1">
                            <ExternalHttpLink url={row.link_convert_vipomall || ''} />
                          </td>
                          <td className="px-2 py-1">
                            <ExternalHttpLink url={row.link_convert_cssbuy || ''} />
                          </td>
                          <td className="px-2 py-1 font-mono">{row.source_stock_status}</td>
                          <td className="px-2 py-1 tabular-nums">{row.available}</td>
                          <td className="px-2 py-1 whitespace-nowrap">
                            <button type="button" disabled={Boolean(oosBusy[row.id])} className="underline text-red-800 mr-2" onClick={() => setOosDeleteIds([row.id])}>
                              {t.sourceStockDeleteDb}
                            </button>
                            <button type="button" disabled={Boolean(oosBusy[row.id])} className="underline mr-2" onClick={() => void runOosAction([row.id], 'clear')}>
                              {t.sourceStockClearFlag}
                            </button>
                            <button type="button" disabled={Boolean(oosBusy[row.id])} className="underline text-emerald-800" onClick={() => void runOosAction([row.id], 'recheck')}>
                              {t.sourceStockRecheck}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {activityReport.samples_pagination.oos.total_pages > 1 ? (
                  <div className="px-3 py-2 flex gap-2 text-[11px]">
                    <button type="button" disabled={reportSamplePages.oos <= 1} onClick={() => setReportSamplePages((s) => ({ ...s, oos: s.oos - 1 }))}>
                      ←
                    </button>
                    <span>
                      {activityReport.samples_pagination.oos.page}/{activityReport.samples_pagination.oos.total_pages}
                    </span>
                    <button
                      type="button"
                      disabled={reportSamplePages.oos >= activityReport.samples_pagination.oos.total_pages}
                      onClick={() => setReportSamplePages((s) => ({ ...s, oos: s.oos + 1 }))}
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="px-3 py-2 text-[11px] text-slate-600">{t.sourceStockOosEmpty}</p>
            )}
          </details>

          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              {t.sourceStockInTable} ({activityReport.samples_pagination.in_stock.total.toLocaleString('vi-VN')})
            </summary>
            <ul className="px-3 py-2 space-y-1 text-[11px]">
              {activityReport.samples.in_stock.map((r) => (
                <li key={r.id}>
                  <span className="font-mono">{r.product_id || r.slug}</span> — {r.name} — <ExternalHttpLink url={r.link_default} />
                </li>
              ))}
              {!activityReport.samples.in_stock.length ? <li className="text-slate-500">{t.sourceStockInEmpty}</li> : null}
            </ul>
          </details>

          <details className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">
              {t.sourceStockTtlTable} ({activityReport.samples_pagination.batch_ttl_recent.total.toLocaleString('vi-VN')})
            </summary>
            <ul className="px-3 py-2 space-y-1 text-[11px]">
              {activityReport.samples.batch_ttl_recent.map((r) => (
                <li key={r.id}>
                  <span className="font-mono">{r.product_id || r.slug}</span> — {r.name} — {formatReportTimestampUtc(r.admin_source_batch_scanned_at)}
                </li>
              ))}
              {!activityReport.samples.batch_ttl_recent.length ? <li className="text-slate-500">{t.sourceStockTtlEmpty}</li> : null}
            </ul>
            {activityReport.samples_pagination.batch_ttl_recent.total_pages > 1 ? (
              <div className="px-3 py-2 flex gap-2 text-[11px]">
                <button type="button" disabled={reportSamplePages.batch_ttl_recent <= 1} onClick={() => setReportSamplePages((s) => ({ ...s, batch_ttl_recent: s.batch_ttl_recent - 1 }))}>
                  ←
                </button>
                <span>
                  {activityReport.samples_pagination.batch_ttl_recent.page}/{activityReport.samples_pagination.batch_ttl_recent.total_pages}
                </span>
                <button
                  type="button"
                  disabled={reportSamplePages.batch_ttl_recent >= activityReport.samples_pagination.batch_ttl_recent.total_pages}
                  onClick={() => setReportSamplePages((s) => ({ ...s, batch_ttl_recent: s.batch_ttl_recent + 1 }))}
                >
                  →
                </button>
              </div>
            ) : null}
          </details>
        </div>
      ) : null}

      {resetPdpConfirmOpen ? (
        <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/45 p-4" role="presentation" onClick={() => !resetPdpBusy && setResetPdpConfirmOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t.sourceStockResetTitle}</h3>
            <p className="text-sm text-slate-700 mt-3 leading-relaxed">{t.sourceStockResetBody}</p>
            <label className="block pt-3">
              <span className="text-[13px] font-medium">
                {t.sourceStockResetType} <code className="text-[12px] bg-gray-100 px-1 py-0.5 rounded">{RESET_PDP_CONFIRM_PROMPT_VI}</code>
              </span>
              <input
                type="text"
                autoComplete="off"
                value={resetPdpTypedPhrase}
                onChange={(e) => setResetPdpTypedPhrase(e.target.value)}
                disabled={resetPdpBusy}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-3 justify-end mt-6">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" disabled={resetPdpBusy} onClick={() => setResetPdpConfirmOpen(false)}>
                {t.sourceStockCancel}
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={resetPdpBusy || !resetPdpTypedPhraseMatchesConfirm(resetPdpTypedPhrase)}
                onClick={() => void runResetPdpCycle()}
              >
                {resetPdpBusy ? t.sourceStockResetting : t.sourceStockResetConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {oosDeleteIds ? (
        <div className="fixed inset-0 z-[121] flex items-center justify-center bg-black/45 p-4" onClick={() => !oosDeleting && setOosDeleteIds(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t.sourceStockDeleteTitle}</h3>
            <p className="text-sm mt-3">{t.sourceStockDeleteBody.replace('{n}', String(oosDeleteIds.length))}</p>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" disabled={oosDeleting} onClick={() => setOosDeleteIds(null)}>
                {t.sourceStockCancel}
              </button>
              <button
                type="button"
                className="rounded-lg bg-rose-700 text-white px-4 py-2 text-sm font-semibold"
                disabled={oosDeleting}
                onClick={() => {
                  setOosDeleting(true)
                  void runOosAction(oosDeleteIds, 'delete')
                }}
              >
                {oosDeleting ? t.sourceStockDeleting : t.sourceStockDeleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

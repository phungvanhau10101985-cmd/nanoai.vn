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
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

const SOURCE_STOCK_REPORT_SAMPLE_PAGE_SIZE = 40
type SourceStockSampleSet = 'oos' | 'in_stock' | 'batch_ttl'
const RESET_PDP_CONFIRM_PROMPT_VI = 'đồng ý reset tất cả'
const DELETE_CHUNK_START = 25
const DELETE_CHUNK_MIN = 1
const DELETE_CHUNK_MAX = 40
const DELETE_RETRY_MS = 12_000
const DELETE_MAX_RETRIES = 10

let sourceStockDeleteInFlight = false

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

function isGatewayOrTimeout(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /\[502\]|\[504\]|timeout|gateway/i.test(msg)
}

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
  if (!u) return <span className="text-slate-400">—</span>
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
  return `${d.toLocaleString(undefined, { timeZone: 'UTC' })} UTC`
}

type SourceStockText = Dictionary['partnerMessagingAi']

function formatReportAge(iso: string | null | undefined, t: SourceStockText): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  if (diffMs < 0) return t.sourceStockJustNow
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return minutes <= 1 ? t.sourceStockJustNow : t.sourceStockMinutesAgo.replace('{n}', String(minutes))
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t.sourceStockHoursAgo.replace('{n}', String(hours))
  return t.sourceStockDaysAgo.replace('{n}', String(Math.floor(hours / 24)))
}

function PreviewStockBranchCard({
  title,
  branch,
  t,
}: {
  title: string
  branch: { status: string; error?: string | null; checked_via?: string | null }
  t: SourceStockText
}) {
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
        {t.sourceStockStatusLabel}: <code className="text-[12px] bg-white/60 px-1 rounded">{branch.status || '—'}</code>
      </p>
      {branch.checked_via ? (
        <p className="text-[10px] mt-1">
          {t.sourceStockPlatformLabel}: <code className="bg-white/60 px-1 rounded font-mono">{branch.checked_via}</code>
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
  t,
}: {
  title: string
  subtitle: string
  tone: 'sky' | 'emerald' | 'slate'
  row: SourceStockWorkerProgressRow | null | undefined
  emptyHint: string
  mode: 'checking' | 'completed' | 'upcoming'
  t: SourceStockText
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
            <span className="font-mono tabular-nums break-all">DB #{row.product_db_id}</span>
            {row.product_code ? (
              <>
                {' · '}
                <span className="font-mono">{row.product_code}</span>
              </>
            ) : null}
          </p>
          {row.name ? <p className="line-clamp-2 text-slate-700">{row.name}</p> : null}
          <p className="break-all">
            <span className="text-slate-500">{t.sourceStockLinkLabel}: </span>
            <ExternalHttpLink url={row.link_default ?? ''} />
          </p>
          {mode === 'checking' && row.checking_started_at_utc_iso ? (
            <p className="text-slate-600">
              {t.sourceStockStartedLabel}: <span className="font-mono text-[10px]">{formatReportTimestampUtc(row.checking_started_at_utc_iso)}</span>{' '}
              <span className="text-slate-400">{formatReportAge(row.checking_started_at_utc_iso, t)}</span>
            </p>
          ) : null}
          {mode === 'completed' ? (
            <>
              {row.source_stock_status ? (
                <p>
                  {t.sourceStockStatusLabel}: <code className="text-[10px] bg-slate-100 px-1 rounded border">{row.source_stock_status}</code>
                  {row.source_stock_check_platform ? (
                    <>
                      {' '}
                      · {t.sourceStockPlatformLabel}{' '}
                      <code className="text-[10px] bg-slate-100 px-1 rounded border">{row.source_stock_check_platform}</code>
                    </>
                  ) : null}
                </p>
              ) : null}
              {row.finished_at_utc_iso ? (
                <p className="text-slate-600">
                  {t.sourceStockFinishedLabel}: <span className="font-mono text-[10px]">{formatReportTimestampUtc(row.finished_at_utc_iso)}</span>{' '}
                  <span className="text-slate-400">{formatReportAge(row.finished_at_utc_iso, t)}</span>
                </p>
              ) : null}
            </>
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

function ReportConvertedSourceLinkCell({ url, err }: { url?: string | null; err?: string | null }) {
  const e = (err ?? '').trim()
  return (
    <div className="min-w-[9rem] max-w-[20rem]">
      <ExternalHttpLink url={url ?? ''} />
      {e ? <p className="mt-1 text-[10px] text-amber-900/90 leading-snug break-words">{e}</p> : null}
    </div>
  )
}

type DeleteProgress = {
  processed: number
  total: number
  deleted: number
  chunkIndex: number
  chunkTotal: number
  chunkSize: number
  waitingRetrySec?: number
  timeoutRetryAttempt?: number
}

type SamplePagination = {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}

function SourceStockReportSampleTable({
  title,
  rows,
  emptyHint,
  defaultOpen,
  t,
  siteSlug,
  pagination,
  oos,
}: {
  title: string
  rows: SourceStockActivityReportSampleRow[]
  emptyHint: string
  defaultOpen: boolean
  t: SourceStockText
  siteSlug: string | null
  pagination?: SamplePagination
  oos?: {
    selected: string[]
    busy: Record<string, string>
    bulkBusy: boolean
    windowTotal: number
    onToggle: (id: string, next: boolean) => void
    onSelectAll: () => void
    onClear: () => void
    onDelete: (ids: string[]) => void
    onClearFlag: (ids: string[]) => void
    onRecheck: (ids: string[]) => void
    onDeleteAll: () => void
    onClearAll: () => void
    onRecheckAll: () => void
  }
}) {
  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  const selectedSet = useMemo(() => new Set(oos?.selected ?? []), [oos?.selected])
  const allDisplayedSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id))
  const someDisplayedSelected = rows.some((r) => selectedSet.has(r.id))
  const colSpan = 12 + (oos ? 2 : 0)

  useEffect(() => {
    const el = headerCheckboxRef.current
    if (!el || !oos) return
    el.indeterminate = someDisplayedSelected && !allDisplayedSelected
  }, [oos, someDisplayedSelected, allDisplayedSelected])

  return (
    <details className="rounded-lg border border-slate-200 bg-white mt-2" open={defaultOpen}>
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-slate-800 bg-slate-50/90 list-none [&::-webkit-details-marker]:hidden flex flex-wrap justify-between gap-2">
        <span>
          {title}{' '}
          <span className="font-normal text-slate-500">
            (
            {pagination
              ? fill(t.sourceStockPageOn, {
                  shown: rows.length,
                  total: pagination.total.toLocaleString('vi-VN'),
                  page: pagination.page,
                  pages: pagination.totalPages,
                })
              : rows.length}
            )
          </span>
        </span>
        <span className="text-[11px] font-normal text-indigo-700 underline">{t.sourceStockOpenClose}</span>
      </summary>
      {oos && rows.length > 0 ? (
        <div className="border-t border-slate-200 bg-slate-50/80 px-2.5 py-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-800">
            {oos.bulkBusy ? <SpinnerIcon className="text-slate-700" /> : null}
            <span>{fill(t.sourceStockSelectedOf, { selected: oos.selected.length, shown: rows.length })}</span>
            <button type="button" disabled={oos.bulkBusy} className="font-medium text-indigo-800 underline disabled:opacity-45" onClick={oos.onSelectAll}>
              {t.sourceStockSelectAll}
            </button>
            <button type="button" disabled={oos.bulkBusy || !oos.selected.length} className="font-medium text-slate-700 underline disabled:opacity-45" onClick={oos.onClear}>
              {t.sourceStockClearSel}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-semibold text-slate-600">{t.sourceStockByMarks}:</span>
            <button type="button" disabled={oos.bulkBusy || !oos.selected.length} className="rounded-md border border-red-200 bg-white px-2 py-1 font-semibold disabled:opacity-45" onClick={() => oos.onDelete(oos.selected)}>
              {t.sourceStockDeleteDb}
            </button>
            <button type="button" disabled={oos.bulkBusy || !oos.selected.length} className="rounded-md border px-2 py-1 font-semibold disabled:opacity-45" onClick={() => oos.onClearFlag(oos.selected)}>
              {t.sourceStockClearFlag}
            </button>
            <button type="button" disabled={oos.bulkBusy || !oos.selected.length} className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 font-semibold disabled:opacity-45" onClick={() => oos.onRecheck(oos.selected)}>
              {t.sourceStockRecheck}
            </button>
            <span className="mx-1 h-4 w-px bg-slate-300" aria-hidden />
            <span className="font-semibold text-slate-600">
              {t.sourceStockWindowOos}
              {oos.windowTotal > 0 ? ` (${oos.windowTotal.toLocaleString('vi-VN')})` : ''}:
            </span>
            <button type="button" disabled={oos.bulkBusy || oos.windowTotal <= 0} className="rounded-md border border-red-400 bg-red-50 px-2 py-1 font-semibold disabled:opacity-45" onClick={oos.onDeleteAll}>
              {t.sourceStockDeleteAllWindow}
            </button>
            <button type="button" disabled={oos.bulkBusy || oos.windowTotal <= 0} className="rounded-md border px-2 py-1 font-semibold disabled:opacity-45" onClick={oos.onClearAll}>
              {t.sourceStockClearAllWindow}
            </button>
            <button type="button" disabled={oos.bulkBusy || oos.windowTotal <= 0} className="rounded-md border border-emerald-400 bg-emerald-50 px-2 py-1 font-semibold disabled:opacity-45" onClick={oos.onRecheckAll}>
              {t.sourceStockRecheckAllWindow}
            </button>
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              {oos ? (
                <th className="w-9 px-1 py-1.5">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allDisplayedSelected}
                    disabled={oos.bulkBusy}
                    onChange={() => (allDisplayedSelected ? oos.onClear() : oos.onSelectAll())}
                    className="h-4 w-4 accent-indigo-700"
                  />
                </th>
              ) : null}
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColDbId}</th>
              <th className="text-left px-2 py-1.5 font-medium min-w-[12rem]">{t.sourceStockColLinkDb}</th>
              <th className="text-left px-2 py-1.5 font-medium min-w-[10rem]">{t.sourceStockColVipomall}</th>
              <th className="text-left px-2 py-1.5 font-medium min-w-[10rem]">{t.sourceStockColCssbuy}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColSku}</th>
              <th className="text-left px-2 py-1.5 font-medium min-w-[10rem]">{t.sourceStockColName}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColQty}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockStatusLabel}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColPlatform}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColChecked}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColBatch}</th>
              <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColPdp}</th>
              {oos ? <th className="text-left px-2 py-1.5 font-medium whitespace-nowrap">{t.sourceStockColActions}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-2 py-4 text-gray-500 text-center">
                  {emptyHint}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const pdp = siteSlug ? partnerSiteProductPath(siteSlug, row.id, { name: row.name }) : ''
                const busy = oos?.busy[row.id]
                return (
                  <tr key={row.id} className="border-t border-gray-200 align-top">
                    {oos ? (
                      <td className="px-1 py-1.5 text-center">
                        <input type="checkbox" checked={selectedSet.has(row.id)} disabled={oos.bulkBusy} onChange={(ev) => oos.onToggle(row.id, ev.target.checked)} className="h-4 w-4 accent-indigo-700" />
                      </td>
                    ) : null}
                    <td className="px-2 py-1.5 font-mono text-[10px] break-all max-w-[8rem]">{row.id}</td>
                    <td className="px-2 py-1.5">
                      <ExternalHttpLink url={row.link_default} />
                    </td>
                    <td className="px-2 py-1.5">
                      <ReportConvertedSourceLinkCell url={row.link_convert_vipomall} err={row.link_convert_vipomall_err} />
                    </td>
                    <td className="px-2 py-1.5">
                      <ReportConvertedSourceLinkCell url={row.link_convert_cssbuy} err={row.link_convert_cssbuy_err} />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-[11px]">{row.product_id || row.slug || '—'}</td>
                    <td className="px-2 py-1.5 max-w-[14rem]">{row.name}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{row.available}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono">{row.source_stock_status ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-mono text-[11px]">{row.source_stock_check_platform ?? '—'}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[11px]">
                      <span className="block">{formatReportTimestampUtc(row.source_stock_checked_at)}</span>
                      {formatReportAge(row.source_stock_checked_at, t) ? <span className="block text-[10px] text-slate-500">{formatReportAge(row.source_stock_checked_at, t)}</span> : null}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-[11px]">
                      <span className="block">{formatReportTimestampUtc(row.admin_source_batch_scanned_at)}</span>
                      {formatReportAge(row.admin_source_batch_scanned_at, t) ? <span className="block text-[10px] text-slate-500">{formatReportAge(row.admin_source_batch_scanned_at, t)}</span> : null}
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {pdp ? (
                        <a href={pdp} target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                          {t.sourceStockViewPdp}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    {oos ? (
                      <td className="px-2 py-1.5 min-w-[7.75rem]">
                        <div className="flex flex-col gap-1.5">
                          <button type="button" disabled={oos.bulkBusy || Boolean(busy)} className="text-[10px] font-semibold rounded border border-red-300 bg-red-50 px-2 py-1 text-left leading-tight disabled:opacity-45" onClick={() => oos.onDelete([row.id])}>
                            {t.sourceStockDeleteLine}
                            <span className="font-normal block text-[9px]">{t.sourceStockDeleteHint}</span>
                          </button>
                          <button type="button" disabled={oos.bulkBusy || Boolean(busy)} className="text-[10px] font-semibold rounded border px-2 py-1 text-left leading-tight disabled:opacity-45" onClick={() => oos.onClearFlag([row.id])}>
                            {t.sourceStockClearLine}
                            <span className="font-normal block text-[9px] text-slate-600">{t.sourceStockClearHint}</span>
                          </button>
                          <button type="button" disabled={oos.bulkBusy || Boolean(busy)} className="text-[10px] font-semibold rounded border border-emerald-400 bg-emerald-50 px-2 py-1 text-left leading-tight disabled:opacity-45" onClick={() => oos.onRecheck([row.id])}>
                            {t.sourceStockRecheckLine}
                            <span className="font-normal block text-[9px]">{t.sourceStockRecheckHint}</span>
                          </button>
                          {busy ? <span className="text-[10px] text-slate-500">{busy}</span> : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination ? (
        <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 px-3 py-2">
          <p className="text-[11px] text-slate-700">
            {pagination.total <= 0
              ? t.sourceStockInEmpty
              : fill(t.sourceStockPageFooter, {
                  page: pagination.page,
                  pages: pagination.totalPages,
                  size: pagination.pageSize,
                  total: pagination.total.toLocaleString('vi-VN'),
                })}
          </p>
          {pagination.totalPages > 1 ? (
            <div className="flex gap-2 text-[11px]">
              <button type="button" disabled={pagination.page <= 1} className="underline disabled:opacity-40" onClick={() => pagination.onPageChange(pagination.page - 1)}>
                ←
              </button>
              <button type="button" disabled={pagination.page >= pagination.totalPages} className="underline disabled:opacity-40" onClick={() => pagination.onPageChange(pagination.page + 1)}>
                →
              </button>
            </div>
          ) : null}
        </nav>
      ) : null}
    </details>
  )
}

export function PartnerSourceStockCheckCard({
  partnerId,
  siteSlug,
  t,
}: {
  partnerId: string
  siteSlug?: string | null
  t: SourceStockText
}) {
  const [domain, setDomain] = useState<SourceStockDomain>('cssbuy')
  const [queueStats, setQueueStats] = useState<SourceStockQueueStats | null>(null)
  const [queueStatsLoading, setQueueStatsLoading] = useState(true)
  const [workerState, setWorkerState] = useState<SourceStockWorkerState | null>(null)
  const [activityReport, setActivityReport] = useState<SourceStockActivityReport | null>(null)
  const [activityReportLoading, setActivityReportLoading] = useState(true)
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
  const [deleteProgress, setDeleteProgress] = useState<DeleteProgress | null>(null)
  const shopSlug = (siteSlug || '').trim() || null

  const cooldownDays = queueStats?.admin_batch_scan_cooldown_days ?? activityReport?.queue.admin_batch_scan_cooldown_days ?? 30

  const showToast = (type: 'ok' | 'err' | 'warn', msg: string) => {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 4200)
  }

  const refreshQueueStats = useCallback(async () => {
    setQueueStatsLoading(true)
    const [statsResult, workerResult] = await Promise.allSettled([
      sourceStockClient.queueStats(partnerId, domain),
      sourceStockClient.workerState(partnerId),
    ])
    const errors: string[] = []
    if (statsResult.status === 'fulfilled') setQueueStats(statsResult.value)
    else errors.push(statsResult.reason instanceof Error ? statsResult.reason.message : String(statsResult.reason))
    if (workerResult.status === 'fulfilled') setWorkerState(workerResult.value)
    else errors.push(workerResult.reason instanceof Error ? workerResult.reason.message : String(workerResult.reason))
    setLastError(errors.length ? errors.join('\n') : null)
    setQueueStatsLoading(false)
  }, [partnerId, domain])

  const waitForRecheckResults = useCallback(
    async (ids: string[]) => {
      if (!ids.length || ids.length > 10) return
      const pending = new Set(ids)
      for (let attempt = 0; attempt < 32 && pending.size; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 2800))
        const states = await Promise.all(
          [...pending].map(async (id) => {
            try {
              return await sourceStockClient.productState(partnerId, id)
            } catch {
              return null
            }
          })
        )
        states.forEach((state) => {
          if (!state) return
          const status = (state.source_stock_status || '').toLowerCase()
          if (status !== 'queued' && status !== 'checking') pending.delete(state.product_db_id)
        })
      }
    },
    [partnerId]
  )

  const refreshActivityReport = useCallback(async (sets?: SourceStockSampleSet[], quiet = false) => {
    if (!quiet) {
      setActivityReportLoading(true)
      setActivityReportError(null)
    }
    try {
      const report = await sourceStockClient.report(partnerId, {
        domain,
        oosPage: reportSamplePages.oos,
        inStockPage: reportSamplePages.in_stock,
        ttlPage: reportSamplePages.batch_ttl_recent,
        pageSize: SOURCE_STOCK_REPORT_SAMPLE_PAGE_SIZE,
        sampleSets: sets,
        includeQueue: false,
      })
      setActivityReport((prev) => {
        if (!sets || !prev) return report
        return {
          ...report,
          queue: prev.queue.total_in_scope ? prev.queue : report.queue,
          samples: {
            oos: sets.includes('oos') ? report.samples.oos : prev.samples.oos,
            in_stock: sets.includes('in_stock') ? report.samples.in_stock : prev.samples.in_stock,
            batch_ttl_recent: sets.includes('batch_ttl') ? report.samples.batch_ttl_recent : prev.samples.batch_ttl_recent,
          },
          samples_pagination: {
            ...report.samples_pagination,
            oos: sets.includes('oos') ? report.samples_pagination.oos : prev.samples_pagination.oos,
            in_stock: sets.includes('in_stock') ? report.samples_pagination.in_stock : prev.samples_pagination.in_stock,
            batch_ttl_recent: sets.includes('batch_ttl')
              ? report.samples_pagination.batch_ttl_recent
              : prev.samples_pagination.batch_ttl_recent,
          },
        }
      })
    } catch (e) {
      if (!quiet) setActivityReportError(e instanceof Error ? e.message : String(e))
    } finally {
      if (!quiet) setActivityReportLoading(false)
    }
  }, [partnerId, domain, reportSamplePages])

  useEffect(() => {
    let stop = false
    void (async () => {
      await refreshQueueStats()
      if (stop) return
      await refreshActivityReport(['oos'])
      if (stop) return
      await refreshActivityReport(['in_stock', 'batch_ttl'], true)
    })()
    return () => {
      stop = true
    }
  }, [refreshQueueStats, refreshActivityReport])

  useEffect(() => {
    const id = window.setInterval(() => void refreshQueueStats(), 90_000)
    return () => window.clearInterval(id)
  }, [refreshQueueStats])

  useEffect(() => {
    if (resetPdpConfirmOpen) setResetPdpTypedPhrase('')
  }, [resetPdpConfirmOpen])

  useEffect(() => {
    if (!resetPdpConfirmOpen) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || resetPdpBusy) return
      setResetPdpConfirmOpen(false)
      setResetPdpTypedPhrase('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [resetPdpConfirmOpen, resetPdpBusy])

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

  const runOosAction = async (ids: string[], kind: 'clear' | 'recheck') => {
    if (!ids.length) return
    const busy: Record<string, string> = {}
    for (const id of ids) busy[id] = kind
    setOosBusy((s) => ({ ...s, ...busy }))
    try {
      if (kind === 'clear') {
        await sourceStockClient.clearOosFlagBulk(partnerId, { db_ids: ids, domain })
        showToast('ok', t.sourceStockClearedOk)
      } else {
        for (const id of ids) await sourceStockClient.forceRecheck(partnerId, id)
        showToast('ok', t.sourceStockRecheckOk)
        await waitForRecheckResults(ids)
      }
      setSelectedOos([])
      await refreshActivityReport()
      await refreshQueueStats()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      setOosBusy({})
    }
  }

  const executeChunkedDelete = async (ids: string[]) => {
    if (sourceStockDeleteInFlight || !ids.length) return
    sourceStockDeleteInFlight = true
    setOosDeleting(true)
    const unique = [...new Set(ids)]
    let chunkSize = DELETE_CHUNK_START
    let cursor = 0
    let chunkIndex = 0
    let deleted = 0
    let retries = 0
    try {
      while (cursor < unique.length) {
        const chunk = unique.slice(cursor, cursor + chunkSize)
        const remaining = unique.length - cursor
        const chunkTotal = chunkIndex + Math.max(1, Math.ceil(remaining / Math.max(1, chunkSize)))
        chunkIndex += 1
        setDeleteProgress({ processed: cursor, total: unique.length, deleted, chunkIndex, chunkTotal, chunkSize })
        try {
          const res = await sourceStockClient.deleteByIds(partnerId, chunk)
          if (!res.ok) throw new Error('delete_failed')
          retries = 0
          deleted += typeof res.deleted === 'number' ? res.deleted : chunk.length
          cursor += chunk.length
          if (chunkSize < DELETE_CHUNK_MAX) chunkSize = Math.min(DELETE_CHUNK_MAX, chunkSize + 5)
          setDeleteProgress({ processed: cursor, total: unique.length, deleted, chunkIndex, chunkTotal, chunkSize })
        } catch (error) {
          if (isGatewayOrTimeout(error) && chunkSize > DELETE_CHUNK_MIN) {
            chunkSize = Math.max(DELETE_CHUNK_MIN, Math.floor(chunkSize / 2))
            chunkIndex -= 1
            continue
          }
          if (isGatewayOrTimeout(error) && retries < DELETE_MAX_RETRIES) {
            retries += 1
            chunkIndex -= 1
            const end = Date.now() + DELETE_RETRY_MS
            while (Date.now() < end) {
              const secLeft = Math.max(0, Math.ceil((end - Date.now()) / 1000))
              setDeleteProgress({
                processed: cursor,
                total: unique.length,
                deleted,
                chunkIndex: Math.max(1, chunkIndex),
                chunkTotal,
                chunkSize,
                waitingRetrySec: secLeft,
                timeoutRetryAttempt: retries,
              })
              const slice = Math.min(1000, end - Date.now())
              if (slice <= 0) break
              await new Promise((resolve) => window.setTimeout(resolve, slice))
            }
            continue
          }
          const detail = error instanceof Error ? error.message : String(error)
          throw new Error(
            fill(t.sourceStockDeletePartial, {
              done: deleted,
              total: unique.length,
              left: unique.length - cursor,
              retries,
              detail,
            })
          )
        }
      }
      showToast('ok', t.sourceStockDeletedOk.replace('{n}', String(deleted)))
      setOosDeleteIds(null)
      setSelectedOos([])
      await refreshActivityReport()
      await refreshQueueStats()
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e))
    } finally {
      sourceStockDeleteInFlight = false
      setOosDeleting(false)
      setDeleteProgress(null)
    }
  }

  const audit = workerState?.products_commit_audit
  const oosNames = useMemo(() => {
    const map = new Map<string, string>()
    for (const row of activityReport?.samples.oos ?? []) map.set(row.id, row.name)
    return map
  }, [activityReport])

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">{t.sourceStockTitle}</h2>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">{t.sourceStockIntro}</p>
        <details className="group mt-3 rounded-lg border border-border bg-muted/40 text-sm">
          <summary className="cursor-pointer list-none px-3 py-2.5 font-medium select-none">{t.sourceStockReadMore}</summary>
          <div className="px-3 pb-3 pt-0 space-y-3 text-[13px] leading-relaxed border-t">
            <p>{t.sourceStockReadMoreP1}</p>
            <p>{t.sourceStockReadMoreP2.replace('{n}', String(cooldownDays))}</p>
            <p>{t.sourceStockReadMoreP3}</p>
          </div>
        </details>
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

      <div className="flex flex-wrap items-end gap-4 gap-y-3">
        <div className="flex flex-col gap-1 min-w-[10rem]">
          <span className="text-xs font-medium text-muted-foreground">{t.sourceStockFlowLabel}</span>
          <p className="text-sm font-semibold">{t.sourceStockFlowValue}</p>
          <p className="text-[11px] text-muted-foreground max-w-[19rem] leading-snug">{t.sourceStockFlowHint}</p>
        </div>
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
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{t.sourceStockDomainHint}</p>
        </div>
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
              <span className="text-slate-500">{t.sourceStockNormalizedLabel}:</span>{' '}
              <code className="text-[10px] break-all bg-slate-100 px-1 rounded">{testLinkResult.canonical_input}</code>
              {' · '}
              <span className={`font-semibold ${testLinkResult.link_eligible ? 'text-emerald-800' : 'text-amber-800'}`}>
                {testLinkResult.link_eligible ? t.sourceStockEligible : t.sourceStockIneligible}
              </span>
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1.5 text-[10px] text-slate-600">
              {(
                [
                  ['cssbuy', t.sourceStockCoerceCssbuy, testLinkResult.coercion.cssbuy_url, testLinkResult.coercion.cssbuy_coercion_error],
                  ['vipomall', t.sourceStockCoerceVipomall, testLinkResult.coercion.vipomall_url, testLinkResult.coercion.vipomall_coercion_error],
                  ['pandamall', t.sourceStockCoercePandamall, testLinkResult.coercion.pandamall_url, testLinkResult.coercion.pandamall_coercion_error],
                ] as const
              ).map(([key, label, url, err]) => (
                <p key={key}>
                  {label} {url.trim() ? <ExternalHttpLink url={url} /> : <span className="text-slate-400">—</span>}
                  {err.trim() ? <span className="block text-amber-900/90 mt-0.5">{err}</span> : null}
                </p>
              ))}
            </div>
            <PreviewStockBranchCard title={t.sourceStockBranchCssbuy} branch={testLinkResult.cssbuy} t={t} />
            <PreviewStockBranchCard title={t.sourceStockBranchVipomall} branch={testLinkResult.vipomall ?? { status: 'skipped' }} t={t} />
            <PreviewStockBranchCard title={t.sourceStockBranchPandamall} branch={testLinkResult.pandamall ?? { status: 'skipped' }} t={t} />
            <PreviewStockBranchCard title={t.sourceStockBranchMerged} branch={testLinkResult.merged} t={t} />
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-3 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-indigo-950 uppercase tracking-wide">{t.sourceStockWorkerHeading}</p>
            {workerState ? (
              <>
                <p className="text-[11px] text-indigo-950/85 leading-snug">
                  ENV <code className="text-[10px] px-1 bg-white/80 rounded border">SOURCE_STOCK_CHECK_ENABLED</code>:{' '}
                  <strong>{workerState.env_source_stock_check_enabled ? t.sourceStockOn : t.sourceStockOff}</strong>
                  {' · '}
                  {t.sourceStockPauseFlag}: <strong>{workerState.db_paused ? t.sourceStockPauseOnDetail : t.sourceStockOff}</strong>
                  {workerState.db_pause_updated_at_utc_iso ? ` · ${formatReportTimestampUtc(workerState.db_pause_updated_at_utc_iso)}` : ''}
                  <br />
                  {t.sourceStockDaemon}: <strong>{workerState.daemon_thread_alive ? t.sourceStockRunning : t.sourceStockIdle}</strong>
                  {' · '}
                  {t.sourceStockRamLabel}: <strong className="tabular-nums">{workerState.process_in_memory_queue_depth}</strong>
                  {' · '}
                  {t.sourceStockCycleLabel} ~<strong className="tabular-nums">{workerState.check_interval_seconds}s</strong>
                </p>
                {workerState.effective_idle_reason ? (
                  <p className="text-[11px] text-amber-950 bg-amber-50/95 border border-amber-100 rounded-md px-2 py-1.5">
                    {t.sourceStockIdlePrefix}: <code className="text-[10px]">{workerState.effective_idle_reason}</code>
                    {workerState.effective_idle_hint_vi ? ` — ${workerState.effective_idle_hint_vi}` : null}
                  </p>
                ) : null}
                {audit ? (
                  <div
                    role={audit.ok === false ? 'alert' : 'status'}
                    className={`rounded-md border px-2 py-1.5 text-[11px] space-y-1 ${
                      audit.ok === false
                        ? 'border-red-200 bg-red-50 text-red-900'
                        : audit.ok === true
                          ? 'border-emerald-200 bg-emerald-50/90 text-emerald-950'
                          : 'border-amber-200 bg-amber-50/90 text-amber-950'
                    }`}
                  >
                    <p className="font-semibold">{audit.ok === false ? t.sourceStockCommitFail : audit.ok === true ? t.sourceStockCommitOk : t.sourceStockCommitUnknown}</p>
                    {audit.detail ? <p className="whitespace-pre-wrap leading-snug">{audit.detail}</p> : null}
                    {audit.at_utc_iso ? (
                      <p className="text-[10px] opacity-85">
                        {t.sourceStockCommitWhen}: <span className="font-mono">{formatReportTimestampUtc(audit.at_utc_iso)}</span>
                        {audit.product_db_id ? <span className="font-mono">{` · ${audit.product_db_id}`}</span> : null}
                      </p>
                    ) : null}
                    {audit.consistency_hint_vi ? <p className="text-[10px] leading-snug border-t border-black/5 pt-1">{audit.consistency_hint_vi}</p> : null}
                  </div>
                ) : (
                  <p className="text-[10px] text-indigo-900/70">{t.sourceStockCommitNone}</p>
                )}
                {workerState.deployment_notes_vi ? (
                  <details className="text-[10px] text-indigo-900/85">
                    <summary className="cursor-pointer underline font-medium">{t.sourceStockMultiProcess}</summary>
                    <p className="mt-1.5 leading-relaxed">{workerState.deployment_notes_vi}</p>
                  </details>
                ) : null}
              </>
            ) : (
              <p className="text-[11px]">{t.sourceStockWorkerLoading}</p>
            )}
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
          <div className="space-y-2 pt-2 mt-2 border-t border-indigo-100/80">
            <p className="text-[10px] font-semibold text-indigo-950/90 uppercase tracking-wide">{t.sourceStockProgressHeading}</p>
            <div className="grid md:grid-cols-3 gap-2">
              <WorkerStockProgressCard tone="sky" title={t.sourceStockChecking} subtitle={t.sourceStockCheckingHint} row={workerState.checking} emptyHint={t.sourceStockCheckingEmpty} mode="checking" t={t} />
              <WorkerStockProgressCard tone="emerald" title={t.sourceStockLastDone} subtitle={t.sourceStockLastDoneHint} row={workerState.last_completed} emptyHint={t.sourceStockLastDoneEmpty} mode="completed" t={t} />
              <WorkerStockProgressCard tone="slate" title={t.sourceStockUpcoming} subtitle={t.sourceStockUpcomingHint} row={workerState.next_upcoming_primary} emptyHint={t.sourceStockUpcomingEmpty} mode="upcoming" t={t} />
            </div>
            {(workerState.upcoming_candidates ?? []).length > 0 ? (
              <details className="rounded-md border border-indigo-100/80 bg-white/60 px-2 py-1.5 text-[10px]">
                <summary className="cursor-pointer font-medium underline">
                  {t.sourceStockUpcomingList.replace('{n}', String(workerState.upcoming_candidates.length))}
                </summary>
                <ol className="mt-2 list-decimal pl-4 space-y-2">
                  {workerState.upcoming_candidates.map((u) => (
                    <li key={`${u.queue_hint || 'q'}-${u.product_db_id}`} className="leading-snug">
                      <span className="font-mono break-all">#{u.product_db_id}</span>
                      {u.product_code ? <span className="font-mono">{` · ${u.product_code}`}</span> : null} — <ExternalHttpLink url={u.link_default ?? ''} />
                      {u.queue_hint_vi ? <span className="block text-[9px] text-slate-600 mt-0.5">{u.queue_hint_vi}</span> : null}
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
            {workerState.progress_notes_vi ? <p className="text-[10px] text-slate-600 leading-relaxed italic">{workerState.progress_notes_vi}</p> : null}
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
        <button type="button" disabled={queueStatsLoading || activityReportLoading} className="text-xs font-semibold text-rose-800 underline" onClick={() => setResetPdpConfirmOpen(true)}>
          {t.sourceStockResetPdp}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
        <span>{t.sourceStockTtlClassic.replace('{n}', String(cooldownDays))}</span>
        {queueStats?.admin_batch_traffic_check_gap_days != null ? <span className="text-muted-foreground">· {t.sourceStockPdpGap.replace('{n}', String(queueStats.admin_batch_traffic_check_gap_days))}</span> : null}
        {queueStats?.admin_batch_traffic_view_window_days != null ? <span className="text-muted-foreground">· {t.sourceStockPdpWindow.replace('{n}', String(queueStats.admin_batch_traffic_view_window_days))}</span> : null}
      </div>

      {queueStatsLoading && !queueStats ? <p className="text-xs text-muted-foreground">{t.sourceStockQueueLoading}</p> : null}
      {queueStats ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t.sourceStockQueueHeading}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            <MiniStat label={t.sourceStockStatTotal} value={queueStats.total_in_scope} variant="slate" />
            <MiniStat label={t.sourceStockStatEligible} value={queueStats.eligible_now} variant="emerald" />
            <MiniStat label={t.sourceStockStatTraffic} value={queueStats.eligible_with_recent_customer_view} variant="violet" />
            <MiniStat label={t.sourceStockStatCooldown} value={queueStats.in_cooldown} variant="amber" />
            <MiniStat label={t.sourceStockStatNever} value={queueStats.eligible_never_scanned} variant="slate" />
            <MiniStat label={t.sourceStockStatRescan} value={queueStats.eligible_rescan_after_ttl} variant="teal" />
            <MiniStat label={t.sourceStockStatNoPdp} value={queueStats.eligible_without_recent_customer_view} variant="slate" />
          </div>
          <details className="text-[11px] rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
            <summary className="cursor-pointer font-medium select-none">{t.sourceStockCountHow}</summary>
            <p className="mt-2 leading-relaxed text-muted-foreground">{t.sourceStockCountHowBody}</p>
          </details>
        </div>
      ) : !queueStatsLoading ? (
        <p className="text-xs text-muted-foreground">{t.sourceStockQueueMissing}</p>
      ) : null}

      <div className={`rounded-lg border px-3 py-3 ${activityReportError ? 'border-red-200 bg-red-50/70' : 'border-indigo-100 bg-indigo-50/40'}`}>
        <h3 className="text-sm font-semibold text-indigo-950 mb-2">
          {t.sourceStockReportHeading.replace('{n}', String(activityReport?.window_days ?? 30))}{' '}
          <span className="font-normal text-indigo-800/85 text-xs">{t.sourceStockReportUtc}</span>
        </h3>
        <details className="text-[11px] mb-2 rounded border border-white/70 bg-white/50 px-2 py-1.5">
          <summary className="cursor-pointer font-medium select-none">{t.sourceStockReportExplain}</summary>
          <p className="mt-2 leading-relaxed text-slate-700">{t.sourceStockReportExplainBody}</p>
        </details>
        {activityReportError ? (
          <div role="alert" className="rounded border border-red-200 bg-white px-2 py-1.5 text-xs text-red-900 mb-2 flex flex-wrap gap-2">
            <span>{activityReportError}</span>
            <button type="button" className="underline font-medium" onClick={() => void refreshActivityReport()}>
              {t.sourceStockReportRetry}
            </button>
          </div>
        ) : null}
        {activityReportLoading && !activityReport ? <p className="text-xs">{t.sourceStockReportLoading}</p> : null}
        {activityReport ? (
          <div className="space-y-3">
            <p className="text-[11px] text-slate-700">
              <span className="text-gray-500">{t.sourceStockReportFrom}</span>{' '}
              <code className="text-[10px] bg-white/95 px-1 rounded border">{activityReport.window_since_utc_iso}</code>{' '}
              {fill(t.sourceStockReportNewestNote, { n: activityReport.samples_pagination.page_size })}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2">
              <MiniStat label={t.sourceStockStatEligible} value={queueStats?.eligible_now ?? activityReport.queue.eligible_now} variant="emerald" />
              <MiniStat label={t.sourceStockCountTtl} value={activityReport.counts.batch_ttl_stamped_in_window} variant="slate" />
              <MiniStat label={t.sourceStockCountChecked} value={activityReport.counts.source_stock_checked_any_in_window} variant="slate" />
              <MiniStat label={t.sourceStockCountOos} value={activityReport.counts.source_stock_oos_signal_in_window} variant="rose" />
              <MiniStat label={t.sourceStockCountIn} value={activityReport.counts.source_stock_in_stock_signal_in_window} variant="teal" />
              <MiniStat label={t.sourceStockCountQtyPos} value={activityReport.counts.checked_available_positive_in_window} variant="emerald" />
              <MiniStat label={t.sourceStockCountQtyZero} value={activityReport.counts.checked_available_zero_or_negative_in_window} variant="amber" />
            </div>
            <p className="text-[11px] font-semibold text-slate-600">{t.sourceStockCountChecked}</p>
            <ul className="flex flex-wrap gap-1.5 text-[11px]">
              {Object.entries(activityReport.checked_in_window_by_source_stock_status)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="rounded-full bg-white/95 border border-slate-200 px-2 py-0.5 font-mono text-[10px]">
                    {k}: <strong>{v.toLocaleString('vi-VN')}</strong>
                  </li>
                ))}
              {Object.keys(activityReport.checked_in_window_by_source_stock_status).length === 0 ? <li className="text-slate-500">{t.sourceStockNoChecked}</li> : null}
            </ul>
            <SourceStockReportSampleTable
              title={t.sourceStockOosTable}
              rows={activityReport.samples.oos}
              emptyHint={t.sourceStockOosEmpty}
              defaultOpen
              t={t}
              siteSlug={shopSlug}
              pagination={{
                page: activityReport.samples_pagination.oos.page,
                totalPages: activityReport.samples_pagination.oos.total_pages,
                total: activityReport.samples_pagination.oos.total,
                pageSize: activityReport.samples_pagination.page_size,
                onPageChange: (page) => setReportSamplePages((s) => ({ ...s, oos: page })),
              }}
              oos={{
                selected: selectedOos,
                busy: oosBusy,
                bulkBusy: oosDeleting || Object.keys(oosBusy).length > 0,
                windowTotal: activityReport.samples_pagination.oos.total,
                onToggle: (id, next) => setSelectedOos((s) => (next ? [...s, id] : s.filter((x) => x !== id))),
                onSelectAll: () => setSelectedOos(oosRows.map((r) => r.id)),
                onClear: () => setSelectedOos([]),
                onDelete: (ids) => setOosDeleteIds(ids),
                onClearFlag: (ids) => void runOosAction(ids, 'clear'),
                onRecheck: (ids) => void runOosAction(ids, 'recheck'),
                onDeleteAll: () => {
                  void sourceStockClient.oosIds(partnerId, domain).then((out) => setOosDeleteIds(out.ids)).catch((e) => setLastError(e instanceof Error ? e.message : String(e)))
                },
                onClearAll: () => {
                  void sourceStockClient.oosIds(partnerId, domain).then((out) => runOosAction(out.ids, 'clear')).catch((e) => setLastError(e instanceof Error ? e.message : String(e)))
                },
                onRecheckAll: () => {
                  void sourceStockClient.oosIds(partnerId, domain).then((out) => runOosAction(out.ids, 'recheck')).catch((e) => setLastError(e instanceof Error ? e.message : String(e)))
                },
              }}
            />
            {activityReport.samples_pagination.oos.total === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950 leading-snug">
                <p className="font-semibold mb-1">{t.sourceStockOosWhyTitle}</p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>{t.sourceStockOosWhy1}</li>
                  <li>{t.sourceStockOosWhy2}</li>
                  <li>{t.sourceStockOosWhy3}</li>
                  <li>{t.sourceStockOosWhy4}</li>
                </ul>
              </div>
            ) : null}
            <SourceStockReportSampleTable
              title={t.sourceStockInTable}
              rows={activityReport.samples.in_stock}
              emptyHint={t.sourceStockInEmpty}
              defaultOpen={false}
              t={t}
              siteSlug={shopSlug}
              pagination={{
                page: activityReport.samples_pagination.in_stock.page,
                totalPages: activityReport.samples_pagination.in_stock.total_pages,
                total: activityReport.samples_pagination.in_stock.total,
                pageSize: activityReport.samples_pagination.page_size,
                onPageChange: (page) => setReportSamplePages((s) => ({ ...s, in_stock: page })),
              }}
            />
            <SourceStockReportSampleTable
              title={t.sourceStockTtlTable}
              rows={activityReport.samples.batch_ttl_recent}
              emptyHint={t.sourceStockTtlEmpty}
              defaultOpen={false}
              t={t}
              siteSlug={shopSlug}
              pagination={{
                page: activityReport.samples_pagination.batch_ttl_recent.page,
                totalPages: activityReport.samples_pagination.batch_ttl_recent.total_pages,
                total: activityReport.samples_pagination.batch_ttl_recent.total,
                pageSize: activityReport.samples_pagination.page_size,
                onPageChange: (page) => setReportSamplePages((s) => ({ ...s, batch_ttl_recent: page })),
              }}
            />
          </div>
        ) : !activityReportLoading && !activityReportError ? (
          <p className="text-xs text-slate-600">{t.sourceStockReportEmpty}</p>
        ) : null}
      </div>

      <div role="status" className="flex flex-wrap items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
        <span className="h-2 w-2 mt-1.5 rounded-full bg-emerald-500 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{t.sourceStockServerTitle}</p>
          <p className="text-xs sm:text-sm leading-snug max-w-4xl">{t.sourceStockServerBody}</p>
        </div>
      </div>

      {resetPdpConfirmOpen ? (
        <div
          className="fixed inset-0 z-[121] flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => {
            if (!resetPdpBusy) {
              setResetPdpConfirmOpen(false)
              setResetPdpTypedPhrase('')
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t.sourceStockResetTitle}</h3>
            <div className="text-sm text-slate-700 mt-3 leading-relaxed space-y-2">
              <p>{t.sourceStockResetP1.replace('{domain}', domain)}</p>
              <p className="text-amber-900 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5 text-[13px]">{t.sourceStockResetP2}</p>
              <p className="text-xs text-slate-500">{t.sourceStockResetP3}</p>
              <label className="block pt-1">
                <span className="text-[13px] font-medium">
                  {t.sourceStockResetType} <code className="text-[12px] bg-gray-100 px-1 py-0.5 rounded">{RESET_PDP_CONFIRM_PROMPT_VI}</code> {t.sourceStockResetPhraseNote}
                </span>
                <input
                  type="text"
                  autoComplete="off"
                  value={resetPdpTypedPhrase}
                  onChange={(e) => setResetPdpTypedPhrase(e.target.value)}
                  disabled={resetPdpBusy}
                  placeholder={RESET_PDP_CONFIRM_PROMPT_VI}
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 justify-end mt-6">
              <button
                type="button"
                className="rounded-lg border px-4 py-2 text-sm"
                disabled={resetPdpBusy}
                onClick={() => {
                  setResetPdpConfirmOpen(false)
                  setResetPdpTypedPhrase('')
                }}
              >
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{t.sourceStockDeleteTitle.replace('{n}', oosDeleteIds.length.toLocaleString('vi-VN'))}</h3>
            <div className="text-sm text-slate-700 mt-3 leading-relaxed space-y-2">
              <p>{t.sourceStockDeleteBody}</p>
              {!oosDeleting ? (
                <ul className="mt-2 max-h-48 overflow-auto border rounded-lg divide-y text-[13px]">
                  {oosDeleteIds.slice(0, 18).map((id) => (
                    <li key={id} className="px-3 py-2 flex flex-col gap-0.5">
                      <span className="font-mono text-xs break-all">{id}</span>
                      <span className="line-clamp-2">{oosNames.get(id) ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {oosDeleteIds.length > 18 && !oosDeleting ? <p className="text-xs text-slate-500">{t.sourceStockDeleteAndMore.replace('{n}', String(oosDeleteIds.length - 18))}</p> : null}
              {oosDeleting && deleteProgress ? (
                <div className="mt-3 rounded-lg border border-red-100 bg-red-50/80 px-3 py-3 space-y-2" role="status">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-red-950">
                    <span className="font-medium">{deleteProgress.waitingRetrySec ? t.sourceStockDeleteWaiting : t.sourceStockDeleteRunning}</span>
                    <span className="tabular-nums">
                      {deleteProgress.processed.toLocaleString('vi-VN')} / {deleteProgress.total.toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-red-100 overflow-hidden" aria-hidden>
                    <div
                      className="h-full rounded-full bg-red-600 transition-[width]"
                      style={{ width: `${Math.min(100, deleteProgress.total > 0 ? (deleteProgress.processed / deleteProgress.total) * 100 : 0)}%` }}
                    />
                  </div>
                  {deleteProgress.waitingRetrySec ? (
                    <p className="text-xs text-amber-900">
                      {fill(t.sourceStockDeleteRetryNote, {
                        sec: deleteProgress.waitingRetrySec,
                        attempt: deleteProgress.timeoutRetryAttempt ?? 1,
                        deleted: deleteProgress.deleted.toLocaleString('vi-VN'),
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-red-900">
                      {fill(t.sourceStockDeleteChunkNote, {
                        deleted: deleteProgress.deleted.toLocaleString('vi-VN'),
                        index: deleteProgress.chunkIndex,
                        total: deleteProgress.chunkTotal,
                        size: deleteProgress.chunkSize,
                      })}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" disabled={oosDeleting} onClick={() => setOosDeleteIds(null)}>
                {t.sourceStockCancel}
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-700 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50"
                disabled={oosDeleting}
                onClick={() => {
                  if (sourceStockDeleteInFlight) return
                  void executeChunkedDelete(oosDeleteIds)
                }}
              >
                {oosDeleting && deleteProgress?.waitingRetrySec
                  ? `${deleteProgress.waitingRetrySec}s…`
                  : oosDeleting && deleteProgress
                    ? `${Math.round((deleteProgress.processed / Math.max(1, deleteProgress.total)) * 100)}%…`
                    : oosDeleting
                      ? t.sourceStockDeleting
                      : t.sourceStockDeleteConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

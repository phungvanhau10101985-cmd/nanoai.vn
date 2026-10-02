'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchMyMessagingAdSpendReport,
  fetchMyMessagingAdSpendSettings,
  saveMyMessagingAdSpendSettings,
} from '@/app/dashboard/messaging/actions'
import { PartnerOrderProfitSection, type AdSpendProfitSummary } from '@/app/dashboard/messaging/partner-order-profit-section'
import type { PartnerAdSpendSettingsView } from '@/lib/db/messaging-partner-ad-spend-pg'
import { adSpendPageCopy, fillCopy, type AdSpendPageCopy } from '@/lib/messaging/ad-spend/partner-ad-spend-copy'
import type { AdSpendPlatformReport, AdSpendReport } from '@/lib/messaging/ad-spend/partner-ad-spend'
import type { WebLocale } from '@/lib/i18n/config'
import { SettingsDataRoleBox, SettingsDataRoleLegend } from '@/components/messaging/settings-data-role'

type RangeKey = 'today' | 'yesterday' | 'week' | 'prevWeek' | '7' | '30' | 'month' | 'prev'
type AdSpendState = 'loading' | 'ready' | 'unavailable'

const PRESET_KEYS: RangeKey[] = ['today', 'yesterday', 'week', 'prevWeek', '7', '30', 'month', 'prev']
const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

type Props = {
  partnerId: string
  locale?: WebLocale
}

function isoTodayVn(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

function dateFromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const weekday = copy.getDay()
  const diff = weekday === 0 ? 6 : weekday - 1
  copy.setDate(copy.getDate() - diff)
  return copy
}

function rangeFor(key: RangeKey): { from: string; to: string } {
  const today = dateFromIso(isoTodayVn())
  const to = isoDate(today)
  if (key === 'today') return { from: to, to }
  if (key === 'yesterday') {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    const yesterday = isoDate(day)
    return { from: yesterday, to: yesterday }
  }
  if (key === 'week') return { from: isoDate(startOfWeek(today)), to }
  if (key === 'prevWeek') {
    const start = startOfWeek(today)
    start.setDate(start.getDate() - 7)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    return { from: isoDate(start), to: isoDate(end) }
  }
  if (key === '7') {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { from: isoDate(start), to }
  }
  if (key === '30') {
    const start = new Date(today)
    start.setDate(start.getDate() - 29)
    return { from: isoDate(start), to }
  }
  if (key === 'prev') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 0)
    return { from: isoDate(start), to: isoDate(end) }
  }
  return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to }
}

function matchPreset(from: string, to: string): RangeKey | null {
  for (const key of PRESET_KEYS) {
    const range = rangeFor(key)
    if (range.from === from && range.to === to) return key
  }
  return null
}

function formatViDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

function eachDate(from: string, to: string): string[] {
  if (!from || !to || from > to) return []
  const out: string[] = []
  const cursor = dateFromIso(from)
  const end = dateFromIso(to)
  while (cursor <= end && out.length < 62) {
    out.push(isoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
    Math.round(amount),
  )
}

function formatMoney(amount: number, currency: string | null): string {
  const code = (currency || '').toUpperCase()
  if (code === 'VND') return formatVnd(amount)
  if (code) {
    try {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: code }).format(amount)
    } catch {
      return `${amount.toLocaleString('vi-VN')} ${code}`
    }
  }
  return amount.toLocaleString('vi-VN')
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n || 0)
}

function sameSummary(prev: AdSpendProfitSummary, next: AdSpendProfitSummary): boolean {
  return (
    prev.dateFrom === next.dateFrom &&
    prev.dateTo === next.dateTo &&
    prev.loading === next.loading &&
    prev.orderCount === next.orderCount &&
    prev.revenue === next.revenue &&
    prev.revenueCny === next.revenueCny &&
    prev.returnedCount === next.returnedCount &&
    prev.uncollected === next.uncollected &&
    prev.cost === next.cost &&
    prev.missing === next.missing &&
    prev.gross === next.gross &&
    prev.profit === next.profit
  )
}

function sumDaily(days: AdSpendPlatformReport['daily'], from: string, to: string) {
  let spend = 0
  let clicks = 0
  let impressions = 0
  for (const row of days) {
    if (row.date >= from && row.date <= to) {
      spend += row.spend
      clicks += row.clicks
      impressions += row.impressions
    }
  }
  return { spend, clicks, impressions }
}

type Slice = {
  amount: number | null
  clicks: number
  impressions: number
  currency: string | null
  configured: boolean
  ok: boolean
}

function platformSlice(report: AdSpendPlatformReport, from: string, to: string, full: boolean): Slice {
  if (!report.configured || !report.ok) {
    return { amount: null, clicks: 0, impressions: 0, currency: report.currency, configured: report.configured, ok: report.ok }
  }
  if (full) {
    return { amount: report.spend, clicks: report.clicks, impressions: report.impressions, currency: report.currency, configured: true, ok: true }
  }
  const summed = sumDaily(report.daily, from, to)
  return { amount: summed.spend, clicks: summed.clicks, impressions: summed.impressions, currency: report.currency, configured: true, ok: true }
}

export function PartnerOrderProfitPanel({ partnerId, locale = 'vi' }: Props) {
  const copy = adSpendPageCopy(locale)
  const initial = rangeFor('30')
  const [settings, setSettings] = useState<PartnerAdSpendSettingsView | null>(null)
  const [report, setReport] = useState<AdSpendReport | null>(null)
  const [periodFrom, setPeriodFrom] = useState(initial.from)
  const [periodTo, setPeriodTo] = useState(initial.to)
  const [focusFrom, setFocusFrom] = useState(initial.from)
  const [focusTo, setFocusTo] = useState(initial.to)
  const [draftFrom, setDraftFrom] = useState(initial.from)
  const [draftTo, setDraftTo] = useState(initial.to)
  const [chosenPreset, setChosenPreset] = useState<RangeKey | null>('30')
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [profitSummary, setProfitSummary] = useState<AdSpendProfitSummary | null>(null)
  const [googleCustomerId, setGoogleCustomerId] = useState('')
  const [googleLoginCustomerId, setGoogleLoginCustomerId] = useState('')
  const [googleDeveloperToken, setGoogleDeveloperToken] = useState('')
  const [googleClientId, setGoogleClientId] = useState('')
  const [googleClientSecret, setGoogleClientSecret] = useState('')
  const [googleRefreshToken, setGoogleRefreshToken] = useState('')
  const [clearGoogle, setClearGoogle] = useState(false)
  const [metaAccountId, setMetaAccountId] = useState('')
  const [metaToken, setMetaToken] = useState('')
  const [clearMeta, setClearMeta] = useState(false)
  const reportSeq = useRef(0)
  const selectedChipRef = useRef<HTMLButtonElement | null>(null)

  const applySettingsForm = (data: PartnerAdSpendSettingsView) => {
    setGoogleCustomerId(data.googleCustomerId || '')
    setGoogleLoginCustomerId(data.googleLoginCustomerId || '')
    setMetaAccountId(data.metaAdAccountId || '')
    setGoogleDeveloperToken('')
    setGoogleClientId('')
    setGoogleClientSecret('')
    setGoogleRefreshToken('')
    setMetaToken('')
    setClearGoogle(false)
    setClearMeta(false)
  }

  const loadReport = useCallback(async (from: string, to: string) => {
    const seq = ++reportSeq.current
    setLoadingReport(true)
    setError(null)
    const res = await fetchMyMessagingAdSpendReport({ partnerId, dateFrom: from, dateTo: to })
    if (seq !== reportSeq.current) return
    if ('error' in res) setError(res.error)
    else setReport(res.report)
    setLoadingReport(false)
  }, [partnerId])

  const onProfitSummary = useCallback((next: AdSpendProfitSummary) => {
    setProfitSummary((prev) => (prev && sameSummary(prev, next) ? prev : next))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingSettings(true)
    void fetchMyMessagingAdSpendSettings({ partnerId }).then((res) => {
      if (cancelled) return
      if ('error' in res) {
        setError(res.error)
        setSettings(null)
      } else {
        setSettings(res.settings)
        applySettingsForm(res.settings)
        if (!res.settings.googleConfigured && !res.settings.facebookConfigured) setShowSettings(true)
      }
      setLoadingSettings(false)
    })
    return () => {
      cancelled = true
    }
  }, [partnerId])

  useEffect(() => {
    if (!settings) return
    if (!settings.googleConfigured && !settings.facebookConfigured) return
    void loadReport(periodFrom, periodTo)
    // Chỉ tải khi khóa đã đủ. Đổi kỳ đi qua nút.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.googleConfigured, settings?.facebookConfigured, partnerId])

  const applyPeriod = (from: string, to: string, preset: RangeKey | null) => {
    setChosenPreset(preset)
    setDraftFrom(from)
    setDraftTo(to)
    setPeriodFrom(from)
    setPeriodTo(to)
    setFocusFrom(from)
    setFocusTo(to)
    if (settings?.googleConfigured || settings?.facebookConfigured) void loadReport(from, to)
  }

  const showWholePeriod = () => {
    if (focusFrom === periodFrom && focusTo === periodTo) return
    setFocusFrom(periodFrom)
    setFocusTo(periodTo)
  }

  const focusDay = (iso: string) => {
    const already = focusFrom === iso && focusTo === iso
    setFocusFrom(already ? periodFrom : iso)
    setFocusTo(already ? periodTo : iso)
  }

  const onSaveKeys = async (event: FormEvent) => {
    event.preventDefault()
    setSavingKeys(true)
    setError(null)
    const res = await saveMyMessagingAdSpendSettings({
      partnerId,
      googleCustomerId,
      googleLoginCustomerId,
      metaAdAccountId: metaAccountId,
      ...(googleDeveloperToken.trim() ? { googleDeveloperToken: googleDeveloperToken.trim() } : {}),
      ...(googleClientId.trim() ? { googleClientId: googleClientId.trim() } : {}),
      ...(googleClientSecret.trim() ? { googleClientSecret: googleClientSecret.trim() } : {}),
      ...(googleRefreshToken.trim() ? { googleRefreshToken: googleRefreshToken.trim() } : {}),
      ...(metaToken.trim() ? { metaAccessToken: metaToken.trim() } : {}),
      ...(clearGoogle ? { clearGoogleSecrets: true } : {}),
      ...(clearMeta ? { clearMetaSecrets: true } : {}),
    })
    setSavingKeys(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    setSettings(res.settings)
    applySettingsForm(res.settings)
    setToast(copy.savedToast)
    window.setTimeout(() => setToast(null), 4000)
    if (res.settings.googleConfigured || res.settings.facebookConfigured) void loadReport(periodFrom, periodTo)
    else setReport(null)
  }

  const adsConfigured = Boolean(settings?.googleConfigured || settings?.facebookConfigured)
  const periodReport = report && report.dateFrom === periodFrom && report.dateTo === periodTo ? report : null
  const spendLoading = loadingReport || (adsConfigured && !periodReport && !error)
  const periodDays = useMemo(() => eachDate(periodFrom, periodTo), [periodFrom, periodTo])
  const dayFocused = focusFrom === focusTo && (focusFrom !== periodFrom || focusTo !== periodTo)
  const spanMonths = periodFrom.slice(0, 7) !== periodTo.slice(0, 7)

  const focusSpend = useMemo(() => {
    if (!periodReport) return null
    const full = focusFrom === periodReport.dateFrom && focusTo === periodReport.dateTo
    const google = platformSlice(periodReport.google, focusFrom, focusTo, full)
    const facebook = platformSlice(periodReport.facebook, focusFrom, focusTo, full)
    let total: number | null = null
    let currency: string | null = null
    let status: AdSpendReport['totalStatus'] = 'incomplete'
    if (full) {
      total = periodReport.totalStatus === 'ok' ? periodReport.totalSpend : null
      currency = periodReport.totalCurrency
      status = periodReport.totalStatus
    } else if (google.ok && facebook.ok && google.amount != null && facebook.amount != null) {
      if (google.currency && facebook.currency && google.currency !== facebook.currency) status = 'mixed_currency'
      else {
        currency = google.currency || facebook.currency
        total = google.amount + facebook.amount
        status = 'ok'
      }
    } else if (google.ok && google.amount != null && !periodReport.facebook.configured) {
      total = google.amount
      currency = google.currency
      status = 'ok'
    } else if (facebook.ok && facebook.amount != null && !periodReport.google.configured) {
      total = facebook.amount
      currency = facebook.currency
      status = 'ok'
    }
    return { google, facebook, total, currency, status }
  }, [periodReport, focusFrom, focusTo])

  const focusTotalVnd =
    focusSpend && focusSpend.status === 'ok' && (focusSpend.currency || '').toUpperCase() === 'VND' ? focusSpend.total : null
  const adSpendState: AdSpendState = !settings || loadingSettings
    ? 'loading'
    : !adsConfigured
      ? 'unavailable'
      : spendLoading
        ? 'loading'
        : focusTotalVnd != null
          ? 'ready'
          : 'unavailable'

  const dailyRows = useMemo(() => {
    if (!periodReport) return []
    const map = new Map<string, { google?: number; facebook?: number }>()
    for (const row of periodReport.google.daily) map.set(row.date, { ...(map.get(row.date) || {}), google: row.spend })
    for (const row of periodReport.facebook.daily) map.set(row.date, { ...(map.get(row.date) || {}), facebook: row.spend })
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([date, values]) => ({ date, ...values }))
  }, [periodReport])

  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [focusFrom, focusTo, periodFrom, periodTo])

  const presetLabel = chosenPreset ? copy.presets[chosenPreset] : null
  const focusCaption = focusFrom === focusTo ? formatViDate(focusFrom) : `${formatViDate(focusFrom)} → ${formatViDate(focusTo)}`
  const viewingLabel = dayFocused ? focusCaption : presetLabel ? `${presetLabel} · ${focusCaption}` : focusCaption
  const profitForFocus =
    profitSummary && profitSummary.dateFrom === focusFrom && profitSummary.dateTo === focusTo ? profitSummary : null
  const profitLoading = !profitForFocus || profitForFocus.loading
  const profitText = profitLoading
    ? copy.calculating
    : profitForFocus.profit == null
      ? copy.dash
      : formatVnd(profitForFocus.profit)
  const profitNegative = !profitLoading && profitForFocus.profit != null && profitForFocus.profit < 0
  const profitHint = profitLoading
    ? copy.depositedHint
    : profitForFocus.missing
      ? fillCopy(copy.missingCost, { n: profitForFocus.missing })
      : profitForFocus.gross != null
        ? fillCopy(copy.grossBeforeAds, { n: profitForFocus.orderCount, amount: formatVnd(profitForFocus.gross) })
        : fillCopy(copy.orders, { n: profitForFocus.orderCount })
  const totalText = spendLoading
    ? copy.reading
    : !focusSpend
      ? copy.dash
      : focusSpend.status === 'mixed_currency'
        ? copy.mixedCurrency
        : focusSpend.status === 'ok' && focusSpend.total != null
          ? formatMoney(focusSpend.total, focusSpend.currency)
          : copy.dash

  const presetClass = (key: RangeKey) => {
    const selected = chosenPreset === key
    if (selected && !dayFocused) return 'border-[#ea580c] bg-[#ea580c] font-semibold text-white shadow-sm'
    if (selected) return 'border-[#ea580c] bg-orange-50 font-semibold text-[#ea580c]'
    return 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#ea580c] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  }
  const chipClass = (active: boolean) =>
    active
      ? 'border-[#ea580c] bg-[#ea580c] font-bold text-white shadow-sm'
      : 'border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-[#ea580c] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'

  return (
    <div className="mx-auto max-w-6xl">
      <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-50">{copy.title}</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-zinc-300">{copy.intro}</p>

      {error ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}{' '}
          <button type="button" className="font-medium underline" onClick={() => void loadReport(periodFrom, periodTo)}>
            {copy.retry}
          </button>
        </div>
      ) : null}
      {toast ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{toast}</div> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!draftFrom || !draftTo || draftFrom > draftTo) {
            setError(copy.badRange)
            return
          }
          applyPeriod(draftFrom, draftTo, matchPreset(draftFrom, draftTo))
        }}
        className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:p-4"
      >
        <div className="flex flex-wrap gap-2" role="group" aria-label={copy.viewing}>
          {PRESET_KEYS.map((key) => (
            <button key={key} type="button" aria-pressed={chosenPreset === key} onClick={() => applyPeriod(rangeFor(key).from, rangeFor(key).to, key)} className={`rounded-full border px-3 py-1.5 text-sm transition ${presetClass(key)}`}>
              {copy.presets[key]}
            </button>
          ))}
        </div>
        {periodDays.length > 1 ? (
          <div className="mt-3">
            <p className="text-xs font-medium text-slate-500">{copy.eachDay}</p>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
              <button type="button" ref={dayFocused ? undefined : selectedChipRef} aria-pressed={!dayFocused} onClick={showWholePeriod} className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${chipClass(!dayFocused)}`}>
                {copy.wholePeriod}
              </button>
              {periodDays.map((iso) => {
                const date = dateFromIso(iso)
                const active = focusFrom === iso && focusTo === iso
                return (
                  <button key={iso} type="button" ref={active ? selectedChipRef : undefined} aria-pressed={active} onClick={() => focusDay(iso)} className={`flex min-w-[3.1rem] shrink-0 flex-col items-center rounded-xl border px-2 py-1.5 ${chipClass(active)}`}>
                    <span className={`text-[10px] font-medium ${active ? 'text-orange-100' : 'text-slate-400'}`}>{WEEKDAYS[date.getDay()]}</span>
                    <span className="text-sm leading-tight">{spanMonths ? `${date.getDate()}/${date.getMonth() + 1}` : date.getDate()}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 dark:border-zinc-800">
          <label className="text-sm text-slate-700 dark:text-zinc-200">
            {copy.from}
            <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" />
          </label>
          <label className="text-sm text-slate-700 dark:text-zinc-200">
            {copy.to}
            <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 dark:border-zinc-600 dark:bg-zinc-950" />
          </label>
          <button type="submit" disabled={loadingReport || loadingSettings} className="rounded-lg bg-[#ea580c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#c2410c] disabled:opacity-60">
            {loadingReport ? copy.reading : copy.viewPeriod}
          </button>
        </div>
      </form>

      <section className="mt-4 overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm dark:bg-zinc-900" aria-label={copy.viewing}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 bg-orange-50 px-4 py-3 dark:border-orange-900/40 dark:bg-orange-950/30">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ea580c]">{copy.viewing}</p>
            <p className="text-base font-bold text-slate-900 dark:text-zinc-50">{viewingLabel}</p>
          </div>
          {dayFocused ? (
            <button type="button" onClick={showWholePeriod} className="rounded-lg border border-[#ea580c] bg-white px-3 py-1.5 text-sm font-semibold text-[#ea580c] hover:bg-orange-50">
              {copy.wholePeriod}
            </button>
          ) : null}
        </div>
        <div className="grid gap-px bg-orange-100 sm:grid-cols-2 dark:bg-orange-950/40">
          <HeroStat label={copy.adSpend} value={totalText} hint={focusSpend?.status === 'mixed_currency' ? copy.mixedCurrency : copy.googlePlusFacebook} />
          <HeroStat label={copy.profit} value={profitText} hint={profitHint} negative={profitNegative} />
        </div>
        <div className="grid grid-cols-2 gap-px border-t border-orange-100 bg-orange-100 lg:grid-cols-4 dark:border-orange-900/40 dark:bg-orange-950/40">
          <MiniStat label={copy.google} value={platformText(copy, focusSpend?.google, spendLoading && adsConfigured)} hint={platformHint(copy, focusSpend?.google)} />
          <MiniStat label={copy.facebook} value={platformText(copy, focusSpend?.facebook, spendLoading && adsConfigured)} hint={platformHint(copy, focusSpend?.facebook)} />
          <MiniStat
            label={copy.revenue}
            value={profitLoading ? copy.calculating : formatVnd(profitForFocus?.revenue ?? 0)}
            hint={
              profitLoading
                ? undefined
                : profitForFocus?.returnedCount
                  ? fillCopy(copy.returnedRevenue, {
                      n: profitForFocus.orderCount,
                      amount: formatVnd(profitForFocus.uncollected),
                      returned: profitForFocus.returnedCount,
                    })
                  : fillCopy(copy.orders, { n: profitForFocus?.orderCount ?? 0 })
            }
          />
          <MiniStat
            label={copy.cost}
            value={profitLoading ? copy.calculating : profitForFocus?.cost == null ? copy.dash : formatVnd(profitForFocus.cost)}
            hint={profitForFocus?.missing ? copy.missingCostShort : copy.costHint}
          />
        </div>
      </section>

      {periodReport ? (
        <div className="mt-4 space-y-3">
          {periodReport.google.partial || periodReport.facebook.partial ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{copy.partial}</div> : null}
          {periodReport.google.configured && !periodReport.google.ok && periodReport.google.error ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{copy.google}: {periodReport.google.error}</div> : null}
          {periodReport.facebook.configured && !periodReport.facebook.ok && periodReport.facebook.error ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{copy.facebook}: {periodReport.facebook.error}</div> : null}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-zinc-100">{copy.dailyTitle}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{copy.dailyHint}</p>
            </div>
            {dailyRows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{copy.noSpend}</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500 dark:bg-zinc-950">
                    <tr>
                      <th className="px-4 py-2 font-medium">{copy.day}</th>
                      <th className="px-4 py-2 font-medium">{copy.google}</th>
                      <th className="px-4 py-2 font-medium">{copy.facebook}</th>
                      <th className="px-4 py-2 font-medium">{copy.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyRows.map((row) => {
                      const selected = focusFrom === row.date && focusTo === row.date
                      const moneyClass = selected ? 'font-bold text-[#ea580c]' : 'text-slate-800 dark:text-zinc-100'
                      return (
                        <tr key={row.date} role="button" tabIndex={0} aria-pressed={selected} onClick={() => focusDay(row.date)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); focusDay(row.date) } }} className={`cursor-pointer border-t border-slate-100 dark:border-zinc-800 ${selected ? 'bg-orange-50 dark:bg-orange-950/30' : 'hover:bg-orange-50/60'}`}>
                          <td className={`px-4 py-2 whitespace-nowrap ${selected ? 'font-bold text-[#ea580c]' : ''}`}>{WEEKDAYS[dateFromIso(row.date).getDay()]} {formatViDate(row.date)}</td>
                          <td className={`px-4 py-2 whitespace-nowrap ${moneyClass}`}>{row.google != null ? formatMoney(row.google, periodReport.google.currency) : copy.dash}</td>
                          <td className={`px-4 py-2 whitespace-nowrap ${moneyClass}`}>{row.facebook != null ? formatMoney(row.facebook, periodReport.facebook.currency) : copy.dash}</td>
                          <td className={`px-4 py-2 whitespace-nowrap ${moneyClass}`}>{dayTotal(row.google, row.facebook, periodReport, copy)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <CampaignTable title={copy.google} report={periodReport.google} copy={copy} />
            <CampaignTable title={copy.facebook} report={periodReport.facebook} copy={copy} />
          </div>
        </div>
      ) : spendLoading ? <p className="mt-4 text-sm text-slate-500">{copy.reading}</p> : null}

      <div className="mt-6">
        <PartnerOrderProfitSection
          partnerId={partnerId}
          locale={locale}
          dateFrom={focusFrom}
          dateTo={focusTo}
          refreshKey={0}
          adSpend={focusTotalVnd}
          adSpendState={adSpendState}
          onSummaryChange={onProfitSummary}
        />
      </div>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-slate-800 dark:text-zinc-100" aria-expanded={showSettings} onClick={() => setShowSettings((value) => !value)}>
          {copy.keysTitle}
          <span className="text-slate-400">{showSettings ? copy.close : copy.open}</span>
        </button>
        {showSettings && settings ? (
          <form onSubmit={onSaveKeys} className="space-y-6 border-t border-slate-100 px-4 py-4 dark:border-zinc-800">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-50">{copy.guideTitle}</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-slate-600 dark:text-zinc-300">
                {copy.googleSteps.map((step, index) => <li key={`google-${index}`}><span className="font-medium text-slate-800 dark:text-zinc-100">{copy.googleTitle}.</span> {step}</li>)}
                {copy.facebookSteps.map((step, index) => <li key={`facebook-${index}`}><span className="font-medium text-slate-800 dark:text-zinc-100">{copy.facebookTitle}.</span> {step}</li>)}
              </ol>
            </div>
            <SettingsDataRoleLegend copy={copy.role} />
            <SettingsDataRoleBox role="inbound" copy={copy.role}>
              <h3 className="text-sm font-semibold">{copy.googleTitle}</h3>
              <p className="text-xs">{fillCopy(copy.googleLead, { version: settings.googleAdsApiVersion })}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label={copy.customerId} value={googleCustomerId} onChange={setGoogleCustomerId} />
                <TextField label={copy.mcc} value={googleLoginCustomerId} onChange={setGoogleLoginCustomerId} />
                <TextField label={copy.developerToken} value={googleDeveloperToken} onChange={setGoogleDeveloperToken} secret placeholder={settings.googleDeveloperTokenSet ? copy.savedKeep : copy.missingSecret} />
                <TextField label={copy.clientId} value={googleClientId} onChange={setGoogleClientId} placeholder={settings.googleClientIdSet ? copy.savedKeep : copy.missingSecret} />
                <TextField label={copy.clientSecret} value={googleClientSecret} onChange={setGoogleClientSecret} secret placeholder={settings.googleClientSecretSet ? copy.savedKeep : copy.missingSecret} />
                <TextField label={copy.refreshToken} value={googleRefreshToken} onChange={setGoogleRefreshToken} secret placeholder={settings.googleRefreshTokenSet ? copy.savedKeep : copy.missingSecret} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={clearGoogle} onChange={(e) => setClearGoogle(e.target.checked)} />
                {copy.clearGoogle}
              </label>
            </SettingsDataRoleBox>
            <SettingsDataRoleBox role="inbound" copy={copy.role}>
              <h3 className="text-sm font-semibold">{copy.facebookTitle}</h3>
              <p className="text-xs">{fillCopy(copy.facebookLead, { version: settings.metaGraphApiVersion })}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label={copy.adAccountId} value={metaAccountId} onChange={setMetaAccountId} />
                <TextField label={copy.accessToken} value={metaToken} onChange={setMetaToken} secret placeholder={settings.metaAccessTokenSet ? copy.savedKeep : copy.missingSecret} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={clearMeta} onChange={(e) => setClearMeta(e.target.checked)} />
                {copy.clearFacebook}
              </label>
            </SettingsDataRoleBox>
            <button type="submit" disabled={savingKeys} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60">
              {savingKeys ? copy.saving : copy.saveKeys}
            </button>
          </form>
        ) : null}
      </section>
    </div>
  )
}

function platformText(copy: AdSpendPageCopy, slice: Slice | null | undefined, loading: boolean): string {
  if (loading) return copy.reading
  if (!slice) return copy.notConfigured
  if (!slice.configured) return copy.notConfigured
  if (!slice.ok || slice.amount == null) return copy.unreadable
  return formatMoney(slice.amount, slice.currency)
}

function platformHint(copy: AdSpendPageCopy, slice: Slice | null | undefined): string | undefined {
  if (!slice?.ok || slice.amount == null) return undefined
  return fillCopy(copy.clicksImpressions, { clicks: formatCount(slice.clicks), impressions: formatCount(slice.impressions) })
}

function dayTotal(google: number | undefined, facebook: number | undefined, source: AdSpendReport, copy: AdSpendPageCopy): string {
  if (google == null && facebook == null) return copy.dash
  const googleCurrency = source.google.currency
  const facebookCurrency = source.facebook.currency
  if (google != null && facebook != null && googleCurrency && facebookCurrency && googleCurrency !== facebookCurrency) return copy.dash
  return formatMoney((google ?? 0) + (facebook ?? 0), google != null ? googleCurrency : facebookCurrency)
}

function HeroStat({ label, value, hint, negative }: { label: string; value: string; hint: string; negative?: boolean }) {
  return (
    <div className="bg-white px-4 py-4 dark:bg-zinc-900">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums sm:text-3xl ${negative ? 'text-red-600' : 'text-[#ea580c]'}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  )
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-zinc-900">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums text-[#ea580c]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}

function TextField({ label, value, onChange, secret, placeholder }: { label: string; value: string; onChange: (value: string) => void; secret?: boolean; placeholder?: string }) {
  return (
    <label className="block text-sm">
      {label}
      <input type={secret ? 'password' : 'text'} autoComplete="new-password" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-emerald-600 bg-white px-3 py-2 text-emerald-950 dark:bg-zinc-950 dark:text-emerald-100" />
    </label>
  )
}

function CampaignTable({ title, report, copy }: { title: string; report: AdSpendPlatformReport; copy: AdSpendPageCopy }) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:border-zinc-800 dark:text-zinc-100">{title}</h3>
      {!report.configured ? <p className="px-4 py-6 text-sm text-slate-500">{copy.notConfigured}</p> : report.campaigns.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{copy.noCampaigns}</p> : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-2 font-medium">{copy.campaign}</th>
                <th className="px-4 py-2 font-medium">{copy.adSpend}</th>
                <th className="px-4 py-2 font-medium">{copy.clicks}</th>
              </tr>
            </thead>
            <tbody>
              {report.campaigns.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{row.name}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatMoney(row.spend, report.currency)}</td>
                  <td className="px-4 py-2">{formatCount(row.clicks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

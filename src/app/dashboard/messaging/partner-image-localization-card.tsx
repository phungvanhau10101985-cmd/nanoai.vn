'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { imageLocalizationClient } from '@/lib/messaging/image-localization/image-localization-client'
import {
  IMAGE_LOC_GEMINI_MODEL_PRESETS,
  IMAGE_LOC_OPENAI_MODEL_PRESETS,
  IMAGE_LOC_OPENAI_OUTPUT_PRESETS,
  imageLocalizationJobProgress,
  isTerminalImageLocalizationJobStatus,
  type ImageLocAuthStatus,
  type ImageLocGeminiMode,
  type ImageLocJob,
  type ImageLocLanguage,
  type ImageLocSummary,
} from '@/lib/messaging/image-localization/image-localization-types'

const JOBS_LS = (partnerId: string) => `nanoai.image_loc.jobs.${partnerId}`

function readTrackedJobIds(partnerId: string): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(JOBS_LS(partnerId))
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(arr) ? arr.map((x) => String(x)).filter(Boolean) : []
  } catch {
    return []
  }
}

function writeTrackedJobIds(partnerId: string, ids: string[]) {
  try {
    sessionStorage.setItem(JOBS_LS(partnerId), JSON.stringify(ids.slice(0, 40)))
  } catch {
    /* quota */
  }
}

function resolveGeminiPreset(model: string): string {
  const hit = IMAGE_LOC_GEMINI_MODEL_PRESETS.find((p) => p.model === model.trim())
  return hit?.id ?? (model.trim() ? 'custom' : IMAGE_LOC_GEMINI_MODEL_PRESETS[0].id)
}

function resolveOpenaiPreset(model: string): string {
  const hit = IMAGE_LOC_OPENAI_MODEL_PRESETS.find((p) => p.model === model.trim())
  return hit?.id ?? (model.trim() ? 'custom' : IMAGE_LOC_OPENAI_MODEL_PRESETS[0].id)
}

function resolveOpenaiOutputPreset(quality: string, size: string): string {
  const hit = IMAGE_LOC_OPENAI_OUTPUT_PRESETS.find((p) => p.quality === quality && p.size === size)
  return hit?.id ?? (quality || size ? '__custom' : '')
}

export function PartnerImageLocalizationCard({
  partnerId,
  t,
  selectedInventoryIds,
}: {
  partnerId: string
  t: Dictionary['partnerMessagingAi']
  selectedInventoryIds: Set<string>
}) {
  const selectedCount = selectedInventoryIds.size
  const [language, setLanguage] = useState<ImageLocLanguage>('vi')
  const [geminiMode, setGeminiMode] = useState<ImageLocGeminiMode>('local_only')
  const [geminiModel, setGeminiModel] = useState('')
  const [geminiSize, setGeminiSize] = useState('2K')
  const [openaiModel, setOpenaiModel] = useState('')
  const [openaiQuality, setOpenaiQuality] = useState('high')
  const [openaiSize, setOpenaiSize] = useState('auto')
  const [force, setForce] = useState(false)
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [auth, setAuth] = useState<ImageLocAuthStatus | null>(null)
  const [summary, setSummary] = useState<ImageLocSummary | null>(null)
  const [jobs, setJobs] = useState<ImageLocJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [startBusy, setStartBusy] = useState(false)
  const [offPeakSaving, setOffPeakSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const aiModesSelectable = selectedCount > 0 && auth?.ai_image_jobs_allowed !== false
  const geminiReady =
    geminiMode === 'local_only' ||
    (geminiMode === 'api' && Boolean(auth?.api?.ready)) ||
    (geminiMode === 'openai' && Boolean(auth?.openai?.ready))

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    window.setTimeout(() => setToast(null), 4200)
  }

  const loadAuthAndSummary = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([
        imageLocalizationClient.geminiAuth(partnerId, language),
        imageLocalizationClient.summary(partnerId),
      ])
      setAuth(a)
      setSummary(s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [partnerId, language])

  const loadJobs = useCallback(async () => {
    setJobsLoading(true)
    try {
      const data = await imageLocalizationClient.listJobs(partnerId, { limit: 40 })
      setJobs(data.jobs)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setJobsLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    void loadAuthAndSummary()
    void loadJobs()
  }, [loadAuthAndSummary, loadJobs])

  useEffect(() => {
    if (selectedCount === 0 && geminiMode !== 'local_only') setGeminiMode('local_only')
  }, [selectedCount, geminiMode])

  const pollActive = jobs.some((j) => !isTerminalImageLocalizationJobStatus(j.status))
  useEffect(() => {
    if (!pollActive) return
    const id = window.setInterval(() => void loadJobs(), 2500)
    return () => window.clearInterval(id)
  }, [pollActive, loadJobs])

  useEffect(() => {
    writeTrackedJobIds(
      partnerId,
      Array.from(new Set([...readTrackedJobIds(partnerId), ...jobs.map((j) => j.job_id)]))
    )
  }, [partnerId, jobs])

  const startJob = async () => {
    if (geminiMode !== 'local_only' && selectedCount === 0) {
      setError(t.imageLocSelectRequired)
      return
    }
    setStartBusy(true)
    try {
      const productIds = selectedOnly && selectedCount > 0 ? Array.from(selectedInventoryIds) : undefined
      const out = await imageLocalizationClient.startJob(partnerId, {
        language,
        force,
        dry_run: false,
        product_ids: productIds ?? null,
        gemini_mode: geminiMode === 'local_only' ? 'api' : geminiMode,
        allow_ai_image_models: geminiMode === 'local_only' ? false : null,
        ...(geminiMode === 'api'
          ? {
              gemini_image_model: geminiModel.trim() || null,
              gemini_image_size: geminiSize.trim() || null,
            }
          : {}),
        ...(geminiMode === 'openai'
          ? {
              openai_image_model: openaiModel.trim() || null,
              openai_image_quality: openaiQuality.trim() || null,
              openai_image_size: openaiSize.trim() || null,
            }
          : {}),
      })
      writeTrackedJobIds(partnerId, [out.job_id, ...readTrackedJobIds(partnerId)])
      showToast('ok', t.imageLocQueued)
      await Promise.all([loadJobs(), loadAuthAndSummary()])
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      showToast('err', msg)
    } finally {
      setStartBusy(false)
    }
  }

  const toggleOffPeak = async (enabled: boolean) => {
    setOffPeakSaving(true)
    try {
      const out = await imageLocalizationClient.setDeepseekOffPeak(partnerId, enabled)
      setAuth((prev) => (prev ? { ...prev, deepseek_pricing: out.deepseek_pricing } : prev))
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : String(e))
    } finally {
      setOffPeakSaving(false)
    }
  }

  const geminiPreset = useMemo(() => resolveGeminiPreset(geminiModel), [geminiModel])
  const openaiPreset = useMemo(() => resolveOpenaiPreset(openaiModel), [openaiModel])
  const openaiOutPreset = useMemo(
    () => resolveOpenaiOutputPreset(openaiQuality, openaiSize),
    [openaiQuality, openaiSize]
  )

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {toast ? (
        <div
          className={`fixed bottom-4 right-4 z-[130] max-w-[min(22rem,calc(100vw-1.5rem))] rounded-lg border px-3 py-2 text-sm shadow-lg ${
            toast.type === 'err' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t.imageLocTitle}</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-3xl">{t.imageLocIntro}</p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
          onClick={() => {
            void loadAuthAndSummary()
            void loadJobs()
          }}
        >
          {t.imageLocRefresh}
        </button>
      </div>

      <p
        className={
          auth?.ai_image_jobs_allowed === false
            ? 'rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 leading-relaxed'
            : 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 leading-relaxed'
        }
      >
        {auth?.ai_image_jobs_allowed === false ? t.imageLocAiOffBanner : t.imageLocBulkHint}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">{t.imageLocModeLabel}</span>
              <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={geminiMode === 'local_only'}
                    onChange={() => setGeminiMode('local_only')}
                    disabled={startBusy}
                  />
                  <span>
                    <span className="font-medium">{t.imageLocModeLocal}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.imageLocModeLocalHint}</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2 ${aiModesSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}>
                  <input
                    type="radio"
                    className="mt-1"
                    checked={geminiMode === 'api'}
                    onChange={() => setGeminiMode('api')}
                    disabled={startBusy || !aiModesSelectable}
                  />
                  <span>
                    <span className="font-medium">{t.imageLocModeGemini}</span>
                    {auth?.ai_image_jobs_allowed === false ? (
                      <span className="ml-1 text-xs text-muted-foreground">({t.imageLocAiOff})</span>
                    ) : selectedCount === 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">({t.imageLocNeedSelect})</span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.imageLocModeGeminiHint}</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2 ${aiModesSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'}`}>
                  <input
                    type="radio"
                    className="mt-1"
                    checked={geminiMode === 'openai'}
                    onChange={() => setGeminiMode('openai')}
                    disabled={startBusy || !aiModesSelectable}
                  />
                  <span>
                    <span className="font-medium">{t.imageLocModeOpenai}</span>
                    {auth?.ai_image_jobs_allowed === false ? (
                      <span className="ml-1 text-xs text-muted-foreground">({t.imageLocAiOff})</span>
                    ) : selectedCount === 0 ? (
                      <span className="ml-1 text-xs text-muted-foreground">({t.imageLocNeedSelect})</span>
                    ) : null}
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.imageLocModeOpenaiHint}</span>
                  </span>
                </label>
              </div>
              {geminiMode === 'api' ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t.imageLocGeminiModel}</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={geminiPreset}
                      disabled={startBusy}
                      onChange={(e) => {
                        const id = e.target.value
                        if (id === 'custom') return
                        const row = IMAGE_LOC_GEMINI_MODEL_PRESETS.find((x) => x.id === id)
                        setGeminiModel(row?.model ?? '')
                      }}
                    >
                      {IMAGE_LOC_GEMINI_MODEL_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                      <option value="custom">{t.imageLocCustomModel}</option>
                    </select>
                  </label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    disabled={startBusy}
                    placeholder={auth?.image_model || 'gemini-3-pro-image-preview'}
                  />
                  <p className="text-xs text-muted-foreground">{t.imageLocGeminiModelHint}</p>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t.imageLocGeminiSize}</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={geminiSize}
                      disabled={startBusy}
                      onChange={(e) => setGeminiSize(e.target.value)}
                    >
                      <option value="">{t.imageLocEnvDefault}</option>
                      {(auth?.gemini_api_image_sizes ?? ['2K', '4K']).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-xs text-muted-foreground">{t.imageLocGeminiSizeHint}</span>
                  </label>
                </div>
              ) : null}
              {geminiMode === 'openai' ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t.imageLocOpenaiModel}</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={openaiPreset}
                      disabled={startBusy}
                      onChange={(e) => {
                        const id = e.target.value
                        if (id === 'custom') return
                        const row = IMAGE_LOC_OPENAI_MODEL_PRESETS.find((x) => x.id === id)
                        setOpenaiModel(row?.model ?? '')
                      }}
                    >
                      {IMAGE_LOC_OPENAI_MODEL_PRESETS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                      <option value="custom">{t.imageLocCustomModel}</option>
                    </select>
                  </label>
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm font-mono"
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    disabled={startBusy}
                    placeholder={auth?.openai_image_model || 'gpt-image-2'}
                  />
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">{t.imageLocOpenaiOut}</span>
                    <select
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      value={openaiOutPreset}
                      disabled={startBusy}
                      onChange={(e) => {
                        const id = e.target.value
                        if (id === '__custom') return
                        const row = IMAGE_LOC_OPENAI_OUTPUT_PRESETS.find((x) => x.id === id)
                        setOpenaiQuality(row?.quality ?? '')
                        setOpenaiSize(row?.size ?? '')
                      }}
                    >
                      {IMAGE_LOC_OPENAI_OUTPUT_PRESETS.map((p) => (
                        <option key={p.id || 'none'} value={p.id || ''}>
                          {p.label}
                        </option>
                      ))}
                      <option value="__custom">{t.imageLocCustomModel}</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{t.imageLocLanguage}</span>
              <select
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                value={language}
                disabled={startBusy}
                onChange={(e) => setLanguage(e.target.value as ImageLocLanguage)}
              >
                <option value="vi">{t.imageLocLangVi}</option>
                <option value="en">{t.imageLocLangEn}</option>
                <option value="th">{t.imageLocLangTh}</option>
                <option value="id">{t.imageLocLangId}</option>
              </select>
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={selectedOnly}
                disabled={startBusy || selectedCount === 0}
                onChange={(e) => setSelectedOnly(e.target.checked)}
              />
              {t.imageLocSelectedOnly.replace('{n}', String(selectedCount))}
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
              <input type="checkbox" checked={force} disabled={startBusy} onChange={(e) => setForce(e.target.checked)} />
              {t.imageLocForce}
            </label>
            <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
              <div>
                {t.imageLocStatPending}: {summary?.pending ?? '—'}
              </div>
              <div>
                {t.imageLocStatDone}: {summary?.localized ?? '—'} · {t.imageLocStatError}: {summary?.failed ?? '—'}
                {(summary?.skipped ?? 0) > 0 ? ` · ${t.imageLocStatSkip}: ${summary?.skipped}` : ''}
                {(summary?.processing ?? 0) > 0 ? ` · ${t.imageLocStatRun}: ${summary?.processing}` : ''}
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={Boolean(auth?.deepseek_pricing?.off_peak_only_enabled)}
                disabled={offPeakSaving || !auth}
                onChange={(e) => void toggleOffPeak(e.target.checked)}
              />
              <span>
                <span className="font-medium text-violet-950">{t.imageLocOffPeak}</span>
                <span className="mt-0.5 block text-xs leading-snug text-violet-900/90">{t.imageLocOffPeakHint}</span>
              </span>
            </label>
          </div>

          {auth?.deepseek_pricing?.peak_now && auth.deepseek_pricing.banner_message_vi ? (
            <div
              className={
                auth.deepseek_pricing.banner_variant === 'wait'
                  ? 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950'
                  : 'rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-relaxed text-sky-950'
              }
              role="status"
            >
              <span className="font-semibold">
                {auth.deepseek_pricing.banner_variant === 'wait' ? t.imageLocPeakWaitTitle : t.imageLocPeakNowTitle}
              </span>
              <p className="mt-1">{auth.deepseek_pricing.banner_message_vi}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void startJob()}
              disabled={startBusy || !geminiReady}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {startBusy ? t.imageLocStarting : pollActive ? t.imageLocStartMore : t.imageLocStart}
            </button>
            {jobs.some((j) => isTerminalImageLocalizationJobStatus(j.status)) ? (
              <button
                type="button"
                className="rounded-lg border border-border px-3 py-2 text-sm"
                onClick={async () => {
                  try {
                    await imageLocalizationClient.deleteTerminalJobs(partnerId)
                    await loadJobs()
                  } catch (e) {
                    showToast('err', e instanceof Error ? e.message : String(e))
                  }
                }}
              >
                {t.imageLocDeleteTerminal}
              </button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="rounded-lg border border-border bg-muted/20 p-3">
          <h3 className="text-sm font-semibold">{t.imageLocJobsHeading}</h3>
          {jobsLoading && jobs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.imageLocJobsLoading}</p>
          ) : jobs.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{t.imageLocJobsEmpty}</p>
          ) : (
            <div className="mt-3 max-h-[min(70vh,520px)] space-y-3 overflow-auto pr-0.5">
              {jobs.map((job) => {
                const pct = imageLocalizationJobProgress(job)
                const terminal = isTerminalImageLocalizationJobStatus(job.status)
                return (
                  <div
                    key={job.job_id}
                    className={`rounded-lg border bg-background p-2.5 shadow-sm ${
                      job.status === 'error'
                        ? 'border-red-200'
                        : job.status === 'cancelled'
                          ? 'border-gray-300'
                          : job.status === 'done'
                            ? 'border-emerald-200'
                            : 'border-violet-200'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[11px] text-muted-foreground" title={job.job_id}>
                          {job.job_id}
                        </p>
                        <p className="text-xs font-semibold capitalize">{job.status}</p>
                      </div>
                      {terminal ? (
                        <button
                          type="button"
                          className="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            try {
                              await imageLocalizationClient.deleteJob(partnerId, job.job_id)
                              await loadJobs()
                            } catch (e) {
                              showToast('err', e instanceof Error ? e.message : String(e))
                            }
                          }}
                        >
                          {t.imageLocDelete}
                        </button>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            className="rounded-md border px-2 py-1 text-[11px]"
                            onClick={() => void imageLocalizationClient.cancelJob(partnerId, job.job_id, 'graceful').then(() => loadJobs())}
                          >
                            {t.imageLocCancelGraceful}
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-200 px-2 py-1 text-[11px] text-red-700"
                            onClick={() => void imageLocalizationClient.cancelJob(partnerId, job.job_id, 'force').then(() => loadJobs())}
                          >
                            {t.imageLocCancelForce}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-violet-600 transition-[width] duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {pct}% · {job.done ?? 0}/{job.total ?? '—'} · {t.imageLocStatError} {job.failed ?? 0} · {t.imageLocStatSkip}{' '}
                      {job.skipped ?? 0}
                    </p>
                    {job.message ? <p className="mt-1 text-[11px] leading-snug">{job.message}</p> : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

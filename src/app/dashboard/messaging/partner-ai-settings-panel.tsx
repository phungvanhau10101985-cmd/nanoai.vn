'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type {
  PartnerAiSettingsClientRow,
  PartnerAiSettingsPayload,
  PartnerAiTokenUsageStatRow,
  PartnerVisionCatalogStats,
} from '@/app/dashboard/messaging/actions'
import {
  cancelVisionCatalogBackgroundSync,
  deletePartnerFaq,
  deletePartnerInventoryItem,
  dismissVisionCatalogBackgroundSyncReport,
  enqueueVisionCatalogBackgroundSync,
  getPartnerAiBundle,
  getPartnerAiTokenUsageStats,
  savePartnerAiSettings,
  savePartnerFaqPreset,
  upsertPartnerFaq,
  upsertPartnerInventoryItem,
} from '@/app/dashboard/messaging/actions'
import {
  PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED,
  PARTNER_FAQ_PRESET_ANSWER_REQUIRED,
  PARTNER_FAQ_PRESET_KEYS,
  type PartnerFaqPresetKey,
} from '@/lib/messaging/partner-faq-presets'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  VISION_BG_SYNC_REPORT_MESSAGE,
  VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR,
  VISION_LOCATIONS,
  VISION_PRODUCT_CATEGORIES,
  VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS,
  VISION_SYNC_CLIENT_CHAIN_MAX_MS,
  VISION_SYNC_CLIENT_CHAIN_MAX_ROUNDS,
  VISION_SYNC_CLIENT_CHAIN_PAUSE_MS,
  VISION_SYNC_CLIENT_CHAIN_SEGMENT_BREAK_MS,
  VISION_SYNC_CLIENT_FETCH_TIMEOUT_MS,
  VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE,
  VISION_WAREHOUSE_REINDEX_PENDING_CODE,
  isVisionCatalogImageUrlSyncable,
  isVisionProductSearchMaintenanceError,
  normalizeVisionProductSearchLocation,
} from '@/lib/messaging/partner-vision-constants'
import { Bot, Download, FileSpreadsheet, Loader2, ScanSearch, Sparkles, Upload } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'
import {
  VISION_SHOP_COUNTRY_CODES_ORDERED,
  getVisionLocationForShopCountry,
  shopCountryMatchesVisionLocation,
} from '@/lib/messaging/partner-vision-shop-country-presets'

const VISION_SHOP_COUNTRY_SELECT_CUSTOM = '__custom__'

function resolveVisionShopCountrySelectValue(country: string, location: string): string {
  const c = country.trim().toUpperCase()
  if (!c || !shopCountryMatchesVisionLocation(c, location)) return VISION_SHOP_COUNTRY_SELECT_CUSTOM
  return c
}

type AiT = Dictionary['partnerMessagingAi']
type SettingsRow = PartnerAiSettingsClientRow

function visionSyncFailureUserMessage(raw: string, t: AiT): { title: string; description?: string } {
  if (isVisionProductSearchMaintenanceError(raw)) {
    return {
      title: t.visionProductSearchMaintenanceTitle,
      description: t.visionProductSearchMaintenanceDetail,
    }
  }
  return { title: raw }
}
type FaqRow = Database['public']['Tables']['messaging_partner_faq']['Row']
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const tokenFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

type VisionBgReportParsed = {
  completed?: boolean
  totalRounds?: number
  totalImported?: number
  totalRemoved?: number
  hasMore?: boolean
  lastScannedId?: string | null
  stoppedReason?: string
  message?: string
  errorDetail?: string
  cronSliceAt?: string
}

function parseVisionBgSyncReport(raw: string | null | undefined): VisionBgReportParsed | null {
  if (!raw?.trim()) return null
  try {
    return JSON.parse(raw) as VisionBgReportParsed
  } catch {
    return null
  }
}

function visionBgStatusLabel(t: AiT, status: string): string {
  switch (status) {
    case 'idle':
      return t.visionBgSyncStatusIdle
    case 'queued':
      return t.visionBgSyncStatusQueued
    case 'running':
      return t.visionBgSyncStatusRunning
    case 'done':
      return t.visionBgSyncStatusDone
    case 'error':
      return t.visionBgSyncStatusError
    default:
      return status
  }
}

function formatVisionBgStoppedReason(t: AiT, sr: string): string {
  switch (sr) {
    case 'completed':
      return t.visionBgSyncStopCompleted
    case 'error':
      return t.visionBgSyncStopError
    case 'cron_slice':
      return t.visionBgSyncStopCronSlice
    case 'bad_cursor':
      return t.visionBgSyncStopBadCursor
    default:
      return sr
  }
}

function formatVisionBgReportMessage(t: AiT, raw: string): string {
  if (raw === VISION_BG_SYNC_REPORT_MESSAGE.completed) return t.visionBgSyncMsgCompleted
  if (raw === VISION_BG_SYNC_REPORT_MESSAGE.inProgress) return t.visionBgSyncMsgInProgress
  if (raw === VISION_BG_SYNC_REPORT_MESSAGE.badCursor) return t.visionBgSyncMsgBadCursor
  return raw
}

function buildVisionBgDetailLines(
  t: AiT,
  rep: VisionBgReportParsed | null,
  serverError: string
): string[] {
  const parts: string[] = []
  const seTrim = serverError?.trim() ?? ''
  if (rep) {
    if (typeof rep.totalRounds === 'number') parts.push(`${t.visionBgSyncFieldRounds}: ${rep.totalRounds}`)
    if (typeof rep.totalImported === 'number') parts.push(`${t.visionBgSyncFieldImported}: ${rep.totalImported}`)
    if (typeof rep.totalRemoved === 'number') parts.push(`${t.visionBgSyncFieldRemoved}: ${rep.totalRemoved}`)
    if (typeof rep.hasMore === 'boolean') {
      parts.push(`${t.visionBgSyncFieldHasMore}: ${rep.hasMore ? t.visionBgSyncBoolYes : t.visionBgSyncBoolNo}`)
    }
    if (rep.lastScannedId != null && String(rep.lastScannedId).trim() !== '') {
      parts.push(`${t.visionBgSyncFieldLastScanned}: ${rep.lastScannedId}`)
    }
    if (rep.stoppedReason) {
      parts.push(`${t.visionBgSyncFieldStopped}: ${formatVisionBgStoppedReason(t, rep.stoppedReason)}`)
    }
    if (rep.message?.trim()) {
      const msg = rep.message.trim()
      parts.push(`${t.visionBgSyncFieldMessage}: ${formatVisionBgReportMessage(t, msg)}`)
    }
    const ed = rep.errorDetail?.trim()
    if (ed && ed !== seTrim) {
      parts.push(
        ed === VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE ? t.visionWarehouseCorpusUnsupportedType : ed
      )
    }
  }
  if (seTrim) {
    const displayErr =
      seTrim === VISION_BG_SYNC_SERVER_ERROR_BAD_CURSOR
        ? t.visionBgSyncServerErrCursor
        : seTrim === VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE
          ? t.visionWarehouseCorpusUnsupportedType
          : seTrim
    parts.push(`${t.visionBgSyncFieldServerError}: ${displayErr}`)
  }
  return parts
}

function defaultsFromSettings(s: SettingsRow | null) {
  return {
    enabled: s?.enabled ?? false,
    reply_delay_seconds: s?.reply_delay_seconds ?? 20,
    typing_pause_min_ms: s?.typing_pause_min_ms ?? 1200,
    typing_pause_max_ms: s?.typing_pause_max_ms ?? 3800,
    shop_policy: s?.shop_policy ?? '',
    tone_instructions: s?.tone_instructions ?? '',
    append_ai_disclosure: s?.append_ai_disclosure ?? true,
    disclosure_suffix: s?.disclosure_suffix ?? '',
    vision_product_search_enabled: s?.vision_product_search_enabled ?? false,
    vision_shop_country: (s?.vision_shop_country ?? '').trim().toUpperCase(),
    vision_location: normalizeVisionProductSearchLocation(s?.vision_location ?? undefined),
    vision_product_category: s?.vision_product_category ?? 'general-v1',
    vision_gcs_bucket: s?.vision_gcs_bucket ?? '',
    vision_index_ready: s?.vision_index_ready ?? false,
    vision_index_synced_at: s?.vision_index_synced_at ?? null,
    vision_index_error: s?.vision_index_error ?? '',
    image_search_api_enabled: s?.image_search_api_enabled ?? false,
    image_search_api_key_configured: s?.image_search_api_key_configured ?? false,
    vision_bg_sync_status: s?.vision_bg_sync_status ?? 'idle',
    vision_bg_sync_resume_after_id: s?.vision_bg_sync_resume_after_id ?? null,
    vision_bg_sync_rounds: s?.vision_bg_sync_rounds ?? 0,
    vision_bg_sync_imported: s?.vision_bg_sync_imported ?? 0,
    vision_bg_sync_removed: s?.vision_bg_sync_removed ?? 0,
    vision_bg_sync_started_at: s?.vision_bg_sync_started_at ?? null,
    vision_bg_sync_finished_at: s?.vision_bg_sync_finished_at ?? null,
    vision_bg_sync_error: s?.vision_bg_sync_error ?? '',
    vision_bg_sync_report: s?.vision_bg_sync_report ?? '',
  }
}

type FormState = ReturnType<typeof defaultsFromSettings>

type VisionSyncResponse = {
  ok?: boolean
  error?: string
  imported?: number
  removed?: number
  importBatches?: number
  inventoryScanExhausted?: boolean
  hasMore?: boolean
  lastScannedId?: string | null
  /** Phản hồi từ kick analyze sau sync (API thêm trường này). */
  reindexKick?: { step: string; detail?: string }
}

function formToPayload(f: FormState): PartnerAiSettingsPayload {
  return {
    enabled: f.enabled,
    reply_delay_seconds: f.reply_delay_seconds,
    typing_pause_min_ms: f.typing_pause_min_ms,
    typing_pause_max_ms: f.typing_pause_max_ms,
    shop_policy: f.shop_policy,
    tone_instructions: f.tone_instructions,
    append_ai_disclosure: f.append_ai_disclosure,
    disclosure_suffix: f.disclosure_suffix,
    vision_product_search_enabled: f.vision_product_search_enabled,
    vision_shop_country: f.vision_shop_country,
    vision_location: f.vision_location,
    vision_product_category: f.vision_product_category,
    vision_gcs_bucket: f.vision_gcs_bucket,
    image_search_api_enabled: f.image_search_api_enabled,
  }
}

export function PartnerAiSettingsPanel({
  partnerId,
  t,
  saveOkMessage,
  aiModelId,
  locale,
}: {
  partnerId: string
  t: AiT
  saveOkMessage: string
  /** Model id from server (DEEPSEEK_MODEL / default deepseek-chat) */
  aiModelId: string
  locale: WebLocale
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [faqs, setFaqs] = useState<FaqRow[]>([])
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [visionCatalogStats, setVisionCatalogStats] = useState<PartnerVisionCatalogStats | null>(null)
  const [tokenUsageRows, setTokenUsageRows] = useState<PartnerAiTokenUsageStatRow[]>([])
  const [tokenUsageLookbackDays, setTokenUsageLookbackDays] = useState(30)
  const [form, setForm] = useState<FormState>(() => defaultsFromSettings(null))
  const formRef = useRef<FormState>(form)
  const [visionSyncing, setVisionSyncing] = useState(false)
  const [visionBgRunSliceBusy, setVisionBgRunSliceBusy] = useState(false)
  const [visionSyncResumeAfterId, setVisionSyncResumeAfterId] = useState<string | null>(null)
  const prevVisionBgStatusRef = useRef<string | null>(null)

  const regionDisplayNames = useMemo(() => {
    try {
      return new Intl.DisplayNames([locale, 'en'], { type: 'region' })
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' })
    }
  }, [locale])

  const visionShopCountrySelectValue = resolveVisionShopCountrySelectValue(
    form.vision_shop_country,
    form.vision_location
  )

  const load = useCallback((): Promise<void> => {
    setLoadErr(null)
    return (async () => {
      const [bundleRes, usageRes] = await Promise.all([
        getPartnerAiBundle(partnerId),
        getPartnerAiTokenUsageStats(partnerId),
      ])
      if ('error' in usageRes) {
        setTokenUsageRows([])
      } else {
        setTokenUsageRows(usageRes.rows)
        setTokenUsageLookbackDays(usageRes.lookbackDays)
      }
      if ('error' in bundleRes && bundleRes.error) {
        setVisionCatalogStats(null)
        setLoadErr(bundleRes.error)
        toast({ title: t.loadError, description: bundleRes.error, variant: 'destructive' })
        return
      }
      if ('settings' in bundleRes) {
        const next = defaultsFromSettings(bundleRes.settings ?? null)
        formRef.current = next
        setForm(next)
        setFaqs(bundleRes.faqs ?? [])
        setInventory(bundleRes.inventory ?? [])
        setVisionCatalogStats(bundleRes.visionCatalogStats ?? null)
      }
    })()
  }, [partnerId, t.loadError, toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setVisionSyncResumeAfterId(null)
    prevVisionBgStatusRef.current = null
  }, [partnerId])

  useEffect(() => {
    formRef.current = form
  }, [form])

  const visionBgActive =
    form.vision_bg_sync_status === 'queued' || form.vision_bg_sync_status === 'running'

  /** Số dòng kho có URL ảnh https — khớp điều kiện đồng bộ Google (ước lượng tiến độ). */
  const visionBgImageRowTotal = useMemo(
    () => inventory.filter((r) => isVisionCatalogImageUrlSyncable(r.image_url)).length,
    [inventory]
  )

  useEffect(() => {
    if (!visionBgActive) return
    const id = window.setInterval(() => load(), 8000)
    return () => window.clearInterval(id)
  }, [visionBgActive, load])

  useEffect(() => {
    const cur = form.vision_bg_sync_status
    const prev = prevVisionBgStatusRef.current
    if (prev !== null && (prev === 'queued' || prev === 'running')) {
      if (cur === 'done' || cur === 'error') {
        const rep = parseVisionBgSyncReport(form.vision_bg_sync_report)
        const lines = buildVisionBgDetailLines(t, rep, form.vision_bg_sync_error)
        const description = lines.length > 0 ? lines.join('\n') : undefined
        if (cur === 'done') {
          toast({ title: t.visionBgSyncToastDone, ...(description ? { description } : {}) })
        } else {
          toast({
            title: t.visionBgSyncToastError,
            variant: 'destructive',
            ...(description ? { description } : {}),
          })
        }
      }
    }
    prevVisionBgStatusRef.current = cur
  }, [form.vision_bg_sync_status, form.vision_bg_sync_report, form.vision_bg_sync_error, toast, t])

  const persistPartial = useCallback(
    (partial: Partial<FormState>) => {
      const next = { ...formRef.current, ...partial }
      formRef.current = next
      setForm(next)
      startTransition(async () => {
        const res = await savePartnerAiSettings(partnerId, formToPayload(next))
        if ('error' in res && res.error) {
          toast({ title: res.error, variant: 'destructive' })
          load()
          return
        }
        toast({ title: saveOkMessage })
      })
    },
    [partnerId, saveOkMessage, toast, load]
  )

  const performVisionCatalogSyncRound = useCallback(
    async (resumeAfterId: string | null): Promise<VisionSyncResponse> => {
      const body =
        resumeAfterId != null && resumeAfterId !== '' ? { resumeAfterId } : {}
      const signal =
        typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
          ? AbortSignal.timeout(VISION_SYNC_CLIENT_FETCH_TIMEOUT_MS)
          : undefined
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/vision-catalog-sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          ...(signal ? { signal } : {}),
        }
      )
      const data = (await res.json()) as VisionSyncResponse
      if (!res.ok) throw new Error(data.error || 'Sync failed')
      return data
    },
    [partnerId]
  )

  const runVisionCatalogSyncChained = useCallback(
    async (startResumeAfterId: string | null) => {
      const sleepMs = (ms: number) =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, ms)
        })

      let resume: string | null = startResumeAfterId
      let grandImported = 0
      let grandRemoved = 0
      let totalRounds = 0
      let last: VisionSyncResponse = {}

      outer: while (true) {
        const segmentStarted = Date.now()
        let segmentRounds = 0

        inner: while (true) {
          if (totalRounds >= VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS) {
            break outer
          }
          if (segmentRounds >= VISION_SYNC_CLIENT_CHAIN_MAX_ROUNDS) {
            break inner
          }
          if (Date.now() - segmentStarted >= VISION_SYNC_CLIENT_CHAIN_MAX_MS) {
            break inner
          }

          const data = await performVisionCatalogSyncRound(resume)
          last = data
          segmentRounds += 1
          totalRounds += 1
          grandImported += data.imported ?? 0
          grandRemoved += data.removed ?? 0

          if (!data.hasMore) {
            break outer
          }
          const nextResume = data.lastScannedId?.trim() || null
          if (!nextResume) {
            break outer
          }
          resume = nextResume
          await sleepMs(VISION_SYNC_CLIENT_CHAIN_PAUSE_MS)
        }

        if (!last.hasMore) {
          break outer
        }

        if (totalRounds >= VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS) {
          break outer
        }

        await sleepMs(VISION_SYNC_CLIENT_CHAIN_SEGMENT_BREAK_MS)
      }

      const stillMore = Boolean(last.hasMore)
      const missingCursor = stillMore && !last.lastScannedId?.trim()
      const abortedSafety =
        stillMore && totalRounds >= VISION_SYNC_CLIENT_CHAIN_ABSOLUTE_MAX_ROUNDS

      if (stillMore && last.lastScannedId) {
        setVisionSyncResumeAfterId(last.lastScannedId)
      } else {
        setVisionSyncResumeAfterId(null)
      }

      if (missingCursor) {
        toast({
          title: t.loadError,
          description: t.visionSyncToastMore,
          variant: 'destructive',
        })
      } else if (abortedSafety) {
        toast({
          title: t.visionSyncChainedAbortedSafety,
          description: [
            `${t.visionSyncToastImported}: ${grandImported}`,
            `${t.visionSyncToastRemoved}: ${grandRemoved}`,
            t.visionSyncChainedRounds.replace(/\{n\}/g, String(totalRounds)),
          ].join(' · '),
          variant: 'destructive',
        })
      } else if (!stillMore && grandImported === 0 && grandRemoved === 0) {
        toast({ title: t.visionSyncToastIdle })
      } else {
        const descParts: string[] = []
        if (grandImported > 0 || grandRemoved > 0) {
          descParts.push(
            `${t.visionSyncToastImported}: ${grandImported}`,
            `${t.visionSyncToastRemoved}: ${grandRemoved}`
          )
        }
        if (totalRounds > 1) {
          descParts.push(t.visionSyncChainedRounds.replace(/\{n\}/g, String(totalRounds)))
        }
        const description = descParts.filter(Boolean).join(' · ')
        toast({
          title: t.visionSyncOk,
          ...(description ? { description } : {}),
        })
      }
    },
    [
      performVisionCatalogSyncRound,
      toast,
      t.visionSyncOk,
      t.visionSyncToastIdle,
      t.visionSyncToastImported,
      t.visionSyncToastRemoved,
      t.visionSyncToastMore,
      t.visionSyncChainedRounds,
      t.visionSyncChainedAbortedSafety,
      t.loadError,
    ]
  )

  const handleVisionProductSearchToggle = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setVisionSyncResumeAfterId(null)
        persistPartial({ vision_product_search_enabled: false })
        return
      }
      const prevEnabled = formRef.current.vision_product_search_enabled
      const next = { ...formRef.current, vision_product_search_enabled: true }
      formRef.current = next
      setForm(next)
      startTransition(async () => {
        const res = await savePartnerAiSettings(partnerId, formToPayload(next))
        if ('error' in res && res.error) {
          toast({ title: res.error, variant: 'destructive' })
          load()
          return
        }
        toast({ title: saveOkMessage })
        if (!prevEnabled) {
          setVisionSyncing(true)
          setVisionSyncResumeAfterId(null)
          try {
            await runVisionCatalogSyncChained(null)
          } catch (e) {
            const raw = e instanceof Error ? e.message : t.loadError
            const { title, description } = visionSyncFailureUserMessage(raw, t)
            toast({
              title,
              ...(description ? { description } : {}),
              variant: 'destructive',
            })
          } finally {
            setVisionSyncing(false)
            load()
          }
        } else {
          load()
        }
      })
    },
    [
      persistPartial,
      partnerId,
      saveOkMessage,
      toast,
      load,
      runVisionCatalogSyncChained,
      t,
    ]
  )

  const saveSettings = () => {
    startTransition(async () => {
      const res = await savePartnerAiSettings(partnerId, formToPayload(formRef.current))
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: saveOkMessage })
      load()
    })
  }

  const runVisionSync = useCallback(() => {
    setVisionSyncing(true)
    void (async () => {
      try {
        await runVisionCatalogSyncChained(visionSyncResumeAfterId)
        load()
      } catch (e) {
        const raw = e instanceof Error ? e.message : t.loadError
        const { title, description } = visionSyncFailureUserMessage(raw, t)
        toast({
          title,
          ...(description ? { description } : {}),
          variant: 'destructive',
        })
        load()
      } finally {
        setVisionSyncing(false)
      }
    })()
  }, [runVisionCatalogSyncChained, visionSyncResumeAfterId, t, toast, load])

  const handleEnqueueVisionBgSync = useCallback(() => {
    startTransition(async () => {
      const res = await enqueueVisionCatalogBackgroundSync(partnerId, visionSyncResumeAfterId)
      if ('error' in res && res.error) {
        const msg =
          res.code === 'already_active'
            ? t.visionBgSyncAlreadyActive
            : res.code === 'enable_vision_first'
              ? t.visionBgSyncEnableVisionFirst
              : res.code === 'no_ai_row'
                ? t.visionBgSyncSaveSettingsFirst
                : res.error
        if (res.code === 'already_active') {
          toast({ title: msg, description: t.visionBgSyncAlreadyActiveRefreshHint })
          await load()
          return
        }
        toast({ title: msg, variant: 'destructive' })
        return
      }
      toast({ title: t.visionBgSyncEnqueueOk })
      load()
    })
  }, [partnerId, visionSyncResumeAfterId, t, toast, load])

  const handleCancelVisionBgSync = useCallback(() => {
    startTransition(async () => {
      const res = await cancelVisionCatalogBackgroundSync(partnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      load()
    })
  }, [partnerId, toast, load])

  const handleRunVisionBgSyncSlice = useCallback(async () => {
    setVisionBgRunSliceBusy(true)
    try {
      const res = await fetch(
        `/api/messaging/partners/${encodeURIComponent(partnerId)}/vision-bg-sync/run-once`,
        { method: 'POST', credentials: 'same-origin' }
      )
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        partnersTouched?: number
        roundsExecuted?: number
        errors?: string[]
      }
      if (!res.ok) {
        toast({ title: data.error || t.visionBgSyncToastError, variant: 'destructive' })
        return
      }
      const rounds = String(data.roundsExecuted ?? 0)
      const partners = String(data.partnersTouched ?? 0)
      toast({
        title: t.visionBgSyncRunSliceOk.replace('{rounds}', rounds).replace('{partners}', partners),
      })
      if (data.errors?.length) {
        toast({ title: data.errors.join('; '), variant: 'destructive' })
      }
      await load()
    } catch {
      toast({ title: t.visionBgSyncToastError, variant: 'destructive' })
    } finally {
      setVisionBgRunSliceBusy(false)
    }
  }, [partnerId, load, toast, t])

  const handleDismissVisionBgReport = useCallback(() => {
    startTransition(async () => {
      const res = await dismissVisionCatalogBackgroundSyncReport(partnerId)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      load()
    })
  }, [partnerId, toast, load])

  const visionBgReportLines = buildVisionBgDetailLines(
    t,
    parseVisionBgSyncReport(form.vision_bg_sync_report),
    form.vision_bg_sync_error
  )
  const showVisionBgReportBlock =
    form.vision_bg_sync_status === 'done' ||
    form.vision_bg_sync_status === 'error' ||
    visionBgReportLines.length > 0

  return (
    <Card className="overflow-hidden border-violet-200/60 bg-gradient-to-br from-violet-50/40 via-background to-background dark:border-violet-900/40 dark:from-violet-950/20 shadow-sm">
      <CardHeader className="space-y-3 border-b bg-muted/30 pb-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Bot className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-lg flex flex-wrap items-center gap-2">
              {t.panelTitle}
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed max-w-3xl">{t.panelSubtitle}</CardDescription>
          </div>
        </div>

        <div className="rounded-xl border border-violet-200/50 bg-background/90 p-4 shadow-sm dark:border-violet-900/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium">{t.enableLabel}</p>
              <p className="text-xs text-muted-foreground">{t.enableHint}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span
                className={`text-xs font-semibold tabular-nums ${form.enabled ? 'text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}
              >
                {form.enabled ? t.toggleStatusOn : t.toggleStatusOff}
              </span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(c) => persistPartial({ enabled: c })}
                disabled={pending}
                aria-label={t.enableLabel}
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t.aiEngineTitle}</span>
            <Badge className="bg-slate-800 text-white hover:bg-slate-800 dark:bg-slate-700">DeepSeek</Badge>
            <Badge variant="outline" className="font-mono text-[10px] font-normal">
              {aiModelId}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            {t.aiEngineDescription.replace(/\{model\}/g, aiModelId)}
          </p>
        </div>

        {loadErr ? <p className="text-xs text-destructive">{loadErr}</p> : null}
      </CardHeader>
      <CardContent className="pt-4">
        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="mb-4 grid w-full max-w-3xl grid-cols-2 sm:grid-cols-4 h-auto min-h-10 gap-1 p-1">
            <TabsTrigger value="settings" className="text-xs sm:text-sm">
              {t.tabSettings}
            </TabsTrigger>
            <TabsTrigger value="faq" className="text-xs sm:text-sm">
              {t.tabFaq}
            </TabsTrigger>
            <TabsTrigger value="inv" className="text-xs sm:text-sm gap-1.5">
              {t.tabInventory}
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 font-mono text-[10px] tabular-nums">
                {inventory.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="usage" className="text-xs sm:text-sm">
              {t.tabUsage}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-delay">{t.delayLabel}</Label>
                <Input
                  id="ai-delay"
                  type="number"
                  min={5}
                  max={30}
                  value={form.reply_delay_seconds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reply_delay_seconds: Number(e.target.value) || 20 }))
                  }
                />
                <p className="text-xs text-muted-foreground">{t.delayHint}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="ai-tmin">{t.typingMinLabel}</Label>
                  <Input
                    id="ai-tmin"
                    type="number"
                    min={0}
                    max={30000}
                    value={form.typing_pause_min_ms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, typing_pause_min_ms: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ai-tmax">{t.typingMaxLabel}</Label>
                  <Input
                    id="ai-tmax"
                    type="number"
                    min={0}
                    max={30000}
                    value={form.typing_pause_max_ms}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, typing_pause_max_ms: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground col-span-2">{t.typingHint}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-policy">{t.shopPolicyLabel}</Label>
              <Textarea
                id="ai-policy"
                rows={4}
                placeholder={t.shopPolicyPlaceholder}
                value={form.shop_policy}
                onChange={(e) => setForm((f) => ({ ...f, shop_policy: e.target.value }))}
                className="resize-y min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-tone">{t.toneLabel}</Label>
              <Textarea
                id="ai-tone"
                rows={3}
                placeholder={t.tonePlaceholder}
                value={form.tone_instructions}
                onChange={(e) => setForm((f) => ({ ...f, tone_instructions: e.target.value }))}
                className="resize-y"
              />
            </div>

            <div className="space-y-4 rounded-xl border border-border/70 bg-muted/15 p-4">
              <div className="flex items-start gap-2">
                <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" aria-hidden />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium">{t.visionSearchTitle}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{t.visionSearchHint}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground border-l-2 border-violet-300/80 pl-2 dark:border-violet-700">
                    {t.visionWarehouseInventorySummary
                      .replace('{total}', String(inventory.length))
                      .replace('{withImage}', String(visionBgImageRowTotal))}
                  </p>
                  {visionCatalogStats ? (
                    <div className="mt-2 space-y-1.5 rounded-md border border-violet-200/70 bg-violet-50/40 p-2.5 dark:border-violet-900/50 dark:bg-violet-950/25">
                      <p className="text-[11px] font-medium text-foreground">{t.visionCatalogSyncStatsTitle}</p>
                      <ul className="list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-muted-foreground">
                        <li>
                          {t.visionCatalogSyncStatsLineSynced.replace(
                            '{n}',
                            String(visionCatalogStats.syncedUpToDate)
                          )}
                        </li>
                        <li>
                          {t.visionCatalogSyncStatsLinePending.replace(
                            '{n}',
                            String(visionCatalogStats.pendingSync)
                          )}
                        </li>
                        <li>
                          {t.visionCatalogSyncStatsLineNoHttps.replace(
                            '{n}',
                            String(visionCatalogStats.noHttpsImageUrl)
                          )}
                        </li>
                        <li>
                          {t.visionCatalogSyncStatsLineExcluded.replace(
                            '{n}',
                            String(visionCatalogStats.visionCatalogExcluded)
                          )}
                        </li>
                      </ul>
                      <p className="text-[10px] leading-relaxed text-muted-foreground pt-0.5">
                        {t.visionCatalogSyncStatsExplain}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-background/60 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{t.visionSearchEnable}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {form.vision_index_ready ? t.visionIndexReady : t.visionIndexNotReady}
                    {form.vision_index_synced_at
                      ? ` · ${t.visionLastSynced}: ${new Date(form.vision_index_synced_at).toLocaleString()}`
                      : ''}
                  </p>
                  {form.vision_index_error ? (
                    form.vision_index_error === VISION_WAREHOUSE_REINDEX_PENDING_CODE ? (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-1 leading-relaxed whitespace-pre-wrap break-words">
                        {t.visionWarehouseReindexPending}
                      </p>
                    ) : form.vision_index_error === VISION_WAREHOUSE_CORPUS_UNSUPPORTED_TYPE_CODE ? (
                      <p className="text-[11px] text-destructive mt-1 leading-relaxed whitespace-pre-wrap break-words">
                        {t.visionWarehouseCorpusUnsupportedType}
                      </p>
                    ) : isVisionProductSearchMaintenanceError(form.vision_index_error) ? (
                      <div className="text-[11px] text-destructive mt-1 space-y-1">
                        <p className="font-medium">{t.visionProductSearchMaintenanceTitle}</p>
                        <p className="leading-relaxed whitespace-pre-wrap break-words">
                          {t.visionProductSearchMaintenanceDetail}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-destructive mt-1 whitespace-pre-wrap break-words">
                        {t.visionSyncErrorLabel}: {form.vision_index_error}
                      </p>
                    )
                  ) : null}
                </div>
                <Switch
                  checked={form.vision_product_search_enabled}
                  onCheckedChange={handleVisionProductSearchToggle}
                  disabled={pending || visionSyncing}
                  aria-label={t.visionSearchEnable}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.visionShopCountryLabel}</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.visionShopCountryHint}</p>
                <Select
                  value={visionShopCountrySelectValue}
                  onValueChange={(v) => {
                    if (v === VISION_SHOP_COUNTRY_SELECT_CUSTOM) {
                      persistPartial({ vision_shop_country: '' })
                      return
                    }
                    const loc = getVisionLocationForShopCountry(v)
                    if (loc) persistPartial({ vision_shop_country: v, vision_location: loc })
                  }}
                  disabled={pending || visionSyncing}
                >
                  <SelectTrigger className="h-10 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={VISION_SHOP_COUNTRY_SELECT_CUSTOM}>{t.visionShopCountryCustom}</SelectItem>
                    {VISION_SHOP_COUNTRY_CODES_ORDERED.map((code) => (
                      <SelectItem key={code} value={code}>
                        {regionDisplayNames.of(code) ?? code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {visionShopCountrySelectValue === VISION_SHOP_COUNTRY_SELECT_CUSTOM ? (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{t.visionShopCountryAdvancedHint}</p>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t.visionLocationLabel}</Label>
                  <Select
                    value={form.vision_location}
                    onValueChange={(v) =>
                      persistPartial({
                        vision_location: normalizeVisionProductSearchLocation(v),
                        vision_shop_country: '',
                      })
                    }
                    disabled={pending || visionSyncing}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISION_LOCATIONS.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t.visionCategoryLabel}</Label>
                  <Select
                    value={form.vision_product_category}
                    onValueChange={(v) => persistPartial({ vision_product_category: v })}
                    disabled={pending}
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISION_PRODUCT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vision-bucket">{t.visionBucketOverrideLabel}</Label>
                <Input
                  id="vision-bucket"
                  value={form.vision_gcs_bucket}
                  placeholder="my-vision-catalog-bucket"
                  onChange={(e) => setForm((f) => ({ ...f, vision_gcs_bucket: e.target.value }))}
                  onBlur={() => persistPartial({ vision_gcs_bucket: formRef.current.vision_gcs_bucket })}
                  disabled={pending || visionSyncing}
                />
                <p className="text-xs text-muted-foreground">{t.visionBucketOverrideHint}</p>
              </div>
              <div className="space-y-1.5">
                <Button type="button" variant="secondary" disabled={pending || visionSyncing} onClick={runVisionSync}>
                  {visionSyncing ? t.visionSyncing : t.visionSyncButton}
                </Button>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                  {t.visionSyncAutoWhenEnableHint}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                  {t.visionInventoryDeleteRemovesIndexNote}
                </p>
              </div>

              <div className="space-y-3 rounded-lg border border-dashed border-violet-200/80 bg-violet-50/30 p-3 dark:border-violet-800/60 dark:bg-violet-950/20">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t.visionBgSyncTitle}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">{t.visionBgSyncHint}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                    {t.visionBgSyncUseResumeHint}
                  </p>
                  {visionBgActive ? (
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                      {t.visionBgSyncPollingNote}
                    </p>
                  ) : null}
                  {visionBgActive ? (
                    <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                      {t.visionBgSyncPostRefreshExplain}
                    </p>
                  ) : null}
                  {visionBgActive && form.vision_bg_sync_status === 'queued' ? (
                    <p className="max-w-xl rounded-md border border-amber-200/90 bg-amber-50/90 p-2 text-[11px] leading-relaxed text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100">
                      {t.visionBgSyncQueuedExplain}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={visionBgActive ? 'default' : 'secondary'}>
                    {visionBgStatusLabel(t, form.vision_bg_sync_status)}
                  </Badge>
                  {visionBgActive ? (
                    <span className="text-xs text-muted-foreground">
                      {t.visionBgSyncFieldRounds}: {form.vision_bg_sync_rounds} · {t.visionBgSyncFieldImported}:{' '}
                      {form.vision_bg_sync_imported} · {t.visionBgSyncFieldRemoved}: {form.vision_bg_sync_removed}
                    </span>
                  ) : null}
                </div>
                {visionBgActive ? (
                  <div className="rounded-md border border-violet-200/80 bg-background/90 p-3 dark:border-violet-900/50">
                    <p className="mb-2 text-xs font-medium text-foreground">{t.visionBgSyncProgressTitle}</p>
                    {visionBgImageRowTotal > 0 ? (
                      <>
                        <p className="mb-2 text-xs text-muted-foreground">
                          {t.visionBgSyncProgressRatio
                            .replace('{imported}', String(form.vision_bg_sync_imported))
                            .replace('{total}', String(visionBgImageRowTotal))}
                        </p>
                        <div
                          className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.min(
                            100,
                            Math.round((form.vision_bg_sync_imported / visionBgImageRowTotal) * 100)
                          )}
                        >
                          <div
                            className="h-full rounded-full bg-violet-600 transition-[width] duration-300 ease-out dark:bg-violet-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((form.vision_bg_sync_imported / visionBgImageRowTotal) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                          {t.visionBgSyncProgressHint}
                        </p>
                      </>
                    ) : (
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        {t.visionBgSyncProgressNoImageRows}
                      </p>
                    )}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={pending || visionSyncing || visionBgActive || !form.vision_product_search_enabled}
                    onClick={handleEnqueueVisionBgSync}
                  >
                    {t.visionBgSyncButton}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={pending || !visionBgActive}
                    onClick={handleCancelVisionBgSync}
                  >
                    {t.visionBgSyncCancel}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    className="bg-violet-600 hover:bg-violet-700 dark:bg-violet-600 dark:hover:bg-violet-500"
                    disabled={pending || !visionBgActive || visionBgRunSliceBusy}
                    onClick={() => void handleRunVisionBgSyncSlice()}
                  >
                    {visionBgRunSliceBusy ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                        {t.visionBgSyncRunSliceButton}
                      </>
                    ) : (
                      t.visionBgSyncRunSliceButton
                    )}
                  </Button>
                  {(form.vision_bg_sync_status === 'done' || form.vision_bg_sync_status === 'error') && (
                    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={handleDismissVisionBgReport}>
                      {t.visionBgSyncDismiss}
                    </Button>
                  )}
                </div>
                {visionBgActive ? (
                  <p className="text-[10px] leading-relaxed text-muted-foreground max-w-xl">{t.visionBgSyncRunSliceHint}</p>
                ) : null}
                {showVisionBgReportBlock ? (
                  <div className="rounded-md border bg-background/80 p-3 text-xs space-y-1.5">
                    <p className="font-medium text-sm">{t.visionBgSyncReportTitle}</p>
                    {visionBgReportLines.map((line, i) => (
                      <p key={i} className="text-muted-foreground whitespace-pre-wrap break-words">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div className="min-w-0">
                <Label className="text-sm font-medium">{t.disclosureToggle}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t.disclosureSuffixHint}</p>
                <p className="text-[11px] font-medium text-violet-600/90 dark:text-violet-400 mt-1">
                  {form.append_ai_disclosure ? t.disclosureSwitchOn : t.disclosureSwitchOff}
                </p>
              </div>
              <Switch
                checked={form.append_ai_disclosure}
                onCheckedChange={(c) => persistPartial({ append_ai_disclosure: c })}
                disabled={pending}
                aria-label={t.disclosureToggle}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-disclosure">{t.disclosureSuffixLabel}</Label>
              <Textarea
                id="ai-disclosure"
                rows={2}
                value={form.disclosure_suffix}
                onChange={(e) => setForm((f) => ({ ...f, disclosure_suffix: e.target.value }))}
                disabled={!form.append_ai_disclosure}
                className="resize-none"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveSettings} disabled={pending}>
                {t.saveSettings}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed border-t pt-3">{t.cronSetupHint}</p>
          </TabsContent>

          <TabsContent value="faq" className="mt-0 space-y-4">
            <FaqEditor
              partnerId={partnerId}
              t={t}
              faqs={faqs}
              onChanged={load}
              saveOkMessage={saveOkMessage}
              pending={pending}
              startTransition={startTransition}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="inv" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
              <p className="text-sm font-medium tabular-nums">
                {t.inventoryProductCountSummary.replace('{count}', String(inventory.length))}
              </p>
            </div>
            <InventoryEditor
              partnerId={partnerId}
              t={t}
              rows={inventory}
              onChanged={load}
              saveOkMessage={saveOkMessage}
              pending={pending}
              startTransition={startTransition}
              toast={toast}
            />
          </TabsContent>

          <TabsContent value="usage" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.tokenUsageIntro.replace(/\{days\}/g, String(tokenUsageLookbackDays))}
            </p>
            {tokenUsageRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.tokenUsageEmpty}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="p-2 font-medium">{t.tokenUsageColProvider}</th>
                      <th className="p-2 font-medium">{t.tokenUsageColModel}</th>
                      <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                      <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                      <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                      <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenUsageRows.map((row) => (
                      <tr key={`${row.provider}:${row.model}`} className="border-b border-border/60 last:border-0">
                        <td className="p-2 capitalize">{row.provider}</td>
                        <td className="p-2 font-mono text-[11px]">{row.model}</td>
                        <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                        <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                        <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                        <td className="p-2 tabular-nums font-medium">{tokenFmt.format(row.sum_total_tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

function PresetFaqCard({
  partnerId,
  presetKey,
  row,
  t,
  saveOkMessage,
  pending,
  startTransition,
  toast,
  onSaved,
}: {
  partnerId: string
  presetKey: PartnerFaqPresetKey
  row: FaqRow | undefined
  t: AiT
  saveOkMessage: string
  pending: boolean
  startTransition: (cb: () => Promise<void>) => void
  toast: ReturnType<typeof useToast>['toast']
  onSaved: () => void
}) {
  const [answer, setAnswer] = useState(row?.answer ?? '')
  const [isActive, setIsActive] = useState(row?.is_active ?? false)

  useEffect(() => {
    setAnswer(row?.answer ?? '')
    setIsActive(row?.is_active ?? false)
  }, [row?.id, row?.answer, row?.is_active, partnerId, presetKey])

  const save = () => {
    startTransition(async () => {
      const res = await savePartnerFaqPreset(partnerId, presetKey, { answer, is_active: isActive })
      if ('error' in res && res.error) {
        toast({
          title:
            res.error === PARTNER_FAQ_PRESET_ANSWER_REQUIRED ? t.faqPresetAnswerRequired : res.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: saveOkMessage })
      onSaved()
    })
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug pr-2">{t.faqPresetQuestions[presetKey]}</p>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-input"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t.faqActiveLabel}
        </label>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">{t.faqAnswerLabel}</Label>
        <Textarea
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="min-h-[72px] resize-y"
        />
      </div>
      <Button type="button" size="sm" onClick={save} disabled={pending}>
        {t.saveRow}
      </Button>
    </div>
  )
}

function FaqEditor({
  partnerId,
  t,
  faqs,
  onChanged,
  saveOkMessage,
  pending,
  startTransition,
  toast,
}: {
  partnerId: string
  t: AiT
  faqs: FaqRow[]
  onChanged: () => void
  saveOkMessage: string
  pending: boolean
  startTransition: (cb: () => Promise<void>) => void
  toast: ReturnType<typeof useToast>['toast']
}) {
  const customFaqs = faqs.filter((r) => !r.preset_key)
  const [draft, setDraft] = useState({
    id: null as string | null,
    custom_title: '',
    trigger_keywords: '',
    answer: '',
    sort_order: 100,
    is_active: true,
  })

  const nextCustomSortOrder = useCallback(
    () =>
      customFaqs.length === 0 ? 100 : Math.max(100, ...customFaqs.map((r) => r.sort_order)) + 1,
    [customFaqs]
  )

  const resetDraft = () =>
    setDraft({
      id: null,
      custom_title: '',
      trigger_keywords: '',
      answer: '',
      sort_order: nextCustomSortOrder(),
      is_active: true,
    })

  useEffect(() => {
    if (!draft.id) setDraft((d) => ({ ...d, sort_order: nextCustomSortOrder() }))
  }, [draft.id, nextCustomSortOrder])

  const editCustomRow = (r: FaqRow) => {
    setDraft({
      id: r.id,
      custom_title: r.custom_title ?? '',
      trigger_keywords: r.trigger_keywords,
      answer: r.answer,
      sort_order: r.sort_order,
      is_active: r.is_active,
    })
  }

  const saveCustom = () => {
    if (!draft.answer.trim()) return
    startTransition(async () => {
      const res = await upsertPartnerFaq(partnerId, draft.id, {
        custom_title: draft.custom_title,
        trigger_keywords: draft.trigger_keywords,
        answer: draft.answer.trim(),
        sort_order: draft.sort_order,
        is_active: draft.is_active,
      })
      if ('error' in res && res.error) {
        toast({
          title:
            res.error === PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED
              ? t.faqCustomKeywordsRequired
              : res.error,
          variant: 'destructive',
        })
        return
      }
      toast({ title: saveOkMessage })
      resetDraft()
      onChanged()
    })
  }

  const delCustom = (id: string) => {
    startTransition(async () => {
      const res = await deletePartnerFaq(partnerId, id)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: saveOkMessage })
      if (draft.id === id) resetDraft()
      onChanged()
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{t.faqPresetsIntro}</p>
      <p className="text-[11px] text-muted-foreground">{t.faqPresetSaveHint}</p>

      <ul className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
        {PARTNER_FAQ_PRESET_KEYS.map((key) => (
          <li key={key}>
            <PresetFaqCard
              partnerId={partnerId}
              presetKey={key}
              row={faqs.find((r) => r.preset_key === key)}
              t={t}
              saveOkMessage={saveOkMessage}
              pending={pending}
              startTransition={startTransition}
              toast={toast}
              onSaved={onChanged}
            />
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-semibold">{t.faqCustomSectionTitle}</h4>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.faqCustomSectionIntro}</p>

        {customFaqs.length > 0 ? (
          <ul className="max-h-[28vh] space-y-2 overflow-y-auto pr-1">
            {customFaqs.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border bg-muted/20 p-3 text-sm shadow-sm transition-colors hover:border-violet-200/80 dark:hover:border-violet-800/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-normal">
                        #{r.sort_order}
                      </Badge>
                      {!r.is_active ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {t.inactiveBadge}
                        </Badge>
                      ) : null}
                    </div>
                    {r.custom_title?.trim() ? (
                      <p className="line-clamp-2 text-sm font-medium text-foreground">{r.custom_title.trim()}</p>
                    ) : null}
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {t.faqKeywordsLabel}: {r.trigger_keywords || '—'}
                    </p>
                    <p className="line-clamp-3 whitespace-pre-wrap">{r.answer}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => editCustomRow(r)} disabled={pending}>
                      {t.edit}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => delCustom(r.id)}
                      disabled={pending}
                    >
                      {t.deleteRow}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-dashed border-violet-300/60 bg-violet-50/30 p-4 space-y-3 dark:border-violet-800/50 dark:bg-violet-950/20">
          <h4 className="text-sm font-semibold">{draft.id ? t.edit : t.faqCustomAddTitle}</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.faqCustomQuestionLabel}</Label>
              <Input
                value={draft.custom_title}
                onChange={(e) => setDraft((d) => ({ ...d, custom_title: e.target.value }))}
              />
              <p className="text-[11px] text-muted-foreground">{t.faqCustomQuestionHint}</p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.faqKeywordsLabel}</Label>
              <Textarea
                rows={2}
                value={draft.trigger_keywords}
                onChange={(e) => setDraft((d) => ({ ...d, trigger_keywords: e.target.value }))}
                placeholder={t.faqKeywordsHint}
              />
              <p className="text-[11px] text-muted-foreground">{t.faqKeywordsHint}</p>
            </div>
            <div className="space-y-2">
              <Label>{t.faqSortLabel}</Label>
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={draft.is_active}
                  onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
                />
                {t.faqActiveLabel}
              </label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>{t.faqAnswerLabel}</Label>
              <Textarea
                rows={4}
                value={draft.answer}
                onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveCustom} disabled={pending || !draft.answer.trim()}>
              {t.saveRow}
            </Button>
            {draft.id ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={pending}>
                {t.cancelEdit}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

/** POST multipart với tiến trình upload (fetch không hỗ trợ upload progress). */
function postInventoryExcelImport(
  url: string,
  formData: FormData,
  onProgress: (info: { percent: number | null }) => void
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress({ percent: Math.min(100, Math.round((100 * ev.loaded) / ev.total)) })
      } else {
        onProgress({ percent: null })
      }
    }
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        text: xhr.responseText ?? '',
      })
    }
    xhr.onerror = () => reject(new Error('network'))
    xhr.send(formData)
  })
}

function mapInventoryImportError(code: string | undefined, t: AiT): string {
  switch (code) {
    case 'INVALID_XLSX':
      return t.inventoryErrInvalidXlsx
    case 'EMPTY_WORKBOOK':
    case 'EMPTY_SHEET':
      return t.inventoryErrEmptySheet
    case 'MISSING_NAME_COLUMN':
      return t.inventoryErrMissingName
    case 'NO_DATA_ROWS':
      return t.inventoryErrNoRows
    case 'NO_FILE':
      return t.inventoryErrNoFile
    case 'FILE_TOO_LARGE':
      return t.inventoryErrFileTooLarge
    default:
      return code || t.inventoryImportFailed
  }
}

function InventoryEditor({
  partnerId,
  t,
  rows,
  onChanged,
  saveOkMessage,
  pending,
  startTransition,
  toast,
}: {
  partnerId: string
  t: AiT
  rows: InvRow[]
  onChanged: () => void
  saveOkMessage: string
  pending: boolean
  startTransition: (cb: () => Promise<void>) => void
  toast: ReturnType<typeof useToast>['toast']
}) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const [excelBusy, setExcelBusy] = useState(false)
  /** Chỉ khi nhập Excel: % hoặc null = không xác định (thanh pulse) */
  const [excelImportProgress, setExcelImportProgress] = useState<{ percent: number | null } | null>(null)

  const [draft, setDraft] = useState({
    id: null as string | null,
    name: '',
    sku: '',
    description: '',
    stock_note: '',
    price_hint: '',
    image_url: '',
    product_url: '',
    consult_note: '',
    sort_order: 0,
  })

  const resetDraft = () =>
    setDraft({
      id: null,
      name: '',
      sku: '',
      description: '',
      stock_note: '',
      price_hint: '',
      image_url: '',
      product_url: '',
      consult_note: '',
      sort_order: rows.length,
    })

  useEffect(() => {
    if (!draft.id) setDraft((d) => ({ ...d, sort_order: rows.length }))
  }, [rows.length, draft.id])

  const editRow = (r: InvRow) => {
    setDraft({
      id: r.id,
      name: r.name,
      sku: r.sku ?? '',
      description: r.description,
      stock_note: r.stock_note,
      price_hint: r.price_hint,
      image_url: r.image_url ?? '',
      product_url: r.product_url ?? '',
      consult_note: r.consult_note ?? '',
      sort_order: r.sort_order,
    })
  }

  const save = () => {
    if (!draft.name.trim()) return
    startTransition(async () => {
      const res = await upsertPartnerInventoryItem(partnerId, draft.id, {
        name: draft.name,
        sku: draft.sku,
        description: draft.description,
        stock_note: draft.stock_note,
        price_hint: draft.price_hint,
        image_url: draft.image_url,
        product_url: draft.product_url,
        consult_note: draft.consult_note,
        sort_order: draft.sort_order,
      })
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: saveOkMessage })
      resetDraft()
      onChanged()
    })
  }

  const del = (id: string) => {
    startTransition(async () => {
      const res = await deletePartnerInventoryItem(partnerId, id)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      toast({ title: saveOkMessage })
      if (draft.id === id) resetDraft()
      onChanged()
    })
  }

  const downloadTemplate = async () => {
    setExcelBusy(true)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/template`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        toast({ title: t.inventoryImportFailed, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      downloadBlob(blob, 'mau-danh-sach-kho-hang.xlsx')
    } catch {
      toast({ title: t.inventoryImportFailed, variant: 'destructive' })
    } finally {
      setExcelBusy(false)
    }
  }

  const exportExcel = async () => {
    setExcelBusy(true)
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/export`, {
        credentials: 'same-origin',
      })
      if (!res.ok) {
        toast({ title: t.inventoryImportFailed, variant: 'destructive' })
        return
      }
      const blob = await res.blob()
      const dateStr = new Date().toISOString().slice(0, 10)
      downloadBlob(blob, `kho-hang-export-${dateStr}.xlsx`)
    } catch {
      toast({ title: t.inventoryImportFailed, variant: 'destructive' })
    } finally {
      setExcelBusy(false)
    }
  }

  const onPickImport = () => importInputRef.current?.click()

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!window.confirm(t.inventoryImportReplaceWarning)) return
    setExcelBusy(true)
    setExcelImportProgress({ percent: 0 })
    try {
      const fd = new FormData()
      fd.set('file', file)
      const url = `/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/import`
      const { ok, text } = await postInventoryExcelImport(url, fd, setExcelImportProgress)
      setExcelImportProgress({ percent: 100 })
      let data: {
        ok?: boolean
        count?: number
        inserted?: number
        updated?: number
        deleted?: number
        error?: string
      } = {}
      try {
        data = JSON.parse(text) as typeof data
      } catch {
        data = {}
      }
      if (!ok) {
        toast({
          title: mapInventoryImportError(data.error, t),
          variant: 'destructive',
        })
        return
      }
      toast({
        title: t.inventoryImportSuccess
          .replace('{count}', String(data.count ?? 0))
          .replace('{inserted}', String(data.inserted ?? 0))
          .replace('{updated}', String(data.updated ?? 0))
          .replace('{deleted}', String(data.deleted ?? 0)),
      })
      resetDraft()
      onChanged()
    } catch {
      toast({ title: t.inventoryImportFailed, variant: 'destructive' })
    } finally {
      setExcelBusy(false)
      setExcelImportProgress(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={excelBusy || pending}
          onClick={() => void downloadTemplate()}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t.inventoryDownloadTemplate}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={excelBusy || pending}
          onClick={() => void exportExcel()}
        >
          <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t.inventoryExportExcel}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={excelBusy || pending}
          onClick={onPickImport}
        >
          <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t.inventoryImportExcel}
        </Button>
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(ev) => void onImportFile(ev)}
        />
      </div>
      {excelImportProgress ? (
        <div
          className="rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mb-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {excelImportProgress.percent === null
                ? t.inventoryExcelImportSending
                : t.inventoryExcelImportUploading}
            </span>
            {excelImportProgress.percent != null ? (
              <span className="tabular-nums font-medium text-foreground">{excelImportProgress.percent}%</span>
            ) : null}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            {excelImportProgress.percent != null ? (
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
                style={{ width: `${excelImportProgress.percent}%` }}
              />
            ) : (
              <div className="h-full w-full animate-pulse rounded-full bg-primary/70" />
            )}
          </div>
        </div>
      ) : null}
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t.inventoryOpenApiHint}{' '}
        <Link
          href="/dashboard/api-integration"
          className="text-violet-600 underline underline-offset-2 dark:text-violet-400"
        >
          {t.inventoryOpenApiLink}
        </Link>
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyInventory}</p> : null}
      <ul className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 gap-2">
                {(() => {
                  const iu = r.image_url?.trim() ?? ''
                  const show =
                    iu &&
                    (/^https?:\/\//i.test(iu) || iu.startsWith('//'))
                  const src = iu.startsWith('//') ? `https:${iu}` : iu
                  return show ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-md border object-cover"
                  />
                  ) : null
                })()}
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.sku ? (
                    <Badge variant="outline" className="text-[10px] font-mono font-normal">
                      {r.sku}
                    </Badge>
                  ) : null}
                </div>
                {r.description ? <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.description}</p> : null}
                <p className="text-xs mt-1 text-muted-foreground">
                  {r.stock_note ? (
                    <span className="mr-2">
                      {t.inventoryStock}: {r.stock_note}
                    </span>
                  ) : null}
                  {r.price_hint ? <span>{r.price_hint}</span> : null}
                </p>
                {r.product_url?.trim() && /^https?:\/\//i.test(r.product_url.trim()) ? (
                  <p className="mt-1 text-[11px]">
                    <a
                      href={r.product_url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-violet-600 underline underline-offset-2 dark:text-violet-400"
                    >
                      {t.inventoryOpenProductPage}
                    </a>
                  </p>
                ) : null}
                {r.consult_note?.trim() ? (
                  <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.consult_note.trim()}</p>
                ) : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => editRow(r)} disabled={pending}>
                  {t.edit}
                </Button>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => del(r.id)} disabled={pending}>
                  {t.deleteRow}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-dashed border-violet-300/60 bg-violet-50/30 dark:border-violet-800/50 dark:bg-violet-950/20 p-4 space-y-3">
        <h4 className="text-sm font-semibold">{draft.id ? t.edit : t.addInventory}</h4>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.inventoryFieldsGuide}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t.inventoryName}</Label>
            <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.inventorySku}</Label>
            <Input value={draft.sku} onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.inventoryDesc}</Label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
            <p className="text-[11px] text-muted-foreground">{t.inventoryDescHint}</p>
          </div>
          <div className="space-y-2">
            <Label>{t.inventoryStock}</Label>
            <Input value={draft.stock_note} onChange={(e) => setDraft((d) => ({ ...d, stock_note: e.target.value }))} />
            <p className="text-[11px] text-muted-foreground">{t.inventoryStockHint}</p>
          </div>
          <div className="space-y-2">
            <Label>{t.inventoryPrice}</Label>
            <Input value={draft.price_hint} onChange={(e) => setDraft((d) => ({ ...d, price_hint: e.target.value }))} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.inventoryImageUrl}</Label>
            <Input
              value={draft.image_url}
              maxLength={2048}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
              placeholder="https://"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">{t.inventoryImageUrlHint}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.inventoryProductUrl}</Label>
            <Input
              value={draft.product_url}
              maxLength={2048}
              onChange={(e) => setDraft((d) => ({ ...d, product_url: e.target.value }))}
              placeholder="https://"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">{t.inventoryProductUrlHint}</p>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.inventoryConsultNote}</Label>
            <Textarea
              rows={2}
              value={draft.consult_note}
              onChange={(e) => setDraft((d) => ({ ...d, consult_note: e.target.value }))}
            />
            <p className="text-[11px] text-muted-foreground">{t.inventoryConsultNoteHint}</p>
          </div>
          <div className="space-y-2">
            <Label>{t.inventorySort}</Label>
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending || !draft.name.trim()}>
            {t.saveRow}
          </Button>
          {draft.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={pending}>
              {t.cancelEdit}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

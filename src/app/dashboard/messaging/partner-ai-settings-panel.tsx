'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import type { Database } from '@/types/database.types'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import {
  deletePartnerInventoryItem,
  getPartnerAiBundle,
  getPartnerBirthdayPromoSettings,
  savePartnerBirthdayPromoSettings,
  getPartnerInventoryEmbeddingStats,
  getPartnerInventoryTextEmbeddingStats,
  triggerPartnerInventoryEmbeddingSync,
  getPartnerInventoryPage,
  getPartnerAiTokenUsageStats,
  getPartnerAiUsageAnalytics,
  savePartnerAiSettings,
  upsertPartnerInventoryItem,
  type PartnerInventoryEmbeddingStats,
  type PartnerAiSettingsClientRow,
  type PartnerAiSettingsPayload,
  type PartnerAiTokenUsageStatRowWithCostEstimate,
  type PartnerAiTokenUsageKindStatRow,
  type PartnerAiTokenDailyStatRow,
  type PartnerAiTokenUsageDetailRowWithCostEstimate,
  type PartnerAiImageGenUsageStatRow,
  type OwnerCreditEventSummaryRow,
  type OwnerCreditEventDetailRow,
  type PartnerLogoCreditRow,
  type PartnerImageEmbedUsageDetailRow,
  type PartnerImageEmbedUsageSummaryRow,
  type PartnerTextEmbedUsageDetailRow,
  type PartnerTextEmbedUsageSummaryRow,
  type PartnerAiUsageCostBreakdown,
  type PartnerAiUsagePeriod,
  type PartnerAiUsageQuery,
} from '@/app/dashboard/messaging/actions'
import { PartnerInventoryExternalSyncCard } from '@/app/dashboard/messaging/partner-inventory-external-sync-card'
import { buildGuestConsultChatAbsoluteUrl, buildGuestConsultChatPath } from '@/lib/messaging/build-guest-consult-chat-link'
import { validateInventoryHttpUrl } from '@/lib/messaging/inventory-http-url'
import { normalizeGuestPurchaseFlow } from '@/lib/messaging/guest-purchase-flow'
import { Bot, Cake, Copy, Download, FileSpreadsheet, Image as ImageIcon, Search, Sparkles, Upload } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'

type AiT = Dictionary['partnerMessagingAi']
type SettingsRow = PartnerAiSettingsClientRow

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']
function parseStockQtyInput(raw: string): string {
  const n = Math.max(0, Math.floor(Number(raw || '0') || 0))
  return String(n)
}

const tokenFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const creditFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 0 })
const vndFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

function utcYmdToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateTimeForLocale(iso: string, locale: WebLocale): string {
  const tag =
    locale === 'vi'
      ? 'vi-VN'
      : locale === 'zh'
        ? 'zh-CN'
        : locale === 'ja'
          ? 'ja-JP'
          : locale === 'ko'
            ? 'ko-KR'
            : 'en-US'
  try {
    return new Date(iso).toLocaleString(tag, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

/** `dayUtc` dạng YYYY-MM-DD — hiển thị theo locale, múi UTC. */
function dayUtcForLocale(dayUtc: string, locale: WebLocale): string {
  const tag =
    locale === 'vi'
      ? 'vi-VN'
      : locale === 'zh'
        ? 'zh-CN'
        : locale === 'ja'
          ? 'ja-JP'
          : locale === 'ko'
            ? 'ko-KR'
            : 'en-US'
  try {
    const [y, m, d] = dayUtc.split('-').map((x) => Number.parseInt(x, 10))
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dayUtc
    const dt = new Date(Date.UTC(y, m - 1, d))
    return dt.toLocaleDateString(tag, { timeZone: 'UTC', dateStyle: 'medium' })
  } catch {
    return dayUtc
  }
}

function tokenUsageDetailKindLabel(row: PartnerAiTokenUsageDetailRowWithCostEstimate, t: AiT): string {
  const k = row.usage_kind
  if (!k) return t.usageTokenKindInbox
  if (k === 'material_infer') return t.usageTokenKindMaterialInfer
  if (k === 'image_material_detail') return t.usageImageGenKindMaterial
  if (k === 'image_real_use') return t.usageImageGenKindRealUse
  return k
}

function tokenUsageKindStatLabel(kind: string | null, t: AiT): string {
  if (kind == null || kind === '') return t.usageTokenKindInbox
  if (kind === 'material_infer') return t.usageTokenKindMaterialInfer
  if (kind === 'image_material_detail') return t.usageImageGenKindMaterial
  if (kind === 'image_real_use') return t.usageImageGenKindRealUse
  return kind
}

function defaultsFromSettings(s: SettingsRow | null) {
  return {
    enabled: s?.enabled ?? false,
    reply_delay_seconds: (() => {
      const rd = Number(s?.reply_delay_seconds)
      return Number.isFinite(rd) ? Math.max(5, Math.min(30, Math.floor(rd))) : 20
    })(),
    /** Độ trễ trước khi gửi tin tự động không qua model (mua trong chat, danh sách đặt…). */
    typing_pause_min_ms: s?.typing_pause_min_ms ?? 650,
    typing_pause_max_ms: s?.typing_pause_max_ms ?? 1150,
    product_consultation_context: s?.product_consultation_context ?? '',
    append_ai_disclosure: s?.append_ai_disclosure ?? true,
    disclosure_suffix: s?.disclosure_suffix ?? '',
    vision_product_search_enabled: false,
    vision_shop_country: '',
    vision_location: 'us-central1',
    vision_product_category: 'general-v1',
    vision_gcs_bucket: '',
    vision_index_ready: false,
    vision_index_synced_at: null,
    vision_index_error: '',
    image_search_api_enabled: s?.image_search_api_enabled ?? false,
    image_search_api_key_configured: s?.image_search_api_key_configured ?? false,
    vision_bg_sync_status: 'idle',
    vision_bg_sync_resume_after_id: null,
    vision_bg_sync_rounds: 0,
    vision_bg_sync_imported: 0,
    vision_bg_sync_removed: 0,
    vision_bg_sync_started_at: null,
    vision_bg_sync_finished_at: null,
    vision_bg_sync_error: '',
    vision_bg_sync_report: '',
    guest_purchase_flow: normalizeGuestPurchaseFlow(s?.guest_purchase_flow),
  }
}

type FormState = ReturnType<typeof defaultsFromSettings>

function formToPayload(f: FormState): PartnerAiSettingsPayload {
  return {
    enabled: f.enabled,
    reply_delay_seconds: f.reply_delay_seconds,
    typing_pause_min_ms: f.typing_pause_min_ms,
    typing_pause_max_ms: f.typing_pause_max_ms,
    product_consultation_context: f.product_consultation_context,
    append_ai_disclosure: f.append_ai_disclosure,
    disclosure_suffix: f.disclosure_suffix,
    vision_product_search_enabled: f.vision_product_search_enabled,
    vision_shop_country: f.vision_shop_country,
    vision_location: f.vision_location,
    vision_product_category: f.vision_product_category,
    vision_gcs_bucket: f.vision_gcs_bucket,
    image_search_api_enabled: f.image_search_api_enabled,
    guest_purchase_flow: f.guest_purchase_flow,
  }
}

export function PartnerAiSettingsPanel({
  partnerId,
  partnerChatSlug,
  t,
  saveOkMessage,
  aiModelId,
  locale,
}: {
  partnerId: string
  /** Slug workspace — `/messaging/p/{slug}` (link tư vấn kèm ảnh SP). */
  partnerChatSlug: string
  t: AiT
  saveOkMessage: string
  /** Model id from server (DEEPSEEK_MODEL / default deepseek-chat) */
  aiModelId: string
  locale: WebLocale
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [inventoryTotalCount, setInventoryTotalCount] = useState(0)
  const [inventoryPageSize, setInventoryPageSize] = useState(120)
  const [inventoryPage, setInventoryPage] = useState(0)
  const [inventoryLoadingMore, setInventoryLoadingMore] = useState(false)
  const [tokenUsageRows, setTokenUsageRows] = useState<PartnerAiTokenUsageStatRowWithCostEstimate[]>([])
  const [tokenUsageKindRows, setTokenUsageKindRows] = useState<PartnerAiTokenUsageKindStatRow[]>([])
  const [tokenDailyRows, setTokenDailyRows] = useState<PartnerAiTokenDailyStatRow[]>([])
  const [imageGenRows, setImageGenRows] = useState<PartnerAiImageGenUsageStatRow[]>([])
  const [usageRangeMode, setUsageRangeMode] = useState<'rolling' | 'calendar'>('rolling')
  const [usagePeriod, setUsagePeriod] = useState<PartnerAiUsagePeriod>('month')
  /** Empty until client mount so SSR and first client paint match (avoids UTC-day hydration mismatch). */
  const [usageCalendarFrom, setUsageCalendarFrom] = useState('')
  const [usageCalendarTo, setUsageCalendarTo] = useState('')
  const [usageTodayUtc, setUsageTodayUtc] = useState('')
  const [tokenDetailRows, setTokenDetailRows] = useState<PartnerAiTokenUsageDetailRowWithCostEstimate[]>([])
  const [tokenUsageEstimatedCostVndTotal, setTokenUsageEstimatedCostVndTotal] = useState(0)
  const [tokenUsageCostBreakdown, setTokenUsageCostBreakdown] = useState<PartnerAiUsageCostBreakdown | null>(
    null
  )
  const [tokenDetailsEstimatedCostVndTotal, setTokenDetailsEstimatedCostVndTotal] = useState(0)
  const [creditSummaryRows, setCreditSummaryRows] = useState<OwnerCreditEventSummaryRow[]>([])
  const [creditDetailRows, setCreditDetailRows] = useState<OwnerCreditEventDetailRow[]>([])
  const [logoCreditRows, setLogoCreditRows] = useState<PartnerLogoCreditRow[]>([])
  const [usageOwnerLinked, setUsageOwnerLinked] = useState(true)
  const [imageEmbedSummaryRows, setImageEmbedSummaryRows] = useState<PartnerImageEmbedUsageSummaryRow[]>([])
  const [imageEmbedDetailRows, setImageEmbedDetailRows] = useState<PartnerImageEmbedUsageDetailRow[]>([])
  const [textEmbedSummaryRows, setTextEmbedSummaryRows] = useState<PartnerTextEmbedUsageSummaryRow[]>([])
  const [textEmbedDetailRows, setTextEmbedDetailRows] = useState<PartnerTextEmbedUsageDetailRow[]>([])
  const [embeddingStats, setEmbeddingStats] = useState<PartnerInventoryEmbeddingStats | null>(null)
  const [textEmbeddingStats, setTextEmbeddingStats] = useState<PartnerInventoryEmbeddingStats | null>(null)
  const [embeddingSyncing, setEmbeddingSyncing] = useState(false)
  const [form, setForm] = useState<FormState>(() => defaultsFromSettings(null))
  const formRef = useRef<FormState>(form)
  const [bdayEnabled, setBdayEnabled] = useState(false)
  const [bdayDiscountPct, setBdayDiscountPct] = useState(10)
  const [bdayDaysMax, setBdayDaysMax] = useState(7)
  const [bdayDaysMin, setBdayDaysMin] = useState(1)
  const bdayPersistRef = useRef({
    enabled: false,
    discountPct: 10,
    daysMax: 7,
    daysMin: 1,
  })
  const bdayDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadSeqRef = useRef(0)
  const autoEmbedSyncStateRef = useRef<{ running: boolean; lastRunAt: number; partnerId: string | null }>({
    running: false,
    lastRunAt: 0,
    partnerId: null,
  })
  useEffect(() => {
    const d = utcYmdToday()
    setUsageCalendarFrom(d)
    setUsageCalendarTo(d)
    setUsageTodayUtc(d)
  }, [])
  /** Tránh chạy song song với nút «Đồng bộ ngay». */
  const manualEmbedLockRef = useRef(false)
  /** Đồng bộ ref mỗi render — không đưa vào deps của useEffect auto-sync (tránh cắt chuỗi lô khi pending đổi). */
  const embeddingPendingRef = useRef(0)
  embeddingPendingRef.current = embeddingStats?.pending ?? 0
  const textEmbeddingPendingRef = useRef(0)
  textEmbeddingPendingRef.current = textEmbeddingStats?.pending ?? 0

  const loadUsageAnalyticsWithSeq = useCallback(
    async (seq: number, usageQuery: PartnerAiUsageQuery) => {
      const [usageRes, analyticsRes] = await Promise.all([
        getPartnerAiTokenUsageStats(partnerId, usageQuery),
        getPartnerAiUsageAnalytics(partnerId, usageQuery),
      ])
      if (seq !== loadSeqRef.current) return
      const rangeErr =
        'error' in usageRes ? usageRes.error : 'error' in analyticsRes ? analyticsRes.error : null
      if (rangeErr) {
        toast({ title: t.loadError, description: rangeErr, variant: 'destructive' })
      }
      if ('error' in usageRes) {
        setTokenUsageRows([])
        setTokenUsageKindRows([])
        setTokenDailyRows([])
        setImageGenRows([])
        setTokenUsageEstimatedCostVndTotal(0)
        setTokenUsageCostBreakdown(null)
      } else {
        setTokenUsageRows(usageRes.rows)
        setTokenUsageEstimatedCostVndTotal(usageRes.tokenUsageEstimatedCostVndTotal ?? 0)
        setTokenUsageKindRows(usageRes.usageKindRows ?? [])
        setTokenDailyRows(usageRes.dailyRows ?? [])
        setImageGenRows(usageRes.imageGenRows ?? [])
        setTokenUsageCostBreakdown(usageRes.costBreakdown ?? null)
      }
      if ('error' in analyticsRes) {
        setTokenDetailRows([])
        setTokenDetailsEstimatedCostVndTotal(0)
        setCreditSummaryRows([])
        setCreditDetailRows([])
        setLogoCreditRows([])
        setUsageOwnerLinked(true)
        setImageEmbedSummaryRows([])
        setImageEmbedDetailRows([])
        setTextEmbedSummaryRows([])
        setTextEmbedDetailRows([])
      } else {
        setTokenDetailRows(analyticsRes.tokenDetails)
        setTokenDetailsEstimatedCostVndTotal(analyticsRes.tokenDetailsEstimatedCostVndTotal ?? 0)
        setCreditSummaryRows(analyticsRes.creditSummaries)
        setCreditDetailRows(analyticsRes.creditDetails)
        setLogoCreditRows(analyticsRes.logoCreditRows)
        setUsageOwnerLinked(analyticsRes.ownerAccountLinked)
        setImageEmbedSummaryRows(analyticsRes.imageEmbedSummaries)
        setImageEmbedDetailRows(analyticsRes.imageEmbedDetails)
        setTextEmbedSummaryRows(analyticsRes.textEmbedSummaries ?? [])
        setTextEmbedDetailRows(analyticsRes.textEmbedDetails ?? [])
      }
    },
    [partnerId, t.loadError, toast]
  )

  /** Refs so `load` does not depend on usage-tab filters — avoids extra full reload on mount + race where usage await skipped applying bundle inventory. */
  const usageRangeModeRef = useRef(usageRangeMode)
  const usagePeriodRef = useRef(usagePeriod)
  const usageCalendarFromRef = useRef(usageCalendarFrom)
  const usageCalendarToRef = useRef(usageCalendarTo)
  usageRangeModeRef.current = usageRangeMode
  usagePeriodRef.current = usagePeriod
  usageCalendarFromRef.current = usageCalendarFrom
  usageCalendarToRef.current = usageCalendarTo

  const load = useCallback((): Promise<void> => {
    const seq = ++loadSeqRef.current
    setLoadErr(null)
    setSettingsLoaded(false)
    setInventory([])
    setInventoryTotalCount(0)
    setInventoryPage(0)
    setEmbeddingStats(null)
    setTextEmbeddingStats(null)
    return (async () => {
      const [bundleRes, embeddingRes, textEmbeddingRes, bdayRes] = await Promise.all([
        getPartnerAiBundle(partnerId),
        getPartnerInventoryEmbeddingStats(partnerId),
        getPartnerInventoryTextEmbeddingStats(partnerId),
        getPartnerBirthdayPromoSettings(partnerId),
      ])
      if (seq !== loadSeqRef.current) return

      if ('error' in embeddingRes) {
        setEmbeddingStats(null)
      } else {
        setEmbeddingStats(embeddingRes.stats)
      }
      if ('error' in textEmbeddingRes) {
        setTextEmbeddingStats(null)
      } else {
        setTextEmbeddingStats(textEmbeddingRes.stats)
      }

      if ('error' in bundleRes && bundleRes.error) {
        setLoadErr(bundleRes.error)
        toast({ title: t.loadError, description: bundleRes.error, variant: 'destructive' })
        return
      }
      if (!('error' in bdayRes) && bdayRes && 'settings' in bdayRes && bdayRes.settings) {
        const bs = bdayRes.settings
        setBdayEnabled(Boolean(bs.enabled))
        setBdayDiscountPct(Math.max(0, Math.min(100, Number(bs.discount_percent) || 10)))
        setBdayDaysMax(Math.max(1, Math.min(120, Number(bs.offer_days_before_max) || 7)))
        setBdayDaysMin(Math.max(1, Math.min(120, Number(bs.offer_days_before_min) || 1)))
      }
      if ('settings' in bundleRes) {
        const next = defaultsFromSettings(bundleRes.settings ?? null)
        formRef.current = next
        setForm(next)
        const inv = bundleRes.inventory ?? []
        setInventory(inv)
        setInventoryTotalCount(
          Math.max(inv.length, typeof bundleRes.inventoryTotalCount === 'number' ? bundleRes.inventoryTotalCount : 0)
        )
        setInventoryPageSize(Math.max(20, Number(bundleRes.inventoryPageSize ?? 120) || 120))
        setInventoryPage(0)
        setSettingsLoaded(true)
      } else {
        setSettingsLoaded(true)
      }

      const mode = usageRangeModeRef.current
      const usageQuery: PartnerAiUsageQuery =
        mode === 'rolling'
          ? { type: 'rolling', period: usagePeriodRef.current }
          : {
              type: 'calendar',
              fromDayUtc: usageCalendarFromRef.current || utcYmdToday(),
              toDayUtc: usageCalendarToRef.current || utcYmdToday(),
            }
      await loadUsageAnalyticsWithSeq(seq, usageQuery)
    })()
  }, [partnerId, t.loadError, toast, loadUsageAnalyticsWithSeq])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    formRef.current = form
  }, [form])

  useEffect(() => {
    bdayPersistRef.current = {
      enabled: bdayEnabled,
      discountPct: bdayDiscountPct,
      daysMax: bdayDaysMax,
      daysMin: bdayDaysMin,
    }
  }, [bdayEnabled, bdayDiscountPct, bdayDaysMax, bdayDaysMin])

  useEffect(() => {
    return () => {
      if (bdayDebounceTimerRef.current) {
        clearTimeout(bdayDebounceTimerRef.current)
        bdayDebounceTimerRef.current = null
      }
    }
  }, [])

  const applyBirthdaySettingsFromServer = useCallback((bs: {
    enabled?: boolean
    discount_percent?: number
    offer_days_before_max?: number
    offer_days_before_min?: number
  }) => {
    if (typeof bs.enabled === 'boolean') setBdayEnabled(bs.enabled)
    if (bs.discount_percent != null) {
      setBdayDiscountPct(Math.max(0, Math.min(100, Number(bs.discount_percent) || 10)))
    }
    if (bs.offer_days_before_max != null) {
      setBdayDaysMax(Math.max(1, Math.min(120, Number(bs.offer_days_before_max) || 7)))
    }
    if (bs.offer_days_before_min != null) {
      setBdayDaysMin(Math.max(1, Math.min(120, Number(bs.offer_days_before_min) || 1)))
    }
  }, [])

  /** Không bọc trong startTransition(async): React không theo dõi promise; transition + pending còn có thể khóa UI giữa chừng. */
  const flushBirthdayPromoSave = useCallback(
    (payload: {
      enabled: boolean
      discountPercent: number
      offerDaysBeforeMax: number
      offerDaysBeforeMin: number
    }) => {
      void (async () => {
        try {
          const res = await savePartnerBirthdayPromoSettings(partnerId, payload)
          if ('error' in res && res.error) {
            toast({ title: res.error, variant: 'destructive' })
            await load()
            return
          }
          const verify = await getPartnerBirthdayPromoSettings(partnerId)
          if (!('error' in verify) && verify && 'settings' in verify && verify.settings) {
            applyBirthdaySettingsFromServer(verify.settings)
          }
          toast({ title: saveOkMessage })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          toast({
            title: msg || 'Lưu cài đặt sinh nhật thất bại.',
            variant: 'destructive',
          })
          await load()
        }
      })()
    },
    [partnerId, saveOkMessage, toast, load, applyBirthdaySettingsFromServer]
  )

  const scheduleBirthdayPromoSaveDebounced = useCallback(() => {
    if (bdayDebounceTimerRef.current) clearTimeout(bdayDebounceTimerRef.current)
    bdayDebounceTimerRef.current = setTimeout(() => {
      bdayDebounceTimerRef.current = null
      const s = bdayPersistRef.current
      flushBirthdayPromoSave({
        enabled: s.enabled,
        discountPercent: s.discountPct,
        offerDaysBeforeMax: s.daysMax,
        offerDaysBeforeMin: s.daysMin,
      })
    }, 450)
  }, [flushBirthdayPromoSave])

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

  const hasMoreInventory = inventory.length < inventoryTotalCount

  const loadMoreInventory = () => {
    if (inventoryLoadingMore || !hasMoreInventory) return
    const seq = loadSeqRef.current
    setInventoryLoadingMore(true)
    const nextPage = inventoryPage + 1
    ;(async () => {
      const res = await getPartnerInventoryPage(partnerId, nextPage, inventoryPageSize)
      if (seq !== loadSeqRef.current) return
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      const rows = Array.isArray((res as { rows?: InvRow[] }).rows) ? ((res as { rows?: InvRow[] }).rows ?? []) : []
      const totalCount = Number((res as { totalCount?: number }).totalCount ?? 0)
      const page = Math.max(0, Number((res as { page?: number }).page ?? nextPage))
      setInventory((prev) => {
        const seen = new Set(prev.map((r) => r.id))
        const add = rows.filter((r) => !seen.has(r.id))
        return [...prev, ...add]
      })
      setInventoryTotalCount(Math.max(0, totalCount))
      setInventoryPage(page)
    })()
      .catch(() => {
        toast({ title: t.loadError, variant: 'destructive' })
      })
      .finally(() => setInventoryLoadingMore(false))
  }

  const runEmbeddingSync = () => {
    if (embeddingSyncing) return
    setEmbeddingSyncing(true)
    manualEmbedLockRef.current = true
    ;(async () => {
      const res = await triggerPartnerInventoryEmbeddingSync(partnerId, 1200)
      if ('error' in res && res.error) {
        toast({ title: res.error, variant: 'destructive' })
        return
      }
      const synced = Number((res as { synced?: number }).synced ?? 0)
      const failed = Number((res as { failed?: number }).failed ?? 0)
      toast({
        title: t.inventoryEmbeddingSyncDoneTitle,
        description: t.inventoryEmbeddingSyncDoneBody
          .replace('{synced}', String(synced))
          .replace('{failed}', String(failed)),
      })
      await load()
    })()
      .catch(() => {
        toast({ title: t.loadError, variant: 'destructive' })
      })
      .finally(() => {
        setEmbeddingSyncing(false)
        manualEmbedLockRef.current = false
      })
  }

  useEffect(() => {
    let cancelled = false
    /** Gọi định kỳ để bắt đầu chuỗi lô khi thống kê tải xong / còn backlog; không phụ thuộc pending trong deps để tránh hủy giữa chừng. */
    const WAKE_POLL_MS = 5000
    /** Tránh spam server khi vừa chạy xong một chuỗi nhưng vẫn còn pending (ví dụ max rounds). */
    const BETWEEN_WAKE_MIN_MS = 45_000
    const CHAIN_COOLDOWN_MS = 2000
    const CHAIN_MAX_ROUNDS = 80

    const runChainedSync = async (fromWake: boolean) => {
      const state = autoEmbedSyncStateRef.current
      if (state.running || manualEmbedLockRef.current) return
      if (embeddingPendingRef.current <= 0 && textEmbeddingPendingRef.current <= 0) return
      const now = Date.now()
      if (
        fromWake &&
        state.partnerId === partnerId &&
        now - state.lastRunAt < BETWEEN_WAKE_MIN_MS
      ) {
        return
      }

      state.running = true
      state.partnerId = partnerId
      try {
        let rounds = 0
        while (!cancelled && !manualEmbedLockRef.current && rounds < CHAIN_MAX_ROUNDS) {
          if (embeddingPendingRef.current <= 0 && textEmbeddingPendingRef.current <= 0) break
          state.lastRunAt = Date.now()
          const res = await triggerPartnerInventoryEmbeddingSync(partnerId, 1200)
          if (cancelled || ('error' in res && res.error)) break
          const [refreshed, textRefreshed] = await Promise.all([
            getPartnerInventoryEmbeddingStats(partnerId),
            getPartnerInventoryTextEmbeddingStats(partnerId),
          ])
          if (cancelled) break
          if ('stats' in refreshed && refreshed.stats) {
            setEmbeddingStats(refreshed.stats)
            embeddingPendingRef.current = refreshed.stats.pending ?? 0
          } else {
            embeddingPendingRef.current = 0
          }
          if ('stats' in textRefreshed && textRefreshed.stats) {
            setTextEmbeddingStats(textRefreshed.stats)
            textEmbeddingPendingRef.current = textRefreshed.stats.pending ?? 0
          } else {
            textEmbeddingPendingRef.current = 0
          }
          if (
            ('error' in refreshed && refreshed.error) ||
            ('error' in textRefreshed && textRefreshed.error)
          ) {
            break
          }
          const stillPending =
            (embeddingPendingRef.current > 0 || textEmbeddingPendingRef.current > 0)
          if (!stillPending) break
          rounds += 1
          await new Promise<void>((r) => window.setTimeout(r, CHAIN_COOLDOWN_MS))
        }
      } finally {
        state.running = false
      }
    }

    void runChainedSync(false)
    const timer = window.setInterval(() => {
      void runChainedSync(true)
    }, WAKE_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [partnerId])

  const usageScopeLabel = useMemo(() => {
    if (usageRangeMode === 'calendar') {
      return t.usagePeriodScopeCalendar
        .replace('{from}', usageCalendarFrom)
        .replace('{to}', usageCalendarTo)
    }
    if (usagePeriod === 'day') return t.usagePeriodScopeDay
    if (usagePeriod === 'week') return t.usagePeriodScopeWeek
    return t.usagePeriodScopeMonth
  }, [t, usageRangeMode, usageCalendarFrom, usageCalendarTo, usagePeriod])

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
                {settingsLoaded ? (form.enabled ? t.toggleStatusOn : t.toggleStatusOff) : '...'}
              </span>
              <Switch
                checked={form.enabled}
                onCheckedChange={(c) => persistPartial({ enabled: c })}
                disabled={pending || !settingsLoaded}
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
          <TabsList className="mb-4 grid w-full max-w-3xl grid-cols-2 sm:grid-cols-3 h-auto min-h-10 gap-1 p-1">
            <TabsTrigger value="settings" className="text-xs sm:text-sm">
              {t.tabSettings}
            </TabsTrigger>
            <TabsTrigger value="inv" className="text-xs sm:text-sm gap-1.5">
              {t.tabInventory}
              <Badge variant="secondary" className="h-5 min-w-5 px-1.5 font-mono text-[10px] tabular-nums">
                {inventoryTotalCount}
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
                  onChange={(e) => {
                    const v = Math.floor(Number(e.target.value))
                    setForm((f) => ({
                      ...f,
                      reply_delay_seconds: Number.isFinite(v) ? Math.min(30, Math.max(5, v)) : f.reply_delay_seconds,
                    }))
                  }}
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
              <Label htmlFor="ai-product-consult-context">{t.productConsultationContextLabel}</Label>
              <p className="text-xs text-muted-foreground">{t.productConsultationContextHint}</p>
              <Textarea
                id="ai-product-consult-context"
                rows={7}
                placeholder={t.productConsultationContextPlaceholder}
                value={form.product_consultation_context}
                onChange={(e) =>
                  setForm((f) => ({ ...f, product_consultation_context: e.target.value }))
                }
                className="resize-y min-h-[160px]"
              />
            </div>

            <div className="rounded-lg border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Cake className="h-4 w-4 text-violet-600" aria-hidden />
                    Chúc mừng sinh nhật — email &amp; ưu đãi
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    Gửi email cho khách đã chat, đã đăng nhập (email/Google) và có ngày sinh trên tài khoản, trong
                    khoảng ngày trước sinh nhật bạn chọn (mặc định 7 ngày = 1 tuần). Trong thời gian đó, giá các sản phẩm trong kho trên chat được
                    giảm theo % bạn cài — tự động khi đặt qua chat, không cần mã; khách đăng nhập sẽ thấy tin chúc mừng trong chat. Email kèm link mở chat và gợi ý sản phẩm
                    khách đã quan tâm / đặt. Cron chạy hằng ngày (cần SMTP).
                  </p>
                </div>
                <Switch
                  checked={bdayEnabled}
                  onCheckedChange={(c) => {
                    if (bdayDebounceTimerRef.current) {
                      clearTimeout(bdayDebounceTimerRef.current)
                      bdayDebounceTimerRef.current = null
                    }
                    setBdayEnabled(c)
                    bdayPersistRef.current.enabled = c
                    flushBirthdayPromoSave({
                      enabled: c,
                      discountPercent: bdayPersistRef.current.discountPct,
                      offerDaysBeforeMax: bdayPersistRef.current.daysMax,
                      offerDaysBeforeMin: bdayPersistRef.current.daysMin,
                    })
                  }}
                  disabled={pending || !settingsLoaded}
                  aria-label="Bật chương trình sinh nhật"
                />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bday-pct">Giảm giá (%)</Label>
                  <Input
                    id="bday-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={bdayDiscountPct}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(100, Math.floor(Number(e.target.value) || 0)))
                      setBdayDiscountPct(v)
                      bdayPersistRef.current.discountPct = v
                      scheduleBirthdayPromoSaveDebounced()
                    }}
                    disabled={pending || !settingsLoaded}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bday-max">Trước SN — từ (ngày)</Label>
                  <Input
                    id="bday-max"
                    type="number"
                    min={1}
                    max={120}
                    title="Số ngày trước sinh nhật — mốc xa (vd 7 = một tuần)"
                    value={bdayDaysMax}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 7)))
                      setBdayDaysMax(v)
                      bdayPersistRef.current.daysMax = v
                      scheduleBirthdayPromoSaveDebounced()
                    }}
                    disabled={pending || !settingsLoaded}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bday-min">Trước SN — đến (ngày)</Label>
                  <Input
                    id="bday-min"
                    type="number"
                    min={1}
                    max={120}
                    title="Số ngày trước sinh nhật — mốc gần (vd 1 = đến hôm trước sinh nhật)"
                    value={bdayDaysMin}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(120, Math.floor(Number(e.target.value) || 1)))
                      setBdayDaysMin(v)
                      bdayPersistRef.current.daysMin = v
                      scheduleBirthdayPromoSaveDebounced()
                    }}
                    disabled={pending || !settingsLoaded}
                  />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Công tắc và các số trên được lưu tự động (ô số lưu sau khi bạn ngừng gõ ~0,5 giây).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-guest-purchase-flow">{t.guestPurchaseFlowLabel}</Label>
              <p className="text-xs text-muted-foreground">{t.guestPurchaseFlowHint}</p>
              <Select
                value={form.guest_purchase_flow}
                onValueChange={(v: string) =>
                  persistPartial({ guest_purchase_flow: normalizeGuestPurchaseFlow(v) })
                }
                disabled={pending || !settingsLoaded}
              >
                <SelectTrigger id="ai-guest-purchase-flow" className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_chat">{t.guestPurchaseFlowInChat}</SelectItem>
                  <SelectItem value="external_site">{t.guestPurchaseFlowExternal}</SelectItem>
                </SelectContent>
              </Select>
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

          <TabsContent value="inv" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2.5">
              <p className="text-sm font-medium tabular-nums">
                {t.inventoryProductCountSummary.replace('{count}', String(inventoryTotalCount))}
              </p>
            </div>
            {embeddingStats ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{t.inventoryEmbeddingTitle}</p>
                  <Button type="button" size="sm" variant="outline" onClick={runEmbeddingSync} disabled={embeddingSyncing}>
                    {embeddingSyncing ? t.inventoryEmbeddingSyncRunning : t.inventoryEmbeddingSyncNow}
                  </Button>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t.inventoryEmbeddingSummary
                    .replace('{done}', String(embeddingStats.done))
                    .replace('{eligible}', String(embeddingStats.eligible))
                    .replace('{pending}', String(embeddingStats.pending))
                    .replace('{failed}', String(embeddingStats.failed))}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                  {t.inventoryEmbeddingAutoHint}
                </p>
              </div>
            ) : null}
            {textEmbeddingStats ? (
              <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-foreground">{t.inventoryTextEmbeddingTitle}</p>
                  <Button type="button" size="sm" variant="outline" onClick={runEmbeddingSync} disabled={embeddingSyncing}>
                    {embeddingSyncing ? t.inventoryEmbeddingSyncRunning : t.inventoryEmbeddingSyncNow}
                  </Button>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {t.inventoryTextEmbeddingSummary
                    .replace('{done}', String(textEmbeddingStats.done))
                    .replace('{eligible}', String(textEmbeddingStats.eligible))
                    .replace('{pending}', String(textEmbeddingStats.pending))
                    .replace('{failed}', String(textEmbeddingStats.failed))}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                  {t.inventoryTextEmbeddingAutoHint}
                </p>
              </div>
            ) : null}
            <PartnerInventoryExternalSyncCard partnerId={partnerId} t={t} toast={toast} />
            <InventoryEditor
              partnerId={partnerId}
              partnerChatSlug={partnerChatSlug}
              t={t}
              rows={inventory}
              onChanged={load}
              onImportCompleted={runEmbeddingSync}
              saveOkMessage={saveOkMessage}
              pending={pending}
              startTransition={startTransition}
              toast={toast}
              totalCount={inventoryTotalCount}
              hasMore={hasMoreInventory}
              loadingMore={inventoryLoadingMore}
              onLoadMore={loadMoreInventory}
            />
          </TabsContent>

          <TabsContent value="usage" className="mt-0 space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <p className="min-w-0 flex-1 text-xs text-muted-foreground leading-relaxed">
                {t.tokenUsageIntro.replace(/\{scope\}/g, usageScopeLabel)}
              </p>
              <div className="flex shrink-0 flex-wrap items-end justify-end gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground">{t.usageRangeModeLabel}</span>
                  <Select
                    value={usageRangeMode}
                    onValueChange={(v) => {
                      const mode = v as 'rolling' | 'calendar'
                      setUsageRangeMode(mode)
                      const seq = ++loadSeqRef.current
                      if (mode === 'rolling') {
                        void loadUsageAnalyticsWithSeq(seq, { type: 'rolling', period: usagePeriod })
                      } else {
                        const from = usageCalendarFrom || utcYmdToday()
                        const to = usageCalendarTo || utcYmdToday()
                        if (!usageCalendarFrom) setUsageCalendarFrom(from)
                        if (!usageCalendarTo) setUsageCalendarTo(to)
                        void loadUsageAnalyticsWithSeq(seq, {
                          type: 'calendar',
                          fromDayUtc: from,
                          toDayUtc: to,
                        })
                      }
                    }}
                  >
                    <SelectTrigger className="h-8 w-[168px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rolling">{t.usageRangeModeRolling}</SelectItem>
                      <SelectItem value="calendar">{t.usageRangeModeCalendar}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {usageRangeMode === 'rolling' ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground">{t.usagePeriodLabel}</span>
                    <Select
                      value={usagePeriod}
                      onValueChange={(v) => {
                        const p = v as PartnerAiUsagePeriod
                        setUsagePeriod(p)
                        const seq = ++loadSeqRef.current
                        void loadUsageAnalyticsWithSeq(seq, { type: 'rolling', period: p })
                      }}
                    >
                      <SelectTrigger className="h-8 w-[128px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">{t.usagePeriodDay}</SelectItem>
                        <SelectItem value="week">{t.usagePeriodWeek}</SelectItem>
                        <SelectItem value="month">{t.usagePeriodMonth}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[11px] font-normal text-muted-foreground">
                        {t.usageCalendarFromLabel}
                      </Label>
                      <Input
                        type="date"
                        className="h-8 w-[142px] text-xs"
                        value={usageCalendarFrom}
                        max={usageCalendarTo || undefined}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v) return
                          setUsageCalendarFrom(v)
                          let to = usageCalendarTo
                          if (v > to) {
                            to = v
                            setUsageCalendarTo(to)
                          }
                          const seq = ++loadSeqRef.current
                          void loadUsageAnalyticsWithSeq(seq, { type: 'calendar', fromDayUtc: v, toDayUtc: to })
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[11px] font-normal text-muted-foreground">
                        {t.usageCalendarToLabel}
                      </Label>
                      <Input
                        type="date"
                        className="h-8 w-[142px] text-xs"
                        value={usageCalendarTo}
                        min={usageCalendarFrom || undefined}
                        max={usageTodayUtc || undefined}
                        onChange={(e) => {
                          const v = e.target.value
                          if (!v) return
                          setUsageCalendarTo(v)
                          let from = usageCalendarFrom
                          if (v < from) {
                            from = v
                            setUsageCalendarFrom(from)
                          }
                          const seq = ++loadSeqRef.current
                          void loadUsageAnalyticsWithSeq(seq, { type: 'calendar', fromDayUtc: from, toDayUtc: v })
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3 dark:border-amber-500/25 dark:bg-amber-950/20">
              <div>
                <h3 className="text-sm font-semibold">{t.usageSectionCreditTitle}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.usageSectionCreditIntro}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium">{t.usageCreditLedgerTitle}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.usageCreditLedgerIntro}</p>
                {!usageOwnerLinked ? (
                  <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{t.usageNoOwnerHint}</p>
                ) : creditSummaryRows.length === 0 && creditDetailRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t.usageCreditLedgerEmpty}</p>
                ) : (
                  <div className="mt-2 space-y-3">
                    {creditSummaryRows.length > 0 ? (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left">
                              <th className="p-2 font-medium">{t.usageCreditColType}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageCreditColCount}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageCreditColAmount}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {creditSummaryRows.map((row) => (
                              <tr
                                key={row.charge_type || '(empty)'}
                                className="border-b border-border/60 last:border-0"
                              >
                                <td className="p-2 font-mono text-[11px]">{row.charge_type || '—'}</td>
                                <td className="p-2 tabular-nums">{tokenFmt.format(row.event_count)}</td>
                                <td className="p-2 tabular-nums font-medium">
                                  {creditFmt.format(row.sum_amount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {creditDetailRows.length > 0 ? (
                      <div>
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                          {t.usageCreditDetailTitle}
                        </p>
                        <div className="overflow-x-auto rounded-lg border">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b bg-muted/40 text-left">
                                <th className="p-2 font-medium">{t.usageCreditColWhen}</th>
                                <th className="p-2 font-medium">{t.usageCreditColType}</th>
                                <th className="p-2 font-medium tabular-nums">{t.usageCreditColSingle}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {creditDetailRows.map((row) => (
                                <tr key={row.id} className="border-b border-border/60 last:border-0">
                                  <td className="p-2 whitespace-nowrap tabular-nums">
                                    {dateTimeForLocale(row.created_at, locale)}
                                  </td>
                                  <td className="p-2 font-mono text-[11px]">{row.charge_type || '—'}</td>
                                  <td className="p-2 tabular-nums font-medium">
                                    {creditFmt.format(row.amount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium">{t.usageLogoCreditTitle}</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.usageLogoCreditIntro}</p>
                {logoCreditRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t.usageLogoCreditEmpty}</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="p-2 font-medium">{t.usageDetailColTime}</th>
                          <th className="p-2 font-medium">{t.usageLogoColModel}</th>
                          <th className="p-2 font-medium">{t.usageLogoColStatus}</th>
                          <th className="p-2 font-medium tabular-nums">{t.usageCreditColSingle}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logoCreditRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/60 last:border-0">
                            <td className="p-2 whitespace-nowrap tabular-nums">
                              {dateTimeForLocale(row.created_at, locale)}
                            </td>
                            <td className="p-2 font-mono text-[11px]">{row.model || '—'}</td>
                            <td className="p-2">{row.status || '—'}</td>
                            <td className="p-2 tabular-nums font-medium">
                              {creditFmt.format(row.charged_credits)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border/60 bg-muted/15 p-3 dark:bg-muted/10">
              <div>
                <h3 className="text-sm font-semibold">{t.usageSectionApiTitle}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.usageSectionApiIntro}</p>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground border-t border-border/40 pt-2">
                  {t.tokenUsageCostDisclaimer}
                </p>
                {tokenUsageCostBreakdown ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t.tokenUsageCostTablesNote}</p>
                ) : null}
                {tokenUsageEstimatedCostVndTotal > 0 ? (
                  <p className="mt-2 text-sm font-semibold tabular-nums text-foreground">
                    {t.tokenUsageEstimatedTotalLabel.replace(
                      '{amount}',
                      vndFmt.format(tokenUsageEstimatedCostVndTotal)
                    )}
                  </p>
                ) : null}
              </div>
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
                      <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
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
                        <td className="p-2 tabular-nums font-medium text-foreground">
                          {vndFmt.format(row.estimated_cost_vnd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tokenUsageCostBreakdown && tokenUsageCostBreakdown.byKind.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageByKindTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageByKindIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.usageDetailColUsageKind}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageCostBreakdown.byKind.map((row) => (
                        <tr
                          key={row.usage_kind ?? '__inbox__'}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="p-2 text-[11px] text-muted-foreground">
                            {tokenUsageKindStatLabel(row.usage_kind, t)}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                          <td className="p-2 tabular-nums font-medium text-foreground">
                            {vndFmt.format(row.estimated_cost_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : tokenUsageKindRows.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageByKindTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageByKindIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.usageDetailColUsageKind}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageKindRows.map((row) => (
                        <tr
                          key={row.usage_kind ?? '__inbox__'}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="p-2 text-[11px] text-muted-foreground">
                            {tokenUsageKindStatLabel(row.usage_kind, t)}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tokenUsageCostBreakdown && tokenUsageCostBreakdown.byKindAndModel.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageCostByKindAndModelTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t.tokenUsageCostByKindAndModelIntro}
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.usageDetailColUsageKind}</th>
                        <th className="p-2 font-medium">{t.tokenUsageColProvider}</th>
                        <th className="p-2 font-medium">{t.tokenUsageColModel}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageCostBreakdown.byKindAndModel.map((row, idx) => (
                        <tr
                          key={`${row.usage_kind ?? 'inbox'}:${row.provider}:${row.model}:${idx}`}
                          className="border-b border-border/60 last:border-0"
                        >
                          <td className="p-2 text-[11px] text-muted-foreground">
                            {tokenUsageKindStatLabel(row.usage_kind, t)}
                          </td>
                          <td className="p-2 capitalize">{row.provider}</td>
                          <td className="p-2 font-mono text-[11px]">{row.model}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                          <td className="p-2 tabular-nums font-medium text-foreground">
                            {vndFmt.format(row.estimated_cost_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tokenUsageCostBreakdown && tokenUsageCostBreakdown.daily.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageByDayTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageByDayIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.tokenUsageColDay}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageCostBreakdown.daily.map((row) => (
                        <tr key={row.day_utc} className="border-b border-border/60 last:border-0">
                          <td className="p-2 whitespace-nowrap tabular-nums">
                            {dayUtcForLocale(row.day_utc, locale)}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                          <td className="p-2 tabular-nums font-medium text-foreground">
                            {vndFmt.format(row.estimated_cost_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : tokenDailyRows.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageByDayTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageByDayIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.tokenUsageColDay}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenDailyRows.map((row) => (
                        <tr key={row.day_utc} className="border-b border-border/60 last:border-0">
                          <td className="p-2 whitespace-nowrap tabular-nums">
                            {dayUtcForLocale(row.day_utc, locale)}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tokenUsageCostBreakdown && tokenUsageCostBreakdown.weekly.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageCostByWeekTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageCostByWeekIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.tokenUsageColWeekStart}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageCostBreakdown.weekly.map((row) => (
                        <tr key={row.week_start_utc} className="border-b border-border/60 last:border-0">
                          <td className="p-2 whitespace-nowrap tabular-nums">
                            {dayUtcForLocale(row.week_start_utc, locale)}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                          <td className="p-2 tabular-nums font-medium text-foreground">
                            {vndFmt.format(row.estimated_cost_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {tokenUsageCostBreakdown && tokenUsageCostBreakdown.monthly.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">{t.tokenUsageCostByMonthTitle}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{t.tokenUsageCostByMonthIntro}</p>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="p-2 font-medium">{t.tokenUsageColMonthUtc}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                        <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokenUsageCostBreakdown.monthly.map((row) => (
                        <tr key={row.month_utc} className="border-b border-border/60 last:border-0">
                          <td className="p-2 whitespace-nowrap font-mono text-[11px] tabular-nums">
                            {row.month_utc}
                          </td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                          <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_completion_tokens)}</td>
                          <td className="p-2 tabular-nums font-medium">
                            {tokenFmt.format(row.sum_total_tokens)}
                          </td>
                          <td className="p-2 tabular-nums font-medium text-foreground">
                            {vndFmt.format(row.estimated_cost_vnd)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t.usageImageGenTitle}</h3>
              {(() => {
                const nanoCalls = imageGenRows.reduce((s, r) => s + r.call_count, 0)
                const nanoTokens = imageGenRows.reduce((s, r) => s + r.sum_total_tokens, 0)
                return (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-violet-500/25 bg-violet-500/[0.07] px-3 py-2.5 dark:border-violet-500/30 dark:bg-violet-950/25">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="shrink-0 font-semibold tracking-tight">
                        {t.usageNanoBananaBadge}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{t.usageNanoBananaModelHint}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="font-medium tabular-nums text-foreground">
                        {t.usageNanoBananaStatCalls.replace('{calls}', tokenFmt.format(nanoCalls))}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {t.usageNanoBananaStatTokens.replace('{tokens}', tokenFmt.format(nanoTokens))}
                      </span>
                    </div>
                  </div>
                )
              })()}
              <p className="text-xs text-muted-foreground leading-relaxed">{t.usageImageGenIntro}</p>
              {imageGenRows.length === 0 || imageGenRows.every((r) => r.call_count === 0) ? (
                <p className="text-sm text-muted-foreground">{t.usageImageGenEmpty}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium tabular-nums text-foreground">
                    {t.usageImageGenTotalCallsLabel}:{' '}
                    {tokenFmt.format(imageGenRows.reduce((s, r) => s + r.call_count, 0))}
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="p-2 font-medium">{t.usageImageGenColKind}</th>
                          <th className="p-2 font-medium tabular-nums">{t.usageImageGenColCalls}</th>
                          <th className="p-2 font-medium tabular-nums">{t.usageImageGenColTotalTokens}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {imageGenRows.map((row) => (
                          <tr
                            key={row.usage_kind}
                            className="border-b border-border/60 last:border-0"
                          >
                            <td className="p-2">
                              {row.usage_kind === 'image_material_detail'
                                ? t.usageImageGenKindMaterial
                                : t.usageImageGenKindRealUse}
                            </td>
                            <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                            <td className="p-2 tabular-nums font-medium">
                              {tokenFmt.format(row.sum_total_tokens)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t.usageEmbedImageTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.usageEmbedImageIntro}</p>
              {imageEmbedSummaryRows.length === 0 && imageEmbedDetailRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.usageEmbedImageEmpty}</p>
              ) : (
                <div className="space-y-3">
                  {imageEmbedSummaryRows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left">
                            <th className="p-2 font-medium">{t.usageEmbedColSource}</th>
                            <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                            <th className="p-2 font-medium tabular-nums">{t.usageEmbedColPromptSum}</th>
                            <th className="p-2 font-medium tabular-nums">{t.usageEmbedColTotalSum}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {imageEmbedSummaryRows.map((row) => (
                            <tr key={row.source} className="border-b border-border/60 last:border-0">
                              <td className="p-2">
                                {row.source === 'guest_image_search'
                                  ? t.usageEmbedSourceGuest
                                  : t.usageEmbedSourceInventory}
                              </td>
                              <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                              <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                              <td className="p-2 tabular-nums font-medium">
                                {tokenFmt.format(row.sum_total_tokens)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {imageEmbedDetailRows.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                        {t.usageEmbedDetailTitle}
                      </p>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left">
                              <th className="p-2 font-medium">{t.usageDetailColTime}</th>
                              <th className="p-2 font-medium">{t.usageEmbedColSource}</th>
                              <th className="p-2 font-medium">{t.tokenUsageColModel}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageEmbedColPromptSum}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageEmbedColTotalSum}</th>
                              <th className="p-2 font-medium">{t.usageEmbedColInventoryId}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {imageEmbedDetailRows.map((row) => (
                              <tr key={row.id} className="border-b border-border/60 last:border-0">
                                <td className="p-2 whitespace-nowrap tabular-nums">
                                  {dateTimeForLocale(row.created_at, locale)}
                                </td>
                                <td className="p-2">
                                  {row.source === 'guest_image_search'
                                    ? t.usageEmbedSourceGuest
                                    : t.usageEmbedSourceInventory}
                                </td>
                                <td className="p-2 font-mono text-[11px]">{row.model || '—'}</td>
                                <td className="p-2 tabular-nums">{tokenFmt.format(row.prompt_tokens)}</td>
                                <td className="p-2 tabular-nums font-medium">
                                  {tokenFmt.format(row.total_tokens)}
                                </td>
                                <td className="p-2 font-mono text-[10px] text-muted-foreground">
                                  {row.inventory_id ? row.inventory_id.slice(0, 8) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-medium">{t.usageEmbedTextTitle}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{t.usageEmbedTextIntro}</p>
              {textEmbedSummaryRows.length === 0 && textEmbedDetailRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.usageEmbedTextEmpty}</p>
              ) : (
                <div className="space-y-3">
                  {textEmbedSummaryRows.length > 0 ? (
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b bg-muted/40 text-left">
                            <th className="p-2 font-medium">{t.usageEmbedColSource}</th>
                            <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCalls}</th>
                            <th className="p-2 font-medium tabular-nums">{t.usageEmbedColPromptSum}</th>
                            <th className="p-2 font-medium tabular-nums">{t.usageEmbedColTotalSum}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {textEmbedSummaryRows.map((row) => (
                            <tr key={row.source} className="border-b border-border/60 last:border-0">
                              <td className="p-2">
                                {row.source === 'customer_query'
                                  ? t.usageEmbedTextSourceQuery
                                  : t.usageEmbedSourceInventory}
                              </td>
                              <td className="p-2 tabular-nums">{tokenFmt.format(row.call_count)}</td>
                              <td className="p-2 tabular-nums">{tokenFmt.format(row.sum_prompt_tokens)}</td>
                              <td className="p-2 tabular-nums font-medium">
                                {tokenFmt.format(row.sum_total_tokens)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {textEmbedDetailRows.length > 0 ? (
                    <div>
                      <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                        {t.usageEmbedDetailTitle}
                      </p>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b bg-muted/40 text-left">
                              <th className="p-2 font-medium">{t.usageDetailColTime}</th>
                              <th className="p-2 font-medium">{t.usageEmbedColSource}</th>
                              <th className="p-2 font-medium">{t.tokenUsageColModel}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageEmbedColPromptSum}</th>
                              <th className="p-2 font-medium tabular-nums">{t.usageEmbedColTotalSum}</th>
                              <th className="p-2 font-medium">{t.usageEmbedColInventoryId}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {textEmbedDetailRows.map((row) => (
                              <tr key={row.id} className="border-b border-border/60 last:border-0">
                                <td className="p-2 whitespace-nowrap tabular-nums">
                                  {dateTimeForLocale(row.created_at, locale)}
                                </td>
                                <td className="p-2">
                                  {row.source === 'customer_query'
                                    ? t.usageEmbedTextSourceQuery
                                    : t.usageEmbedSourceInventory}
                                </td>
                                <td className="p-2 font-mono text-[11px]">{row.model || '—'}</td>
                                <td className="p-2 tabular-nums">{tokenFmt.format(row.prompt_tokens)}</td>
                                <td className="p-2 tabular-nums font-medium">
                                  {tokenFmt.format(row.total_tokens)}
                                </td>
                                <td className="p-2 font-mono text-[10px] text-muted-foreground">
                                  {row.inventory_id ? row.inventory_id.slice(0, 8) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2 border-t border-border/50 pt-3">
              <div>
                <h3 className="text-sm font-medium">{t.usageDetailApiTitle}</h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{t.usageDetailApiIntro}</p>
                {tokenDetailsEstimatedCostVndTotal > 0 ? (
                  <p className="mt-2 text-xs font-medium tabular-nums text-foreground">
                    {t.tokenUsageDetailEstimatedTotalLabel.replace(
                      '{amount}',
                      vndFmt.format(tokenDetailsEstimatedCostVndTotal)
                    )}
                  </p>
                ) : null}
                {tokenDetailRows.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">{t.usageDetailEmpty}</p>
                ) : (
                  <div className="mt-2 overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left">
                          <th className="p-2 font-medium">{t.usageDetailColTime}</th>
                          <th className="p-2 font-medium">{t.tokenUsageColProvider}</th>
                          <th className="p-2 font-medium">{t.tokenUsageColModel}</th>
                          <th className="p-2 font-medium">{t.usageDetailColUsageKind}</th>
                          <th className="p-2 font-medium tabular-nums">{t.tokenUsageColPrompt}</th>
                          <th className="p-2 font-medium tabular-nums">{t.tokenUsageColCompletion}</th>
                          <th className="p-2 font-medium tabular-nums">{t.tokenUsageColTotal}</th>
                          <th className="p-2 font-medium tabular-nums">{t.tokenUsageColEstimatedCost}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenDetailRows.map((row) => (
                          <tr key={row.id} className="border-b border-border/60 last:border-0">
                            <td className="p-2 whitespace-nowrap tabular-nums">
                              {dateTimeForLocale(row.created_at, locale)}
                            </td>
                            <td className="p-2 capitalize">{row.provider}</td>
                            <td className="p-2 font-mono text-[11px]">{row.model}</td>
                            <td className="p-2 text-[11px] text-muted-foreground">{tokenUsageDetailKindLabel(row, t)}</td>
                            <td className="p-2 tabular-nums">{tokenFmt.format(row.prompt_tokens ?? 0)}</td>
                            <td className="p-2 tabular-nums">{tokenFmt.format(row.completion_tokens ?? 0)}</td>
                            <td className="p-2 tabular-nums font-medium">
                              {tokenFmt.format(row.total_tokens ?? 0)}
                            </td>
                            <td className="p-2 tabular-nums font-medium text-foreground">
                              {vndFmt.format(row.estimated_cost_vnd)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
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

function downloadTextFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, filename)
}

type InventoryImportWarningRow = {
  row_number?: number
  sku?: string
  name?: string
  field?: string
  code?: string
  raw_value?: string
  normalized_value?: string
  message?: string
}

function toCsvCell(raw: unknown): string {
  const s = String(raw ?? '')
  const esc = s.replace(/"/g, '""')
  return `"${esc}"`
}

function buildInventoryImportWarningCsv(rows: InventoryImportWarningRow[]): string {
  const header = [
    'row_number',
    'sku',
    'name',
    'field',
    'code',
    'raw_value',
    'normalized_value',
    'message',
  ]
  const lines = [header.map(toCsvCell).join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.row_number ?? '',
        r.sku ?? '',
        r.name ?? '',
        r.field ?? '',
        r.code ?? '',
        r.raw_value ?? '',
        r.normalized_value ?? '',
        r.message ?? '',
      ]
        .map(toCsvCell)
        .join(',')
    )
  }
  return `\uFEFF${lines.join('\n')}`
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
        // Keep upload phase under 100%; final 100% is shown only after server processing succeeds.
        onProgress({ percent: Math.min(99, Math.round((100 * ev.loaded) / ev.total)) })
      } else {
        onProgress({ percent: null })
      }
    }
    // Upload bytes are fully sent; server may still be parsing/upserting.
    xhr.upload.onloadend = () => onProgress({ percent: null })
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
  if (code?.startsWith('INVALID_SIZE_JSON_ROW_')) {
    const row = code.slice('INVALID_SIZE_JSON_ROW_'.length)
    return `Dòng ${row}: cột Size phải là JSON mảng chuỗi, ví dụ ["38","39","40"].`
  }
  if (code?.startsWith('INVALID_COLOR_VARIANTS_JSON_ROW_')) {
    const row = code.slice('INVALID_COLOR_VARIANTS_JSON_ROW_'.length)
    return `Dòng ${row}: cột Màu sắc phải là JSON mảng object {name,img}, ví dụ [{"name":"Đen","img":"https://..."}].`
  }
  if (code?.startsWith('INVALID_PRICE_STRUCTURE_ROW_')) {
    const row = code.slice('INVALID_PRICE_STRUCTURE_ROW_'.length)
    return `Cấu trúc dữ liệu sai ở dòng ${row}: cột Giá đang chứa trạng thái tồn kho/size. Vui lòng chuyển nội dung này sang cột Ghi chú tồn kho.`
  }
  if (code?.startsWith('TOO_MANY_ROWS_')) {
    const max = code.slice('TOO_MANY_ROWS_'.length) || '100000'
    return t.inventoryErrTooManyRows.replace('{max}', max)
  }
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
  partnerChatSlug,
  t,
  rows,
  onChanged,
  onImportCompleted,
  saveOkMessage,
  pending,
  startTransition,
  toast,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
}: {
  partnerId: string
  partnerChatSlug: string
  t: AiT
  rows: InvRow[]
  onChanged: () => void
  onImportCompleted?: () => void
  saveOkMessage: string
  pending: boolean
  startTransition: (cb: () => Promise<void>) => void
  toast: ReturnType<typeof useToast>['toast']
  totalCount: number
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
}) {
  const importInputRef = useRef<HTMLInputElement>(null)
  const vectorImageInputRef = useRef<HTMLInputElement>(null)
  const [vectorQuery, setVectorQuery] = useState('')
  const [vectorSearchRows, setVectorSearchRows] = useState<InvRow[] | null>(null)
  const [vectorSearchLoading, setVectorSearchLoading] = useState(false)
  const [browserOrigin, setBrowserOrigin] = useState('')
  useEffect(() => {
    if (typeof window !== 'undefined') setBrowserOrigin(window.location.origin)
  }, [])
  const [excelBusy, setExcelBusy] = useState(false)
  /** Chỉ khi nhập Excel: % hoặc null = không xác định (thanh pulse) */
  const [excelImportProgress, setExcelImportProgress] = useState<{ percent: number | null } | null>(null)

  const [draft, setDraft] = useState({
    id: null as string | null,
    name: '',
    sku: '',
    description: '',
    stock_note: '',
    stock_qty: '0',
    price_hint: '',
    image_url: '',
    product_url: '',
    product_video_url: '',
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
      stock_qty: '0',
      price_hint: '',
      image_url: '',
      product_url: '',
      product_video_url: '',
      consult_note: '',
      sort_order: rows.length,
    })

  useEffect(() => {
    if (!draft.id) setDraft((d) => ({ ...d, sort_order: rows.length }))
  }, [rows.length, draft.id])

  useEffect(() => {
    setVectorSearchRows(null)
    setVectorQuery('')
  }, [partnerId])

  const displayRows = vectorSearchRows ?? rows
  const vectorFilterActive = vectorSearchRows !== null

  const runVectorTextSearch = () => {
    const q = vectorQuery.trim()
    if (q.length < 2) return
    setVectorSearchLoading(true)
    void (async () => {
      try {
        const fd = new FormData()
        fd.set('mode', 'text')
        fd.set('q', q)
        const res = await fetch(
          `/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/vector-search`,
          { method: 'POST', body: fd, credentials: 'same-origin' }
        )
        const data = (await res.json().catch(() => null)) as { ok?: boolean; rows?: InvRow[]; error?: string } | null
        if (!res.ok || !data?.ok || !Array.isArray(data.rows)) {
          toast({ title: t.inventoryVectorSearchFailed, variant: 'destructive' })
          return
        }
        setVectorSearchRows(data.rows)
      } catch {
        toast({ title: t.inventoryVectorSearchFailed, variant: 'destructive' })
      } finally {
        setVectorSearchLoading(false)
      }
    })()
  }

  const onPickVectorImage = () => vectorImageInputRef.current?.click()

  const onVectorImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !file.size) return
    setVectorSearchLoading(true)
    void (async () => {
      try {
        const fd = new FormData()
        fd.set('mode', 'image')
        fd.set('file', file)
        const res = await fetch(
          `/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/vector-search`,
          { method: 'POST', body: fd, credentials: 'same-origin' }
        )
        const data = (await res.json().catch(() => null)) as { ok?: boolean; rows?: InvRow[]; error?: string } | null
        if (!res.ok || !data?.ok || !Array.isArray(data.rows)) {
          toast({ title: t.inventoryVectorSearchFailed, variant: 'destructive' })
          return
        }
        setVectorSearchRows(data.rows)
      } catch {
        toast({ title: t.inventoryVectorSearchFailed, variant: 'destructive' })
      } finally {
        setVectorSearchLoading(false)
      }
    })()
  }

  const clearVectorSearch = () => {
    setVectorSearchRows(null)
    setVectorQuery('')
  }

  const draftGuestConsultFullUrl = useMemo(() => {
    if (!draft.id?.trim() || !partnerChatSlug.trim()) return ''
    return buildGuestConsultChatAbsoluteUrl(browserOrigin, partnerChatSlug, {
      id: draft.id,
      image_url: draft.image_url,
      product_url: draft.product_url,
      sku: draft.sku,
    })
  }, [browserOrigin, draft.id, draft.image_url, draft.product_url, draft.sku, partnerChatSlug])

  const copyDraftGuestConsultUrl = useCallback(async () => {
    if (!draftGuestConsultFullUrl) return
    try {
      await navigator.clipboard.writeText(draftGuestConsultFullUrl)
      toast({ title: t.inventoryGuestConsultLinkCopied })
    } catch {
      toast({ title: t.inventoryGuestConsultLinkCopied, variant: 'destructive' })
    }
  }, [draftGuestConsultFullUrl, t.inventoryGuestConsultLinkCopied, toast])

  const editRow = (r: InvRow) => {
    setDraft({
      id: r.id,
      name: r.name,
      sku: r.sku ?? '',
      description: r.description,
      stock_note: r.stock_note,
      stock_qty: String(r.stock_qty ?? 0),
      price_hint: r.price_hint,
      image_url: r.image_url ?? '',
      product_url: r.product_url ?? '',
      product_video_url: r.product_video_url ?? '',
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
        stock_qty: Math.max(0, Math.floor(Number(draft.stock_qty || '0') || 0)),
        price_hint: draft.price_hint,
        image_url: draft.image_url,
        product_url: draft.product_url,
        product_video_url: draft.product_video_url,
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
    let importOk = false
    try {
      const fd = new FormData()
      fd.set('file', file)
      const url = `/api/messaging/partners/${encodeURIComponent(partnerId)}/inventory/import`
      const { ok, text } = await postInventoryExcelImport(url, fd, (p) => {
        if (p.percent == null) {
          setExcelImportProgress({ percent: null })
          return
        }
        // Upload done often stops at 99%; reserve final 100 only when server confirms success.
        setExcelImportProgress({ percent: Math.min(99, Math.max(1, p.percent)) })
      })
      // Uploaded. Waiting for server parse/upsert response.
      setExcelImportProgress({ percent: null })
      let data: {
        ok?: boolean
        count?: number
        inserted?: number
        updated?: number
        deleted?: number
        warnings?: InventoryImportWarningRow[]
        warnings_count?: number
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
      setExcelImportProgress({ percent: 100 })
      importOk = true
      toast({
        title: t.inventoryImportSuccess
          .replace('{count}', String(data.count ?? 0))
          .replace('{inserted}', String(data.inserted ?? 0))
          .replace('{updated}', String(data.updated ?? 0))
          .replace('{deleted}', String(data.deleted ?? 0)),
      })
      if (Array.isArray(data.warnings) && data.warnings.length > 0) {
        const csv = buildInventoryImportWarningCsv(data.warnings)
        const ts = new Date().toISOString().replace(/[:.]/g, '-')
        downloadTextFile(csv, `bao-cao-import-canh-bao-${ts}.csv`)
        toast({
          title: `Import vẫn thành công, có ${data.warnings.length} dòng cần rà soát. Đã tải báo cáo CSV.`,
        })
      }
      resetDraft()
      onChanged()
      onImportCompleted?.()
    } catch {
      toast({ title: t.inventoryImportFailed, variant: 'destructive' })
    } finally {
      setExcelBusy(false)
      // Let users see 100% briefly before hiding progress UI.
      if (importOk) {
        setTimeout(() => setExcelImportProgress(null), 700)
      } else {
        setExcelImportProgress(null)
      }
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
                ? 'Đang xử lý dữ liệu trên server...'
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
          href={`/dashboard/api-integration?partner=${encodeURIComponent(partnerId)}#partner-api-keys`}
          className="text-violet-600 underline underline-offset-2 dark:text-violet-400"
        >
          {t.inventoryOpenApiLink}
        </Link>
      </p>
      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 space-y-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t.inventoryVectorSearchHint}</p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:flex-nowrap">
            <Input
              value={vectorQuery}
              onChange={(e) => setVectorQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  runVectorTextSearch()
                }
              }}
              placeholder={t.inventoryVectorSearchPlaceholder}
              disabled={vectorSearchLoading || pending || excelBusy}
              className="min-w-[12rem] flex-1 text-sm"
              aria-label={t.inventoryVectorSearchPlaceholder}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 shrink-0"
              disabled={vectorSearchLoading || pending || excelBusy || vectorQuery.trim().length < 2}
              onClick={() => runVectorTextSearch()}
            >
              {vectorSearchLoading ? (
                <span className="text-xs">{t.inventoryVectorSearching}</span>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t.inventoryVectorSearchByText}
                </>
              )}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1.5 shrink-0"
              disabled={vectorSearchLoading || pending || excelBusy}
              onClick={() => onPickVectorImage()}
            >
              <ImageIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t.inventoryVectorSearchByImage}
            </Button>
            <input
              ref={vectorImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(ev) => void onVectorImageFile(ev)}
            />
          </div>
          {vectorFilterActive ? (
            <Button type="button" size="sm" variant="outline" onClick={() => clearVectorSearch()} disabled={pending}>
              {t.inventoryVectorSearchClear}
            </Button>
          ) : null}
        </div>
      </div>
      {displayRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {vectorFilterActive ? t.inventoryVectorSearchNoResults : t.emptyInventory}
        </p>
      ) : null}
      <ul className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
        {displayRows.map((r) => (
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
                  <span className="mr-2">Số lượng tồn: {Math.max(0, Number(r.stock_qty ?? 0))}</span>
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
                {(() => {
                  const vu = validateInventoryHttpUrl(r.product_video_url ?? '')
                  return vu ? (
                    <p className="mt-1 text-[11px]">
                      <a
                        href={vu}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 underline underline-offset-2 dark:text-violet-400"
                      >
                        {t.inventoryOpenProductVideo}
                      </a>
                    </p>
                  ) : null
                })()}
                {partnerChatSlug.trim() ? (() => {
                  const consultPath = buildGuestConsultChatPath(partnerChatSlug, r)
                  if (!consultPath) return null
                  const href = browserOrigin ? `${browserOrigin}${consultPath}` : consultPath
                  return (
                    <p className="mt-1 text-[11px]">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 underline underline-offset-2 dark:text-violet-400"
                      >
                        {t.inventoryGuestConsultLink}
                      </a>
                    </p>
                  )
                })() : null}
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
      {hasMore && !vectorFilterActive ? (
        <div className="flex justify-center">
          <Button type="button" variant="outline" size="sm" disabled={loadingMore || pending} onClick={onLoadMore}>
            {loadingMore
              ? t.inventoryExcelImportUploading
              : t.inventoryLoadMore
                  .replace('{shown}', String(rows.length))
                  .replace('{total}', String(totalCount))}
          </Button>
        </div>
      ) : null}

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
            <Label>Số lượng tồn kho</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={draft.stock_qty}
              onChange={(e) => setDraft((d) => ({ ...d, stock_qty: parseStockQtyInput(e.target.value) }))}
            />
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
            <Label>{t.inventoryGuestConsultLink}</Label>
            {!draft.id?.trim() ? (
              <p className="text-[11px] text-muted-foreground">{t.inventoryGuestConsultLinkNeedSave}</p>
            ) : !partnerChatSlug.trim() ? null : (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={draftGuestConsultFullUrl} className="min-w-0 font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1"
                    onClick={() => void copyDraftGuestConsultUrl()}
                    disabled={!draftGuestConsultFullUrl}
                    aria-label={t.inventoryGuestConsultLink}
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">{t.inventoryGuestConsultLinkHint}</p>
              </>
            )}
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>{t.inventoryProductVideoUrl}</Label>
            <Input
              value={draft.product_video_url}
              maxLength={2048}
              onChange={(e) => setDraft((d) => ({ ...d, product_video_url: e.target.value }))}
              placeholder="https:// (YouTube hoặc .mp4)"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">{t.inventoryProductVideoUrlHint}</p>
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

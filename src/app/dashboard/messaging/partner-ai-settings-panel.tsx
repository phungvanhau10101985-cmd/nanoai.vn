'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
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
  PartnerInventoryEmbeddingStats,
  PartnerAiSettingsClientRow,
  PartnerAiSettingsPayload,
  PartnerAiTokenUsageStatRow,
} from '@/app/dashboard/messaging/actions'
import {
  deletePartnerFaq,
  deletePartnerInventoryItem,
  getPartnerAiBundle,
  getPartnerInventoryEmbeddingStats,
  triggerPartnerInventoryEmbeddingSync,
  getPartnerInventoryPage,
  getPartnerAiTokenUsageStats,
  savePartnerAiSettings,
  upsertPartnerFaq,
  upsertPartnerInventoryItem,
} from '@/app/dashboard/messaging/actions'
import {
  PARTNER_FAQ_CUSTOM_KEYWORDS_REQUIRED,
} from '@/lib/messaging/partner-faq-presets'
import { Bot, Download, FileSpreadsheet, Sparkles, Upload } from 'lucide-react'
import type { WebLocale } from '@/lib/i18n/config'

type AiT = Dictionary['partnerMessagingAi']
type SettingsRow = PartnerAiSettingsClientRow

type FaqRow = Database['public']['Tables']['messaging_partner_faq']['Row']
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

const tokenFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })

function defaultsFromSettings(s: SettingsRow | null) {
  return {
    enabled: s?.enabled ?? false,
    reply_delay_seconds: s?.reply_delay_seconds ?? 10,
    typing_pause_min_ms: s?.typing_pause_min_ms ?? 700,
    typing_pause_max_ms: s?.typing_pause_max_ms ?? 1200,
    shop_policy: s?.shop_policy ?? '',
    tone_instructions: s?.tone_instructions ?? '',
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
  }
}

type FormState = ReturnType<typeof defaultsFromSettings>

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
  void locale
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [faqs, setFaqs] = useState<FaqRow[]>([])
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [inventoryTotalCount, setInventoryTotalCount] = useState(0)
  const [inventoryPageSize, setInventoryPageSize] = useState(120)
  const [inventoryPage, setInventoryPage] = useState(0)
  const [inventoryLoadingMore, setInventoryLoadingMore] = useState(false)
  const [tokenUsageRows, setTokenUsageRows] = useState<PartnerAiTokenUsageStatRow[]>([])
  const [tokenUsageLookbackDays, setTokenUsageLookbackDays] = useState(30)
  const [embeddingStats, setEmbeddingStats] = useState<PartnerInventoryEmbeddingStats | null>(null)
  const [embeddingSyncing, setEmbeddingSyncing] = useState(false)
  const [form, setForm] = useState<FormState>(() => defaultsFromSettings(null))
  const formRef = useRef<FormState>(form)
  const loadSeqRef = useRef(0)
  const autoEmbedSyncStateRef = useRef<{ running: boolean; lastRunAt: number; partnerId: string | null }>({
    running: false,
    lastRunAt: 0,
    partnerId: null,
  })
  /** Tránh chạy song song với nút «Đồng bộ ngay». */
  const manualEmbedLockRef = useRef(false)
  /** Đồng bộ ref mỗi render — không đưa vào deps của useEffect auto-sync (tránh cắt chuỗi lô khi pending đổi). */
  const embeddingPendingRef = useRef(0)
  embeddingPendingRef.current = embeddingStats?.pending ?? 0

  const load = useCallback((): Promise<void> => {
    const seq = ++loadSeqRef.current
    setLoadErr(null)
    setSettingsLoaded(false)
    setFaqs([])
    setInventory([])
    setInventoryTotalCount(0)
    setInventoryPage(0)
    setEmbeddingStats(null)
    return (async () => {
      const [bundleRes, usageRes, embeddingRes] = await Promise.all([
        getPartnerAiBundle(partnerId),
        getPartnerAiTokenUsageStats(partnerId),
        getPartnerInventoryEmbeddingStats(partnerId),
      ])
      if (seq !== loadSeqRef.current) return
      if ('error' in usageRes) {
        setTokenUsageRows([])
      } else {
        setTokenUsageRows(usageRes.rows)
        setTokenUsageLookbackDays(usageRes.lookbackDays)
      }
      if ('error' in embeddingRes) {
        setEmbeddingStats(null)
      } else {
        setEmbeddingStats(embeddingRes.stats)
      }
      if ('error' in bundleRes && bundleRes.error) {
        setLoadErr(bundleRes.error)
        toast({ title: t.loadError, description: bundleRes.error, variant: 'destructive' })
        return
      }
      if ('settings' in bundleRes) {
        const next = defaultsFromSettings(bundleRes.settings ?? null)
        formRef.current = next
        setForm(next)
        setFaqs(bundleRes.faqs ?? [])
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
    })()
  }, [partnerId, t.loadError, toast])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    formRef.current = form
  }, [form])

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
      if (embeddingPendingRef.current <= 0) return
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
          if (embeddingPendingRef.current <= 0) break
          state.lastRunAt = Date.now()
          const res = await triggerPartnerInventoryEmbeddingSync(partnerId, 1200)
          if (cancelled || ('error' in res && res.error)) break
          const refreshed = await getPartnerInventoryEmbeddingStats(partnerId)
          if (cancelled || ('error' in refreshed && refreshed.error)) break
          if ('stats' in refreshed && refreshed.stats) setEmbeddingStats(refreshed.stats)
          embeddingPendingRef.current = refreshed.stats?.pending ?? 0
          const stillPending = embeddingPendingRef.current
          if (stillPending <= 0) break
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
            <InventoryEditor
              partnerId={partnerId}
              t={t}
              rows={inventory}
              onChanged={load}
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
      <div className="space-y-3">
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
        // Keep upload phase under 100%; final 100% is shown only after server processing succeeds.
        onProgress({ percent: Math.min(99, Math.round((100 * ev.loaded) / ev.total)) })
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
  t,
  rows,
  onChanged,
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
  t: AiT
  rows: InvRow[]
  onChanged: () => void
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
      setExcelImportProgress({ percent: 100 })
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
          href={`/dashboard/api-integration?partner=${encodeURIComponent(partnerId)}#partner-api-keys`}
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
      {hasMore ? (
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

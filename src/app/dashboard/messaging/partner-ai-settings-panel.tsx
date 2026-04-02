'use client'

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
import type { PartnerAiSettingsPayload } from '@/app/dashboard/messaging/actions'
import {
  deletePartnerFaq,
  deletePartnerInventoryItem,
  getPartnerAiBundle,
  savePartnerAiSettings,
  upsertPartnerFaq,
  upsertPartnerInventoryItem,
} from '@/app/dashboard/messaging/actions'
import { Bot, Sparkles } from 'lucide-react'

type AiT = Dictionary['partnerMessagingAi']
type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']
type FaqRow = Database['public']['Tables']['messaging_partner_faq']['Row']
type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

function defaultsFromSettings(s: SettingsRow | null) {
  return {
    enabled: s?.enabled ?? false,
    reply_delay_seconds: s?.reply_delay_seconds ?? 60,
    typing_pause_min_ms: s?.typing_pause_min_ms ?? 1200,
    typing_pause_max_ms: s?.typing_pause_max_ms ?? 3800,
    shop_policy: s?.shop_policy ?? '',
    tone_instructions: s?.tone_instructions ?? '',
    append_ai_disclosure: s?.append_ai_disclosure ?? true,
    disclosure_suffix: s?.disclosure_suffix ?? '',
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
  }
}

export function PartnerAiSettingsPanel({
  partnerId,
  t,
  saveOkMessage,
  aiModelId,
}: {
  partnerId: string
  t: AiT
  saveOkMessage: string
  /** Model id from server (DEEPSEEK_MODEL / default deepseek-chat) */
  aiModelId: string
}) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [faqs, setFaqs] = useState<FaqRow[]>([])
  const [inventory, setInventory] = useState<InvRow[]>([])
  const [form, setForm] = useState<FormState>(() => defaultsFromSettings(null))
  const formRef = useRef<FormState>(form)

  const load = useCallback(() => {
    setLoadErr(null)
    void (async () => {
      const res = await getPartnerAiBundle(partnerId)
      if ('error' in res && res.error) {
        setLoadErr(res.error)
        toast({ title: t.loadError, description: res.error, variant: 'destructive' })
        return
      }
      if ('settings' in res) {
        const next = defaultsFromSettings(res.settings)
        formRef.current = next
        setForm(next)
        setFaqs(res.faqs ?? [])
        setInventory(res.inventory ?? [])
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
          <TabsList className="mb-4 grid w-full max-w-lg grid-cols-3 h-10">
            <TabsTrigger value="settings" className="text-xs sm:text-sm">
              {t.tabSettings}
            </TabsTrigger>
            <TabsTrigger value="faq" className="text-xs sm:text-sm">
              {t.tabFaq}
            </TabsTrigger>
            <TabsTrigger value="inv" className="text-xs sm:text-sm">
              {t.tabInventory}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 mt-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ai-delay">{t.delayLabel}</Label>
                <Input
                  id="ai-delay"
                  type="number"
                  min={15}
                  max={900}
                  value={form.reply_delay_seconds}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reply_delay_seconds: Number(e.target.value) || 60 }))
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
  const [draft, setDraft] = useState({
    id: null as string | null,
    trigger_keywords: '',
    answer: '',
    sort_order: 0,
    is_active: true,
  })

  const resetDraft = () =>
    setDraft({ id: null, trigger_keywords: '', answer: '', sort_order: faqs.length, is_active: true })

  useEffect(() => {
    if (!draft.id) setDraft((d) => ({ ...d, sort_order: faqs.length }))
  }, [faqs.length, draft.id])

  const editRow = (r: FaqRow) => {
    setDraft({
      id: r.id,
      trigger_keywords: r.trigger_keywords,
      answer: r.answer,
      sort_order: r.sort_order,
      is_active: r.is_active,
    })
  }

  const save = () => {
    if (!draft.answer.trim()) return
    startTransition(async () => {
      const res = await upsertPartnerFaq(partnerId, draft.id, {
        trigger_keywords: draft.trigger_keywords,
        answer: draft.answer.trim(),
        sort_order: draft.sort_order,
        is_active: draft.is_active,
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
      {faqs.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyFaq}</p> : null}
      <ul className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
        {faqs.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border bg-card p-3 text-sm shadow-sm hover:border-violet-200/80 dark:hover:border-violet-800/80 transition-colors"
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
                <p className="text-xs font-medium text-muted-foreground line-clamp-2">{r.trigger_keywords || '—'}</p>
                <p className="line-clamp-3 whitespace-pre-wrap">{r.answer}</p>
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
        <h4 className="text-sm font-semibold">{draft.id ? t.edit : t.addFaq}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
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
            <Textarea rows={4} value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={save} disabled={pending || !draft.answer.trim()}>
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
  const [draft, setDraft] = useState({
    id: null as string | null,
    name: '',
    sku: '',
    description: '',
    stock_note: '',
    price_hint: '',
    sort_order: 0,
    is_active: true,
  })

  const resetDraft = () =>
    setDraft({
      id: null,
      name: '',
      sku: '',
      description: '',
      stock_note: '',
      price_hint: '',
      sort_order: rows.length,
      is_active: true,
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
      sort_order: r.sort_order,
      is_active: r.is_active,
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
        sort_order: draft.sort_order,
        is_active: draft.is_active,
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

  return (
    <div className="space-y-4">
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t.emptyInventory}</p> : null}
      <ul className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
        {rows.map((r) => (
          <li key={r.id} className="rounded-lg border bg-card p-3 text-sm shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  {r.sku ? (
                    <Badge variant="outline" className="text-[10px] font-mono font-normal">
                      {r.sku}
                    </Badge>
                  ) : null}
                  {!r.is_active ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {t.inactiveBadge}
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
          </div>
          <div className="space-y-2">
            <Label>{t.inventoryStock}</Label>
            <Input value={draft.stock_note} onChange={(e) => setDraft((d) => ({ ...d, stock_note: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.inventoryPrice}</Label>
            <Input value={draft.price_hint} onChange={(e) => setDraft((d) => ({ ...d, price_hint: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>{t.inventorySort}</Label>
            <Input
              type="number"
              value={draft.sort_order}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
            />
          </div>
          <div className="flex items-end gap-2 pb-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={draft.is_active}
                onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
              />
              {t.inventoryActive}
            </label>
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

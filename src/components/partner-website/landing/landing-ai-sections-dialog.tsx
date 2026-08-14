'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles, X } from 'lucide-react'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type {
  LandingAiSectionRow,
  LandingAiSectionType,
  LandingFaqData,
  LandingHeroData,
  LandingHighlightsData,
  LandingMaterialData,
  LandingTrustCtaData,
} from '@/lib/partner-website/landing/landing-ai-types'
import type { PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'
import { PARTNER_LANDING_MAX_PRODUCTS } from '@/lib/partner-website/landing/partner-landing-types'
import {
  LandingProductPicker,
  type LandingPickerProduct,
} from '@/components/partner-website/landing/landing-product-picker'

const SECTION_LABEL_KEY: Record<LandingAiSectionType, keyof PartnerWebsiteCopy> = {
  hero: 'lpSectionHero',
  highlights: 'lpSectionHighlights',
  material: 'lpSectionMaterial',
  products_grid: 'lpSectionProductsGrid',
  trust_cta: 'lpSectionTrustCta',
  faq: 'lpSectionFaq',
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'ready') return 'default'
  if (status === 'error') return 'destructive'
  if (status === 'generating') return 'secondary'
  return 'outline'
}

export function LandingAiSectionsDialog({
  partnerId,
  landing,
  t,
  open,
  autogen = false,
  onOpenChange,
  onToast,
}: {
  partnerId: string
  landing: PartnerLandingPageRow
  t: PartnerWebsiteCopy
  open: boolean
  autogen?: boolean
  onOpenChange: (open: boolean) => void
  onToast: (message: string, variant?: 'default' | 'destructive') => void
}) {
  const [sections, setSections] = useState<LandingAiSectionRow[]>([])
  const [loading, setLoading] = useState(false)
  const [busySectionId, setBusySectionId] = useState<string | null>(null)
  const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({})
  const [title, setTitle] = useState(landing.title)
  const [briefText, setBriefText] = useState(landing.briefText)
  const [materialFilter, setMaterialFilter] = useState(landing.materialFilter ?? '')
  const [metaTitle, setMetaTitle] = useState(landing.metaTitle ?? '')
  const [metaDescription, setMetaDescription] = useState(landing.metaDescription ?? '')
  const [seoBusy, setSeoBusy] = useState(false)
  const [infoBusy, setInfoBusy] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<LandingPickerProduct[]>([])
  const [autogenLabel, setAutogenLabel] = useState('')
  const autogenStarted = useRef(false)

  const base = `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landing.id)}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${base}/sections`)
      const json = (await res.json()) as { sections?: LandingAiSectionRow[]; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setSections(json.sections ?? [])
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [base, onToast, t.errorGeneric])

  useEffect(() => {
    if (!open) {
      autogenStarted.current = false
      return
    }
    setTitle(landing.title)
    setBriefText(landing.briefText)
    setMaterialFilter(landing.materialFilter ?? '')
    setMetaTitle(landing.metaTitle ?? '')
    setMetaDescription(landing.metaDescription ?? '')
    void load()
    if (landing.sourceType === 'products' && landing.inventoryIds.length) {
      void (async () => {
        const res = await fetch(
          `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/inventory?page=0&pageSize=48`
        )
        const json = (await res.json()) as { rows?: LandingPickerProduct[] }
        const map = new Map((json.rows ?? []).map((r) => [r.id, r]))
        setSelectedProducts(
          landing.inventoryIds.map((id) => map.get(id) ?? { id, name: id, sku: null, priceHint: '', imageUrl: '' })
        )
      })()
    }
  }, [open, load, landing, partnerId])

  async function generate(section: LandingAiSectionRow, mode: 'generate' | 'regenerate', target = 'all') {
    setBusySectionId(section.id)
    try {
      const res = await fetch(`${base}/sections/${encodeURIComponent(section.id)}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, customPrompt: customPrompts[section.id] || undefined }),
      })
      const json = (await res.json()) as { section?: LandingAiSectionRow; error?: string }
      if (!res.ok || !json.section) throw new Error(json.error || t.errorGeneric)
      setSections((prev) => prev.map((s) => (s.id === json.section!.id ? json.section! : s)))
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
      await load()
    } finally {
      setBusySectionId(null)
    }
  }

  useEffect(() => {
    if (!open || !autogen || autogenStarted.current || loading || sections.length === 0) return
    autogenStarted.current = true
    void (async () => {
      const pending = sections.filter((s) => s.status === 'pending' && s.sectionType !== 'products_grid')
      for (let i = 0; i < pending.length; i++) {
        const s = pending[i]
        setAutogenLabel(
          t.lpAutogenProgress
            .replace('{i}', String(i + 1))
            .replace('{n}', String(pending.length))
            .replace('{section}', String(t[SECTION_LABEL_KEY[s.sectionType]]))
        )
        await generate(s, 'generate')
      }
      if (!metaTitle.trim()) {
        setAutogenLabel(t.lpAutogenSeo)
        await generateSeo()
      }
      setAutogenLabel('')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autogen, loading, sections])

  async function generateSeo() {
    setSeoBusy(true)
    try {
      const res = await fetch(`${base}/generate-seo`, { method: 'POST' })
      const json = (await res.json()) as { metaTitle?: string; metaDescription?: string; error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setMetaTitle(json.metaTitle ?? '')
      setMetaDescription(json.metaDescription ?? '')
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setSeoBusy(false)
    }
  }

  async function saveSeo() {
    setSeoBusy(true)
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaTitle, metaDescription }),
      })
      if (!res.ok) throw new Error(t.errorGeneric)
      onToast(t.lpSaveSeo)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setSeoBusy(false)
    }
  }

  async function saveInfo() {
    setInfoBusy(true)
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          briefText,
          materialFilter: landing.sourceType === 'category' ? materialFilter : undefined,
        }),
      })
      if (!res.ok) throw new Error(t.errorGeneric)
      onToast(t.lpSaveInfo)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setInfoBusy(false)
    }
  }

  async function saveProducts() {
    setInfoBusy(true)
    try {
      const res = await fetch(base, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventoryIds: selectedProducts.map((p) => p.id) }),
      })
      if (!res.ok) throw new Error(t.errorGeneric)
      onToast(t.lpSaveProducts)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setInfoBusy(false)
    }
  }

  async function patchSection(section: LandingAiSectionRow, patch: Record<string, unknown>) {
    const res = await fetch(`${base}/sections/${encodeURIComponent(section.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: patch }),
    })
    const json = (await res.json()) as { section?: LandingAiSectionRow; error?: string }
    if (!res.ok || !json.section) throw new Error(json.error || t.errorGeneric)
    setSections((prev) => prev.map((s) => (s.id === json.section!.id ? json.section! : s)))
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5">
        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t.lpBackToList}
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4" />
            {t.lpSectionsDialogTitle}
          </h2>
          <p className="text-sm text-muted-foreground">{landing.title}</p>
        </div>

        {autogenLabel ? (
          <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Loader2 className="h-4 w-4 animate-spin" />
            {autogenLabel}
          </p>
        ) : null}

        <section className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t.lpTitleLabel}</p>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Label className="text-xs">{t.lpBriefOptional}</Label>
          <Textarea value={briefText} onChange={(e) => setBriefText(e.target.value)} rows={2} />
          {landing.sourceType === 'category' ? (
            <>
              <Label className="text-xs">{t.lpMaterialFilterLabel}</Label>
              <Input value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)} />
            </>
          ) : null}
          <Button type="button" size="sm" disabled={infoBusy} onClick={() => void saveInfo()}>
            {t.lpSaveInfo}
          </Button>
        </section>

        {landing.sourceType === 'products' ? (
          <section className="space-y-2 rounded-lg border p-3">
            <p className="text-sm font-medium">{t.lpProductsLabel}</p>
            <LandingProductPicker
              partnerId={partnerId}
              selected={selectedProducts}
              onChange={setSelectedProducts}
              mode={landing.inventoryIds.length <= 1 ? 'single' : 'multi'}
              searchPlaceholder={t.lpSearchProducts}
              maxProducts={PARTNER_LANDING_MAX_PRODUCTS}
            />
            <Button type="button" size="sm" disabled={infoBusy} onClick={() => void saveProducts()}>
              {t.lpSaveProducts}
            </Button>
          </section>
        ) : null}

        <section className="space-y-2 rounded-lg border p-3">
          <p className="text-sm font-medium">{t.lpSeoTitle}</p>
          <Label className="text-xs">{t.lpSeoMetaTitleLabel}</Label>
          <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} maxLength={200} />
          <Label className="text-xs">{t.lpSeoMetaDescriptionLabel}</Label>
          <Textarea value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} rows={2} />
          <p className="text-xs text-muted-foreground">{metaDescription.length}/160</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={seoBusy} onClick={() => void generateSeo()}>
              {t.lpSeoGenerate}
            </Button>
            <Button type="button" size="sm" disabled={seoBusy} onClick={() => void saveSeo()}>
              {t.lpSaveSeo}
            </Button>
          </div>
        </section>

        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </p>
        ) : (
          sections.map((s) => {
            const busy = busySectionId === s.id
            const isGrid = s.sectionType === 'products_grid'
            return (
              <section key={s.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{String(t[SECTION_LABEL_KEY[s.sectionType]])}</p>
                  <Badge variant={statusBadgeVariant(s.status)}>
                    {s.status === 'ready'
                      ? t.lpSectionStatusReady
                      : s.status === 'error'
                        ? t.lpSectionStatusError
                        : s.status === 'generating'
                          ? t.lpSectionStatusGenerating
                          : t.lpSectionStatusPending}
                  </Badge>
                </div>
                {s.errorMessage ? <p className="text-xs text-destructive">{s.errorMessage}</p> : null}
                {!isGrid && s.status === 'ready' ? <SectionFields section={s} onPatch={patchSection} t={t} /> : null}
                {!isGrid ? (
                  <div className="space-y-2">
                    <Textarea
                      value={customPrompts[s.id] ?? ''}
                      onChange={(e) => setCustomPrompts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder={t.lpSectionCustomPromptPlaceholder}
                      rows={2}
                      className="text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={s.status === 'ready' ? 'secondary' : 'default'}
                        disabled={busy}
                        onClick={() => void generate(s, s.status === 'ready' ? 'regenerate' : 'generate')}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                        {s.status === 'ready' ? t.lpSectionRegenerate : t.lpSectionGenerate}
                      </Button>
                      {s.status === 'ready' && (s.sectionType === 'hero' || s.sectionType === 'material') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void generate(s, 'regenerate', s.sectionType === 'hero' ? 'image' : 'image')}
                        >
                          {s.sectionType === 'hero' ? t.lpRegenImage : t.lpRegenImage}
                        </Button>
                      ) : null}
                      {s.status === 'ready' && (s.sectionType === 'highlights' || s.sectionType === 'faq') ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void generate(s, 'regenerate', 'text')}
                        >
                          {t.lpSectionRegenAll}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t.lpSectionProductsGrid}</p>
                )}
              </section>
            )
          })
        )}
      </div>
    </div>
  )
}

function SectionFields({
  section,
  onPatch,
  t,
}: {
  section: LandingAiSectionRow
  onPatch: (section: LandingAiSectionRow, patch: Record<string, unknown>) => Promise<void>
  t: PartnerWebsiteCopy
}) {
  const data = section.data as Record<string, unknown>
  const save = (patch: Record<string, unknown>) => {
    void onPatch(section, patch).catch(() => undefined)
  }

  if (section.sectionType === 'hero') {
    const d = data as LandingHeroData
    return (
      <div className="space-y-2">
        <Input defaultValue={d.headline ?? ''} onBlur={(e) => save({ headline: e.target.value })} />
        <Textarea defaultValue={d.subheadline ?? ''} rows={2} onBlur={(e) => save({ subheadline: e.target.value })} />
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imageUrl} alt="" className="max-h-40 rounded-md object-cover" />
        ) : null}
      </div>
    )
  }
  if (section.sectionType === 'highlights') {
    const d = data as LandingHighlightsData
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium">{t.lpHighlightsHeading}</p>
        {(d.items ?? []).map((item, i) => (
          <div key={i} className="grid gap-1">
            <Input
              defaultValue={item.title}
              onBlur={(e) => {
                const items = [...(d.items ?? [])]
                items[i] = { ...items[i], title: e.target.value }
                save({ items })
              }}
            />
            <Textarea
              defaultValue={item.desc}
              rows={2}
              onBlur={(e) => {
                const items = [...(d.items ?? [])]
                items[i] = { ...items[i], desc: e.target.value }
                save({ items })
              }}
            />
          </div>
        ))}
      </div>
    )
  }
  if (section.sectionType === 'material') {
    const d = data as LandingMaterialData
    return (
      <div className="space-y-2">
        <Input defaultValue={d.material ?? ''} onBlur={(e) => save({ material: e.target.value })} />
        <Textarea defaultValue={d.body ?? ''} rows={3} onBlur={(e) => save({ body: e.target.value })} />
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imageUrl} alt="" className="max-h-40 rounded-md object-cover" />
        ) : null}
      </div>
    )
  }
  if (section.sectionType === 'trust_cta') {
    const d = data as LandingTrustCtaData
    return (
      <div className="space-y-2">
        <Textarea defaultValue={d.body ?? ''} rows={3} onBlur={(e) => save({ body: e.target.value })} />
        <Input defaultValue={d.ctaLabel ?? ''} onBlur={(e) => save({ ctaLabel: e.target.value })} />
      </div>
    )
  }
  if (section.sectionType === 'faq') {
    const d = data as LandingFaqData
    return (
      <div className="space-y-2">
        {(d.items ?? []).map((item, i) => (
          <div key={i} className="grid gap-1">
            <Input
              defaultValue={item.q}
              onBlur={(e) => {
                const items = [...(d.items ?? [])]
                items[i] = { ...items[i], q: e.target.value }
                save({ items })
              }}
            />
            <Textarea
              defaultValue={item.a}
              rows={2}
              onBlur={(e) => {
                const items = [...(d.items ?? [])]
                items[i] = { ...items[i], a: e.target.value }
                save({ items })
              }}
            />
          </div>
        ))}
      </div>
    )
  }
  return null
}

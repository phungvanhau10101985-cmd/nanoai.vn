'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import type { LandingAiKind, PartnerLandingPageRow } from '@/lib/partner-website/landing/partner-landing-types'
import { PARTNER_LANDING_MAX_PRODUCTS, landingAiKindOf } from '@/lib/partner-website/landing/partner-landing-types'
import { LandingAiSectionsDialog } from '@/components/partner-website/landing/landing-ai-sections-dialog'
import {
  LandingProductPicker,
  type LandingPickerProduct,
} from '@/components/partner-website/landing/landing-product-picker'
import { cn } from '@/lib/utils'
import { ExternalLink, Loader2, Plus, Sparkles } from 'lucide-react'

type CategoryPickRow = { id: string; name: string; children: CategoryPickRow[] }

function flattenCategoriesForPicker(nodes: CategoryPickRow[], depth = 0): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'— '.repeat(depth)}${n.name}` })
    out.push(...flattenCategoriesForPicker(n.children ?? [], depth + 1))
  }
  return out
}

type LandingListItem = PartnerLandingPageRow & {
  kind?: LandingAiKind
  publicUrl?: string | null
  previewPath?: string | null
}

type SourceMode = 'category' | 'product_single' | 'products_multi'
type View = 'list' | 'new'

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  siteSlug?: string | null
  websiteReady: boolean
  sectionId?: string
  autoStartChat?: boolean
  onToast: (message: string, variant?: 'default' | 'destructive') => void
  onChatStarted?: () => void
}

export function PartnerWebsiteLandingsPanel({
  locale,
  t,
  partnerId,
  websiteReady,
  sectionId = 'partner-website-landings',
  autoStartChat = false,
  onToast,
  onChatStarted,
}: Props) {
  const [view, setView] = useState<View>('list')
  const [kind, setKind] = useState<LandingAiKind>('single')
  const [landings, setLandings] = useState<LandingListItem[]>([])
  const [stats, setStats] = useState<Record<LandingAiKind, { total: number; published: number }>>({
    single: { total: 0, published: 0 },
    category: { total: 0, published: 0 },
    multi: { total: 0, published: 0 },
  })
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editLanding, setEditLanding] = useState<LandingListItem | null>(null)
  const [autogen, setAutogen] = useState(false)

  const [sourceMode, setSourceMode] = useState<SourceMode>('product_single')
  const [title, setTitle] = useState('')
  const [titleTouched, setTitleTouched] = useState(false)
  const [briefText, setBriefText] = useState('')
  const [selectedProducts, setSelectedProducts] = useState<LandingPickerProduct[]>([])
  const [categories, setCategories] = useState<{ id: string; label: string }[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [productsLimit, setProductsLimit] = useState(12)
  const [materialOptions, setMaterialOptions] = useState<{ material: string; count: number }[]>([])
  const [materialFilter, setMaterialFilter] = useState('')
  const [includeMaterial, setIncludeMaterial] = useState(true)
  const [includeFaq, setIncludeFaq] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadLandings = useCallback(async () => {
    if (!partnerId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings?kind=${encodeURIComponent(kind)}`
      )
      const json = (await res.json()) as {
        landings?: LandingListItem[]
        stats?: Record<LandingAiKind, { total: number; published: number }>
        error?: string
      }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      setLandings(json.landings ?? [])
      if (json.stats) setStats(json.stats)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setLoading(false)
    }
  }, [partnerId, kind, onToast, t.errorGeneric])

  const loadCategories = useCallback(async () => {
    if (!partnerId) return
    try {
      const res = await fetch(`/api/messaging/partners/${encodeURIComponent(partnerId)}/categories`)
      const json = (await res.json()) as { tree?: CategoryPickRow[] }
      if (res.ok) setCategories(flattenCategoriesForPicker(json.tree ?? []))
    } catch {
      /* optional */
    }
  }, [partnerId])

  useEffect(() => {
    void loadLandings()
  }, [loadLandings])

  useEffect(() => {
    if (autoStartChat && websiteReady && view === 'list') {
      setView('new')
      onChatStarted?.()
    }
  }, [autoStartChat, websiteReady, view, onChatStarted])

  useEffect(() => {
    if (view === 'new') void loadCategories()
  }, [view, loadCategories])

  useEffect(() => {
    if (sourceMode !== 'category' || !categoryId) {
      setMaterialOptions([])
      setMaterialFilter('')
      return
    }
    let alive = true
    void (async () => {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/category-materials?categoryId=${encodeURIComponent(categoryId)}`
      )
      const json = (await res.json()) as { items?: { material: string; count: number }[] }
      if (alive) setMaterialOptions(json.items ?? [])
    })()
    return () => {
      alive = false
    }
  }, [sourceMode, categoryId, partnerId])

  useEffect(() => {
    if (titleTouched) return
    if (sourceMode === 'category') {
      const opt = categories.find((c) => c.id === categoryId)
      if (opt) {
        const leaf = opt.label.replace(/^— /g, '').split('— ').pop()?.trim() || opt.label
        setTitle(materialFilter ? `${leaf} - ${materialFilter}` : leaf)
      }
    } else if (sourceMode === 'product_single' && selectedProducts.length === 1) {
      setTitle(selectedProducts[0].name)
    } else if (sourceMode === 'products_multi' && selectedProducts.length >= 2) {
      setTitle(`${selectedProducts.length} ${t.lpKindMulti}`)
    }
  }, [sourceMode, categoryId, categories, selectedProducts, titleTouched, materialFilter])

  const kindTabs = useMemo(
    () =>
      [
        { id: 'single' as const, label: t.lpKindSingle },
        { id: 'category' as const, label: t.lpKindCategory },
        { id: 'multi' as const, label: t.lpKindMulti },
      ],
    [t]
  )

  const openCreate = (mode?: SourceMode) => {
    if (!websiteReady) {
      onToast(t.lpNeedWebsite, 'destructive')
      return
    }
    setSourceMode(mode ?? (kind === 'category' ? 'category' : kind === 'multi' ? 'products_multi' : 'product_single'))
    setTitle('')
    setTitleTouched(false)
    setBriefText('')
    setSelectedProducts([])
    setCategoryId('')
    setMaterialFilter('')
    setIncludeMaterial(true)
    setIncludeFaq(true)
    setView('new')
    onChatStarted?.()
  }

  const handleCreate = async () => {
    if (title.trim().length < 2) {
      onToast(t.lpTitleRequired, 'destructive')
      return
    }
    if (sourceMode === 'product_single' && selectedProducts.length !== 1) {
      onToast(t.lpPickOneProduct, 'destructive')
      return
    }
    if (sourceMode === 'products_multi' && selectedProducts.length < 2) {
      onToast(t.lpPickMultiProducts, 'destructive')
      return
    }
    if (sourceMode === 'category' && !categoryId) {
      onToast(t.lpCategoryPlaceholder, 'destructive')
      return
    }
    if (sourceMode === 'category' && includeMaterial && !materialFilter.trim()) {
      onToast(t.lpMaterialFilterRequired, 'destructive')
      return
    }
    setSubmitting(true)
    try {
      const sourceType = sourceMode === 'category' ? 'category' : 'products'
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          briefText: briefText.trim(),
          inventoryIds: sourceType === 'products' ? selectedProducts.map((p) => p.id) : [],
          sourceType,
          categoryId: sourceType === 'category' ? categoryId : undefined,
          productsLimit,
          materialFilter: sourceType === 'category' ? materialFilter : undefined,
          includeMaterial,
          includeFaq,
          locale,
        }),
      })
      const json = (await res.json()) as { landing?: PartnerLandingPageRow; error?: string }
      if (!res.ok || !json.landing) throw new Error(json.error || t.errorGeneric)
      onToast(t.lpCreateDraftSuccess)
      setView('list')
      setKind(landingAiKindOf(json.landing))
      await loadLandings()
      setAutogen(true)
      setEditLanding(json.landing as LandingListItem)
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePublish = async (landingId: string, publish: boolean) => {
    setBusyId(landingId)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landingId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: publish ? 'publish' : 'unpublish' }),
        }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      onToast(publish ? t.lpPublishSuccess : t.lpUnpublishSuccess)
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async (landingId: string) => {
    if (!window.confirm(t.lpDeleteConfirm)) return
    setBusyId(landingId)
    try {
      const res = await fetch(
        `/api/messaging/partner-website/${encodeURIComponent(partnerId)}/landings/${encodeURIComponent(landingId)}`,
        { method: 'DELETE' }
      )
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error || t.errorGeneric)
      onToast(t.lpDeleteSuccess)
      await loadLandings()
    } catch (e) {
      onToast(e instanceof Error ? e.message : t.errorGeneric, 'destructive')
    } finally {
      setBusyId(null)
    }
  }

  const currentStat = stats[kind]

  return (
    <Card id={sectionId}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {t.lpPanelTitle}
          </CardTitle>
          <CardDescription>{t.lpPanelHint}</CardDescription>
        </div>
        {view === 'list' ? (
          <Button type="button" size="sm" onClick={() => openCreate()}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t.lpCreateNew}
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setView('list')}>
            {t.lpBackToList}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {view === 'list' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {kindTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setKind(tab.id)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium',
                    kind === tab.id
                      ? 'border-transparent bg-[var(--pw-primary,#0f172a)] text-white'
                      : 'border-border bg-background hover:bg-muted'
                  )}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs opacity-80">({stats[tab.id].total})</span>
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="text-muted-foreground">{t.lpStatsTotal}</p>
                <p className="text-xl font-semibold">{currentStat.total}</p>
              </div>
              <div className="rounded-lg border border-border/70 p-3 text-sm">
                <p className="text-muted-foreground">{t.lpStatsPublished}</p>
                <p className="text-xl font-semibold">{currentStat.published}</p>
              </div>
            </div>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> {t.lpLoading}
              </p>
            ) : landings.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="text-sm text-muted-foreground">{t.lpEmptyKind}</p>
                <Button type="button" className="mt-3" size="sm" onClick={() => openCreate()}>
                  {t.lpCreateNew}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2 pr-3">{t.lpTitleLabel}</th>
                      <th className="py-2 pr-3">{t.lpUpdated}</th>
                      <th className="py-2 pr-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {landings.map((lp) => (
                      <tr key={lp.id} className="border-b border-border/50">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{lp.title}</p>
                          <p className="text-xs text-muted-foreground">/lp/{lp.landingSlug}</p>
                          <span
                            className={cn(
                              'mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold',
                              lp.isPublished ? 'bg-emerald-50 text-emerald-700' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {lp.isPublished ? t.lpPublished : t.lpDraft}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                          {lp.updatedAt ? new Date(lp.updatedAt).toLocaleDateString(locale) : '—'}
                        </td>
                        <td className="py-2.5">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busyId === lp.id}
                              onClick={() => {
                                setAutogen(false)
                                setEditLanding(lp)
                              }}
                            >
                              {t.lpEdit}
                            </Button>
                            {lp.isPublished && lp.publicUrl ? (
                              <Button type="button" size="sm" variant="outline" asChild>
                                <a href={lp.publicUrl} target="_blank" rel="noreferrer">
                                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                                  {t.lpView}
                                </a>
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busyId === lp.id}
                              onClick={() => void handlePublish(lp.id, !lp.isPublished)}
                            >
                              {lp.isPublished ? t.lpUnpublish : t.lpPublish}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={busyId === lp.id}
                              onClick={() => void handleDelete(lp.id)}
                            >
                              {t.lpDelete}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">{t.lpSourceTypeLabel}</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['product_single', t.lpSourceSingle],
                    ['products_multi', t.lpSourceMulti],
                    ['category', t.lpSourceCategory],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSourceMode(id)
                      setSelectedProducts([])
                      setTitleTouched(false)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium',
                      sourceMode === id
                        ? 'border-transparent bg-[var(--pw-primary,#0f172a)] text-white'
                        : 'border-border hover:bg-muted'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {sourceMode === 'category' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>{t.lpCategoryLabel}</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">{t.lpCategoryPlaceholder}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>{t.lpProductsLimitLabel}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={productsLimit}
                    onChange={(e) => setProductsLimit(Number(e.target.value) || 12)}
                  />
                </div>
                {includeMaterial ? (
                  <div className="space-y-1 sm:col-span-2">
                    <Label>{t.lpMaterialFilterLabel}</Label>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={materialFilter}
                      onChange={(e) => setMaterialFilter(e.target.value)}
                    >
                      <option value="">{t.lpCategoryPlaceholder}</option>
                      {materialOptions.map((m) => (
                        <option key={m.material} value={m.material}>
                          {m.material} ({m.count} SP)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1">
                <Label>{sourceMode === 'product_single' ? t.lpSourceSingle : t.lpSourceMulti}</Label>
                <LandingProductPicker
                  partnerId={partnerId}
                  selected={selectedProducts}
                  onChange={setSelectedProducts}
                  mode={sourceMode === 'product_single' ? 'single' : 'multi'}
                  searchPlaceholder={t.lpSearchProducts}
                  maxProducts={PARTNER_LANDING_MAX_PRODUCTS}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label>{t.lpTitleLabel}</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitleTouched(true)
                  setTitle(e.target.value)
                }}
                placeholder={t.lpTitlePlaceholder}
              />
            </div>
            <div className="space-y-1">
              <Label>{t.lpBriefOptional}</Label>
              <Textarea
                value={briefText}
                onChange={(e) => setBriefText(e.target.value)}
                placeholder={t.lpBriefPlaceholder}
                rows={3}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeMaterial} onChange={(e) => setIncludeMaterial(e.target.checked)} />
              {t.lpIncludeMaterial}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={includeFaq} onChange={(e) => setIncludeFaq(e.target.checked)} />
              {t.lpIncludeFaq}
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setView('list')}>
                {t.lpCancel}
              </Button>
              <Button type="button" disabled={submitting} onClick={() => void handleCreate()}>
                {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1.5 h-4 w-4" />}
                {t.lpCreateWithAi}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {editLanding ? (
        <LandingAiSectionsDialog
          partnerId={partnerId}
          landing={editLanding}
          t={t}
          open
          autogen={autogen}
          onOpenChange={(open) => {
            if (!open) {
              setEditLanding(null)
              setAutogen(false)
              void loadLandings()
            }
          }}
          onToast={onToast}
        />
      ) : null}
    </Card>
  )
}

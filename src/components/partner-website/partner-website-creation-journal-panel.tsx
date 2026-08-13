'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, ImagePlus, LayoutTemplate, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import { uploadPartnerImageFile } from '@/components/partner-website/partner-website-asset-panel'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import {
  isHomePageBuilt,
  type PartnerWebsiteCreationJournal,
} from '@/lib/partner-website/partner-website-creation-journal'
import { shopTemplateSamplePreviewPath } from '@/lib/partner-website/template/build-shop-template-sample-html'
import {
  DEFAULT_SHOP_TEMPLATE_PRESET_ID,
  listShopTemplatePresets,
  shopTemplatePresetDescription,
  shopTemplatePresetLabel,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'

type PagePickerItem = {
  key: string
  status: 'not_started' | 'in_progress' | 'built'
}

type Props = {
  locale: WebLocale
  t: PartnerWebsiteCopy
  partnerId: string
  partnerTitle: string
  defaultBrandName?: string
  website: PartnerWebsiteRow | null
  logoUrl: string
  onLogoUrlChange: (url: string) => void
  disabled?: boolean
  onError: (message: string) => void
  onWebsiteUpdated: (payload: {
    website: PartnerWebsiteRow
    publicUrl: string | null
    assistantMessage: string
    source?: string
  }) => void
  onWebsiteRefresh?: (website: PartnerWebsiteRow) => void
  onJournalChange?: (journal: PartnerWebsiteCreationJournal) => void
  onBusyChange?: (busy: boolean) => void
  domainSlot?: ReactNode
}

function StudioBuildProgressList({
  t,
  steps,
  activeId,
  completedIds,
  failedId,
}: {
  t: PartnerWebsiteCopy
  steps: Array<{ id: string; label: string }>
  activeId: string | null
  completedIds: string[]
  failedId: string | null
}) {
  if (!steps.length) return null
  const doneCount = completedIds.length
  const total = steps.length
  const pct = Math.round((Math.min(doneCount, total) / Math.max(total, 1)) * 100)

  return (
    <div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50/60 p-3 dark:border-violet-900/60 dark:bg-violet-950/30">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
          {t.studioBuildProgressTitle}
        </p>
        <p className="text-[11px] font-medium text-violet-700 dark:text-violet-300">
          {t.studioBuildProgressCount
            .replace('{done}', String(doneCount))
            .replace('{total}', String(total))}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-violet-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <ol className="max-h-52 space-y-1 overflow-y-auto pr-1">
        {steps.map((step) => {
          const done = completedIds.includes(step.id)
          const active = activeId === step.id && !done
          const failed = failedId === step.id
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1 text-[12px]',
                active && 'bg-violet-100/80 dark:bg-violet-900/40',
                failed && 'bg-red-50 dark:bg-red-950/30'
              )}
            >
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
              ) : failed ? (
                <X className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-violet-600" aria-hidden />
              ) : (
                <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
              )}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  done && 'text-muted-foreground',
                  active && 'font-semibold text-violet-900 dark:text-violet-100',
                  failed && 'font-semibold text-red-700 dark:text-red-300',
                  !done && !active && !failed && 'text-muted-foreground/80'
                )}
              >
                {step.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
        done
          ? 'bg-emerald-600 text-white'
          : 'bg-orange-500 text-white'
      )}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
    </span>
  )
}

export function PartnerWebsiteCreationJournalPanel({
  locale,
  t,
  partnerId,
  partnerTitle,
  defaultBrandName,
  website,
  logoUrl,
  onLogoUrlChange,
  disabled,
  onError,
  onWebsiteUpdated,
  onWebsiteRefresh,
  onJournalChange,
  onBusyChange,
  domainSlot,
}: Props) {
  const [journal, setJournal] = useState<PartnerWebsiteCreationJournal | null>(null)
  const [pages, setPages] = useState<PagePickerItem[]>([])
  const [initBusy, setInitBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [buildingSite, setBuildingSite] = useState(false)
  const [, setBuildStatusLabel] = useState('')
  const [buildSteps, setBuildSteps] = useState<Array<{ id: string; label: string }>>([])
  const [buildActiveStepId, setBuildActiveStepId] = useState<string | null>(null)
  const [buildCompletedStepIds, setBuildCompletedStepIds] = useState<string[]>([])
  const [buildFailedStepId, setBuildFailedStepId] = useState<string | null>(null)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const initRef = useRef('')
  const [logoUploadBusy, setLogoUploadBusy] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [setupBrand, setSetupBrand] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<ShopTemplatePresetId>(
    DEFAULT_SHOP_TEMPLATE_PRESET_ID
  )
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(true)
  const shopPresets = useMemo(() => listShopTemplatePresets(), [])
  const homeBuilt = Boolean(
    (website && isHomePageBuilt(website.creationJournals)) ||
      pages.some((p) => p.key === 'home' && p.status === 'built')
  )

  useEffect(() => {
    initRef.current = ''
    setJournal(null)
    setPages([])
    setTemplateLibraryOpen(true)
  }, [partnerId])

  useEffect(() => {
    onBusyChange?.(busy || initBusy || brandSaving)
  }, [busy, initBusy, brandSaving, onBusyChange])

  const applyJournal = useCallback(
    (next: PartnerWebsiteCreationJournal, nextWebsite?: PartnerWebsiteRow | null) => {
      setJournal(next)
      onJournalChange?.(next)
      if (nextWebsite) onWebsiteRefresh?.(nextWebsite)
    },
    [onJournalChange, onWebsiteRefresh]
  )

  const loadPageList = useCallback(async () => {
    if (!partnerId) return
    if (initRef.current === partnerId) return
    initRef.current = partnerId
    setInitBusy(true)
    try {
      const res = await fetch('/api/messaging/partner-website/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'list_pages',
          partnerId,
          locale,
          defaultBrandName: defaultBrandName || partnerTitle,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        pages?: PagePickerItem[]
        error?: string
      }
      if (!res.ok) {
        onError(json.error || t.errorGeneric)
        initRef.current = `${partnerId}:failed`
        return
      }
      setPages(json.pages ?? [])
      if (json.website) onWebsiteRefresh?.(json.website)
      setSetupBrand((defaultBrandName || partnerTitle || json.website?.title || '').trim())
      const alreadyBuilt = Boolean(
        json.website && isHomePageBuilt(json.website.creationJournals)
      )
      setTemplateLibraryOpen(!alreadyBuilt)
    } finally {
      setInitBusy(false)
    }
  }, [partnerId, locale, defaultBrandName, partnerTitle, onError, onWebsiteRefresh, t.errorGeneric])

  useEffect(() => {
    void loadPageList()
  }, [loadPageList])

  async function saveBrand(nextLogoUrl = logoUrl) {
    if (!partnerId || !website) return
    const brand = setupBrand.trim()
    if (brand.length < 2) {
      onError(t.studioAnswerRequired)
      return
    }
    setBrandSaving(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_brand',
          title: brand,
          logoUrl: nextLogoUrl.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        error?: string
      }
      if (!res.ok || !json.website) {
        onError(json.error || t.setupBrandSaveError)
        return
      }
      onWebsiteRefresh?.(json.website)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.setupBrandSaveError)
    } finally {
      setBrandSaving(false)
    }
  }

  async function handleLogoUpload(files: FileList | null) {
    if (!partnerId || !files?.length || busy || disabled) return
    const file = files[0]
    if (!file?.type.startsWith('image/')) {
      onError(t.imageInvalidType)
      return
    }
    setLogoUploadBusy(true)
    try {
      const url = await uploadPartnerImageFile(partnerId, file)
      onLogoUrlChange(url)
      if (website) await saveBrand(url)
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setLogoUploadBusy(false)
    }
  }

  async function ensureHomeJournal(): Promise<PartnerWebsiteCreationJournal | null> {
    if (journal?.pageKey === 'home') return journal
    if (!partnerId) return null
    const res = await fetch('/api/messaging/partner-website/studio', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        partnerId,
        locale,
        pageKey: 'home',
        defaultBrandName: setupBrand.trim() || defaultBrandName || partnerTitle,
      }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      website?: PartnerWebsiteRow
      journal?: PartnerWebsiteCreationJournal
      pages?: PagePickerItem[]
      error?: string
    }
    if (!res.ok || !json.journal) {
      onError(json.error || t.errorGeneric)
      return null
    }
    if (json.pages?.length) setPages(json.pages)
    applyJournal(json.journal, json.website ?? null)
    if (!setupBrand.trim()) {
      setSetupBrand(
        json.journal.answers.brand_name?.trim() ||
          defaultBrandName?.trim() ||
          partnerTitle.trim() ||
          ''
      )
    }
    return json.journal
  }

  async function applyTemplate(presetId: ShopTemplatePresetId = selectedPresetId) {
    if (busy || disabled) return
    if (homeBuilt && !window.confirm(t.setupChangeTemplateConfirm)) return
    setSelectedPresetId(presetId)
    setBuildingSite(true)
    setBusy(true)
    setBuildFailedStepId(null)
    setBuildCompletedStepIds([])
    setBuildActiveStepId('apply')
    setBuildStatusLabel(t.studioBuilding)
    setBuildSteps([
      { id: 'apply', label: t.studioBuildStepApplyLabel },
      { id: 'hooks', label: t.studioBuildStepHooksLabel },
      { id: 'publish', label: t.studioBuildStepFinalizeLabel },
    ])

    try {
      const activeJournal = journal?.pageKey === 'home' ? journal : await ensureHomeJournal()
      if (!activeJournal) {
        setBuildFailedStepId('apply')
        return
      }
      const brand =
        setupBrand.trim() ||
        activeJournal.answers.brand_name?.trim() ||
        defaultBrandName?.trim() ||
        partnerTitle.trim()
      if (brand.length < 2) {
        setBuildFailedStepId('apply')
        onError(t.studioAnswerRequired)
        return
      }

      const res = await fetch('/api/messaging/partner-website/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_template',
          partnerId,
          locale,
          pageKey: 'home',
          answers: {
            ...activeJournal.answers,
            brand_name: brand,
            ...(logoUrl.trim() && /^https?:\/\//i.test(logoUrl.trim())
              ? { logo_url: logoUrl.trim() }
              : {}),
          },
          presetId,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        journal?: PartnerWebsiteCreationJournal
        publicUrl?: string | null
        assistantMessage?: string
        error?: string
      }
      if (!res.ok || !json.journal || !json.website) {
        setBuildFailedStepId('apply')
        onError(json.error || t.errorGeneric)
        return
      }
      setBuildCompletedStepIds(['apply', 'hooks', 'publish'])
      setBuildActiveStepId(null)
      applyJournal(json.journal, json.website)
      setPages((prev) =>
        prev.map((p) => (p.key === 'home' ? { ...p, status: 'built' } : p))
      )
      setTemplateLibraryOpen(false)
      onWebsiteUpdated({
        website: { ...json.website, creationJournal: json.journal },
        publicUrl: json.publicUrl ?? null,
        assistantMessage: json.assistantMessage || t.studioBuildComplete,
        source: 'template',
      })
      setBuildSteps([])
      setBuildCompletedStepIds([])
      setBuildFailedStepId(null)
    } finally {
      setBuildingSite(false)
      setBuildStatusLabel('')
      setBusy(false)
    }
  }

  const logoPreviewUrl = logoUrl.trim()
  const controlsDisabled = busy || disabled || buildingSite || initBusy

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 space-y-2 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <LayoutTemplate className="h-4 w-4" />
          {t.setupStepsTitle}
        </CardTitle>
        <CardDescription>{t.setupStepsHint}</CardDescription>
        {(buildingSite || Boolean(buildFailedStepId)) && buildSteps.length > 0 ? (
          <StudioBuildProgressList
            t={t}
            steps={buildSteps}
            activeId={buildActiveStepId}
            completedIds={buildCompletedStepIds}
            failedId={buildFailedStepId}
          />
        ) : null}
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 pt-0">
        {initBusy && pages.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.journalLoading}
          </p>
        ) : null}

        <section className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
          <div className="flex items-center gap-2">
            <StepBadge n={1} done={setupBrand.trim().length >= 2} />
            <div>
              <p className="text-sm font-semibold">{t.setupStep1Title}</p>
              <p className="text-[11px] text-muted-foreground">{t.setupStep1Hint}</p>
            </div>
          </div>
          <Input
            value={setupBrand}
            onChange={(e) => setSetupBrand(e.target.value)}
            placeholder={t.titleLabel}
            disabled={controlsDisabled || brandSaving}
          />
          <p className="text-xs font-medium">{t.logoLabel}</p>
          {logoPreviewUrl && /^https?:\/\//i.test(logoPreviewUrl) ? (
            <div className="flex flex-wrap items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreviewUrl}
                alt=""
                className="h-14 max-w-[160px] rounded border bg-white object-contain p-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled || logoUploadBusy}
                onClick={() => {
                  onLogoUrlChange('')
                  if (website) void saveBrand('')
                }}
              >
                {t.logoRemove}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <input
              ref={logoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              disabled={controlsDisabled || logoUploadBusy || !partnerId}
              onChange={(e) => {
                void handleLogoUpload(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={controlsDisabled || logoUploadBusy || !partnerId}
              onClick={() => logoFileRef.current?.click()}
            >
              {logoUploadBusy ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
              )}
              {t.logoUpload}
            </Button>
            {website ? (
              <Button
                type="button"
                size="sm"
                disabled={controlsDisabled || brandSaving || setupBrand.trim().length < 2}
                onClick={() => void saveBrand()}
              >
                {brandSaving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                {t.setupBrandSave}
              </Button>
            ) : null}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <StepBadge n={2} done={homeBuilt} />
              <div>
                <p className="text-sm font-semibold text-orange-950 dark:text-orange-100">
                  {t.setupStep2Title}
                </p>
                <p className="text-[11px] text-muted-foreground">{t.setupStep2Hint}</p>
              </div>
            </div>
            {homeBuilt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setTemplateLibraryOpen((open) => !open)}
              >
                {templateLibraryOpen ? t.templateGalleryCloseLibrary : t.pagePickerChangeTemplate}
              </Button>
            ) : null}
          </div>

          {templateLibraryOpen || !homeBuilt ? (
            <div className="grid gap-3">
              {shopPresets.map((preset) => {
                const selected = selectedPresetId === preset.id
                const previewHref = shopTemplateSamplePreviewPath(preset.id, locale)
                return (
                  <div
                    key={preset.id}
                    className={cn(
                      'overflow-hidden rounded-xl border-2 bg-background transition-colors',
                      selected ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[16/9] overflow-hidden bg-orange-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {preset.readyToUse ? (
                          <span className="absolute left-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            {t.templateGalleryReadyBadge}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="text-sm font-semibold">
                          {shopTemplatePresetLabel(preset, locale)}
                        </p>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          {shopTemplatePresetDescription(preset, locale)}
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-2 border-t border-border/60 px-3 py-2.5">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <a href={previewHref} target="_blank" rel="noopener noreferrer">
                          {t.templateGalleryViewSample}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={controlsDisabled || setupBrand.trim().length < 2}
                        onClick={() => void applyTemplate(preset.id)}
                      >
                        {busy || buildingSite ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {homeBuilt ? t.pagePickerChangeTemplate : t.templateGalleryUseTemplate}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        {homeBuilt ? (
          <section className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-start gap-2">
              <StepBadge n={3} done />
              <div>
                <p className="text-sm font-semibold text-emerald-950 dark:text-emerald-100">
                  {t.setupStep3Title}
                </p>
                <p className="text-[11px] text-muted-foreground">{t.setupStep3Hint}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t.journalEditSectionHint}</p>
          </section>
        ) : null}

        {homeBuilt ? (
          <section className="space-y-2 rounded-xl border border-border/70 bg-muted/10 p-3">
            <div className="flex items-start gap-2">
              <StepBadge n={4} />
              <div>
                <p className="text-sm font-semibold">{t.setupStep4Title}</p>
                <p className="text-[11px] text-muted-foreground">{t.setupStep4Hint}</p>
              </div>
            </div>
            {website?.siteSlug ? (
              <p className="text-[11px] text-muted-foreground">
                {t.setupLiveUrlLabel}:{' '}
                <code className="rounded bg-background px-1 py-0.5">/site/{website.siteSlug}</code>
              </p>
            ) : null}
            {domainSlot}
          </section>
        ) : null}

        {homeBuilt ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
            <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
              {t.setupSellReadyTitle}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t.setupSellReadyHint}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

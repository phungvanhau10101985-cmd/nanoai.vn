'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Circle, ImagePlus, LayoutTemplate, Loader2, PanelLeftClose, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  isShopTemplatePresetId,
  listShopTemplatePresets,
  shopTemplatePresetDescription,
  shopTemplatePresetLabel,
  suggestedShopTemplatePresetForIndustry,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'
import { looksLikeConnected188Shop } from '@/lib/partner-website/pick-preferred-website-partner'
import {
  PartnerWebsiteThemeColorPicker,
  useDebouncedThemeSave,
} from '@/components/partner-website/partner-website-theme-color-picker'
import { themeFromPresetPartial } from '@/lib/partner-website/template/partner-website-theme-tokens'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'

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
  industryKey?: 'fashion' | 'hotel' | 'food' | 'other' | null
  partnerSlug?: string | null
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
  onCollapse?: () => void
  onLiveThemeChange?: (theme: PartnerWebsiteTheme) => void
  onThemePersisted?: (
    theme: PartnerWebsiteTheme,
    extras?: { htmlSource?: string | null; project?: unknown }
  ) => void
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
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
        done ? 'bg-emerald-600 text-white' : 'bg-orange-500 text-white'
      )}
    >
      {done ? <Check className="h-3 w-3" aria-hidden /> : n}
    </span>
  )
}

function industryLabel(
  t: PartnerWebsiteCopy,
  industryKey: 'fashion' | 'hotel' | 'food' | 'other' | null | undefined
): string {
  if (industryKey === 'hotel') return t.industryLabelHotel
  if (industryKey === 'food') return t.industryLabelFood
  if (industryKey === 'other') return t.industryLabelOther
  return t.industryLabelFashion
}

export function PartnerWebsiteCreationJournalPanel({
  locale,
  t,
  partnerId,
  partnerTitle,
  defaultBrandName,
  industryKey = 'fashion',
  partnerSlug,
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
  onCollapse,
  onLiveThemeChange,
  onThemePersisted,
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
  const [selectedPresetId, setSelectedPresetId] = useState<ShopTemplatePresetId>(() =>
    suggestedShopTemplatePresetForIndustry(industryKey)
  )
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(true)
  const { saving: themeSaving, schedule: scheduleThemeSave } = useDebouncedThemeSave(
    partnerId,
    (savedTheme, extras) => onThemePersisted?.(savedTheme, extras),
    () => onError(t.themeColorSaveError)
  )
  const shopPresets = useMemo(() => listShopTemplatePresets(), [])
  const suggestedPresetId = suggestedShopTemplatePresetForIndustry(industryKey)
  const appliedPresetId =
    website?.templateId && isShopTemplatePresetId(website.templateId) ? website.templateId : null
  const orderedPresets = useMemo(() => {
    return [...shopPresets].sort((a, b) => {
      if (a.id === suggestedPresetId && b.id !== suggestedPresetId) return -1
      if (b.id === suggestedPresetId && a.id !== suggestedPresetId) return 1
      return 0
    })
  }, [shopPresets, suggestedPresetId])
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
    setSelectedPresetId(appliedPresetId ?? suggestedPresetId)
  }, [appliedPresetId, suggestedPresetId])

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
          logoUrl: nextLogoUrl.trim(),
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

  async function handleLogoRemove() {
    onLogoUrlChange('')
    if (!partnerId || !website) return
    setLogoUploadBusy(true)
    try {
      const res = await fetch(`/api/messaging/partner-website/${encodeURIComponent(partnerId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_logo' }),
      })
      const json = (await res.json().catch(() => ({}))) as {
        website?: PartnerWebsiteRow
        error?: string
      }
      if (!res.ok || !json.website) {
        onError(json.error || t.setupBrandSaveError)
        return
      }
      onLogoUrlChange('')
      onWebsiteRefresh?.({ ...json.website, logoUrl: null })
    } catch (e) {
      onError(e instanceof Error ? e.message : t.setupBrandSaveError)
    } finally {
      setLogoUploadBusy(false)
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
    if (homeBuilt) {
      const resetting = Boolean(appliedPresetId && presetId === appliedPresetId)
      if (!window.confirm(resetting ? t.setupResetTemplateConfirm : t.setupChangeTemplateConfirm)) {
        return
      }
    }
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

  function handleThemeLive(next: PartnerWebsiteTheme) {
    onLiveThemeChange?.(next)
    if (website) scheduleThemeSave(next)
  }

  function handleSelectPresetLook(presetId: ShopTemplatePresetId) {
    setSelectedPresetId(presetId)
    const preset = shopPresets.find((p) => p.id === presetId)
    if (!preset || !website) return
    handleThemeLive(themeFromPresetPartial(website.theme, preset.theme))
  }

  const logoPreviewUrl = logoUrl.trim()
  const controlsDisabled = busy || disabled || buildingSite || initBusy
  const shopName = setupBrand.trim() || defaultBrandName?.trim() || partnerTitle.trim() || 'Shop'
  const industryText = industryLabel(t, industryKey)
  const contextTemplate = shopTemplatePresetLabel(
    shopPresets.find((p) => p.id === (appliedPresetId ?? suggestedPresetId)) ?? shopPresets[0]!,
    locale
  )
  const contextText = (homeBuilt && appliedPresetId ? t.editingContextApplied : t.editingContextDefault)
    .replace('{shop}', shopName)
    .replace('{industry}', industryText)
    .replace('{template}', contextTemplate)
  const connected188 = looksLikeConnected188Shop({
    slug: partnerSlug,
    display_name: partnerTitle,
    brand_name: defaultBrandName,
  })

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 space-y-1.5 px-3 pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-[13px] font-semibold leading-none">
          <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{t.setupStepsTitle}</span>
          {onCollapse ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={onCollapse}
              aria-label={t.setupPanelCollapse}
              title={t.setupPanelCollapse}
            >
              <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
            </Button>
          ) : null}
        </CardTitle>
        <div className="rounded-md border border-sky-200 bg-sky-50/80 px-2 py-1.5 dark:border-sky-900/60 dark:bg-sky-950/30">
          <p className="text-[11px] leading-snug text-sky-950 dark:text-sky-100">{contextText}</p>
          {connected188 ? (
            <p className="mt-0.5 text-[10px] text-sky-800 dark:text-sky-200">
              {t.editingContextConnected.replace('{host}', '188.com.vn')}
            </p>
          ) : null}
        </div>
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

      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 pt-0">
        {initBusy && pages.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t.journalLoading}
          </p>
        ) : null}

        <section className="space-y-1.5 rounded-lg border border-border/70 bg-muted/10 p-2.5">
          <div className="flex items-center gap-1.5">
            <StepBadge n={1} done={setupBrand.trim().length >= 2} />
            <p className="text-[13px] font-semibold leading-none">{t.setupStep1Title}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={setupBrand}
              onChange={(e) => setSetupBrand(e.target.value)}
              placeholder={t.titleLabel}
              disabled={controlsDisabled || brandSaving}
              className="h-8 text-sm"
            />
            {website ? (
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0 px-2.5 text-xs"
                disabled={controlsDisabled || brandSaving || setupBrand.trim().length < 2}
                onClick={() => void saveBrand()}
              >
                {brandSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t.setupBrandSave}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {logoPreviewUrl && /^https?:\/\//i.test(logoPreviewUrl) ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoPreviewUrl}
                  alt=""
                  className="h-8 max-w-[96px] rounded border bg-white object-contain p-0.5"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  disabled={controlsDisabled || logoUploadBusy}
                  onClick={() => void handleLogoRemove()}
                >
                  {t.logoRemove}
                </Button>
              </>
            ) : null}
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
              className="h-8 px-2.5 text-xs"
              disabled={controlsDisabled || logoUploadBusy || !partnerId}
              onClick={() => logoFileRef.current?.click()}
            >
              {logoUploadBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {t.logoUpload}
            </Button>
          </div>
        </section>

        <section className="space-y-1.5 rounded-lg border border-orange-200 bg-orange-50/40 p-2.5 dark:border-orange-900/50 dark:bg-orange-950/20">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <StepBadge n={2} done={homeBuilt} />
              <p className="truncate text-[13px] font-semibold text-orange-950 dark:text-orange-100">
                {t.setupStep2Title}
              </p>
            </div>
            {homeBuilt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={() => setTemplateLibraryOpen((open) => !open)}
              >
                {templateLibraryOpen ? t.templateGalleryCloseLibrary : t.pagePickerChangeTemplate}
              </Button>
            ) : null}
          </div>

          {templateLibraryOpen || !homeBuilt ? (
            <div className="grid gap-2">
              {orderedPresets.map((preset) => {
                const selected = selectedPresetId === preset.id
                const inUse = appliedPresetId === preset.id
                const suggested = !inUse && suggestedPresetId === preset.id
                const previewHref = shopTemplateSamplePreviewPath(preset.id, locale)
                return (
                  <div
                    key={preset.id}
                    className={cn(
                      'overflow-hidden rounded-lg border bg-background transition-colors',
                      selected ? 'border-orange-500 ring-1 ring-orange-500/20' : 'border-border'
                    )}
                  >
                    <button
                      type="button"
                      disabled={controlsDisabled}
                      onClick={() => handleSelectPresetLook(preset.id)}
                      className="block w-full text-left"
                    >
                      <div className="relative aspect-[2/1] overflow-hidden bg-orange-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.coverImageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {preset.readyToUse ? (
                          <span className="absolute left-1.5 top-1.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            {t.templateGalleryReadyBadge}
                          </span>
                        ) : null}
                        {inUse ? (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            {t.templateInUseBadge}
                          </span>
                        ) : suggested ? (
                          <span className="absolute right-1.5 top-1.5 rounded-full bg-sky-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                            {t.templateSuggestedBadge}
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-0.5 px-2 py-1.5">
                        <p className="text-[13px] font-semibold leading-snug">
                          {shopTemplatePresetLabel(preset, locale)}
                        </p>
                        <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                          {shopTemplatePresetDescription(preset, locale)}
                        </p>
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-1.5 border-t border-border/60 px-2 py-1.5">
                      <Button type="button" size="sm" variant="outline" className="h-7 px-2 text-xs" asChild>
                        <a href={previewHref} target="_blank" rel="noopener noreferrer">
                          {t.templateGalleryViewSample}
                        </a>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={controlsDisabled || setupBrand.trim().length < 2}
                        onClick={() => void applyTemplate(preset.id)}
                      >
                        {busy || buildingSite ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {homeBuilt ? t.pagePickerChangeTemplate : t.templateGalleryUseTemplate}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}

          {website ? (
            <PartnerWebsiteThemeColorPicker
              t={t}
              theme={website.theme}
              disabled={controlsDisabled}
              saving={themeSaving}
              onLiveChange={handleThemeLive}
            />
          ) : null}
        </section>

        {homeBuilt ? (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-1.5">
              <StepBadge n={3} done />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-none text-emerald-950 dark:text-emerald-100">
                  {t.setupStep3Title}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t.setupStep3Hint}</p>
              </div>
            </div>
          </section>
        ) : null}

        {homeBuilt ? (
          <section className="space-y-1.5 rounded-lg border border-border/70 bg-muted/10 p-2.5">
            <div className="flex items-center gap-1.5">
              <StepBadge n={4} />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-none">{t.setupStep4Title}</p>
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{t.setupStep4Hint}</p>
              </div>
            </div>
            {website?.siteSlug ? (
              <p className="text-[10px] text-muted-foreground">
                {t.setupLiveUrlLabel}:{' '}
                <code className="rounded bg-background px-1 py-0.5">/site/{website.siteSlug}</code>
              </p>
            ) : null}
            {domainSlot}
          </section>
        ) : null}

        {homeBuilt ? (
          <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-2.5 py-1.5 text-[11px] leading-snug text-sky-950 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-100">
            <span className="font-semibold">{t.setupSellReadyTitle}. </span>
            {t.setupSellReadyHint}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

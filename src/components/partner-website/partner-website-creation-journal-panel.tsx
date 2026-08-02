'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Check, Circle, ImagePlus, Loader2, Maximize2, Send, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsiteCopy } from '@/lib/i18n/partner-website-copy'
import {
  collectPartnerWebsiteReferenceUrls,
  PartnerWebsiteAssetPanel,
  PartnerWebsiteEditRefStrip,
  uploadPartnerImageFile,
} from '@/components/partner-website/partner-website-asset-panel'
import type { PartnerWebsiteRow } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteAgentStep } from '@/lib/partner-website/partner-website-agent-loop'
import type { FileDiff } from '@/lib/partner-website/partner-website-line-diff'
import {
  DEFAULT_PARTNER_WEBSITE_MODEL_ID,
  PARTNER_WEBSITE_MODELS,
  partnerWebsiteModelLabel,
  type PartnerWebsiteModelId,
} from '@/lib/partner-website/partner-website-models'
import {
  editSuggestionsForJournal,
  isCreationInProgress,
  type PartnerWebsiteCreationJournal,
  type PartnerWebsiteJournalEntry,
} from '@/lib/partner-website/partner-website-creation-journal'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import {
  shopTemplateGalleryPath,
  shopTemplateSamplePreviewPath,
} from '@/lib/partner-website/template/build-shop-template-sample-html'
import {
  DEFAULT_SHOP_TEMPLATE_PRESET_ID,
  listShopTemplatePresets,
  shopTemplatePresetDescription,
  shopTemplatePresetLabel,
  type ShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'

type PagePickerItem = {
  key: PartnerWebsitePageKey
  htmlPath: string
  routePath: string
  title: string
  hint: string
  status: 'not_started' | 'in_progress' | 'built'
  phase: PartnerWebsiteCreationJournal['phase'] | null
  studioMode?: 'home_template' | 'platform' | 'legacy_ai'
}

export type PartnerWebsiteCreationJournalPanelHandle = {
  sendMessage: (message: string) => Promise<void>
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
  refUrlsText: string
  onRefUrlsTextChange: (text: string) => void
  uploadedRefUrls: string[]
  onUploadedRefUrlsChange: (urls: string[]) => void
  disabled?: boolean
  onError: (message: string) => void
  onWebsiteUpdated: (payload: {
    website: PartnerWebsiteRow
    publicUrl: string | null
    assistantMessage: string
    source?: string
    editMode?: string
    editedFiles?: string[]
    agentSteps?: PartnerWebsiteAgentStep[]
    fileDiffs?: FileDiff[]
  }) => void
  onWebsiteRefresh?: (website: PartnerWebsiteRow) => void
  onJournalChange?: (journal: PartnerWebsiteCreationJournal) => void
  onBusyChange?: (busy: boolean) => void
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

function MockupImageLightbox({
  src,
  alt,
  viewLargeLabel,
  compact = false,
}: {
  src: string
  alt: string
  viewLargeLabel: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div className="overflow-hidden rounded-md border bg-background/50">
        <button
          type="button"
          className="block w-full cursor-zoom-in text-left"
          onClick={() => setOpen(true)}
          aria-label={viewLargeLabel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className={
              compact
                ? 'max-h-72 w-full object-contain'
                : 'max-h-[min(420px,55vh)] w-full object-contain'
            }
          />
        </button>
        <div className="border-t bg-background/80 p-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => setOpen(true)}
          >
            <Maximize2 className="mr-1 h-3.5 w-3.5" />
            {viewLargeLabel}
          </Button>
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          overlayClassName="z-[2147483646] bg-black/90"
          className="!fixed !inset-0 !left-0 !top-0 z-[2147483647] !flex !h-[100dvh] !max-h-[100dvh] !min-h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 items-center justify-center rounded-none border-0 bg-black/95 p-2 shadow-none sm:rounded-none"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-[max(0.75rem,env(safe-area-inset-right))] top-[max(0.75rem,env(safe-area-inset-top))] z-50 h-11 w-11 rounded-full border border-white/20 bg-white/20 text-white hover:bg-white/30"
            onClick={() => setOpen(false)}
            aria-label={viewLargeLabel}
          >
            <X className="h-6 w-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

function JournalBubble({
  entry,
  viewLargeLabel,
}: {
  entry: PartnerWebsiteJournalEntry
  viewLargeLabel: string
}) {
  const isUser = entry.role === 'user'
  return (
    <div className={cn('flex flex-col gap-1.5', isUser ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[95%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        )}
      >
        <p className="whitespace-pre-wrap">{entry.content}</p>
        {entry.imageUrl ? (
          entry.kind === 'mockup_generated' || entry.kind === 'mockup_approved' ? (
            <div className="mt-2">
              <MockupImageLightbox
                src={entry.imageUrl}
                alt={entry.content}
                viewLargeLabel={viewLargeLabel}
                compact
              />
            </div>
          ) : (
            <div className="mt-2 overflow-hidden rounded-md border bg-background/50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.imageUrl} alt="" className="max-h-64 w-full object-contain" />
            </div>
          )
        ) : null}
      </div>
    </div>
  )
}

function SuggestionChips({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: string[]
  disabled?: boolean
  onPick: (value: string) => void
}) {
  if (!suggestions.length) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.map((s) => (
        <Button
          key={s}
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto whitespace-normal py-1 text-xs"
          disabled={disabled}
          onClick={() => onPick(s)}
        >
          {s}
        </Button>
      ))}
    </div>
  )
}

export const PartnerWebsiteCreationJournalPanel = forwardRef<
  PartnerWebsiteCreationJournalPanelHandle,
  Props
>(function PartnerWebsiteCreationJournalPanel(
  {
    locale,
    t,
    partnerId,
    partnerTitle,
    defaultBrandName,
    website,
    logoUrl,
    onLogoUrlChange,
    refUrlsText,
    onRefUrlsTextChange,
    uploadedRefUrls,
    onUploadedRefUrlsChange,
    disabled,
    onError,
    onWebsiteUpdated,
    onWebsiteRefresh,
    onJournalChange,
    onBusyChange,
  },
  ref
) {
  const [journal, setJournal] = useState<PartnerWebsiteCreationJournal | null>(null)
  const [pages, setPages] = useState<PagePickerItem[]>([])
  const [viewMode, setViewMode] = useState<'picker' | 'chat'>('picker')
  const [activePageKey, setActivePageKey] = useState<PartnerWebsitePageKey | null>(null)
  const [initBusy, setInitBusy] = useState(false)
  const [modelId, setModelId] = useState<PartnerWebsiteModelId>(DEFAULT_PARTNER_WEBSITE_MODEL_ID)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [buildingSite, setBuildingSite] = useState(false)
  const [buildStatusLabel, setBuildStatusLabel] = useState('')
  const [buildSteps, setBuildSteps] = useState<Array<{ id: string; label: string }>>([])
  const [buildActiveStepId, setBuildActiveStepId] = useState<string | null>(null)
  const [buildCompletedStepIds, setBuildCompletedStepIds] = useState<string[]>([])
  const [buildFailedStepId, setBuildFailedStepId] = useState<string | null>(null)
  const [showAssets, setShowAssets] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const logoFileRef = useRef<HTMLInputElement>(null)
  const initRef = useRef('')
  const [logoUploadBusy, setLogoUploadBusy] = useState(false)
  const [setupBrand, setSetupBrand] = useState('')
  const [selectedPresetId, setSelectedPresetId] = useState<ShopTemplatePresetId>(
    DEFAULT_SHOP_TEMPLATE_PRESET_ID
  )
  const shopPresets = useMemo(() => listShopTemplatePresets(), [])
  const isTemplateSetup = Boolean(
    journal && (journal.phase === 'discovery' || journal.phase === 'mockup')
  )

  useEffect(() => {
    initRef.current = ''
    setJournal(null)
    setPages([])
    setViewMode('picker')
    setActivePageKey(null)
  }, [partnerId])

  const creationInProgress = journal ? isCreationInProgress(journal) : false

  const activeSuggestions = useMemo(() => {
    if (!journal || journal.phase !== 'built') return []
    const last = journal.entries[journal.entries.length - 1]
    if (last?.suggestions?.length) return last.suggestions
    return editSuggestionsForJournal(journal, t)
  }, [journal, t])

  useEffect(() => {
    onBusyChange?.(busy || initBusy)
  }, [busy, initBusy, onBusyChange])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [journal?.entries.length, busy])

  const applyJournal = useCallback(
    (next: PartnerWebsiteCreationJournal, nextWebsite?: PartnerWebsiteRow | null) => {
      setJournal(next)
      setActivePageKey(next.pageKey as PartnerWebsitePageKey)
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
      const nextPages = json.pages ?? []
      setPages(nextPages)
      if (json.website) onWebsiteRefresh?.(json.website)

      // Stay on template library (picker). Apply/use sample from here — no need to open home first.
      setSetupBrand(
        (defaultBrandName || partnerTitle || json.website?.title || '').trim()
      )
      setViewMode('picker')
      setJournal(null)
      setActivePageKey(null)
    } finally {
      setInitBusy(false)
    }
  }, [partnerId, locale, defaultBrandName, partnerTitle, onError, onWebsiteRefresh, t.errorGeneric])

  const openPageConversation = useCallback(
    async (page: PagePickerItem) => {
      if (!partnerId || busy) return
      // Platform commerce pages are React routes — open live URL, no AI create chat.
      if (page.studioMode === 'platform') {
        const slug = website?.siteSlug?.trim()
        if (!slug) {
          onError(t.pagePickerNeedHomeFirst)
          return
        }
        if (page.status !== 'built') {
          onError(t.pagePickerNeedHomeFirst)
          return
        }
        const path =
          page.routePath === '/'
            ? `/site/${encodeURIComponent(slug)}`
            : `/site/${encodeURIComponent(slug)}${page.routePath.replace('/[id]', '')}`
        window.open(path, '_blank', 'noopener,noreferrer')
        return
      }

      setInitBusy(true)
      try {
        const res = await fetch('/api/messaging/partner-website/studio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'init',
            partnerId,
            locale,
            pageKey: page.key,
            defaultBrandName: defaultBrandName || partnerTitle,
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
          return
        }
        if (json.pages?.length) setPages(json.pages)
        applyJournal(json.journal, json.website ?? null)
        setSetupBrand(
          json.journal.answers.brand_name?.trim() ||
            defaultBrandName?.trim() ||
            partnerTitle.trim() ||
            ''
        )
        setViewMode('chat')
        setInput('')
      } finally {
        setInitBusy(false)
      }
    },
    [
      partnerId,
      busy,
      locale,
      defaultBrandName,
      partnerTitle,
      applyJournal,
      onError,
      website?.siteSlug,
      t.errorGeneric,
      t.pagePickerNeedHomeFirst,
    ]
  )

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
    } catch (e) {
      onError(e instanceof Error ? e.message : t.uploadFailed)
    } finally {
      setLogoUploadBusy(false)
    }
  }

  const logoPreviewUrl = logoUrl.trim()

  useEffect(() => {
    void loadPageList()
  }, [loadPageList])

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
      const pageKey = 'home'
      setViewMode('chat')

      const res = await fetch('/api/messaging/partner-website/studio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'apply_template',
          partnerId,
          locale,
          pageKey,
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
        prev.map((p) =>
          p.key === pageKey ? { ...p, status: 'built', phase: 'built' } : p
        )
      )
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

  const sendEditMessage = useCallback(
    async (rawMessage: string) => {
      const message = rawMessage.trim()
      if (!partnerId || busy || creationInProgress) return
      if (message.length < 2) {
        onError(t.chatMessageTooShort)
        return
      }
      setInput('')
      setBusy(true)
      try {
        const referenceImageUrls = collectPartnerWebsiteReferenceUrls({
          refUrlsText,
          uploadedRefUrls,
        })
        const res = await fetch('/api/messaging/partner-website/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId,
            message,
            modelId,
            messages: journal?.entries
              .filter((e) => e.kind === 'edit_request' || e.kind === 'edit_result')
              .map((e) => ({
                role: e.role === 'user' ? 'user' : 'assistant',
                content: e.content,
              })),
            title: partnerTitle,
            logoUrl: logoUrl.trim() || null,
            referenceImageUrls,
            locale,
          }),
        })
        const json = (await res.json().catch(() => ({}))) as {
          website?: PartnerWebsiteRow
          journal?: PartnerWebsiteCreationJournal
          publicUrl?: string | null
          assistantMessage?: string
          source?: string
          editedFiles?: string[]
          agentSteps?: PartnerWebsiteAgentStep[]
          fileDiffs?: FileDiff[]
          error?: string
        }
        if (!res.ok || !json.website) {
          onError(json.error || t.errorGeneric)
          return
        }
        if (json.journal) applyJournal(json.journal)
        onWebsiteUpdated({
          website: json.website,
          publicUrl: json.publicUrl ?? null,
          assistantMessage: json.assistantMessage ?? t.studioBuildComplete,
          source: json.source,
          editedFiles: json.editedFiles,
          agentSteps: json.agentSteps,
          fileDiffs: json.fileDiffs,
        })
      } finally {
        setBusy(false)
      }
    },
    [
      partnerId,
      busy,
      creationInProgress,
      refUrlsText,
      uploadedRefUrls,
      modelId,
      journal?.entries,
      partnerTitle,
      logoUrl,
      locale,
      applyJournal,
      onWebsiteUpdated,
      onError,
      t.chatMessageTooShort,
      t.errorGeneric,
      t.studioBuildComplete,
    ]
  )

  useImperativeHandle(ref, () => ({ sendMessage: sendEditMessage }), [sendEditMessage])

  function handlePrimarySubmit() {
    if (isTemplateSetup) {
      void applyTemplate()
      return
    }
    void sendEditMessage(input)
  }

  function handleSuggestionPick(value: string) {
    setInput(value)
    if (journal?.phase === 'built') {
      void sendEditMessage(value)
    }
  }

  const showBriefComposer = Boolean(viewMode === 'chat' && isTemplateSetup)
  const showEditComposer = Boolean(viewMode === 'chat' && journal && journal.phase === 'built')

  const statusLabel = (page: PagePickerItem) => {
    if (page.studioMode === 'platform') {
      return page.status === 'built' ? t.pageStatusPlatformReady : t.pageStatusNeedHome
    }
    return page.status === 'built'
      ? t.pageStatusBuilt
      : page.status === 'in_progress'
        ? t.pageStatusInProgress
        : t.pageStatusNotStarted
  }

  const actionLabel = (page: PagePickerItem) => {
    if (page.studioMode === 'platform') {
      return page.status === 'built' ? t.pagePickerOpenLive : t.pagePickerNeedHomeFirst
    }
    if (page.studioMode === 'home_template') {
      return page.status === 'not_started' ? t.pagePickerSetupHome : t.pagePickerContinue
    }
    return page.status === 'not_started' ? t.pagePickerCreate : t.pagePickerContinue
  }

  const activePageTitle =
    pages.find((p) => p.key === (activePageKey || journal?.pageKey))?.title ||
    t.journalSectionTitle

  return (
    <Card className="flex h-full min-h-0 flex-col">
      <CardHeader className="shrink-0 space-y-2 pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4" />
              {viewMode === 'picker' ? t.pagePickerTitle : activePageTitle}
            </CardTitle>
            <CardDescription>
              {viewMode === 'picker' ? t.pagePickerHint : t.studioWebHint}
            </CardDescription>
          </div>
          {viewMode === 'chat' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy || initBusy}
              onClick={() => {
                setViewMode('picker')
                setJournal(null)
                setActivePageKey(null)
                initRef.current = ''
                void loadPageList()
              }}
            >
              {t.pagePickerBack}
            </Button>
          ) : null}
        </div>
        {viewMode === 'chat' && journal?.phase === 'built' && !buildingSite ? (
          <p className="text-xs text-muted-foreground">{t.journalEditSectionHint}</p>
        ) : null}
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

      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 p-4 pt-0">
        {viewMode === 'picker' ? (
          <div className="min-h-[120px] flex-1 space-y-4 overflow-y-auto pr-1">
            {initBusy && pages.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.journalLoading}
              </p>
            ) : null}

            <div className="space-y-2 rounded-xl border border-orange-200 bg-orange-50/40 p-3 dark:border-orange-900/50 dark:bg-orange-950/20">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-orange-950 dark:text-orange-100">
                    {t.studioPickTemplateTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.studioPickTemplateHint}</p>
                </div>
                <a
                  href={shopTemplateGalleryPath(locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11px] font-semibold text-orange-600 underline-offset-2 hover:underline"
                >
                  {t.templateGalleryOpenLibrary}
                </a>
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium">{t.studioQ_brand_name}</p>
                <Input
                  value={setupBrand}
                  onChange={(e) => setSetupBrand(e.target.value)}
                  placeholder={t.titleLabel}
                  disabled={busy || disabled || buildingSite || initBusy}
                />
              </div>

              <div className="grid gap-3">
                {shopPresets.map((preset) => {
                  const selected = selectedPresetId === preset.id
                  const previewHref = shopTemplateSamplePreviewPath(preset.id, locale)
                  const homeBuilt = pages.some((p) => p.key === 'home' && p.status === 'built')
                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        'overflow-hidden rounded-xl border-2 bg-background transition-colors',
                        selected
                          ? 'border-orange-500 ring-2 ring-orange-500/20'
                          : 'border-border'
                      )}
                    >
                      <button
                        type="button"
                        disabled={busy || disabled || buildingSite || initBusy}
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
                          disabled={
                            busy ||
                            disabled ||
                            buildingSite ||
                            initBusy ||
                            setupBrand.trim().length < 2
                          }
                          onClick={() => void applyTemplate(preset.id)}
                        >
                          {busy || buildingSite ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {homeBuilt
                            ? t.pagePickerChangeTemplate
                            : t.templateGalleryUseTemplate}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.pagePickerPlatformSection}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {t.pagePickerPlatformSectionHint}
                </p>
              </div>
              {pages
                .filter((page) => page.studioMode === 'platform' || page.key === 'home')
                .map((page) => {
                  const isPlatform = page.studioMode === 'platform'
                  const lockedPlatform = isPlatform && page.status !== 'built'
                  return (
                    <button
                      key={page.key}
                      type="button"
                      disabled={busy || initBusy || disabled || lockedPlatform}
                      onClick={() => void openPageConversation(page)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                        'hover:border-orange-300 hover:bg-orange-50/50 dark:hover:bg-orange-950/20',
                        'disabled:pointer-events-none disabled:opacity-60'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{page.title}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-[10px] font-medium',
                              page.status === 'built' &&
                                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
                              page.status === 'in_progress' &&
                                'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                              page.status === 'not_started' &&
                                'bg-muted text-muted-foreground'
                            )}
                          >
                            {statusLabel(page)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {isPlatform ? t.pagePickerPlatformHint : page.hint}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-medium text-orange-700 dark:text-orange-300">
                        {actionLabel(page)}
                      </span>
                    </button>
                  )
                })}
            </div>
          </div>
        ) : null}

        {showBriefComposer ? (
          <div className="shrink-0 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div>
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">
                {t.journalBriefSectionTitle}
              </p>
              <p className="text-xs text-muted-foreground">{t.journalBriefSectionHint}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">{t.studioQ_brand_name}</p>
              <Input
                value={setupBrand}
                onChange={(e) => setSetupBrand(e.target.value)}
                placeholder={t.titleLabel}
                disabled={busy || disabled || buildingSite}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">{t.logoLabel}</p>
              <p className="text-xs text-muted-foreground">{t.logoGenerateHint}</p>
              {logoPreviewUrl && /^https?:\/\//i.test(logoPreviewUrl) ? (
                <div className="flex flex-wrap items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreviewUrl}
                    alt=""
                    className="h-16 max-w-[180px] rounded border bg-white object-contain p-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || disabled || logoUploadBusy}
                    onClick={() => onLogoUrlChange('')}
                  >
                    {t.logoRemove}
                  </Button>
                </div>
              ) : null}
              <Input
                value={logoUrl}
                onChange={(e) => onLogoUrlChange(e.target.value)}
                placeholder={t.logoUrlPlaceholder}
                disabled={busy || disabled || logoUploadBusy}
              />
              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy || disabled || logoUploadBusy || !partnerId}
                  onChange={(e) => {
                    void handleLogoUpload(e.target.files)
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || disabled || logoUploadBusy || !partnerId}
                  onClick={() => logoFileRef.current?.click()}
                >
                  {logoUploadBusy ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="mr-1 h-3.5 w-3.5" />
                  )}
                  {t.logoUpload}
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{t.studioPickTemplateTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.studioPickTemplateHint}</p>
                </div>
                <a
                  href={shopTemplateGalleryPath(locale)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[11px] font-semibold text-orange-600 underline-offset-2 hover:underline"
                >
                  {t.templateGalleryOpenLibrary}
                </a>
              </div>
              <div className="grid gap-3">
                {shopPresets.map((preset) => {
                  const selected = selectedPresetId === preset.id
                  const previewHref = shopTemplateSamplePreviewPath(preset.id, locale)
                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        'overflow-hidden rounded-xl border-2 bg-background transition-colors',
                        selected
                          ? 'border-orange-500 ring-2 ring-orange-500/20'
                          : 'border-border'
                      )}
                    >
                      <button
                        type="button"
                        disabled={busy || disabled || buildingSite}
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
                          disabled={busy || disabled || buildingSite || setupBrand.trim().length < 2}
                          onClick={() => {
                            setSelectedPresetId(preset.id)
                            void applyTemplate(preset.id)
                          }}
                        >
                          {busy || buildingSite ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {t.templateGalleryUseTemplate}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        ) : null}

        {viewMode === 'chat' && (journal?.phase === 'built' || buildingSite) ? (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <p className="mb-1.5 shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t.journalHistoryTitle}
            </p>
            <div
              ref={scrollRef}
              className="min-h-[80px] flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/50 bg-muted/20 p-2 pr-1"
            >
              {initBusy && !journal ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.journalLoading}
                </p>
              ) : null}
              {journal?.entries
                .filter((e) => e.kind === 'edit_request' || e.kind === 'edit_result' || e.kind === 'site_built')
                .map((entry) => (
                  <JournalBubble key={entry.id} entry={entry} viewLargeLabel={t.studioMockupViewLarge} />
                ))}
              {busy && !buildingSite ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.chatThinking}
                </p>
              ) : null}
              {buildingSite ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {buildStatusLabel || t.studioBuilding}
                  </p>
                  <StudioBuildProgressList
                    t={t}
                    steps={buildSteps}
                    activeId={buildActiveStepId}
                    completedIds={buildCompletedStepIds}
                    failedId={buildFailedStepId}
                  />
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {showEditComposer ? (
          <div className="shrink-0 space-y-2 pt-3">
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <div>
                <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
                  {t.studioRebuildFromMockup}
                </p>
                <p className="text-xs text-muted-foreground">{t.studioRebuildFromMockupHint}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {shopPresets.map((preset) => {
                  const selected = selectedPresetId === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={busy || disabled || buildingSite}
                      onClick={() => setSelectedPresetId(preset.id)}
                      className={cn(
                        'rounded-lg border-2 bg-background p-2 text-left',
                        selected
                          ? 'border-amber-600 ring-2 ring-amber-600/20'
                          : 'border-border hover:border-amber-400'
                      )}
                    >
                      <div className="mb-1.5 flex h-8 overflow-hidden rounded" aria-hidden>
                        <span className="flex-1" style={{ background: preset.swatch.primary }} />
                        <span className="w-1/3" style={{ background: preset.swatch.accent }} />
                      </div>
                      <p className="text-xs font-semibold">
                        {shopTemplatePresetLabel(preset, locale)}
                      </p>
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busy || disabled || buildingSite}
                  onClick={() => void applyTemplate(selectedPresetId)}
                >
                  {busy && buildingSite ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {t.studioRebuildFromMockup}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
              <p className="text-sm font-semibold">{t.journalEditSectionTitle}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t.journalEditSectionHint}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
})

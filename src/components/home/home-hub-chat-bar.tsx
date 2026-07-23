'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Check,
  Circle,
  History,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import type { WebLocale } from '@/lib/i18n/config'
import { HUB_CHAT_MODELS } from '@/lib/hub-chat/hub-chat-catalog'
import {
  clearHubThreadId,
  openHubPlanStep,
  readHubThreadId,
  saveHubPrefill,
  saveHubThreadId,
} from '@/lib/hub-chat/hub-chat-prefill'
import { sanitizeLoginNext } from '@/lib/auth/sanitize-login-next'
import type { HubChatPlanPayload, HubChatWorkflowSuggestion } from '@/app/api/hub-chat/route'
import { HubPlanAutoRunPanel } from '@/components/hub-chat/hub-plan-auto-run-panel'
import { HubStudioActiveStepPreview, HubStudioMessageBubble, HubStudioMessageTime, HubStudioProcessRail, HubStudioThinking } from '@/components/hub-chat/hub-studio-inline'
import type { HubChatThreadSummary, HubMultiTaskPlanRow } from '@/lib/db/hub-chat-pg'
import { normalizeStudioSession, type HubStudioMessagePayload, type HubStudioProcessStep, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { applyPackagingSessionLabels } from '@/lib/packaging/packaging-face-labels'
import { pendingPreviewBlocksWorkflowInput } from '@/lib/hub-chat/hub-studio-step-preview'

function withClientStudioSession(
  raw: HubStudioSession | null | undefined,
  locale: WebLocale
): HubStudioSession | null {
  const normalized = normalizeStudioSession(raw)
  if (!normalized) return null
  return applyPackagingSessionLabels(normalized, locale)
}
import type { HubStudioAction } from '@/lib/hub-chat/hub-studio-handler'
import type { FacePrintStyleKey } from '@/lib/packaging/face-print-style'
import type { TuckBoxProductionParams } from '@/lib/packaging/tuck-box-production'
import { HubBoxDimensionForm } from '@/components/hub-chat/hub-box-dimension-form'
import { HubBarcodeLabelForm } from '@/components/hub-chat/hub-barcode-label-form'
import { HubBoxFaceConfirmActions } from '@/components/hub-chat/hub-box-face-confirm-actions'
import { HubColorPalettePicker } from '@/components/hub-chat/hub-color-palette-picker'
import { HubDiscoveryChoicePicker } from '@/components/hub-chat/hub-discovery-choice-picker'
import { HubFacePrintStylePicker } from '@/components/hub-chat/hub-face-print-style-picker'
import { HubPrintLanguagePicker } from '@/components/hub-chat/hub-print-language-picker'
import { HubLabelAspectRatioPicker } from '@/components/hub-chat/hub-label-aspect-ratio-picker'
import { HubBannerDesignPreparePanel } from '@/components/hub-chat/hub-banner-design-prepare-panel'
import { HubPackagingFaceActions } from '@/components/hub-chat/hub-packaging-face-actions'
import { HubPackagingBodyStripActions } from '@/components/hub-chat/hub-packaging-body-strip-actions'
import { HubPackagingFaceUploadConfirmDialog } from '@/components/hub-chat/hub-packaging-face-upload-confirm-dialog'
import {
  isStudioColorPalettePickerStep,
  type StudioColorSelection,
} from '@/lib/hub-chat/studio-color-palette'
import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'
import { hasSaleBannerDiscoveryBrief } from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  getFlowSteps,
  getStepAskPrompt,
  getStepGenerator,
  getStudioPreset,
  presetStepLabel,
  presetTitle,
  getPrimaryLogoStepKey,
  hasPrimaryLogoReference,
} from '@/lib/hub-chat/hub-studio-presets'
import { getActiveStepKey } from '@/lib/hub-chat/hub-studio-preset-intent'
import { buildPendingStepStudio } from '@/lib/hub-chat/hub-studio-step-retry'
import {
  isForwardOnlyStudioPreset,
  isNavigatedBackEdit,
} from '@/lib/hub-chat/hub-studio-step-navigate'
import {
  getPackagingFaceSizeForStep,
  isPackagingFaceReEdit,
  isPackagingFaceStepKey,
  packagingStepKeyToSlot,
} from '@/lib/packaging/hub-face-steps'
import { getBoxFaceSlotLabel } from '@/lib/packaging/box-face-slots'
import {
  getPackagingDiscoveryInputKind,
  PACKAGING_STYLE_MOOD_CHOICES,
} from '@/lib/packaging/packaging-discovery-choices'
import {
  resolvePrintLanguageKey,
  type PackagingPrintLanguageKey,
} from '@/lib/packaging/packaging-print-language'
import { formatMmSize } from '@/lib/packaging/face-crop-size'
import { DEFAULT_PRODUCT_LABEL_ASPECT_RATIO, DEFAULT_SEAL_STICKER_ASPECT_RATIO } from '@/lib/label-size-presets'
import {
  DEFAULT_PRODUCT_LABEL_SHAPE,
  DEFAULT_SEAL_STICKER_SHAPE,
  type FlatStickerShape,
  resolveProductLabelShape,
  resolveSealStickerShape,
} from '@/lib/packaging/product-label-step'
import {
  defaultBarcodeFormEntries,
  type PackagingBarcodeFormEntry,
} from '@/lib/packaging/packaging-barcode-form'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import {
  MAX_BANNER_BATCH_PRESETS,
  normalizeBannerAdPresetId,
  type BannerAdPresetId,
} from '@/lib/banner-ad-presets'
import { HubStudioGenerationRefPicker } from '@/components/hub-chat/hub-studio-generation-ref-picker'
import { HubStudioRegenerateDialog } from '@/components/hub-chat/hub-studio-regenerate-dialog'
import { HubFeatureOpenConfirmDialog } from '@/components/hub-chat/hub-feature-open-confirm-dialog'
import {
  isActiveStudioFlow,
  isStudioFlowComplete,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import {
  getHubFeatureCatalogEntry,
  groupHubFeatureCatalog,
  groupPostFlowFeatureCatalog,
} from '@/lib/hub-chat/hub-feature-catalog'
import {
  getStudioStepInputPlaceholder,
  getStudioStepSuggestions,
} from '@/lib/hub-chat/hub-studio-step-suggestions'
import { formatStudioExampleLabel } from '@/lib/hub-chat/hub-studio-example-label'
import {
  buildGenerationRefPickerPayload,
  defaultGenerationReferenceKeys,
  ensureGenerationSelection,
  stepSupportsGenerationRefPicker,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { findBlockingIncompleteStep } from '@/lib/hub-chat/hub-studio-step-retry'
import { STUDIO_REFERENCE_ATTACH_LIMIT } from '@/lib/hub-chat/hub-studio-reference-limits'
import {
  HUB_STUDIO_LAUNCH_QUERY,
  consumeHubStudioLaunch,
  hubStudioLaunchPrompt,
  parseHubStudioLaunchId,
  peekHubStudioLaunch,
  saveHubStudioLaunch,
} from '@/lib/hub-chat/hub-studio-launch'
type ChatLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  workflows?: HubChatWorkflowSuggestion[]
  plan?: HubChatPlanPayload | null
  studio?: HubStudioMessagePayload | null
  stepKey?: string
  createdAt?: string
}

function lineCreatedAt(iso?: string): string {
  return iso ?? new Date().toISOString()
}

function isPendingPackagingFacePreviewLine(
  line: ChatLine,
  session: HubStudioSession | null
): boolean {
  if (!session || session.presetId !== 'packaging_kit') return false
  if (line.role !== 'assistant' || !line.studio?.imageUrl || !line.studio.screenKey) return false
  if (!isPackagingFaceStepKey(line.studio.screenKey)) return false
  const pending = session.pendingPreview
  return (
    session.currentStepKey === line.studio.screenKey &&
    pending?.screenKey === line.studio.screenKey &&
    pending.url === line.studio.imageUrl
  )
}

function replaceLatestStudioStepLine(
  lines: ChatLine[],
  screenKey: string | undefined,
  content: string,
  studio: HubStudioMessagePayload | null | undefined
): ChatLine[] {
  if (!screenKey || !studio) return lines
  let index = -1
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]
    if (line?.role === 'assistant' && line.studio?.screenKey === screenKey) {
      index = lineIndex
      break
    }
  }
  if (index < 0) {
    return [
      ...lines,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content,
        studio,
        createdAt: lineCreatedAt(),
      },
    ]
  }
  return lines.map((line, lineIndex) =>
    lineIndex === index ? { ...line, content, studio, createdAt: lineCreatedAt() } : line
  )
}

function ensureApprovedMockupTimelineLine(
  lines: ChatLine[],
  mockupUrl: string | undefined,
  processSteps: HubStudioProcessStep[] | undefined,
  fallbackContent: string
): ChatLine[] {
  if (!mockupUrl) return lines
  const hasMockupLine = lines.some(
    (line) =>
      line.role === 'assistant' &&
      line.studio?.screenKey === 'box_mockup_3d' &&
      Boolean(line.studio.imageUrl)
  )
  if (hasMockupLine) {
    return markApprovedPackagingMockupLine(lines, 'box_mockup_3d', mockupUrl)
  }
  return [
    ...lines,
    {
      id: `a-mockup-${Date.now()}`,
      role: 'assistant',
      content: fallbackContent,
      studio: {
        imageUrl: mockupUrl,
        screenKey: 'box_mockup_3d',
        screenLabel: 'Mockup 3D',
        processSteps,
        showApproveReference: false,
        showRegenerate: true,
      },
      createdAt: lineCreatedAt(),
    },
  ]
}

function replaceLatestStudioImageLine(
  lines: ChatLine[],
  screenKey: string | undefined,
  content: string,
  studio: HubStudioMessagePayload | null | undefined
): ChatLine[] {
  if (!screenKey || !studio?.imageUrl) return lines
  let index = -1
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]
    if (
      line?.role === 'assistant' &&
      line.studio?.screenKey === screenKey &&
      Boolean(line.studio.imageUrl)
    ) {
      index = lineIndex
      break
    }
  }
  if (index < 0) {
    return [
      ...lines,
      {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content,
        studio,
        createdAt: lineCreatedAt(),
      },
    ]
  }
  return lines.map((line, lineIndex) =>
    lineIndex === index ? { ...line, content, studio, createdAt: lineCreatedAt() } : line
  )
}

/** One image bubble per step — hide older regenerations when reloading thread history. */
function collapseDuplicateStudioImageLines(lines: ChatLine[]): ChatLine[] {
  const latestByScreen = new Map<string, number>()
  lines.forEach((line, index) => {
    const screenKey = line.studio?.screenKey
    if (line.role !== 'assistant' || !screenKey || !line.studio?.imageUrl) return
    latestByScreen.set(screenKey, index)
  })
  if (latestByScreen.size === 0) return lines
  return lines.filter((line, index) => {
    const screenKey = line.studio?.screenKey
    if (line.role !== 'assistant' || !screenKey || !line.studio?.imageUrl) return true
    return latestByScreen.get(screenKey) === index
  })
}

function markApprovedPackagingMockupLine(
  lines: ChatLine[],
  screenKey: string,
  imageUrl: string | undefined
): ChatLine[] {
  if (!imageUrl) return lines
  for (let lineIndex = lines.length - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = lines[lineIndex]
    if (
      line?.role === 'assistant' &&
      line.studio?.screenKey === screenKey &&
      line.studio.imageUrl
    ) {
      return lines.map((item, index) =>
        index === lineIndex
          ? {
              ...item,
              studio: {
                ...item.studio!,
                imageUrl,
                showApproveReference: false,
                showRegenerate: true,
              },
            }
          : item
      )
    }
  }
  return lines
}

function updateLatestStudioImageUrl(
  lines: ChatLine[],
  screenKey: string,
  imageUrl: string | undefined
): ChatLine[] {
  return markApprovedPackagingMockupLine(lines, screenKey, imageUrl)
}

function stepStatusIcon(status: string) {
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-600" />
  if (status === 'skipped') return <X className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === 'in_progress') return <Circle className="h-3.5 w-3.5 fill-violet-500 text-violet-500" />
  return <Circle className="h-3.5 w-3.5 text-slate-300" />
}

function formatThreadUpdatedAt(iso: string, locale: WebLocale): string {
  try {
    return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

function threadListLabel(thread: HubChatThreadSummary, locale: WebLocale): string {
  const title = thread.projectTitle?.trim() || thread.title.trim()
  if (title && title !== 'NanoAI chat') return title
  if (thread.presetId) return presetTitle(locale, thread.presetId)
  if (thread.lastMessagePreview) return thread.lastMessagePreview.slice(0, 80)
  return thread.title.trim() || 'NanoAI chat'
}


export function HomeHubChatBar() {
  const router = useRouter()
  const { toast } = useToast()
  const [uiLocale, setUiLocale] = useState<WebLocale>('vi')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [lines, setLines] = useState<ChatLine[]>([])
  const [activePlan, setActivePlan] = useState<HubChatPlanPayload | null>(null)
  const [activePlanRow, setActivePlanRow] = useState<HubMultiTaskPlanRow | null>(null)
  const [studioSession, setStudioSession] = useState<HubStudioSession | null>(null)
  const [bannerOverlayDraft, setBannerOverlayDraft] = useState('')
  const [selectedGenRefKeys, setSelectedGenRefKeys] = useState<string[]>([])
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false)
  const [regeneratePromptDraft, setRegeneratePromptDraft] = useState('')
  const [regenerateTargetStepKey, setRegenerateTargetStepKey] = useState<string | null>(null)
  const [pendingFeatureOpen, setPendingFeatureOpen] = useState<{
    href: string
    prefillPrompt: string
    label: string
  } | null>(null)
  const [showFeaturePicker, setShowFeaturePicker] = useState(true)
  const [reenteringBoxSize, setReenteringBoxSize] = useState(false)
  const [faceUploadConfirmOpen, setFaceUploadConfirmOpen] = useState(false)
  const [pendingFaceUpload, setPendingFaceUpload] = useState<{
    file: File
    previewUrl: string
    faceLabel: string
    sizeLabel: string
    userLabel: string
  } | null>(null)
  const [editingLineId, setEditingLineId] = useState<string | null>(null)
  const [editingStepKey, setEditingStepKey] = useState<string | null>(null)
  const [chatThreads, setChatThreads] = useState<HubChatThreadSummary[]>([])
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [showThreadList, setShowThreadList] = useState(false)
  const [threadsLoaded, setThreadsLoaded] = useState(false)
  const [threadsLoginRequired, setThreadsLoginRequired] = useState(false)
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null)
  const studioFileRef = useRef<HTMLInputElement>(null)
  const studioLogoFileRef = useRef<HTMLInputElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const studioWorkflowAnchorRef = useRef<HTMLDivElement>(null)
  const studioTextareaRef = useRef<HTMLTextAreaElement>(null)
  const postInFlightRef = useRef(false)
  const prevStudioStepKeyRef = useRef<string | null>(null)
  const studioLaunchStartedRef = useRef(false)
  const loadThreadEpochRef = useRef(0)
  const searchParams = useSearchParams()

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  const scrollStudioWorkflowIntoView = useCallback((behavior: ScrollBehavior = 'smooth') => {
    studioWorkflowAnchorRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const shouldPinStudioWorkflowView = Boolean(
    studioSession?.pendingPreview?.url &&
      studioSession.pendingPreview.screenKey === getActiveStepKey(studioSession)
  )

  useEffect(() => {
    if (lines.length === 0) return
    if (shouldPinStudioWorkflowView && !busy) {
      scrollStudioWorkflowIntoView('smooth')
      scrollChatToBottom('auto')
      const t1 = window.setTimeout(() => {
        scrollStudioWorkflowIntoView('auto')
        scrollChatToBottom('auto')
      }, 80)
      const t2 = window.setTimeout(() => {
        scrollStudioWorkflowIntoView('auto')
        scrollChatToBottom('auto')
      }, 320)
      const t3 = window.setTimeout(() => {
        scrollStudioWorkflowIntoView('auto')
        scrollChatToBottom('auto')
      }, 900)
      return () => {
        window.clearTimeout(t1)
        window.clearTimeout(t2)
        window.clearTimeout(t3)
      }
    }
    scrollChatToBottom()
    const t1 = window.setTimeout(() => scrollChatToBottom(), 80)
    const t2 = window.setTimeout(() => scrollChatToBottom(), 320)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [lines, busy, scrollChatToBottom, scrollStudioWorkflowIntoView, shouldPinStudioWorkflowView])

  useEffect(() => {
    if (!studioSession?.presetId) {
      setSelectedGenRefKeys([])
      return
    }
    const keys = studioSession.generationSelection?.referenceScreenKeys
    if (keys?.length) {
      setSelectedGenRefKeys(keys)
      return
    }
    setSelectedGenRefKeys(
      defaultGenerationReferenceKeys(
        studioSession,
        studioSession.presetId,
        getActiveStepKey(studioSession)
      )
    )
  }, [
    studioSession?.presetId,
    studioSession?.currentStepKey,
    studioSession?.generationSelection?.referenceScreenKeys,
    studioSession?.referenceImages,
  ])

  useEffect(() => {
    const sync = () => setUiLocale(readWebLocaleFromDocumentCookie())
    sync()
    const t = window.setInterval(sync, 1000)
    window.addEventListener('focus', sync)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('focus', sync)
    }
  }, [])

  const fetchFullPlan = useCallback(async (planId: string) => {
    try {
      const res = await fetch(`/api/hub-chat/plans/${planId}`, { credentials: 'same-origin' })
      const data = (await res.json().catch(() => ({}))) as { plan?: HubMultiTaskPlanRow }
      if (res.ok && data.plan) setActivePlanRow(data.plan)
    } catch {
      /* ignore */
    }
  }, [])

  const loadThread = useCallback(async (id: string) => {
    const epoch = loadThreadEpochRef.current
    try {
      const res = await fetch(`/api/hub-chat?threadId=${encodeURIComponent(id)}`, { credentials: 'same-origin' })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        thread?: {
          messages: {
            id: string
            role: 'user' | 'assistant'
            content: string
            workflows: HubChatWorkflowSuggestion[] | null
            planId: string | null
            studio: HubStudioMessagePayload | null
            createdAt: string
          }[]
          session: HubStudioSession | null
        }
      }
      if (!res.ok || !data.thread) return
      if (epoch !== loadThreadEpochRef.current) return

      const planById = new Map<string, HubChatPlanPayload>()
      const planIds = [
        ...new Set(data.thread.messages.map((m) => m.planId).filter((x): x is string => Boolean(x))),
      ]
      await Promise.all(
        planIds.map(async (planId) => {
          try {
            const pr = await fetch(`/api/hub-chat/plans/${planId}`, { credentials: 'same-origin' })
            const pd = (await pr.json().catch(() => ({}))) as { plan?: HubMultiTaskPlanRow }
            if (pr.ok && pd.plan) {
              planById.set(planId, {
                id: pd.plan.id,
                title: pd.plan.title,
                steps: pd.plan.steps.map((s) => ({
                  stepIndex: s.stepIndex,
                  href: s.href,
                  labelKey: s.labelKey,
                  label: s.label,
                  prefillPrompt: s.prefillPrompt,
                  reason: s.reason,
                  status: s.status,
                })),
              })
            }
          } catch {
            /* ignore */
          }
        })
      )

      if (epoch !== loadThreadEpochRef.current) return

      const restored: ChatLine[] = data.thread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        workflows: m.workflows ?? undefined,
        plan: m.planId ? planById.get(m.planId) ?? null : undefined,
        studio: m.studio ?? undefined,
        stepKey: m.studio?.stepKey,
        createdAt: m.createdAt,
      }))
      setLines(collapseDuplicateStudioImageLines(restored))
      if (data.thread.session) {
        const session = withClientStudioSession(data.thread.session, uiLocale)
        if (session) setStudioSession(session)
      } else {
        setStudioSession(null)
      }
      const lastPlan = [...restored].reverse().find((l) => l.plan)?.plan
      if (lastPlan) {
        setActivePlan(lastPlan)
        void fetchFullPlan(lastPlan.id)
      } else {
        setActivePlan(null)
        setActivePlanRow(null)
      }
    } catch {
      /* ignore */
    }
  }, [fetchFullPlan, uiLocale])

  const t = useMemo(() => getDictionary(uiLocale), [uiLocale])
  const hc = t.hubChat
  const featureCatalogGroups = useMemo(
    () => groupHubFeatureCatalog(uiLocale),
    [uiLocale]
  )
  const postFlowFeatureGroups = useMemo(
    () => groupPostFlowFeatureCatalog(uiLocale, studioSession?.presetId),
    [studioSession?.presetId, uiLocale]
  )
  const showPostFlowSuggestions = isStudioFlowComplete(studioSession)

  const fetchThreadList = useCallback(async () => {
    setThreadsLoading(true)
    try {
      const res = await fetch('/api/hub-chat/threads', { credentials: 'same-origin' })
      if (res.status === 401) {
        setChatThreads([])
        setThreadsLoaded(false)
        setThreadsLoginRequired(true)
        return
      }
      setThreadsLoginRequired(false)
      const data = (await res.json().catch(() => ({}))) as { threads?: HubChatThreadSummary[] }
      if (!res.ok) {
        toast({ title: hc.chatHistoryLoadFailed, variant: 'destructive' })
        return
      }
      setChatThreads(data.threads ?? [])
      setThreadsLoaded(true)
    } catch {
      toast({ title: hc.chatHistoryLoadFailed, variant: 'destructive' })
    } finally {
      setThreadsLoading(false)
    }
  }, [hc.chatHistoryLoadFailed, toast])

  const switchThread = useCallback(
    async (id: string) => {
      if (busy || id === threadId) return
      setEditingLineId(null)
      setEditingStepKey(null)
      setMessage('')
      setThreadId(id)
      saveHubThreadId(id)
      await loadThread(id)
    },
    [busy, loadThread, threadId]
  )

  const deleteThread = useCallback(
    async (id: string) => {
      if (busy || deletingThreadId) return
      setDeletingThreadId(id)
      try {
        const res = await fetch(`/api/hub-chat/threads?threadId=${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
        })
        if (res.status === 401) {
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return
        }
        if (!res.ok) throw new Error('delete failed')
        setChatThreads((prev) => prev.filter((t) => t.id !== id))
        if (threadId === id) {
          clearHubThreadId()
          setThreadId(null)
          setLines([])
          setActivePlan(null)
          setActivePlanRow(null)
          setStudioSession(null)
          setMessage('')
        }
        toast({ title: hc.chatHistoryDeleted })
      } catch {
        toast({ title: hc.chatHistoryDeleteFailed, variant: 'destructive' })
      } finally {
        setDeletingThreadId(null)
      }
    },
    [busy, deletingThreadId, hc.chatHistoryDeleteFailed, hc.chatHistoryDeleted, hc.loginRequired, threadId, toast]
  )

  useEffect(() => {
    const launchId = parseHubStudioLaunchId(searchParams.get(HUB_STUDIO_LAUNCH_QUERY))
    if (launchId || peekHubStudioLaunch()) return
    const saved = readHubThreadId()
    if (!saved) return
    setThreadId(saved)
    void loadThread(saved)
  }, [loadThread, searchParams])

  useEffect(() => {
    void fetchThreadList()
  }, [fetchThreadList])

  useEffect(() => {
    if (threadsLoaded && chatThreads.length > 0 && lines.length === 0 && !threadId && !studioLaunchStartedRef.current) {
      setShowThreadList(true)
    }
  }, [threadsLoaded, chatThreads.length, lines.length, threadId])

  const modelLabel = HUB_CHAT_MODELS[0]!.label[uiLocale]

  const startNewThread = useCallback(() => {
    loadThreadEpochRef.current += 1
    clearHubThreadId()
    setThreadId(null)
    setLines([])
    setActivePlan(null)
    setActivePlanRow(null)
    setStudioSession(null)
    setMessage('')
    setSelectedGenRefKeys([])
    setEditingLineId(null)
    setEditingStepKey(null)
    setPendingFaceUpload(null)
    setFaceUploadConfirmOpen(false)
    setRegenerateDialogOpen(false)
    setRegenerateTargetStepKey(null)
    studioLaunchStartedRef.current = false
  }, [])

  const postStudio = useCallback(
    async (payload: {
      message?: string
      action?: HubStudioAction
      presetId?: string
      referenceScreenKey?: string
      generationRefKeys?: string[]
      productUrl?: string
      editMessageId?: string
      editStepKey?: string
      navigateStepKey?: string
      regenerateStepKey?: string
      facePrintStyle?: string
      printLanguage?: string
      printLanguageDetail?: string
      labelAspectRatio?: string
      labelShape?: FlatStickerShape
      bannerAdPresetId?: BannerAdPresetId
      bannerAdPresetIds?: BannerAdPresetId[]
      bannerOverlayText?: string
      discoveryChoice?: string
      discoveryChoiceStep?: string
      colorPaletteKeys?: string[]
      colorPaletteSelection?: StudioColorSelection[]
      boxDimensionsMm?: { length: number; width: number; height: number }
      boxProduction?: TuckBoxProductionParams
      barcodeEntries?: PackagingBarcodeFormEntry[]
      forceNewThread?: boolean
      featureKey?: string
    }): Promise<boolean> => {
      if (busy || postInFlightRef.current) return false
      const silent =
        payload.action === 'set_generation_refs' ||
        payload.action === 'remove_generation_product' ||
        payload.action === 'navigate_step' ||
        payload.action === 'set_print_language' ||
        payload.action === 'set_label_aspect_ratio' ||
        payload.action === 'set_label_shape' ||
        payload.action === 'set_banner_ad_format' ||
        payload.action === 'set_banner_design_setup'
      const stepKeyAtSend = getActiveStepKey(studioSession)
      let optimisticUserId: string | null = null
      if (payload.action === 'start_preset' && payload.presetId && studioLaunchStartedRef.current) {
        const launchId = parseHubStudioLaunchId(payload.presetId)
        if (launchId) {
          optimisticUserId = `u-pending-${Date.now()}`
          setLines([
            {
              id: optimisticUserId,
              role: 'user',
              content: hubStudioLaunchPrompt(launchId, uiLocale),
              createdAt: lineCreatedAt(),
            },
          ])
        }
      }
      if (payload.action === 'message' && payload.message?.trim()) {
        loadThreadEpochRef.current += 1
        setShowThreadList(false)
        optimisticUserId = `u-pending-${Date.now()}`
        setLines((prev) => [
          ...prev,
          {
            id: optimisticUserId!,
            role: 'user',
            content: payload.message!.trim(),
            stepKey: stepKeyAtSend ?? undefined,
            studio: stepKeyAtSend ? { stepKey: stepKeyAtSend } : undefined,
            createdAt: lineCreatedAt(),
          },
        ])
      }
      if (payload.action === 'select_feature' && payload.featureKey) {
        const entry = getHubFeatureCatalogEntry(uiLocale, payload.featureKey)
        if (entry) {
          loadThreadEpochRef.current += 1
          setShowThreadList(false)
          optimisticUserId = `u-pending-${Date.now()}`
          setLines((prev) => [
            ...prev,
            {
              id: optimisticUserId!,
              role: 'user',
              content: entry.label,
              createdAt: lineCreatedAt(),
            },
          ])
        }
      }
      if (payload.action === 'generate_current_step' && payload.message?.trim()) {
        loadThreadEpochRef.current += 1
        setShowThreadList(false)
        optimisticUserId = `u-pending-${Date.now()}`
        setLines((prev) => [
          ...prev,
          {
            id: optimisticUserId!,
            role: 'user',
            content: payload.message!.trim(),
            stepKey: stepKeyAtSend ?? undefined,
            studio: stepKeyAtSend ? { stepKey: stepKeyAtSend } : undefined,
            createdAt: lineCreatedAt(),
          },
        ])
      }
      postInFlightRef.current = true
      setBusy(true)
      try {
        const res = await fetch('/api/hub-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            mode: 'studio',
            locale: uiLocale,
            threadId: payload.forceNewThread ? null : threadId,
            message: payload.message ?? '',
            action: payload.action ?? 'message',
            presetId: payload.presetId,
            referenceScreenKey: payload.referenceScreenKey,
            generationRefKeys: payload.generationRefKeys,
            productUrl: payload.productUrl,
            editMessageId: payload.editMessageId,
            editStepKey: payload.editStepKey,
            navigateStepKey: payload.navigateStepKey,
            regenerateStepKey: payload.regenerateStepKey,
            facePrintStyle: payload.facePrintStyle,
            printLanguage: payload.printLanguage,
            printLanguageDetail: payload.printLanguageDetail,
            labelAspectRatio: payload.labelAspectRatio,
            labelShape: payload.labelShape,
            bannerAdPresetId: payload.bannerAdPresetId,
            bannerAdPresetIds: payload.bannerAdPresetIds,
            bannerOverlayText: payload.bannerOverlayText,
            discoveryChoice: payload.discoveryChoice,
            discoveryChoiceStep: payload.discoveryChoiceStep,
            colorPaletteKeys: payload.colorPaletteKeys,
            colorPaletteSelection: payload.colorPaletteSelection,
            boxDimensionsMm: payload.boxDimensionsMm,
            boxProduction: payload.boxProduction,
            barcodeEntries: payload.barcodeEntries,
            featureKey: payload.featureKey,
          }),
        })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
          workflows?: HubChatWorkflowSuggestion[]
          plan?: HubChatPlanPayload | null
          showFeaturePicker?: boolean
          threadMessages?: {
            id: string
            role: 'user' | 'assistant'
            content: string
            studio?: HubStudioMessagePayload | null
            createdAt?: string
          }[] | null
          userMessageId?: string | null
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return false
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        if (silent) {
          if (data.session) {
            const session = withClientStudioSession(data.session, uiLocale)
            if (session) setStudioSession(session)
          }
          if (payload.action === 'set_generation_refs' && data.session?.generationSelection) {
            setSelectedGenRefKeys(data.session.generationSelection.referenceScreenKeys)
          }
          if (payload.action === 'navigate_step' && data.reply?.trim()) {
            const at = lineCreatedAt()
            setLines((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: data.reply!.trim(),
                studio: data.studio,
                createdAt: at,
              },
            ])
          }
          return true
        }
        if (payload.action === 'set_banner_ad_format') {
          if (data.session) {
            const session = withClientStudioSession(data.session, uiLocale)
            if (session) setStudioSession(session)
          }
          const reloadId = data.threadId ?? threadId
          if (reloadId) await loadThread(reloadId)
          void fetchThreadList()
          return true
        }
        if (payload.action === 'edit_step') {
          if (data.threadMessages?.length) {
            setLines(
              data.threadMessages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                studio: m.studio ?? undefined,
                stepKey: m.studio?.stepKey,
                createdAt: m.createdAt,
              }))
            )
          } else {
            const reloadId = data.threadId ?? threadId
            if (reloadId) await loadThread(reloadId)
          }
          setEditingLineId(null)
          setEditingStepKey(null)
          if (data.session) {
            const session = withClientStudioSession(data.session, uiLocale)
            if (session) setStudioSession(session)
          }
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
          void fetchThreadList()
          return true
        }
        if (payload.action === 'revert_pending_image') {
          const screenKey =
            data.session?.pendingPreview?.screenKey ??
            studioSession?.pendingPreview?.screenKey ??
            data.studio?.screenKey
          setLines((prev) => {
            const next = replaceLatestStudioImageLine(
              prev,
              screenKey,
              data.reply ?? hc.fallbackReply,
              data.studio
            )
            return updateLatestStudioImageUrl(
              next,
              'box_mockup_3d',
              data.session?.packaging?.mockupUrl
            )
          })
          if (data.session) {
            const session = withClientStudioSession(data.session, uiLocale)
            if (session) setStudioSession(session)
          }
          void fetchThreadList()
          return true
        }
        if (payload.action === 'start_preset' && payload.presetId) {
          const launchId = parseHubStudioLaunchId(payload.presetId)
          const title =
            studioLaunchStartedRef.current && launchId
              ? hubStudioLaunchPrompt(launchId, uiLocale)
              : presetTitle(uiLocale, payload.presetId)
          setLines([{ id: `u-${Date.now()}`, role: 'user', content: title, createdAt: lineCreatedAt() }])
        } else if (payload.action === 'generate_current_step' && payload.message?.trim() && optimisticUserId) {
          setLines((prev) =>
            prev.map((line) =>
              line.id === optimisticUserId
                ? {
                    ...line,
                    id: data.userMessageId ?? line.id,
                    stepKey: stepKeyAtSend ?? line.stepKey,
                    studio: stepKeyAtSend ? { stepKey: stepKeyAtSend } : line.studio,
                  }
                : line
            )
          )
        } else if (payload.action === 'message' && payload.message?.trim() && optimisticUserId) {
          setLines((prev) =>
            prev.map((line) =>
              line.id === optimisticUserId
                ? {
                    ...line,
                    id: data.userMessageId ?? line.id,
                    stepKey: stepKeyAtSend ?? line.stepKey,
                    studio: stepKeyAtSend ? { stepKey: stepKeyAtSend } : line.studio,
                  }
                : line
            )
          )
        }
        const replyContent = data.reply ?? hc.fallbackReply
        const studioStepKey = data.studio?.screenKey
        const hasStudioImage = Boolean(studioStepKey && data.studio?.imageUrl)
        const hasStudioArtifact = Boolean(
          studioStepKey &&
            !data.studio?.imageUrl &&
            (data.studio?.artifactUrl ||
              (data.studio?.dielineArtifacts?.length ?? 0) > 0 ||
              (data.studio?.barcodeArtifacts?.length ?? 0) > 0)
        )
        const preserveMockupTimeline =
          (payload.action === 'approve_reference' || payload.action === 'regenerate') &&
          data.session?.packaging?.mockupUrl
        if (hasStudioImage) {
          setLines((prev) => {
            let next = replaceLatestStudioImageLine(prev, studioStepKey, replyContent, data.studio)
            if (preserveMockupTimeline) {
              next = ensureApprovedMockupTimelineLine(
                next,
                data.session!.packaging!.mockupUrl,
                data.session?.processSteps,
                replyContent
              )
            }
            return next
          })
        } else if (hasStudioArtifact) {
          setLines((prev) => {
            let next = replaceLatestStudioStepLine(prev, studioStepKey, replyContent, data.studio)
            if (preserveMockupTimeline) {
              next = ensureApprovedMockupTimelineLine(
                next,
                data.session!.packaging!.mockupUrl,
                data.session?.processSteps,
                replyContent
              )
            }
            return next
          })
        } else {
          setLines((prev) => {
            let next: ChatLine[] = [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: replyContent,
                studio: data.studio ?? null,
                workflows: Array.isArray(data.workflows) ? data.workflows : undefined,
                plan: data.plan ?? undefined,
                createdAt: lineCreatedAt(),
              },
            ]
            if (preserveMockupTimeline) {
              next = ensureApprovedMockupTimelineLine(
                next,
                data.session!.packaging!.mockupUrl,
                data.session?.processSteps,
                replyContent
              )
            }
            return next
          })
        }
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) {
            setStudioSession(session)
            const activeKey = getActiveStepKey(session)
            if (
              activeKey &&
              session.pendingPreview?.url &&
              session.pendingPreview.screenKey === activeKey
            ) {
              setMessage('')
            }
          }
        }
        if (data.plan) {
          setActivePlan(data.plan)
          void fetchFullPlan(data.plan.id)
        }
        if (typeof data.showFeaturePicker === 'boolean') {
          setShowFeaturePicker(data.showFeaturePicker)
        } else if (data.session?.presetId) {
          setShowFeaturePicker(false)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
        void fetchThreadList()
        return true
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
        if (payload.action === 'edit_step') {
          setEditingLineId(null)
          setEditingStepKey(null)
        }
        if (payload.action === 'message' && optimisticUserId) {
          setLines((prev) => prev.filter((line) => line.id !== optimisticUserId))
        }
        if (payload.action === 'generate_current_step' && optimisticUserId) {
          setLines((prev) => prev.filter((line) => line.id !== optimisticUserId))
        }
        return false
      } finally {
        postInFlightRef.current = false
        setBusy(false)
      }
    },
    [busy, fetchFullPlan, fetchThreadList, hc, loadThread, router, studioSession, threadId, toast, uiLocale, editingStepKey]
  )

  const beginFeatureInNewThread = useCallback(
    async (featureKey: string) => {
      startNewThread()
      studioLaunchStartedRef.current = true
      await postStudio({ action: 'select_feature', featureKey, forceNewThread: true })
    },
    [postStudio, startNewThread]
  )

  const postGenerationProductUpload = useCallback(
    async (files: FileList | File[]) => {
      if (busy) return
      const list = Array.from(files).filter((f) => f.size > 0)
      if (!list.length) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'upload_generation_product')
        fd.append('locale', uiLocale)
        if (threadId) fd.append('threadId', threadId)
        for (const f of list) fd.append('images', f)
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return false
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        if (data.reply) {
          setLines((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              content: data.reply ?? hc.fallbackReply,
              studio: data.studio ?? null,
              createdAt: lineCreatedAt(),
            },
          ])
        }
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
      } finally {
        setBusy(false)
      }
    },
    [busy, hc, router, threadId, toast, uiLocale]
  )

  const toggleGenRef = useCallback(
    (screenKey: string, checked: boolean) => {
      const next = checked
        ? [...selectedGenRefKeys, screenKey]
        : selectedGenRefKeys.filter((k) => k !== screenKey)
      setSelectedGenRefKeys(next)
      void postStudio({ action: 'set_generation_refs', generationRefKeys: next })
    },
    [postStudio, selectedGenRefKeys]
  )

  const removeGenProduct = useCallback(
    (url: string) => {
      void postStudio({ action: 'remove_generation_product', productUrl: url })
    },
    [postStudio]
  )

  const postStudioUpload = useCallback(
    async (files: FileList | File[]) => {
      if (busy) return
      const list = Array.from(files).filter((f) => f.size > 0)
      if (!list.length) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'upload_images')
        fd.append('locale', uiLocale)
        if (threadId) fd.append('threadId', threadId)
        for (const f of list) fd.append('images', f)
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return false
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        setLines((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
            createdAt: lineCreatedAt(),
          },
        ])
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
      } finally {
        setBusy(false)
        if (studioFileRef.current) studioFileRef.current.value = ''
      }
    },
    [busy, hc, router, threadId, toast, uiLocale]
  )

  const postStudioLogoUpload = useCallback(
    async (files: FileList | File[]) => {
      if (busy) return
      const list = Array.from(files).filter((f) => f.size > 0)
      if (!list.length) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'upload_logo_reference')
        fd.append('locale', uiLocale)
        if (threadId) fd.append('threadId', threadId)
        for (const f of list.slice(0, 1)) fd.append('images', f)
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return false
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        const at = lineCreatedAt()
        setLines((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: hc.studioLogoUploadUserLabel, createdAt: at },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
            createdAt: lineCreatedAt(),
          },
        ])
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
      } finally {
        setBusy(false)
        if (studioLogoFileRef.current) studioLogoFileRef.current.value = ''
      }
    },
    [busy, hc, router, threadId, toast, uiLocale]
  )

  const postStudioFaceUpload = useCallback(
    async (files: FileList | File[], faceLabel?: string) => {
      if (busy) return
      const list = Array.from(files).filter((f) => f.size > 0)
      if (!list.length) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'upload_packaging_face')
        fd.append('locale', uiLocale)
        if (threadId) fd.append('threadId', threadId)
        for (const f of list.slice(0, 1)) fd.append('images', f)
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return false
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        const label = faceLabel ?? hc.studioFaceUploadUserLabel.replace('{face}', '')
        const at = lineCreatedAt()
        setLines((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: label, createdAt: at },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
            createdAt: lineCreatedAt(),
          },
        ])
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
      } finally {
        setBusy(false)
      }
    },
    [busy, hc, router, threadId, toast, uiLocale]
  )

  const resolveFaceUploadFaceLabel = useCallback(
    (stepKey: string) => {
      const slot = packagingStepKeyToSlot(stepKey)
      if (slot) return getBoxFaceSlotLabel(slot, uiLocale)
      if (studioSession?.presetId) {
        const flow = getFlowSteps(studioSession.presetId).find((s) => s.key === stepKey)
        return presetStepLabel(uiLocale, studioSession.presetId, flow?.labelKey ?? stepKey)
      }
      return stepKey
    },
    [studioSession, uiLocale]
  )

  const queueStudioFaceUpload = useCallback(
    (files: FileList | File[], stepKey?: string | null) => {
      if (busy) return
      const list = Array.from(files).filter((f) => f.size > 0)
      if (!list.length) return

      const resolvedStepKey =
        stepKey ??
        (studioSession ? getActiveStepKey(studioSession) : null) ??
        studioSession?.currentStepKey ??
        null
      if (!resolvedStepKey) return

      const file = list[0]
      const faceLabel = resolveFaceUploadFaceLabel(resolvedStepKey)
      let sizeLabel = hc.studioFaceUploadConfirmSizeUnknown
      if (studioSession?.packaging?.dimensionsMm) {
        const size = getPackagingFaceSizeForStep(studioSession.packaging.dimensionsMm, resolvedStepKey)
        if (size) sizeLabel = formatMmSize(uiLocale, size.widthMm, size.heightMm)
      }
      const userLabel = hc.studioFaceUploadUserLabel.replace('{face}', faceLabel)
      const previewUrl = URL.createObjectURL(file)
      setPendingFaceUpload({ file, previewUrl, faceLabel, sizeLabel, userLabel })
      setFaceUploadConfirmOpen(true)
    },
    [busy, hc, resolveFaceUploadFaceLabel, studioSession, uiLocale]
  )

  const handleFaceUploadConfirmOpenChange = useCallback((open: boolean) => {
    setFaceUploadConfirmOpen(open)
    if (!open) {
      setPendingFaceUpload((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl)
        return null
      })
    }
  }, [])

  const confirmPendingFaceUpload = useCallback(async () => {
    if (!pendingFaceUpload || busy) return
    const { file, userLabel, previewUrl } = pendingFaceUpload
    setFaceUploadConfirmOpen(false)
    setPendingFaceUpload(null)
    URL.revokeObjectURL(previewUrl)
    await postStudioFaceUpload([file], userLabel)
  }, [busy, pendingFaceUpload, postStudioFaceUpload])

  useEffect(() => {
    return () => {
      if (pendingFaceUpload) URL.revokeObjectURL(pendingFaceUpload.previewUrl)
    }
  }, [pendingFaceUpload])

  const showGenRefPicker = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.discoveryComplete || !studioSession.currentStepKey) {
      return false
    }
    if (studioSession.pendingPreview?.screenKey === studioSession.currentStepKey) return false
    return stepSupportsGenerationRefPicker(studioSession.presetId, studioSession.currentStepKey)
  }, [studioSession])

  const genRefPickerData = useMemo(() => {
    if (!showGenRefPicker || !studioSession?.presetId || !studioSession.currentStepKey) return null
    const withSel = ensureGenerationSelection(studioSession, studioSession.presetId)
    return buildGenerationRefPickerPayload(withSel, studioSession.presetId, studioSession.currentStepKey)
  }, [showGenRefPicker, studioSession])

  const regenerateStepKey = useMemo(
    () =>
      regenerateTargetStepKey ??
      studioSession?.pendingPreview?.screenKey ??
      getActiveStepKey(studioSession) ??
      null,
    [regenerateTargetStepKey, studioSession]
  )

  const regenerateDialogPickerData = useMemo(() => {
    if (!studioSession?.presetId || !regenerateStepKey) return null
    const withSel = ensureGenerationSelection(studioSession, studioSession.presetId)
    return buildGenerationRefPickerPayload(withSel, studioSession.presetId, regenerateStepKey)
  }, [regenerateStepKey, studioSession])

  const regenerateScreenLabel = useMemo(() => {
    if (!studioSession || !regenerateStepKey) return ''
    return (
      studioSession.pendingPreview?.screenLabel ??
      studioSession.processSteps.find((s) => s.key === regenerateStepKey)?.label ??
      ''
    )
  }, [regenerateStepKey, studioSession])

  const openRegenerateDialog = useCallback(
    (stepKey?: string) => {
      if (!studioSession) return
      const resolvedKey =
        stepKey ??
        studioSession.pendingPreview?.screenKey ??
        getActiveStepKey(studioSession) ??
        studioSession.currentStepKey ??
        ''
      setRegenerateTargetStepKey(resolvedKey || null)
      const stepPreview =
        studioSession.pendingPreview?.screenKey === resolvedKey
          ? studioSession.pendingPreview
          : null
      const prompt =
        stepPreview?.generationPrompt ??
        (resolvedKey ? studioSession.briefNotes[resolvedKey]?.trim() : undefined) ??
        studioSession.lastGenerationPrompt ??
        ''
      setRegeneratePromptDraft(prompt)
      if (studioSession.presetId && resolvedKey) {
        const withSel = ensureGenerationSelection(studioSession, studioSession.presetId)
        const payload = buildGenerationRefPickerPayload(withSel, studioSession.presetId, resolvedKey)
        const keys =
          payload.selectedGenerationRefKeys ??
          defaultGenerationReferenceKeys(withSel, studioSession.presetId, resolvedKey)
        setSelectedGenRefKeys(keys)
      }
      setRegenerateDialogOpen(true)
    },
    [studioSession]
  )

  const confirmRegenerate = useCallback(async () => {
    const trimmed = regeneratePromptDraft.trim()
    if (trimmed.length < 2) return
    setRegenerateDialogOpen(false)
    await postStudio({
      action: 'regenerate',
      generationRefKeys: selectedGenRefKeys,
      message: trimmed,
      regenerateStepKey: regenerateTargetStepKey ?? undefined,
    })
    setRegenerateTargetStepKey(null)
  }, [postStudio, regeneratePromptDraft, regenerateTargetStepKey, selectedGenRefKeys])

  const showStudioUpload = useMemo(() => {
    if (!studioSession?.presetId) return false
    if (studioSession.presetId === 'sale_banner') return false
    const preset = getStudioPreset(studioSession.presetId)
    return Boolean(
      preset?.needsUpload &&
        studioSession.discoveryComplete &&
        !studioSession.uploadImages.length
    )
  }, [studioSession])

  const showStudioLogoUpload = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.discoveryComplete) return false
    const logoKey = getPrimaryLogoStepKey(studioSession.presetId)
    if (!logoKey) return false
    const activeStepKey = getActiveStepKey(studioSession)
    if (
      activeStepKey &&
      isPackagingFaceStepKey(activeStepKey) &&
      studioSession.pendingPreview?.screenKey === activeStepKey
    ) {
      return false
    }
    const onLogoStep = activeStepKey === logoKey
    if (
      onLogoStep &&
      studioSession.presetId &&
      isNavigatedBackEdit(studioSession, studioSession.presetId)
    ) {
      return true
    }
    if (hasPrimaryLogoReference(studioSession.referenceImages, studioSession.presetId)) return false
    const blockingLogo =
      findBlockingIncompleteStep(studioSession, studioSession.presetId) === logoKey
    return (
      onLogoStep ||
      (blockingLogo && (!activeStepKey || !isPackagingFaceStepKey(activeStepKey)))
    )
  }, [studioSession])

  const activeStepPreview = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.pendingPreview?.url) return null
    const activeKey = getActiveStepKey(studioSession)
    if (!activeKey || studioSession.pendingPreview.screenKey !== activeKey) return null
    const reEditing =
      isNavigatedBackEdit(studioSession, studioSession.presetId) ||
      isPackagingFaceReEdit(studioSession, activeKey)
    if (!reEditing) return null
    return buildPendingStepStudio(studioSession, activeKey, studioSession.presetId)
  }, [studioSession])

  const showFacePrintStylePicker = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    return getPackagingDiscoveryInputKind(step, { reenteringBoxSize }) === 'face_print_style_picker'
  }, [studioSession, reenteringBoxSize])

  const showBoxFaceConfirmActions = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    if (reenteringBoxSize) return false
    return getPackagingDiscoveryInputKind(step) === 'box_face_confirm'
  }, [studioSession, reenteringBoxSize])

  const showPrintLanguagePicker = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    return getPackagingDiscoveryInputKind(step) === 'print_language_picker'
  }, [studioSession])

  const selectedPrintLanguageKey = useMemo(
    () => resolvePrintLanguageKey(studioSession?.briefNotes ?? {}),
    [studioSession?.briefNotes]
  )

  const selectedPrintLanguageDetail = useMemo(
    () => studioSession?.briefNotes?.print_language_detail?.trim() ?? '',
    [studioSession?.briefNotes?.print_language_detail]
  )

  const showStyleMoodPicker = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    return getPackagingDiscoveryInputKind(step) === 'style_mood_picker'
  }, [studioSession])

  const showColorPalettePicker = useMemo(() => {
    if (!studioSession?.presetId) return false
    if (studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    return isStudioColorPalettePickerStep(step)
  }, [studioSession])

  const hideInlineDielinePreview = getActiveStepKey(studioSession) === 'box_face_confirm'

  const hideAutoPackagingArtifactStep = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    const step = getActiveStepKey(studioSession)
    return step === 'box_mockup_3d' || step === 'box_dieline_pdf'
  }, [studioSession])

  const currentDesignGenerator = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.discoveryComplete) return null
    const stepKey = getActiveStepKey(studioSession)
    if (!stepKey) return null
    return getStepGenerator(studioSession.presetId, stepKey)
  }, [studioSession])

  const showBannerDesignPrepare = useMemo(() => {
    if (studioSession?.presetId !== 'sale_banner') return false
    const step = getActiveStepKey(studioSession)
    if (step !== 'banner_design' && step !== 'banner_ad_format') return false
    if (step === 'banner_design' && !studioSession.discoveryComplete) return false
    return !pendingPreviewBlocksWorkflowInput(studioSession)
  }, [studioSession])

  const saleBannerApprovedCount = useMemo(() => {
    if (studioSession?.presetId !== 'sale_banner') return 0
    return studioSession.referenceImages.filter(
      (r) => r.screenKey === 'banner_design' || r.screenKey.startsWith('banner_design_')
    ).length
  }, [studioSession])

  const hideStepInputComposer = useMemo(
    () =>
      (studioSession ? pendingPreviewBlocksWorkflowInput(studioSession) : false) ||
      showBannerDesignPrepare,
    [studioSession, showBannerDesignPrepare]
  )

  /** Tiếp / Tạo lại — chỉ sau khi đã generate và đang chờ duyệt preview. */
  const showPendingStepContinue = useMemo(
    () => Boolean(studioSession && pendingPreviewBlocksWorkflowInput(studioSession)),
    [studioSession]
  )

  const showBoxDimensionForm = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    const step = getActiveStepKey(studioSession)
    return getPackagingDiscoveryInputKind(step, { reenteringBoxSize }) === 'box_dimensions'
  }, [studioSession, reenteringBoxSize])

  const showBarcodeLabelForm = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (!studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    if (step !== 'barcode_label') return false
    return !pendingPreviewBlocksWorkflowInput(studioSession)
  }, [studioSession])

  const showLabelAspectRatioPicker = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (!studioSession.discoveryComplete) return false
    const step = getActiveStepKey(studioSession)
    if (step !== 'product_label' && step !== 'seal_sticker') return false
    return !pendingPreviewBlocksWorkflowInput(studioSession)
  }, [studioSession])

  const labelAspectRatioPickerVariant = useMemo((): 'product_label' | 'seal_sticker' => {
    const step = studioSession ? getActiveStepKey(studioSession) : null
    return step === 'seal_sticker' ? 'seal_sticker' : 'product_label'
  }, [studioSession])

  const selectedLabelAspectRatio = useMemo(() => {
    const step = studioSession ? getActiveStepKey(studioSession) : null
    if (step === 'seal_sticker') {
      return studioSession?.packaging?.sealStickerAspectRatio ?? DEFAULT_SEAL_STICKER_ASPECT_RATIO
    }
    return studioSession?.packaging?.productLabelAspectRatio ?? DEFAULT_PRODUCT_LABEL_ASPECT_RATIO
  }, [
    studioSession?.packaging?.productLabelAspectRatio,
    studioSession?.packaging?.sealStickerAspectRatio,
    studioSession,
  ])

  const selectedLabelShape = useMemo((): FlatStickerShape => {
    if (!studioSession) {
      return labelAspectRatioPickerVariant === 'seal_sticker'
        ? DEFAULT_SEAL_STICKER_SHAPE
        : DEFAULT_PRODUCT_LABEL_SHAPE
    }
    return labelAspectRatioPickerVariant === 'seal_sticker'
      ? resolveSealStickerShape(studioSession.packaging)
      : resolveProductLabelShape(studioSession.packaging)
  }, [studioSession, labelAspectRatioPickerVariant])

  const showGenerateCurrentStep = Boolean(
    studioSession?.presetId &&
      studioSession.discoveryComplete &&
      studioSession.currentStepKey &&
      currentDesignGenerator &&
      !showBarcodeLabelForm &&
      !(studioSession && pendingPreviewBlocksWorkflowInput(studioSession))
  )

  const generateCurrentStepLabel =
    currentDesignGenerator === 'banner' && studioSession?.presetId === 'sale_banner'
      ? hc.studioGenerateBanner
      : currentDesignGenerator === 'lyria_music'
      ? hc.studioGenerateMusic
      : currentDesignGenerator === 'packaging_face'
        ? hc.studioGenerateFace
        : currentDesignGenerator === 'packaging_mockup' ||
            currentDesignGenerator === 'dieline_pdf' ||
            currentDesignGenerator === 'barcode'
          ? hc.studioGenerateArtifact
          : hc.studioGenerateCurrent

  const generateCanRunWithoutBrief =
    currentDesignGenerator === 'packaging_mockup' ||
    currentDesignGenerator === 'dieline_pdf'

  const currentStepHasBrief = Boolean(
    studioSession?.currentStepKey &&
      studioSession.briefNotes[studioSession.currentStepKey]?.trim()
  )
  const currentStepDraftBrief = message.trim()
  const isSaleBannerDesignStep = Boolean(
    studioSession?.presetId === 'sale_banner' && getActiveStepKey(studioSession) === 'banner_design'
  )
  const bannerSelectedPresetIds = useMemo((): BannerAdPresetId[] => {
    const fromSession = studioSession?.bannerAd?.selectedPresetIds
    if (fromSession?.length) {
      return fromSession.map((id) => normalizeBannerAdPresetId(id))
    }
    const single = studioSession?.bannerAd?.presetId
    return single ? [normalizeBannerAdPresetId(single)] : []
  }, [studioSession?.bannerAd?.presetId, studioSession?.bannerAd?.selectedPresetIds])

  const hasBannerRatioSelected = bannerSelectedPresetIds.length > 0
  const hasSaleBannerCopy = Boolean(
    bannerOverlayDraft.trim() ||
      studioSession?.bannerAd?.overlayText?.trim() ||
      hasSaleBannerDiscoveryBrief(studioSession?.briefNotes)
  )
  const canGenerateCurrentStep = Boolean(
    isSaleBannerDesignStep
      ? hasBannerRatioSelected && hasSaleBannerCopy
      : generateCanRunWithoutBrief ||
          currentStepHasBrief ||
          (currentStepDraftBrief.length >= 2 && isValidHubStudioMessage(currentStepDraftBrief))
  )

  const bannerGenerateMissingHints = useMemo((): string[] => {
    if (!isSaleBannerDesignStep || canGenerateCurrentStep) return []
    const hints: string[] = []
    if (!hasBannerRatioSelected) hints.push(hc.studioBannerNeedRatio)
    if (!hasSaleBannerCopy) hints.push(hc.studioBannerNeedCopy)
    return hints
  }, [
    canGenerateCurrentStep,
    hasBannerRatioSelected,
    hasSaleBannerCopy,
    hc.studioBannerNeedCopy,
    hc.studioBannerNeedRatio,
    isSaleBannerDesignStep,
  ])

  const barcodeFormInitialEntries = useMemo((): PackagingBarcodeFormEntry[] => {
    if (!studioSession) return []
    const saved = studioSession.packaging?.barcodeFormEntries
    if (saved?.length) return saved
    return defaultBarcodeFormEntries(studioSession)
  }, [studioSession])

  const shouldAutoFocusStudioChat =
    !hideStepInputComposer &&
    !showFacePrintStylePicker &&
    !showBoxFaceConfirmActions &&
    !showStyleMoodPicker &&
    !showColorPalettePicker &&
    !showBoxDimensionForm &&
    !showBarcodeLabelForm &&
    !showBannerDesignPrepare &&
    !hideAutoPackagingArtifactStep

  const focusStudioChat = useCallback(() => {
    studioTextareaRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (
      busy ||
      !shouldAutoFocusStudioChat ||
      editingLineId ||
      regenerateDialogOpen ||
      lines[lines.length - 1]?.role !== 'assistant'
    ) {
      return
    }
    const frame = window.requestAnimationFrame(() => {
      studioTextareaRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [busy, editingLineId, lines, regenerateDialogOpen, shouldAutoFocusStudioChat])

  const packagingFaceSlot = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return null
    const step = getActiveStepKey(studioSession)
    if (!step || !isPackagingFaceStepKey(step)) return null
    if (
      studioSession.pendingPreview?.screenKey === step &&
      studioSession.pendingPreview?.url
    ) {
      return null
    }
    return packagingStepKeyToSlot(step)
  }, [studioSession])

  const showBodyStripActions = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    const step = getActiveStepKey(studioSession)
    if (step !== 'body_strip') return false
    return !(
      studioSession.pendingPreview?.screenKey === step &&
      studioSession.pendingPreview.url
    )
  }, [studioSession])

  const cropLabels = useMemo(
    () => ({
      title: hc.studioCropTitle,
      save: hc.studioCropSave,
      done: hc.studioCropDone,
      cancel: hc.studioCropCancel,
      targetSize: hc.studioCropTargetSize,
      cropSize: hc.studioCropResultSize,
      dragHint: hc.studioCropDragHint,
      ratioLocked: hc.studioCropRatioLocked,
      fillEdgeColor: hc.studioCropFillEdgeColor,
      fillEdgeColorOff: hc.studioCropFillEdgeColorOff,
      outpaintBackground: hc.studioCropOutpaintBackground,
      outpaintBusy: hc.studioCropOutpaintBusy,
      outpaintCredit: hc.studioCropOutpaintCredit,
      outpaintNeedGaps: hc.studioCropOutpaintNeedGaps,
      blendSeams: hc.studioCropBlendSeams,
      blendSeamsBusy: hc.studioCropBlendSeamsBusy,
      eraser: hc.studioCropEraser,
      adjustCropFrame: hc.studioCropAdjustFrame,
      cropFrameModeFree: hc.studioCropFrameModeFree,
      cropFrameModePrint: hc.studioCropFrameModePrint,
      dragHintFree: hc.studioCropDragHintFree,
      ratioFree: hc.studioCropRatioFree,
      eraserSize: hc.studioCropEraserSize,
      eraserUndo: hc.studioCropEraserUndo,
      eraserUndoHint: hc.studioCropEraserUndoHint,
      magicEraser: hc.studioCropMagicEraser,
      magicEraserBusy: hc.studioCropMagicEraserBusy,
      magicEraserHint: hc.studioCropMagicEraserHint,
      magicEraserModeBox: hc.studioCropMagicEraserModeBox,
      magicEraserModeBrush: hc.studioCropMagicEraserModeBrush,
      magicEraserBoxHint: hc.studioCropMagicEraserBoxHint,
      addText: hc.studioEditAddText,
      addImage: hc.studioEditAddImage,
      addSticker: hc.studioEditAddSticker,
      overlayHint: hc.studioEditOverlayHint,
      textPlaceholder: hc.studioEditTextPlaceholder,
      textColor: hc.studioEditTextColor,
      deleteLayer: hc.studioEditDeleteLayer,
    }),
    [hc]
  )

  const postStudioOutpaintGaps = useCallback(
    async (blob: Blob, aspectRatio: string): Promise<string | null> => {
      if (busy) return null
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'outpaint_crop_gaps')
        fd.append('locale', uiLocale)
        fd.append('cropAspectRatio', aspectRatio)
        if (threadId) fd.append('threadId', threadId)
        fd.append('images', new File([blob], 'crop-outpaint.png', { type: 'image/png' }))
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          threadId?: string
          chargedImage?: number
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return null
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        if (data.reply) {
          toast({ title: data.reply })
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
        return data.studio?.imageUrl ?? null
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
        return null
      } finally {
        setBusy(false)
      }
    },
    [busy, hc, router, threadId, toast, uiLocale]
  )

  const postStudioRevert = useCallback(async () => {
    await postStudio({ action: 'revert_pending_image' })
  }, [postStudio])

  const postStudioCrop = useCallback(
    async (
      blob: Blob,
      printSizeMm: { widthMm: number; heightMm: number },
      screenKey?: string
    ) => {
      if (busy) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'crop_pending_image')
        fd.append('locale', uiLocale)
        fd.append('cropWidthMm', String(printSizeMm.widthMm))
        fd.append('cropHeightMm', String(printSizeMm.heightMm))
        if (screenKey) fd.append('cropScreenKey', screenKey)
        if (threadId) fd.append('threadId', threadId)
        fd.append('images', new File([blob], 'face-crop.png', { type: 'image/png' }))
        const res = await fetch('/api/hub-chat', { method: 'POST', credentials: 'same-origin', body: fd })
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean
          error?: string
          reply?: string
          studio?: HubStudioMessagePayload
          session?: HubStudioSession
          threadId?: string
        }
        if (res.status === 401) {
          const next = sanitizeLoginNext(typeof window !== 'undefined' ? window.location.pathname : '/')
          router.push(`/auth/login?next=${encodeURIComponent(next)}`)
          toast({ title: hc.loginRequired, variant: 'destructive' })
          return
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        const croppedScreenKey =
          screenKey ??
          data.studio?.screenKey ??
          data.session?.pendingPreview?.screenKey ??
          studioSession?.pendingPreview?.screenKey
        setLines((prev) => {
          const next = replaceLatestStudioImageLine(
            prev,
            croppedScreenKey,
            data.reply ?? hc.fallbackReply,
            data.studio
          )
          return updateLatestStudioImageUrl(
            next,
            'box_mockup_3d',
            data.session?.packaging?.mockupUrl
          )
        })
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
      } finally {
        setBusy(false)
      }
    },
    [busy, hc, router, studioSession, threadId, toast, uiLocale]
  )

  const submitFacePrintStyle = useCallback(
    async (styleKey: FacePrintStyleKey) => {
      await postStudio({ action: 'set_face_print_style', facePrintStyle: styleKey })
    },
    [postStudio]
  )

  const submitBoxFaceConfirm = useCallback(async () => {
    setReenteringBoxSize(false)
    await postStudio({ action: 'confirm_box_face' })
  }, [postStudio])

  const submitPrintLanguage = useCallback(
    async (languageKey: PackagingPrintLanguageKey, otherDetail?: string) => {
      await postStudio({
        action: 'set_print_language',
        printLanguage: languageKey,
        printLanguageDetail: otherDetail,
      })
    },
    [postStudio]
  )

  const submitLabelAspectRatio = useCallback(
    async (ratio: string) => {
      await postStudio({
        action: 'set_label_aspect_ratio',
        labelAspectRatio: ratio,
      })
    },
    [postStudio]
  )

  const submitBannerDesignSetup = useCallback(
    async (input: {
      bannerAdPresetId?: BannerAdPresetId
      bannerAdPresetIds?: BannerAdPresetId[]
      bannerOverlayText?: string
    }) => {
      await postStudio({
        action: 'set_banner_design_setup',
        bannerAdPresetId: input.bannerAdPresetId,
        bannerAdPresetIds: input.bannerAdPresetIds,
        bannerOverlayText: input.bannerOverlayText,
      })
    },
    [postStudio]
  )

  const toggleBannerPreset = useCallback(
    async (presetId: BannerAdPresetId) => {
      const step = getActiveStepKey(studioSession)
      if (step === 'banner_ad_format') {
        await postStudio({ action: 'set_banner_ad_format', bannerAdPresetId: presetId })
        return
      }
      const id = normalizeBannerAdPresetId(presetId)
      const current = bannerSelectedPresetIds
      let next: BannerAdPresetId[]
      if (current.includes(id)) {
        next = current.filter((x) => x !== id)
      } else if (current.length >= MAX_BANNER_BATCH_PRESETS) {
        toast({ title: hc.studioBannerBatchMax, variant: 'destructive' })
        return
      } else {
        next = [...current, id]
      }
      await submitBannerDesignSetup({ bannerAdPresetIds: next })
    },
    [
      bannerSelectedPresetIds,
      hc.studioBannerBatchMax,
      postStudio,
      studioSession,
      submitBannerDesignSetup,
      toast,
    ]
  )

  const submitLabelShape = useCallback(
    async (shape: FlatStickerShape) => {
      await postStudio({
        action: 'set_label_shape',
        labelShape: shape,
      })
    },
    [postStudio]
  )

  const submitDiscoveryChoice = useCallback(
    async (stepKey: string, choiceKey: string) => {
      await postStudio({
        action: 'set_discovery_choice',
        discoveryChoice: choiceKey,
        discoveryChoiceStep: stepKey,
      })
    },
    [postStudio]
  )

  const submitColorPalette = useCallback(
    async (selection: StudioColorSelection[]) => {
      await postStudio({
        action: 'set_color_palette',
        colorPaletteSelection: selection,
      })
    },
    [postStudio]
  )

  const submitBoxDimensions = useCallback(
    async (value: {
      dimensionsMm: { length: number; width: number; height: number }
      production: TuckBoxProductionParams
    }) => {
      setReenteringBoxSize(false)
      await postStudio({
        action: 'set_box_production',
        boxDimensionsMm: value.dimensionsMm,
        boxProduction: value.production,
      })
    },
    [postStudio]
  )

  const submitBarcodeLabels = useCallback(
    async (entries: PackagingBarcodeFormEntry[]) => {
      await postStudio({
        action: 'generate_packaging_barcodes',
        barcodeEntries: entries,
      })
    },
    [postStudio]
  )

  useEffect(() => {
    setReenteringBoxSize(false)
  }, [studioSession?.currentStepKey])

  useEffect(() => {
    setBannerOverlayDraft(studioSession?.bannerAd?.overlayText ?? '')
  }, [studioSession?.currentStepKey, studioSession?.bannerAd?.overlayText])

  useEffect(() => {
    const stepKey = getActiveStepKey(studioSession)
    if (!stepKey || !studioSession?.discoveryComplete) {
      if (prevStudioStepKeyRef.current !== null) {
        setMessage('')
        prevStudioStepKeyRef.current = null
      }
      return
    }
    if (
      studioSession.pendingPreview?.url &&
      studioSession.pendingPreview.screenKey === stepKey
    ) {
      setMessage('')
      return
    }
    if (prevStudioStepKeyRef.current !== stepKey) {
      prevStudioStepKeyRef.current = stepKey
      setMessage(studioSession.briefNotes[stepKey]?.trim() ?? '')
    }
  }, [studioSession])

  const studioInputPlaceholder = useMemo(() => {
    if (!studioSession?.presetId) {
      return hc.studioPlaceholder
    }
    const stepKey = getActiveStepKey(studioSession)
    if (!stepKey) {
      return hc.studioPlaceholder
    }
    const ask = getStepAskPrompt(uiLocale, studioSession.presetId, stepKey)
    if (ask.trim()) return ask
    const flowStep = getFlowSteps(studioSession.presetId).find((s) => s.key === stepKey)
    if (flowStep) return presetStepLabel(uiLocale, studioSession.presetId, flowStep.labelKey)
    return hc.studioPlaceholder
  }, [studioSession, uiLocale, hc.studioPlaceholder])

  const activeStepSuggestions = useMemo(() => {
    if (!isActiveStudioFlow(studioSession)) return []
    return getStudioStepSuggestions(
      studioSession?.presetId,
      getActiveStepKey(studioSession),
      uiLocale
    )
  }, [studioSession, uiLocale])

  const chatInputPlaceholder = useMemo(() => {
    const stepKey = getActiveStepKey(studioSession)
    if (!studioSession?.presetId || !stepKey) {
      return hc.studioPlaceholder
    }
    return getStudioStepInputPlaceholder(
      studioSession.presetId,
      stepKey,
      uiLocale,
      hc.studioPlaceholder
    )
  }, [studioSession, uiLocale, hc.studioPlaceholder])

  const openWorkflow = (href: string, prefillPrompt: string, planCtx?: { planId: string; stepIndex: number }) => {
    if (planCtx && activePlan) {
      openHubPlanStep(href, prefillPrompt, {
        planId: planCtx.planId,
        stepIndex: planCtx.stepIndex,
        title: activePlan.title,
        totalSteps: activePlan.steps.length,
      })
    } else if (prefillPrompt.trim()) {
      saveHubPrefill(href, prefillPrompt)
    }
    router.push(href)
  }

  const openPlanStep = (plan: HubChatPlanPayload, stepIndex: number) => {
    const step = plan.steps.find((s) => s.stepIndex === stepIndex)
    if (!step) return
    setActivePlan(plan)
    openWorkflow(step.href, step.prefillPrompt, { planId: plan.id, stepIndex: step.stepIndex })
  }

  const generateCurrentStep = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? message).trim()
      if (busy || postInFlightRef.current) {
        toast({ title: hc.thinking, variant: 'default' })
        return false
      }
      const isBannerDesignStep =
        studioSession?.presetId === 'sale_banner' &&
        getActiveStepKey(studioSession) === 'banner_design'
      const hasSaleBannerOverlay = Boolean(
        isBannerDesignStep &&
          (bannerOverlayDraft.trim() ||
            studioSession?.bannerAd?.overlayText?.trim() ||
            hasSaleBannerDiscoveryBrief(studioSession?.briefNotes))
      )
      if (
        !generateCanRunWithoutBrief &&
        !isValidHubStudioMessage(trimmed) &&
        !currentStepHasBrief &&
        !hasSaleBannerOverlay
      ) {
        return false
      }
      const stepKey = getActiveStepKey(studioSession)
      if (stepKey && trimmed) {
        setStudioSession((prev) =>
          prev
            ? {
                ...prev,
                briefNotes: {
                  ...prev.briefNotes,
                  [stepKey]: trimmed,
                },
              }
            : prev
        )
      }
      return postStudio({
        action: 'generate_current_step',
        message: trimmed || undefined,
        generationRefKeys: selectedGenRefKeys,
        bannerAdPresetIds: isBannerDesignStep ? bannerSelectedPresetIds : undefined,
        bannerOverlayText: isBannerDesignStep ? bannerOverlayDraft : undefined,
      })
    },
    [
      bannerSelectedPresetIds,
      bannerOverlayDraft,
      busy,
      currentStepHasBrief,
      generateCanRunWithoutBrief,
      hc.thinking,
      message,
      postStudio,
      selectedGenRefKeys,
      studioSession,
      toast,
    ]
  )

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length < 1 || busy || postInFlightRef.current || !isValidHubStudioMessage(trimmed)) {
        return
      }
      if (showGenerateCurrentStep) {
        await generateCurrentStep(trimmed)
        return
      }
      const stepKey = getActiveStepKey(studioSession)
      if (stepKey && studioSession?.discoveryComplete) {
        setStudioSession((prev) =>
          prev
            ? {
                ...prev,
                briefNotes: {
                  ...prev.briefNotes,
                  [stepKey]: trimmed,
                },
              }
            : prev
        )
      }
      const sent = await postStudio({
        message: trimmed,
        action: 'message',
        generationRefKeys: selectedGenRefKeys,
      })
      if (sent && !studioSession?.discoveryComplete) {
        setMessage('')
      }
    },
    [busy, generateCurrentStep, postStudio, selectedGenRefKeys, showGenerateCurrentStep, studioSession]
  )

  const requestStartPreset = useCallback(
    (presetId: string) => {
      if (isActiveStudioFlow(studioSession)) {
        toast({ title: hc.studioNewFlowThreadRequired, variant: 'default' })
        return
      }
      void postStudio({ action: 'start_preset', presetId })
    },
    [hc.studioNewFlowThreadRequired, postStudio, studioSession, toast]
  )

  useEffect(() => {
    const fromQuery =
      parseHubStudioLaunchId(searchParams.get(HUB_STUDIO_LAUNCH_QUERY)) ??
      (typeof window !== 'undefined'
        ? parseHubStudioLaunchId(new URLSearchParams(window.location.search).get(HUB_STUDIO_LAUNCH_QUERY))
        : null)
    if (fromQuery) {
      studioLaunchStartedRef.current = false
      saveHubStudioLaunch(fromQuery)
      router.replace('/', { scroll: false })
      return
    }

    const launchId = consumeHubStudioLaunch()
    if (!launchId || studioLaunchStartedRef.current || busy || postInFlightRef.current) return
    if (isActiveStudioFlow(studioSession)) {
      toast({ title: hc.studioNewFlowThreadRequired, variant: 'default' })
      return
    }

    studioLaunchStartedRef.current = true
    loadThreadEpochRef.current += 1
    clearHubThreadId()
    setThreadId(null)
    setLines([])
    setActivePlan(null)
    setActivePlanRow(null)
    setStudioSession(null)
    setMessage('')
    setShowThreadList(false)

    void postStudio({ action: 'start_preset', presetId: launchId, forceNewThread: true })
    window.setTimeout(() => scrollChatToBottom('auto'), 120)
  }, [busy, hc.studioNewFlowThreadRequired, postStudio, router, scrollChatToBottom, searchParams, searchParams.toString(), studioSession, toast, uiLocale])

  const latestPlan = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      const p = lines[i]?.plan
      if (p?.steps?.length) return p
    }
    return activePlan
  }, [lines, activePlan])

  const displayLines = useMemo(() => collapseDuplicateStudioImageLines(lines), [lines])

  const latestPlanRow = activePlanRow?.id === latestPlan?.id ? activePlanRow : null
  const planPanelSource = latestPlanRow ?? latestPlan

  const planCurrentStep = latestPlan?.steps.find((s) => s.status === 'in_progress') ?? latestPlan?.steps[0]

  const renderAdvisoryExtras = (line: ChatLine) => {
    if (line.role !== 'assistant') return null
    return (
      <>
        {line.workflows && line.workflows.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {line.workflows.map((w) => (
              <li
                key={`${line.id}-${w.href}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/60 bg-white/70 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900/60"
              >
                <span className="min-w-0 flex-1 text-xs font-medium">
                  <span>{w.label || t.tool[w.labelKey as keyof typeof t.tool] || w.labelKey}</span>
                  {w.reason && w.reason !== w.label ? (
                    <span className="mt-0.5 block font-normal text-muted-foreground">{w.reason}</span>
                  ) : null}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 text-xs"
                  onClick={() => {
                    if (isActiveStudioFlow(studioSession)) {
                      toast({ title: hc.studioNewFlowThreadRequired, variant: 'default' })
                      return
                    }
                    if (w.requiresOpenConfirm) {
                      setPendingFeatureOpen({
                        href: w.href,
                        prefillPrompt: w.prefillPrompt,
                        label: w.label || t.tool[w.labelKey as keyof typeof t.tool] || w.labelKey,
                      })
                      return
                    }
                    openWorkflow(w.href, w.prefillPrompt)
                  }}
                >
                  {w.requiresOpenConfirm ? hc.advisoryOpenFeature : hc.openTool}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
        {line.plan && line.plan.steps.length >= 2 ? (
          <div className="mt-2 rounded border border-violet-200 bg-violet-50/60 p-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">
              {hc.planCreated.replace('{n}', String(line.plan.steps.length))}: {line.plan.title}
            </p>
            <ol className="mt-1.5 space-y-1">
              {line.plan.steps.map((s) => (
                <li key={s.stepIndex} className="flex items-start gap-2 text-xs">
                  {stepStatusIcon(s.status)}
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{s.label}</span>
                    {s.reason ? <span className="text-muted-foreground"> — {s.reason}</span> : null}
                  </span>
                </li>
              ))}
            </ol>
            <Button
              type="button"
              size="sm"
              className="mt-2 h-7 bg-violet-600 text-xs hover:bg-violet-700"
              onClick={() => openPlanStep(line.plan!, line.plan!.steps[0]!.stepIndex)}
            >
              {hc.startStep}
            </Button>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="surface-card overflow-hidden border border-indigo-100/80 shadow-sm dark:border-indigo-900/40">
      <div className="border-b border-indigo-50 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 px-3 py-3 sm:px-5 sm:py-4 dark:border-indigo-950/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/30">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100 sm:text-lg">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            {hc.title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{hc.studioSubtitle}</p>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        {studioSession?.processSteps?.length ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="mb-1.5 text-xs font-medium text-violet-900 dark:text-violet-100">{hc.studioProcessTitle}</p>
            <HubStudioProcessRail
              steps={studioSession.processSteps}
              currentStepKey={getActiveStepKey(studioSession)}
              labels={{
                done: isForwardOnlyStudioPreset(studioSession.presetId)
                  ? hc.studioProcessForwardOnlyHint
                  : hc.studioNavigateStepHint,
                inProgress: '',
                pending: '',
                navigateHint: isForwardOnlyStudioPreset(studioSession.presetId)
                  ? hc.studioProcessForwardOnlyHint
                  : hc.studioNavigateStepHint,
              }}
              onNavigateStep={
                isForwardOnlyStudioPreset(studioSession.presetId)
                  ? undefined
                  : (stepKey) => {
                      void postStudio({ action: 'navigate_step', navigateStepKey: stepKey })
                    }
              }
            />
          </div>
        ) : null}

        {lines.length > 0 && (
          <div ref={studioWorkflowAnchorRef} className="space-y-3">
            <div
              ref={chatScrollRef}
              className={`space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40 ${
                shouldPinStudioWorkflowView ? 'max-h-[min(60vh,520px)]' : 'max-h-80'
              }`}
            >
            {displayLines.map((line) => {
              const displayLine =
                hideInlineDielinePreview && line.studio?.boxWireframeSvg
                  ? {
                      ...line,
                      studio: {
                        ...line.studio,
                        boxWireframeSvg: undefined,
                        boxProductionSummary: undefined,
                      },
                    }
                  : line
              return (
              <div key={line.id}>
                {line.studio || line.role === 'user' ? (
                  <HubStudioMessageBubble
                    line={displayLine}
                    hc={hc}
                    busy={busy}
                    editingLineId={editingLineId}
                    onEditStep={
                      studioSession?.presetId && line.role === 'user' && (line.stepKey ?? line.studio?.stepKey)
                        ? (l) => {
                            setEditingLineId(l.id)
                            setEditingStepKey(l.stepKey ?? l.studio?.stepKey ?? null)
                          }
                        : undefined
                    }
                    onSaveEdit={(lineId, content, stepKey) => {
                      void postStudio({
                        action: 'edit_step',
                        message: content,
                        editMessageId: lineId,
                        editStepKey: stepKey ?? editingStepKey ?? undefined,
                      })
                    }}
                    onCancelEdit={() => {
                      setEditingLineId(null)
                      setEditingStepKey(null)
                    }}
                    onRegenerate={openRegenerateDialog}
                    onApproveReference={() => void postStudio({ action: 'approve_reference' })}
                    onCropImage={(blob, sizeMm, screenKey) => void postStudioCrop(blob, sizeMm, screenKey)}
                    onOutpaintGaps={postStudioOutpaintGaps}
                    onRevertFaceEdit={() => postStudioRevert()}
                    onUploadFace={
                      isPendingPackagingFacePreviewLine(line, studioSession)
                        ? (files) => {
                            queueStudioFaceUpload(files, line.studio!.screenKey!)
                          }
                        : undefined
                    }
                    uiLocale={uiLocale}
                    cropLabels={cropLabels}
                    studioSession={studioSession}
                    suppressImagePreview={Boolean(
                      activeStepPreview &&
                        line.role === 'assistant' &&
                        line.studio?.screenKey === activeStepPreview.screenKey &&
                        line.studio?.imageUrl === studioSession?.pendingPreview?.url
                    )}
                    onRemoveReference={(screenKey) =>
                      void postStudio({ action: 'remove_reference', referenceScreenKey: screenKey })
                    }
                  />
                ) : (
                  <div className="mr-6 max-w-full">
                    <div className="rounded-md bg-indigo-50/80 px-2.5 py-2 text-sm text-slate-800 dark:bg-indigo-950/30 dark:text-slate-100">
                      <p className="whitespace-pre-wrap">{line.content}</p>
                    </div>
                    <HubStudioMessageTime createdAt={line.createdAt} locale={uiLocale} align="right" />
                  </div>
                )}
                {line.studio ? (
                  <div className="mr-6">{renderAdvisoryExtras(line)}</div>
                ) : (
                  renderAdvisoryExtras(line)
                )}
              </div>
              )
            })}
            {busy ? <HubStudioThinking label={hc.studioGenerating} /> : null}
            </div>

            {showPendingStepContinue ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2.5 dark:border-violet-900 dark:bg-violet-950/30">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-violet-600 text-xs hover:bg-violet-700"
                  disabled={busy}
                  onClick={() => void postStudio({ action: 'approve_reference' })}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  {hc.studioContinue}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 text-xs"
                  disabled={busy}
                  onClick={() =>
                    openRegenerateDialog(studioSession?.pendingPreview?.screenKey ?? undefined)
                  }
                >
                  {hc.studioRegenerate}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {planPanelSource && planPanelSource.steps.length >= 2 && (
          <HubPlanAutoRunPanel
            plan={planPanelSource}
            onPlanUpdated={(p) => {
              setActivePlanRow(p)
              setActivePlan({
                id: p.id,
                title: p.title,
                steps: p.steps.map((s) => ({
                  stepIndex: s.stepIndex,
                  href: s.href,
                  labelKey: s.labelKey,
                  label: s.label,
                  prefillPrompt: s.prefillPrompt,
                  reason: s.reason,
                  status: s.status,
                })),
              })
            }}
          />
        )}

        {latestPlan && planCurrentStep && lines.length > 0 && (
          <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="text-xs font-medium text-violet-900 dark:text-violet-100">
              {hc.planBannerTitle.replace('{title}', latestPlan.title)}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-1.5 h-7 border-violet-300 text-xs"
              onClick={() => openPlanStep(latestPlan, planCurrentStep.stepIndex)}
            >
              {planCurrentStep.stepIndex === 0 && planCurrentStep.status === 'in_progress'
                ? hc.startStep
                : hc.continueNextStep.replace('{n}', String(planCurrentStep.stepIndex + 1))}
            </Button>
          </div>
        )}

        {showStudioLogoUpload ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/80 px-2 py-1.5 text-xs text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100">
            <span>{hc.studioLogoUploadHint}</span>
            <input
              ref={studioLogoFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void postStudioLogoUpload(e.target.files)
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-indigo-300 text-xs"
              disabled={busy}
              onClick={() => studioLogoFileRef.current?.click()}
            >
              {hc.studioLogoUploadBtn}
            </Button>
          </div>
        ) : null}

        {showStudioUpload ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-amber-50/80 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <span>
              {(() => {
                if (!studioSession?.presetId) return hc.studioNeedUpload
                const row = getStudioPresetCopy(uiLocale)[
                  studioSession.presetId as keyof ReturnType<typeof getStudioPresetCopy>
                ] as { uploadHint?: string } | undefined
                return row?.uploadHint ?? hc.studioNeedUpload
              })()}
            </span>
            <input
              ref={studioFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) void postStudioUpload(e.target.files)
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 text-xs"
              disabled={busy}
              onClick={() => studioFileRef.current?.click()}
            >
              {hc.studioUploadBtn}
            </Button>
          </div>
        ) : null}

        {activeStepPreview && studioSession ? (
          <HubStudioActiveStepPreview
            st={activeStepPreview}
            studioSession={studioSession}
            hc={hc}
            busy={busy}
            uiLocale={uiLocale}
            cropLabels={cropLabels}
            onRegenerate={() => openRegenerateDialog(activeStepPreview.screenKey ?? undefined)}
            onApproveReference={() => void postStudio({ action: 'approve_reference' })}
            onCropImage={(blob, sizeMm, screenKey) => void postStudioCrop(blob, sizeMm, screenKey)}
            onOutpaintGaps={postStudioOutpaintGaps}
            onRevertFaceEdit={() => postStudioRevert()}
            onUploadFace={
              activeStepPreview?.screenKey && isPackagingFaceStepKey(activeStepPreview.screenKey)
                ? (files) => queueStudioFaceUpload(files, activeStepPreview.screenKey ?? undefined)
                : undefined
            }
          />
        ) : null}

        {showGenRefPicker && genRefPickerData?.showGenerationRefPicker ? (
          <HubStudioGenerationRefPicker
            options={genRefPickerData.generationRefOptions ?? []}
            selectedKeys={selectedGenRefKeys}
            productPreviews={genRefPickerData.generationProductPreviews ?? []}
            attachUsed={genRefPickerData.generationAttachUsed}
            attachLimit={genRefPickerData.referenceAttachLimit ?? STUDIO_REFERENCE_ATTACH_LIMIT}
            busy={busy}
            labels={{
              title: hc.studioGenRefPickerTitle,
              hint: hc.studioGenRefPickerHint.replace('{max}', String(STUDIO_REFERENCE_ATTACH_LIMIT)),
              approvedSection: hc.studioGenRefApprovedSection,
              productSection: hc.studioGenRefProductSection,
              productUpload: hc.studioGenRefProductLabel,
              productUploadNote: hc.studioGenRefProductUploadNote,
              attachCount: hc.studioGenRefAttachCount,
              removeProduct: hc.studioReferenceRemove,
            }}
            onToggleRef={toggleGenRef}
            onUploadProduct={(files) => void postGenerationProductUpload(files)}
            onRemoveProduct={removeGenProduct}
          />
        ) : null}

        {packagingFaceSlot ? (
          <div
            className={
              showGenRefPicker && genRefPickerData?.showGenerationRefPicker
                ? 'mt-4 border-t border-dashed border-slate-300 pt-3 dark:border-slate-600'
                : undefined
            }
          >
            <HubPackagingFaceActions
              locale={uiLocale}
              slot={packagingFaceSlot}
              busy={busy}
              onSkip={() => void postStudio({ action: 'skip_packaging_face' })}
              onCopy={() => void postStudio({ action: 'copy_packaging_face' })}
              onUpload={(files) => queueStudioFaceUpload(files)}
            />
          </div>
        ) : showBodyStripActions ? (
          <HubPackagingBodyStripActions
            locale={uiLocale}
            busy={busy}
            onUpload={(files) => queueStudioFaceUpload(files, 'body_strip')}
          />
        ) : null}

        <HubPackagingFaceUploadConfirmDialog
          open={faceUploadConfirmOpen}
          onOpenChange={handleFaceUploadConfirmOpenChange}
          previewUrl={pendingFaceUpload?.previewUrl ?? null}
          fileName={pendingFaceUpload?.file.name ?? ''}
          faceLabel={pendingFaceUpload?.faceLabel ?? ''}
          sizeLabel={pendingFaceUpload?.sizeLabel ?? ''}
          busy={busy}
          labels={{
            title: hc.studioFaceUploadConfirmTitle,
            faceField: hc.studioFaceUploadConfirmFaceField,
            sizeField: hc.studioFaceUploadConfirmSizeField,
            fileField: hc.studioFaceUploadConfirmFile,
            hint: hc.studioFaceUploadConfirmHint.replace(/\*\*/g, ''),
            confirm: hc.studioFaceUploadConfirmOk,
            cancel: hc.studioCropCancel,
          }}
          onConfirm={confirmPendingFaceUpload}
        />

        <HubFeatureOpenConfirmDialog
          open={Boolean(pendingFeatureOpen)}
          onOpenChange={(open) => {
            if (!open) setPendingFeatureOpen(null)
          }}
          featureTitle={pendingFeatureOpen?.label ?? ''}
          busy={busy}
          labels={{
            title: hc.advisoryFeatureOpenConfirmTitle,
            body: hc.advisoryFeatureOpenConfirmBody,
            confirm: hc.advisoryFeatureOpenConfirmOk,
            cancel: hc.advisoryFeatureOpenConfirmCancel,
          }}
          onConfirm={() => {
            const pending = pendingFeatureOpen
            if (!pending) return
            setPendingFeatureOpen(null)
            openWorkflow(pending.href, pending.prefillPrompt)
          }}
        />

        <HubStudioRegenerateDialog
          open={regenerateDialogOpen}
          onOpenChange={(open) => {
            setRegenerateDialogOpen(open)
            if (!open) setRegenerateTargetStepKey(null)
          }}
          screenLabel={regenerateScreenLabel}
          prompt={regeneratePromptDraft}
          onPromptChange={setRegeneratePromptDraft}
          showRefPicker={Boolean(regenerateDialogPickerData?.showGenerationRefPicker)}
          refOptions={regenerateDialogPickerData?.generationRefOptions ?? []}
          selectedRefKeys={selectedGenRefKeys}
          productPreviews={regenerateDialogPickerData?.generationProductPreviews ?? []}
          attachUsed={regenerateDialogPickerData?.generationAttachUsed}
          attachLimit={regenerateDialogPickerData?.referenceAttachLimit ?? STUDIO_REFERENCE_ATTACH_LIMIT}
          busy={busy}
          labels={{
            title: hc.studioRegenerateDialogTitle,
            promptLabel: hc.studioRegeneratePromptLabel,
            promptHint: hc.studioRegeneratePromptHint,
            confirm: hc.studioRegenerateConfirm,
            cancel: hc.studioEditCancel,
            refPickerTitle: hc.studioGenRefPickerTitle,
            refPickerHint: hc.studioGenRefPickerHint.replace('{max}', String(STUDIO_REFERENCE_ATTACH_LIMIT)),
            refApprovedSection: hc.studioGenRefApprovedSection,
            refProductSection: hc.studioGenRefProductSection,
            refProductLabel: hc.studioGenRefProductLabel,
            refAttachCount: hc.studioGenRefAttachCount,
            refRemoveProduct: hc.studioReferenceRemove,
          }}
          onToggleRef={toggleGenRef}
          onUploadProduct={(files) => void postGenerationProductUpload(files)}
          onRemoveProduct={removeGenProduct}
          onConfirm={() => void confirmRegenerate()}
        />

        <div className="flex flex-col gap-3">
          {showPrintLanguagePicker ? (
            <HubPrintLanguagePicker
              locale={uiLocale}
              selectedKey={selectedPrintLanguageKey}
              otherDetail={selectedPrintLanguageDetail}
              busy={busy}
              onSelect={submitPrintLanguage}
            />
          ) : null}

          {showFacePrintStylePicker ? (
            <HubFacePrintStylePicker locale={uiLocale} busy={busy} onSelect={submitFacePrintStyle} />
          ) : null}

          {showBoxFaceConfirmActions ? (
            <HubBoxFaceConfirmActions
              locale={uiLocale}
              busy={busy}
              onConfirm={submitBoxFaceConfirm}
              onReenter={() => setReenteringBoxSize(true)}
            />
          ) : null}

          {showStyleMoodPicker ? (
            <HubDiscoveryChoicePicker
              locale={uiLocale}
              title={presetStepLabel(uiLocale, 'packaging_kit', 'style_mood')}
              hint={getStepAskPrompt(uiLocale, 'packaging_kit', 'style_mood')}
              choices={PACKAGING_STYLE_MOOD_CHOICES}
              busy={busy}
              showCustomOption
              onSelect={(key) => void submitDiscoveryChoice('style_mood', key)}
              onCustom={focusStudioChat}
            />
          ) : null}

          {showColorPalettePicker && studioSession?.presetId ? (
            <HubColorPalettePicker
              locale={uiLocale}
              title={presetStepLabel(uiLocale, studioSession.presetId, 'color_palette')}
              hint={getStepAskPrompt(uiLocale, studioSession.presetId, 'color_palette')}
              busy={busy}
              onConfirm={(selection) => void submitColorPalette(selection)}
            />
          ) : null}

          {showBoxDimensionForm ? (
            <HubBoxDimensionForm
              locale={uiLocale}
              busy={busy}
              initialDimensionsMm={studioSession?.packaging?.dimensionsMm}
              initialProduction={studioSession?.packaging?.production}
              onSubmit={submitBoxDimensions}
            />
          ) : null}

          {showBarcodeLabelForm ? (
            <HubBarcodeLabelForm
              locale={uiLocale}
              busy={busy}
              initialEntries={barcodeFormInitialEntries}
              onSubmit={submitBarcodeLabels}
            />
          ) : null}

          {showLabelAspectRatioPicker ? (
            <HubLabelAspectRatioPicker
              locale={uiLocale}
              variant={labelAspectRatioPickerVariant}
              selectedRatio={selectedLabelAspectRatio}
              selectedShape={selectedLabelShape}
              busy={busy}
              onSelectRatio={submitLabelAspectRatio}
              onSelectShape={submitLabelShape}
            />
          ) : null}

          {showBannerDesignPrepare ? (
            <HubBannerDesignPreparePanel
              locale={uiLocale}
              selectedPresetIds={bannerSelectedPresetIds}
              overlayText={bannerOverlayDraft}
              uploadImages={studioSession?.uploadImages ?? []}
              approvedBannerCount={saleBannerApprovedCount}
              busy={busy}
              onTogglePreset={toggleBannerPreset}
              onMaxPresetsSelected={() =>
                toast({ title: hc.studioBannerBatchMax, variant: 'destructive' })
              }
              onOverlayTextChange={setBannerOverlayDraft}
              onOverlayTextCommit={(text) => void submitBannerDesignSetup({ bannerOverlayText: text })}
              onUploadFiles={(files) => void postStudioUpload(files)}
              onFinishFlow={() => void postStudio({ action: 'banner_finish_flow' })}
            />
          ) : null}

          {!hideStepInputComposer ? (
            <div className="flex flex-col gap-2">
              {studioSession?.presetId && getActiveStepKey(studioSession) && studioInputPlaceholder ? (
                <p className="text-xs font-medium text-foreground">{studioInputPlaceholder}</p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Textarea
                  ref={studioTextareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={chatInputPlaceholder}
                  rows={3}
                  disabled={busy}
                  className="min-h-[80px] w-full min-w-0 flex-1 resize-y text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage(message)
                    }
                  }}
                />
                <Button
                  type="button"
                  className="h-10 shrink-0 bg-indigo-600 hover:bg-indigo-700 sm:h-auto"
                  disabled={
                    busy ||
                    (showGenerateCurrentStep
                      ? !canGenerateCurrentStep
                      : !isValidHubStudioMessage(message))
                  }
                  onClick={() => void sendMessage(message)}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {busy ? hc.thinking : hc.send}
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="-mx-3 border-t border-indigo-50 bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/80 px-3 py-2.5 sm:-mx-5 sm:px-5 dark:border-indigo-950/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-white/80 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700 dark:border-indigo-800 dark:bg-slate-900/80 dark:text-indigo-300">
              {hc.creditNote}
            </span>
            <span className="text-[11px] text-muted-foreground sm:text-xs">
              {hc.modelLabel}:{' '}
              <span className="font-medium text-slate-700 dark:text-slate-200">{modelLabel}</span>
            </span>
            {!threadsLoginRequired ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-indigo-200 text-xs text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200"
                onClick={() => {
                  setShowThreadList((v) => !v)
                  if (!threadsLoaded && !threadsLoading) void fetchThreadList()
                }}
                disabled={threadsLoading}
              >
                {threadsLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <History className="h-3.5 w-3.5" />
                )}
                {hc.chatHistory}
                {chatThreads.length > 0 ? ` (${chatThreads.length})` : ''}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 gap-1 border-indigo-200 text-xs text-indigo-800 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-200"
              onClick={startNewThread}
              disabled={busy || (!threadId && lines.length === 0 && !studioSession)}
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              {hc.newThread}
            </Button>
            {isActiveStudioFlow(studioSession) ? (
              <span className="text-[11px] text-muted-foreground">{hc.newThreadFlowHint}</span>
            ) : null}
          </div>
          {showThreadList ? (
            <div className="mt-2 rounded-lg border border-indigo-100 bg-white/70 px-2 py-2 dark:border-indigo-900 dark:bg-slate-900/50">
              <p className="mb-1.5 px-1 text-xs font-medium text-indigo-900 dark:text-indigo-100">{hc.chatHistory}</p>
              {threadsLoading ? (
                <div className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {hc.thinking}
                </div>
              ) : chatThreads.length === 0 ? (
                <p className="px-1 py-2 text-xs text-muted-foreground">{hc.chatHistoryEmpty}</p>
              ) : (
                <ul className="max-h-44 space-y-1 overflow-y-auto">
                  {chatThreads.map((thread) => {
                    const active = thread.id === threadId
                    const subtitle =
                      thread.presetId && thread.projectTitle
                        ? presetTitle(uiLocale, thread.presetId)
                        : thread.lastMessagePreview?.slice(0, 100) ?? null
                    return (
                      <li key={thread.id} className="flex items-stretch gap-0.5">
                        <button
                          type="button"
                          disabled={busy || deletingThreadId === thread.id}
                          onClick={() => void switchThread(thread.id)}
                          className={`flex min-w-0 flex-1 flex-col rounded-md px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-60 ${
                            active
                              ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100'
                              : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/30'
                          }`}
                        >
                          <span className="line-clamp-1 font-medium">{threadListLabel(thread, uiLocale)}</span>
                          <span className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                            {formatThreadUpdatedAt(thread.updatedAt, uiLocale)}
                            {subtitle ? ` · ${subtitle}` : null}
                          </span>
                        </button>
                        <button
                          type="button"
                          aria-label={hc.chatHistoryDelete}
                          title={hc.chatHistoryDelete}
                          disabled={busy || deletingThreadId === thread.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            void deleteThread(thread.id)
                          }}
                          className="flex shrink-0 items-center justify-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                        >
                          {deletingThreadId === thread.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          ) : null}
        </div>

        {showGenerateCurrentStep ? (
          <div className="flex flex-col gap-1.5">
            {bannerGenerateMissingHints.length > 0 ? (
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {bannerGenerateMissingHints.join(' · ')}
              </p>
            ) : null}
            <Button
              type="button"
              className="w-full gap-2 bg-violet-600 hover:bg-violet-700 sm:w-auto"
              disabled={busy || !canGenerateCurrentStep}
              onClick={() => void generateCurrentStep()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generateCurrentStepLabel}
            </Button>
          </div>
        ) : null}

        {showPostFlowSuggestions ? (
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{hc.studioPostFlowSuggestHint}</p>
            {postFlowFeatureGroups.map((group) => (
              <div key={group.groupKey}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
                  {group.groupLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.entries.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={busy}
                      onClick={() => void beginFeatureInNewThread(entry.key)}
                      className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-900 transition-colors hover:border-emerald-400 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !hideStepInputComposer && showFeaturePicker && !isActiveStudioFlow(studioSession) && activeStepSuggestions.length === 0 ? (
          <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
            <p className="text-xs font-medium text-muted-foreground">{hc.featurePickerHint}</p>
            {featureCatalogGroups.map((group) => (
              <div key={group.groupKey}>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-violet-700/80 dark:text-violet-300/80">
                  {group.groupLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.entries.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void postStudio({ action: 'select_feature', featureKey: entry.key })
                      }}
                      className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-800 transition-colors hover:border-violet-400 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : !hideStepInputComposer && activeStepSuggestions.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">{hc.suggested}</p>
            <div className="flex flex-wrap gap-1.5">
              {activeStepSuggestions.map((item) => (
                <button
                  key={`${item.label}-${item.message}`}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMessage(item.message)
                    focusStudioChat()
                  }}
                  className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-800 transition-colors hover:border-violet-400 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

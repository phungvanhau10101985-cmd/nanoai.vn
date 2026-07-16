'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { HubStudioActiveStepPreview, HubStudioMessageBubble, HubStudioProcessRail, HubStudioThinking } from '@/components/hub-chat/hub-studio-inline'
import type { HubChatThreadSummary, HubMultiTaskPlanRow } from '@/lib/db/hub-chat-pg'
import { normalizeStudioSession, type HubStudioMessagePayload, type HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { applyPackagingSessionLabels } from '@/lib/packaging/packaging-face-labels'

function withClientStudioSession(
  raw: HubStudioSession | null | undefined,
  locale: WebLocale
): HubStudioSession | null {
  const normalized = normalizeStudioSession(raw)
  if (!normalized) return null
  return applyPackagingSessionLabels(normalized, locale)
}
import type { HubStudioAction } from '@/lib/hub-chat/hub-studio-handler'
import { HubBoxDimensionForm } from '@/components/hub-chat/hub-box-dimension-form'
import { HubPackagingFaceActions } from '@/components/hub-chat/hub-packaging-face-actions'
import { isValidHubStudioMessage } from '@/lib/hub-chat/hub-studio-message'
import { STUDIO_PRESETS, getStepAskPrompt, getStudioPreset, presetTitle, getPrimaryLogoStepKey, hasPrimaryLogoReference } from '@/lib/hub-chat/hub-studio-presets'
import { getActiveStepKey } from '@/lib/hub-chat/hub-studio-preset-intent'
import { buildPendingStepStudio } from '@/lib/hub-chat/hub-studio-step-retry'
import { isNavigatedBackEdit } from '@/lib/hub-chat/hub-studio-step-navigate'
import { isPackagingFaceStepKey, packagingStepKeyToSlot } from '@/lib/packaging/hub-face-steps'
import { getBoxFaceSlotLabel } from '@/lib/packaging/box-face-slots'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'
import { HubStudioGenerationRefPicker } from '@/components/hub-chat/hub-studio-generation-ref-picker'
import {
  buildGenerationRefPickerPayload,
  defaultGenerationReferenceKeys,
  ensureGenerationSelection,
  stepSupportsGenerationRefPicker,
} from '@/lib/hub-chat/hub-studio-generation-refs'
import { findBlockingIncompleteStep } from '@/lib/hub-chat/hub-studio-step-retry'
import { STUDIO_REFERENCE_ATTACH_LIMIT } from '@/lib/hub-chat/hub-studio-reference-limits'

type ChatLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  workflows?: HubChatWorkflowSuggestion[]
  plan?: HubChatPlanPayload | null
  studio?: HubStudioMessagePayload | null
  stepKey?: string
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
  const [selectedGenRefKeys, setSelectedGenRefKeys] = useState<string[]>([])
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
  const postInFlightRef = useRef(false)

  const scrollChatToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (lines.length === 0) return
    scrollChatToBottom()
    const t1 = window.setTimeout(() => scrollChatToBottom(), 80)
    const t2 = window.setTimeout(() => scrollChatToBottom(), 320)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [lines, busy, scrollChatToBottom])

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
          }[]
          session: HubStudioSession | null
        }
      }
      if (!res.ok || !data.thread) return

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

      const restored: ChatLine[] = data.thread.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        workflows: m.workflows ?? undefined,
        plan: m.planId ? planById.get(m.planId) ?? null : undefined,
        studio: m.studio ?? undefined,
        stepKey: m.studio?.stepKey,
      }))
      setLines(restored)
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
    const saved = readHubThreadId()
    if (!saved) return
    setThreadId(saved)
    void loadThread(saved)
  }, [loadThread])

  useEffect(() => {
    void fetchThreadList()
  }, [fetchThreadList])

  useEffect(() => {
    if (threadsLoaded && chatThreads.length > 0 && lines.length === 0 && !threadId) {
      setShowThreadList(true)
    }
  }, [threadsLoaded, chatThreads.length, lines.length, threadId])

  const modelLabel = HUB_CHAT_MODELS[0]!.label[uiLocale]

  const startNewThread = () => {
    clearHubThreadId()
    setThreadId(null)
    setLines([])
    setActivePlan(null)
    setActivePlanRow(null)
    setStudioSession(null)
    setMessage('')
  }

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
    }) => {
      if (busy || postInFlightRef.current) return
      const silent =
        payload.action === 'set_generation_refs' ||
        payload.action === 'remove_generation_product' ||
        payload.action === 'navigate_step'
      const stepKeyAtSend = getActiveStepKey(studioSession)
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
            threadId,
            message: payload.message ?? '',
            action: payload.action ?? 'message',
            presetId: payload.presetId,
            referenceScreenKey: payload.referenceScreenKey,
            generationRefKeys: payload.generationRefKeys,
            productUrl: payload.productUrl,
            editMessageId: payload.editMessageId,
            editStepKey: payload.editStepKey,
            navigateStepKey: payload.navigateStepKey,
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
          threadMessages?: {
            id: string
            role: 'user' | 'assistant'
            content: string
            studio?: HubStudioMessagePayload | null
          }[] | null
          userMessageId?: string | null
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
        if (silent) {
          if (data.session) {
            const session = withClientStudioSession(data.session, uiLocale)
            if (session) setStudioSession(session)
          }
          if (payload.action === 'set_generation_refs' && data.session?.generationSelection) {
            setSelectedGenRefKeys(data.session.generationSelection.referenceScreenKeys)
          }
          if (payload.action === 'navigate_step' && data.reply?.trim()) {
            setLines((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: data.reply!.trim(),
                studio: data.studio,
              },
            ])
          }
          return
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
          return
        }
        if (payload.action === 'start_preset' && payload.presetId) {
          const title = presetTitle(uiLocale, payload.presetId)
          setLines([
            { id: `u-${Date.now()}`, role: 'user', content: title },
          ])
        } else if (payload.action === 'message' && payload.message?.trim()) {
          setLines((prev) => [
            ...prev,
            {
              id: data.userMessageId ?? `u-${Date.now()}`,
              role: 'user',
              content: payload.message!.trim(),
              stepKey: stepKeyAtSend ?? undefined,
              studio: stepKeyAtSend ? { stepKey: stepKeyAtSend } : undefined,
            },
          ])
        }
        setLines((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
            workflows: Array.isArray(data.workflows) ? data.workflows : undefined,
            plan: data.plan ?? undefined,
          },
        ])
        if (data.session) {
          const session = withClientStudioSession(data.session, uiLocale)
          if (session) setStudioSession(session)
        }
        if (data.plan) {
          setActivePlan(data.plan)
          void fetchFullPlan(data.plan.id)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
        void fetchThreadList()
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
        if (payload.action === 'message') setLines((prev) => prev.slice(0, -1))
        if (payload.action === 'edit_step') {
          setEditingLineId(null)
          setEditingStepKey(null)
        }
      } finally {
        postInFlightRef.current = false
        setBusy(false)
      }
    },
    [busy, fetchFullPlan, fetchThreadList, hc, loadThread, router, studioSession, threadId, toast, uiLocale, editingStepKey]
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
          return
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
          return
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
          return
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        setLines((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: hc.studioLogoUploadUserLabel },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
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
          return
        }
        if (!res.ok) throw new Error(data.error || hc.errorGeneric)
        if (data.threadId) {
          setThreadId(data.threadId)
          saveHubThreadId(data.threadId)
        }
        const label = faceLabel ?? hc.studioFaceUploadUserLabel.replace('{face}', '')
        setLines((prev) => [
          ...prev,
          { id: `u-${Date.now()}`, role: 'user', content: label },
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
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

  const showStudioUpload = useMemo(() => {
    if (!studioSession?.presetId) return false
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
    const onLogoStep = studioSession.currentStepKey === logoKey
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
    return onLogoStep || blockingLogo
  }, [studioSession])

  const activeStepPreview = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.pendingPreview?.url) return null
    const activeKey = getActiveStepKey(studioSession)
    if (!activeKey || studioSession.pendingPreview.screenKey !== activeKey) return null
    if (!isNavigatedBackEdit(studioSession, studioSession.presetId)) return null
    return buildPendingStepStudio(studioSession, activeKey, studioSession.presetId)
  }, [studioSession])

  const activePreviewFaceSlot = useMemo(() => {
    if (!activeStepPreview?.screenKey || !isPackagingFaceStepKey(activeStepPreview.screenKey)) return null
    return packagingStepKeyToSlot(activeStepPreview.screenKey)
  }, [activeStepPreview])

  const showBoxDimensionForm = useMemo(() => {
    if (studioSession?.presetId !== 'packaging_kit') return false
    if (studioSession.packaging?.dimensionsMm) return false
    const step = getActiveStepKey(studioSession)
    return step === 'box_size' || step === 'box_size_length' || step === 'box_size_width' || step === 'box_size_height'
  }, [studioSession])

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

  const cropLabels = useMemo(
    () => ({
      title: hc.studioCropTitle,
      save: hc.studioCropSave,
      cancel: hc.studioCropCancel,
      targetSize: hc.studioCropTargetSize,
      cropSize: hc.studioCropResultSize,
      dragHint: hc.studioCropDragHint,
      ratioLocked: hc.studioCropRatioLocked,
      addText: hc.studioEditAddText,
      addImage: hc.studioEditAddImage,
      addSticker: hc.studioEditAddSticker,
      overlayHint: hc.studioEditOverlayHint,
      textPlaceholder: hc.studioEditTextPlaceholder,
      deleteLayer: hc.studioEditDeleteLayer,
    }),
    [hc]
  )

  const postStudioRevert = useCallback(async () => {
    await postStudio({ action: 'revert_pending_image' })
  }, [postStudio])

  const postStudioCrop = useCallback(
    async (blob: Blob, printSizeMm: { widthMm: number; heightMm: number }) => {
      if (busy) return
      setBusy(true)
      try {
        const fd = new FormData()
        fd.append('mode', 'studio')
        fd.append('action', 'crop_pending_image')
        fd.append('locale', uiLocale)
        fd.append('cropWidthMm', String(printSizeMm.widthMm))
        fd.append('cropHeightMm', String(printSizeMm.heightMm))
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
        setLines((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: data.reply ?? hc.fallbackReply,
            studio: data.studio ?? null,
          },
        ])
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

  const submitPackagingFaceAction = useCallback(
    async (message: string) => {
      await postStudio({ message, action: 'message' })
    },
    [postStudio]
  )

  const submitBoxDimensions = useCallback(
    async (message: string) => {
      await postStudio({ message, action: 'message' })
    },
    [postStudio]
  )

  const studioInputPlaceholder = useMemo(() => {
    if (!studioSession?.presetId) {
      return hc.studioPlaceholder
    }
    const stepKey = getActiveStepKey(studioSession)
    if (!stepKey) {
      return hc.studioPlaceholder
    }
    const ask = getStepAskPrompt(uiLocale, studioSession.presetId, stepKey)
    return ask.trim() || hc.studioPlaceholder
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

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (trimmed.length < 1 || busy || postInFlightRef.current || !isValidHubStudioMessage(trimmed)) return
      setMessage('')
      await postStudio({
        message: trimmed,
        action: 'message',
        generationRefKeys: selectedGenRefKeys,
      })
    },
    [busy, postStudio, selectedGenRefKeys]
  )

  const latestPlan = useMemo(() => {
    for (let i = lines.length - 1; i >= 0; i--) {
      const p = lines[i]?.plan
      if (p?.steps?.length) return p
    }
    return activePlan
  }, [lines, activePlan])

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
                <span className="text-xs font-medium">
                  {w.label || t.tool[w.labelKey as keyof typeof t.tool] || w.labelKey}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => openWorkflow(w.href, w.prefillPrompt)}
                >
                  {hc.openTool}
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
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100 sm:text-lg">
              <Sparkles className="h-5 w-5 text-indigo-600" />
              {hc.title}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{hc.studioSubtitle}</p>
          </div>
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
          </div>
        </div>
        {showThreadList ? (
          <div className="mt-3 rounded-lg border border-indigo-100 bg-white/70 px-2 py-2 dark:border-indigo-900 dark:bg-slate-900/50">
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

      <div className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        {studioSession?.processSteps?.length ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="mb-1.5 text-xs font-medium text-violet-900 dark:text-violet-100">{hc.studioProcessTitle}</p>
            <HubStudioProcessRail
              steps={studioSession.processSteps}
              currentStepKey={getActiveStepKey(studioSession)}
              labels={{
                done: hc.studioNavigateStepHint,
                inProgress: '',
                pending: '',
                navigateHint: hc.studioNavigateStepHint,
              }}
              onNavigateStep={(stepKey) => {
                void postStudio({ action: 'navigate_step', navigateStepKey: stepKey })
              }}
            />
          </div>
        ) : null}

        {lines.length > 0 && (
          <div
            ref={chatScrollRef}
            className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40"
          >
            {lines.map((line) => (
              <div key={line.id}>
                {line.studio || line.role === 'user' ? (
                  <HubStudioMessageBubble
                    line={line}
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
                    onRegenerate={() => void postStudio({ action: 'regenerate' })}
                    onApproveReference={() => void postStudio({ action: 'approve_reference' })}
                    onCropImage={(blob, sizeMm) => postStudioCrop(blob, sizeMm)}
                    onRevertFaceEdit={() => postStudioRevert()}
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
                  <div className="mr-6 rounded-md bg-indigo-50/80 px-2.5 py-2 text-sm text-slate-800 dark:bg-indigo-950/30 dark:text-slate-100">
                    <p className="whitespace-pre-wrap">{line.content}</p>
                  </div>
                )}
                {line.studio ? (
                  <div className="mr-6">{renderAdvisoryExtras(line)}</div>
                ) : (
                  renderAdvisoryExtras(line)
                )}
              </div>
            ))}
            {busy ? <HubStudioThinking label={hc.studioGenerating} /> : null}
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
            onRegenerate={() => void postStudio({ action: 'regenerate' })}
            onApproveReference={() => void postStudio({ action: 'approve_reference' })}
            onCropImage={(blob, sizeMm) => postStudioCrop(blob, sizeMm)}
            onRevertFaceEdit={() => postStudioRevert()}
            onUploadFace={
              activePreviewFaceSlot
                ? (files) =>
                    void postStudioFaceUpload(
                      files,
                      hc.studioFaceUploadUserLabel.replace('{face}', getBoxFaceSlotLabel(activePreviewFaceSlot, uiLocale))
                    )
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
              productUpload: hc.studioGenRefProductLabel,
              attachCount: hc.studioGenRefAttachCount,
              removeProduct: hc.studioReferenceRemove,
            }}
            onToggleRef={toggleGenRef}
            onUploadProduct={(files) => void postGenerationProductUpload(files)}
            onRemoveProduct={removeGenProduct}
          />
        ) : null}

        {packagingFaceSlot ? (
          <HubPackagingFaceActions
            locale={uiLocale}
            slot={packagingFaceSlot}
            busy={busy}
            onSubmit={submitPackagingFaceAction}
            onUpload={(files) =>
              void postStudioFaceUpload(files, hc.studioFaceUploadUserLabel.replace('{face}', getBoxFaceSlotLabel(packagingFaceSlot, uiLocale)))
            }
          />
        ) : null}

        {showBoxDimensionForm ? (
          <HubBoxDimensionForm locale={uiLocale} busy={busy} onSubmit={submitBoxDimensions} />
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={studioInputPlaceholder}
              rows={2}
              disabled={busy}
              className="min-h-[72px] flex-1 resize-y text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void sendMessage(message)
                }
              }}
            />
            <Button
              type="button"
              className="shrink-0 bg-indigo-600 hover:bg-indigo-700"
              disabled={busy || !isValidHubStudioMessage(message)}
              onClick={() => void sendMessage(message)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? hc.thinking : hc.send}
            </Button>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">{hc.suggested}</p>
          <div className="flex flex-wrap gap-1.5">
            {STUDIO_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                disabled={busy}
                onClick={() => void postStudio({ action: 'start_preset', presetId: preset.id })}
                className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs text-violet-800 transition-colors hover:border-violet-400 disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200"
              >
                {presetTitle(uiLocale, preset.id)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

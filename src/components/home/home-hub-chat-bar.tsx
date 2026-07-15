'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Check,
  Circle,
  Loader2,
  MessageSquarePlus,
  Send,
  Sparkles,
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
import { HubStudioMessageBubble, HubStudioProcessRail, HubStudioThinking } from '@/components/hub-chat/hub-studio-inline'
import type { HubMultiTaskPlanRow } from '@/lib/db/hub-chat-pg'
import type { HubStudioMessagePayload, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import type { HubStudioAction } from '@/lib/hub-chat/hub-studio-handler'
import { STUDIO_PRESETS, getStepAskPrompt, getStudioPreset, presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { getStudioPresetCopy } from '@/lib/i18n/studio-preset-copy'

type ChatLine = {
  id: string
  role: 'user' | 'assistant'
  content: string
  workflows?: HubChatWorkflowSuggestion[]
  plan?: HubChatPlanPayload | null
  studio?: HubStudioMessagePayload | null
}

function stepStatusIcon(status: string) {
  if (status === 'done') return <Check className="h-3.5 w-3.5 text-emerald-600" />
  if (status === 'skipped') return <X className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === 'in_progress') return <Circle className="h-3.5 w-3.5 fill-violet-500 text-violet-500" />
  return <Circle className="h-3.5 w-3.5 text-slate-300" />
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
  const studioFileRef = useRef<HTMLInputElement>(null)

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
      if (!res.ok || !data.thread?.messages?.length) return

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
      }))
      setLines(restored)
      if (data.thread.session) setStudioSession(data.thread.session)
      const lastPlan = [...restored].reverse().find((l) => l.plan)?.plan
      if (lastPlan) {
        setActivePlan(lastPlan)
        void fetchFullPlan(lastPlan.id)
      }
    } catch {
      /* ignore */
    }
  }, [fetchFullPlan])

  useEffect(() => {
    const saved = readHubThreadId()
    if (!saved) return
    setThreadId(saved)
    void loadThread(saved)
  }, [loadThread])

  const t = useMemo(() => getDictionary(uiLocale), [uiLocale])
  const hc = t.hubChat

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
    }) => {
      if (busy) return
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
        if (payload.action === 'start_preset' && payload.presetId) {
          const title = presetTitle(uiLocale, payload.presetId)
          setLines([
            { id: `u-${Date.now()}`, role: 'user', content: title },
          ])
        } else if (payload.action === 'message' && payload.message?.trim()) {
          setLines((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: payload.message!.trim() }])
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
        if (data.session) setStudioSession(data.session)
        if (data.plan) {
          setActivePlan(data.plan)
          void fetchFullPlan(data.plan.id)
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
      } catch (e) {
        const msg = e instanceof Error ? e.message : hc.errorGeneric
        toast({ title: hc.errorGeneric, description: msg, variant: 'destructive' })
        if (payload.action === 'message') setLines((prev) => prev.slice(0, -1))
      } finally {
        setBusy(false)
      }
    },
    [busy, fetchFullPlan, hc, router, threadId, toast, uiLocale]
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
        if (data.session) setStudioSession(data.session)
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

  const showStudioUpload = useMemo(() => {
    if (!studioSession?.presetId) return false
    const preset = getStudioPreset(studioSession.presetId)
    return Boolean(
      preset?.needsUpload &&
        studioSession.discoveryComplete &&
        !studioSession.uploadImages.length
    )
  }, [studioSession])

  const studioInputPlaceholder = useMemo(() => {
    if (!studioSession?.presetId || !studioSession.currentStepKey) {
      return hc.studioPlaceholder
    }
    const ask = getStepAskPrompt(uiLocale, studioSession.presetId, studioSession.currentStepKey)
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
      if (trimmed.length < 2 || busy) return
      setMessage('')
      await postStudio({ message: trimmed, action: 'message' })
    },
    [busy, postStudio]
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
            <Button type="button" size="sm" variant="link" className="h-7 px-1 text-xs" asChild>
              <Link href="/dashboard/tasks">{hc.viewTaskQueue}</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-3 py-3 sm:px-5 sm:py-4">
        {studioSession?.processSteps?.length ? (
          <div className="rounded-lg border border-violet-100 bg-violet-50/40 px-3 py-2 dark:border-violet-900 dark:bg-violet-950/20">
            <p className="mb-1.5 text-xs font-medium text-violet-900 dark:text-violet-100">{hc.studioProcessTitle}</p>
            <HubStudioProcessRail
              steps={studioSession.processSteps}
              labels={{ done: '', inProgress: '', pending: '' }}
            />
          </div>
        ) : null}

        {lines.length > 0 && (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
            {lines.map((line) => (
              <div key={line.id}>
                {line.studio || line.role === 'user' ? (
                  <HubStudioMessageBubble
                    line={line}
                    hc={hc}
                    busy={busy}
                    onRegenerate={() => void postStudio({ action: 'regenerate' })}
                    onApproveReference={() => void postStudio({ action: 'approve_reference' })}
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
            disabled={busy || message.trim().length < 2}
            onClick={() => void sendMessage(message)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? hc.thinking : hc.send}
          </Button>
        </div>

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

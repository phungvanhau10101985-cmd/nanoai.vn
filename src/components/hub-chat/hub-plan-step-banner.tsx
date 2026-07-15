'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Check, SkipForward, X } from 'lucide-react'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  clearHubActivePlanContext,
  readHubActivePlanContext,
  saveHubActivePlanContext,
  type HubActivePlanContext,
} from '@/lib/hub-chat/hub-chat-prefill'
import type { HubMultiTaskPlanRow } from '@/lib/db/hub-chat-pg'

export function HubPlanStepBanner() {
  const [ctx, setCtx] = useState<HubActivePlanContext | null>(null)
  const [plan, setPlan] = useState<HubMultiTaskPlanRow | null>(null)
  const [busy, setBusy] = useState(false)
  const locale = readWebLocaleFromDocumentCookie()
  const t = getDictionary(locale)
  const hc = t.hubChat

  const loadPlan = useCallback(async (planId: string) => {
    try {
      const res = await fetch(`/api/hub-chat/plans/${planId}`, { credentials: 'same-origin' })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: HubMultiTaskPlanRow }
      if (res.ok && data.plan) {
        setPlan(data.plan)
        const active = data.plan.steps.find((s) => s.status === 'in_progress') ?? data.plan.steps[data.plan.currentStepIndex]
        if (active) {
          saveHubActivePlanContext({
            planId: data.plan.id,
            stepIndex: active.stepIndex,
            title: data.plan.title,
            totalSteps: data.plan.steps.length,
          })
        }
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    const c = readHubActivePlanContext()
    if (!c?.planId) return
    setCtx(c)
    void loadPlan(c.planId)
  }, [loadPlan])

  const patchStep = async (action: 'complete' | 'skip' | 'cancel') => {
    if (!ctx?.planId || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/hub-chat/plans/${ctx.planId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; plan?: HubMultiTaskPlanRow }
      if (!res.ok || !data.plan) return
      setPlan(data.plan)
      if (data.plan.status !== 'active') {
        clearHubActivePlanContext()
        setCtx(null)
        return
      }
      const next = data.plan.steps.find((s) => s.status === 'in_progress')
      if (next) {
        const nextCtx: HubActivePlanContext = {
          planId: data.plan.id,
          stepIndex: next.stepIndex,
          title: data.plan.title,
          totalSteps: data.plan.steps.length,
        }
        saveHubActivePlanContext(nextCtx)
        setCtx(nextCtx)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!ctx || !plan || plan.status !== 'active') return null

  const current =
    plan.steps.find((s) => s.stepIndex === ctx.stepIndex) ??
    plan.steps.find((s) => s.status === 'in_progress') ??
    plan.steps[plan.currentStepIndex]
  if (!current) return null

  const doneCount = plan.steps.filter((s) => s.status === 'done' || s.status === 'skipped').length

  return (
    <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/90 px-3 py-2.5 text-sm dark:border-violet-900 dark:bg-violet-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-violet-900 dark:text-violet-100">
            {hc.planBannerTitle.replace('{title}', plan.title)}
          </p>
          <p className="text-xs text-muted-foreground">
            {hc.planStepProgress
              .replace('{current}', String(current.stepIndex + 1))
              .replace('{total}', String(plan.steps.length))
              .replace('{done}', String(doneCount))}
            {' · '}
            {current.label}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void patchStep('complete')}>
            <Check className="mr-1 h-3.5 w-3.5" />
            {hc.planCompleteStep}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void patchStep('skip')}>
            <SkipForward className="mr-1 h-3.5 w-3.5" />
            {hc.planSkipStep}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => void patchStep('cancel')}>
            <X className="mr-1 h-3.5 w-3.5" />
            {hc.planCancel}
          </Button>
          <Button type="button" size="sm" variant="link" className="h-8 px-2" asChild>
            <Link href="/dashboard/tasks">{hc.planOpenQueue}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useRef, useState } from 'react'
import { Loader2, Play, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { readWebLocaleFromDocumentCookie } from '@/lib/i18n/read-web-locale-cookie'
import {
  canAutoRunPlan,
  estimatePlanCredits,
  planNeedsInputImages,
} from '@/lib/hub-agent/auto-run-support'
import type { HubChatPlanPayload } from '@/app/api/hub-chat/route'
import type { HubMultiTaskPlanRow } from '@/lib/db/hub-chat-pg'

type PlanLike = HubChatPlanPayload | HubMultiTaskPlanRow

export function HubPlanAutoRunPanel({
  plan,
  onPlanUpdated,
}: {
  plan: PlanLike
  onPlanUpdated?: (plan: HubMultiTaskPlanRow) => void
}) {
  const locale = readWebLocaleFromDocumentCookie()
  const hc = getDictionary(locale).hubChat
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<File[]>([])

  if (!canAutoRunPlan(plan.steps)) return null

  const needsImages = planNeedsInputImages(plan.steps)
  const estimate = estimatePlanCredits(plan.steps, '2K')
  const autoStatus = 'autoRunStatus' in plan ? plan.autoRunStatus : 'off'

  const runAuto = async () => {
    if (busy) return
    if (needsImages && files.length === 0) {
      setError(hc.autoRunNeedImage)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('imageQuality', '2K')
      files.forEach((f, i) => form.set(`image_${i}`, f))
      const res = await fetch(`/api/hub-chat/plans/${plan.id}/auto-run`, {
        method: 'POST',
        credentials: 'same-origin',
        body: form,
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        plan?: HubMultiTaskPlanRow
      }
      if (!res.ok || !data.plan) {
        setError(data.error || hc.errorGeneric)
        return
      }
      onPlanUpdated?.(data.plan)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('credits-updated'))
    } catch {
      setError(hc.errorGeneric)
    } finally {
      setBusy(false)
    }
  }

  if (autoStatus === 'running' || autoStatus === 'queued') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/30">
        <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-100">
          <Loader2 className="h-4 w-4 animate-spin" />
          {hc.autoRunRunning}
        </p>
      </div>
    )
  }

  if (autoStatus === 'completed') {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
        <p className="font-medium text-emerald-800 dark:text-emerald-200">{hc.autoRunDone}</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2.5 dark:border-indigo-900 dark:bg-indigo-950/25">
      <p className="text-xs font-medium text-indigo-900 dark:text-indigo-100">{hc.autoRunTitle}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {hc.autoRunEstimate.replace('{n}', String(estimate))}
      </p>
      {needsImages ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-3.5 w-3.5" />
            {files.length ? hc.autoRunImagesSelected.replace('{n}', String(files.length)) : hc.autoRunUpload}
          </Button>
        </div>
      ) : null}
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
      {autoStatus === 'failed' && 'autoRunError' in plan && plan.autoRunError ? (
        <p className="mt-1 text-xs text-destructive">{plan.autoRunError}</p>
      ) : null}
      <Button
        type="button"
        size="sm"
        className="mt-2 h-8 bg-indigo-600 text-xs hover:bg-indigo-700"
        disabled={busy}
        onClick={() => void runAuto()}
      >
        {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
        {busy ? hc.autoRunRunning : hc.autoRunStart}
      </Button>
    </div>
  )
}

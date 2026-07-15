'use client'

import { readHubActivePlanContext } from '@/lib/hub-chat/hub-chat-prefill'
import { normalizePlanHref } from '@/lib/hub-agent/auto-run-support'

/** Sau khi generate thành công trên tool page — tự hoàn thành bước plan nếu đang active (manual mode). */
export async function tryAutoCompleteHubPlanStep(
  currentHref: string,
  resultUrl?: string
): Promise<boolean> {
  const ctx = readHubActivePlanContext()
  if (!ctx?.planId) return false

  const href = normalizePlanHref(currentHref)
  try {
    const res = await fetch(`/api/hub-chat/plans/${ctx.planId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        action: 'complete',
        resultUrl: resultUrl?.trim() || undefined,
        stepIndex: ctx.stepIndex,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

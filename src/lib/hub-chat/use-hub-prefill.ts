'use client'

import { useEffect } from 'react'
import { consumeHubPrefill, saveHubActivePlanContext, type HubPrefillPayload } from '@/lib/hub-chat/hub-chat-prefill'

/** Đọc prompt từ thanh chat homepage (sessionStorage) và áp vào form tool. */
export function useHubPrefill(
  href: string,
  apply: (prompt: string, meta?: Pick<HubPrefillPayload, 'planId' | 'stepIndex'>) => void
): void {
  useEffect(() => {
    const payload = consumeHubPrefill(href)
    if (!payload) return
    apply(payload.prompt, { planId: payload.planId, stepIndex: payload.stepIndex })
    if (payload.planId != null && payload.stepIndex != null) {
      saveHubActivePlanContext({
        planId: payload.planId,
        stepIndex: payload.stepIndex,
        title: '',
        totalSteps: 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href])
}


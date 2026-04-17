'use client'

import { useEffect, useRef } from 'react'
import type { MetaViewContentClientPayload } from '@/lib/tracking/meta-view-content'
import { ensureFbqPixelInitialized } from './meta-pixel-session'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    _fbq?: unknown
  }
}

/**
 * Snippet Meta chuẩn + init + PageView + ViewContent (eventID khớp CAPI).
 * Pixel Helper thường cần thấy `fbq` + `fbevents.js` như bản cài đặt chính thức.
 */
export function MetaPixelViewContentTracker({ payload }: { payload: MetaViewContentClientPayload }) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    const pid = payload.pixelId.trim()
    if (!pid || typeof window === 'undefined') return
    fired.current = true

    if (!ensureFbqPixelInitialized(pid)) return

    const w = window
    if (!w.fbq) return

    w.fbq('track', 'PageView')

    const custom: Record<string, unknown> = {
      content_ids: payload.content_ids,
      content_name: payload.content_name,
      content_type: payload.content_type,
      currency: payload.currency,
      value: payload.value,
    }
    if (payload.remarketing_id) custom.remarketing_id = payload.remarketing_id
    w.fbq('track', 'ViewContent', custom, { eventID: payload.eventId })
  }, [payload])

  return null
}

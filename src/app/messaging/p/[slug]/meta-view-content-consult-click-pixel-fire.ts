'use client'

import type { MetaViewContentClientPayload } from '@/lib/tracking/meta-view-content'
import { ensureFbqPixelInitialized } from './meta-pixel-session'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

/** Pixel: ViewContent — event_id khớp CAPI (dedupe). Không gửi PageView. */
export function fireMetaConsultViewContentPixelEvent(payload: MetaViewContentClientPayload): void {
  if (typeof window === 'undefined') return
  if (!ensureFbqPixelInitialized(payload.pixelId)) return
  const w = window
  if (!w.fbq) return

  const custom: Record<string, unknown> = {
    content_ids: payload.content_ids,
    content_name: payload.content_name,
    content_type: payload.content_type,
    currency: payload.currency,
    value: payload.value,
  }
  if (payload.remarketing_id) custom.remarketing_id = payload.remarketing_id
  w.fbq('track', 'ViewContent', custom, { eventID: payload.eventId })
}

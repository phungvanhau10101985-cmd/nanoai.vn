'use client'

import type { MetaPurchaseClientPayload } from '@/lib/tracking/meta-purchase-events'
import { ensureFbqPixelInitialized } from './meta-pixel-session'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function fireMetaPurchasePixelEvents(payload: MetaPurchaseClientPayload): void {
  if (typeof window === 'undefined') return
  if (!ensureFbqPixelInitialized(payload.pixelId)) return
  const w = window
  if (!w.fbq) return

  const custom: Record<string, unknown> = {
    value: payload.value,
    currency: payload.currency,
    content_ids: payload.content_ids,
    content_type: payload.content_type,
    num_items: payload.num_items,
    contents: payload.contents,
    order_id: payload.order_id,
  }
  if (payload.remarketing_id) custom.remarketing_id = payload.remarketing_id
  w.fbq('track', 'Purchase', custom, { eventID: payload.eventId })
}

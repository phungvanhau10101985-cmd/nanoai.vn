'use client'

import type { MetaBuyNowClientPayload } from '@/lib/tracking/meta-view-content'
import { ensureFbqPixelInitialized } from './meta-pixel-session'

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

function toFbqCustom(p: MetaBuyNowClientPayload): Record<string, unknown> {
  const custom: Record<string, unknown> = {
    content_ids: p.content_ids,
    content_name: p.content_name,
    content_type: p.content_type,
    currency: p.currency,
    value: p.value,
  }
  if (p.remarketing_id) custom.remarketing_id = p.remarketing_id
  return custom
}

/** Pixel: ViewContent + AddToCart — event_id khớp CAPI (dedupe). */
export function fireMetaBuyNowPixelEvents(payload: MetaBuyNowClientPayload): void {
  if (typeof window === 'undefined') return
  if (!ensureFbqPixelInitialized(payload.pixelId)) return
  const w = window
  if (!w.fbq) return

  const custom = toFbqCustom(payload)
  w.fbq('track', 'ViewContent', custom, { eventID: payload.viewContentEventId })
  w.fbq('track', 'AddToCart', custom, { eventID: payload.addToCartEventId })
}

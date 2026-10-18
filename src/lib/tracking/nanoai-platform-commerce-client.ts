'use client'

import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import {
  NANO_PLATFORM_PURCHASE_COOKIE,
  parsePlatformPurchases,
  type PlatformPurchaseRow,
} from '@/lib/tracking/nanoai-platform-commerce'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    ttq?: {
      track?: (event: string, params?: Record<string, unknown>, options?: { event_id?: string }) => void
      page?: () => void
    }
    __nanoPlatformGoogleAdsId?: string
    __nanoPlatformGoogleAdsLabels?: { view?: string; addToCart?: string; purchase?: string }
  }
}

export type PlatformCommerceEvent = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

const GA4_EVENT: Record<PlatformCommerceEvent, string> = {
  ViewContent: 'view_item',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
}

const TIKTOK_EVENT: Record<PlatformCommerceEvent, string> = {
  ViewContent: 'ViewContent',
  AddToCart: 'AddToCart',
  InitiateCheckout: 'InitiateCheckout',
  Purchase: 'CompletePayment',
}

function canTrack(): boolean {
  return typeof window !== 'undefined' && !isLikelyBotTraffic() && window.top === window.self
}

function createEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`
}

function readCookie(name: string): string {
  const source = document.cookie || ''
  for (const part of source.split(';')) {
    const [k, ...rest] = part.split('=')
    if ((k || '').trim() !== name) continue
    return decodeURIComponent(rest.join('=').trim())
  }
  return ''
}

function adsSendTo(event: PlatformCommerceEvent): string {
  const labels = window.__nanoPlatformGoogleAdsLabels
  if (!labels) return ''
  if (event === 'ViewContent') return String(labels.view || '').trim()
  if (event === 'AddToCart') return String(labels.addToCart || '').trim()
  if (event === 'Purchase') return String(labels.purchase || '').trim()
  return ''
}

function sendTikTokEventToServer(body: Record<string, unknown>): void {
  void fetch('/api/tracking/tiktok-standard-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => {
    // Events API is best-effort; the browser pixel already fired.
  })
}

/** Cùng một sự kiện cho Facebook, Google (GA4 + AW nếu đã cấu hình) và TikTok. */
export function broadcastNanoAiCommerce(input: {
  event: PlatformCommerceEvent
  contentId: string
  contentName: string
  valueVnd: number
  orderId?: string
  eventId?: string
  dedupeKey?: string
  skipDedupe?: boolean
  category?: string
  extra?: Record<string, unknown>
}): boolean {
  if (!canTrack()) return false
  const contentId = input.contentId.trim()
  if (!contentId) return false
  const value = Math.max(0, Math.round(input.valueVnd))
  const name = input.contentName.trim().slice(0, 200) || contentId
  const requestedId = String(input.eventId || '').trim()
  const eventId = /^[A-Za-z0-9._:-]{8,128}$/.test(requestedId) ? requestedId : createEventId()
  const gaEvent = GA4_EVENT[input.event]
  const item = {
    item_id: contentId,
    id: contentId,
    item_name: name,
    price: value,
    quantity: 1,
    item_category: input.category || 'ai_feature',
    google_business_vertical: 'retail' as const,
  }
  const params: Record<string, unknown> = {
    currency: 'VND',
    value,
    items: [item],
    ecomm_prodid: contentId,
    ecomm_totalvalue: value,
    ecomm_pagetype: input.event === 'Purchase' ? 'purchase' : input.event === 'ViewContent' ? 'product' : 'cart',
  }
  if (input.orderId && input.event === 'Purchase') params.transaction_id = input.orderId
  if (typeof window.gtag === 'function') {
    window.gtag('event', gaEvent, params)
  }
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push({
    event: gaEvent,
    content_ids: [contentId],
    content_type: 'product',
    currency: 'VND',
    value,
    ecommerce: {
      currency: 'VND',
      value,
      ...(input.orderId && input.event === 'Purchase' ? { transaction_id: input.orderId } : {}),
      items: [item],
    },
  })
  const accepted = fireMetaStandardEvent(input.event, {
    skipDedupe: input.skipDedupe,
    dedupeKey: input.dedupeKey,
    eventId,
    customData: {
      content_type: 'product',
      content_category: input.category || 'ai_feature',
      content_ids: [contentId],
      content_name: name,
      currency: 'VND',
      value,
      num_items: 1,
      contents: [{ id: contentId, quantity: 1, item_price: value }],
      ...(input.orderId ? { order_id: input.orderId } : {}),
      ...(input.extra || {}),
    },
  })
  if (!accepted) return false
  const sendTo = adsSendTo(input.event)
  if (sendTo && typeof window.gtag === 'function') {
    window.gtag('event', input.event === 'Purchase' ? 'purchase' : 'conversion', {
      send_to: sendTo,
      value,
      currency: 'VND',
      items: [item],
      ...(input.orderId && input.event === 'Purchase' ? { transaction_id: input.orderId } : {}),
    })
  }
  const tt = window.ttq
  if (typeof tt?.track === 'function') {
    tt.track(
      TIKTOK_EVENT[input.event],
      {
        content_type: 'product',
        content_id: contentId,
        content_ids: [contentId],
        contents: [{ content_id: contentId, content_type: 'product', content_name: name, quantity: 1, price: value }],
        value,
        currency: 'VND',
        ...(input.orderId ? { order_id: input.orderId } : {}),
      },
      { event_id: eventId }
    )
  }
  sendTikTokEventToServer({
    eventName: input.event,
    eventId,
    eventSourceUrl: window.location.href.slice(0, 2000),
    contentId,
    contentName: name,
    valueVnd: value,
    orderId: input.orderId || '',
    ttclid: readCookie('ttclid'),
    ttp: readCookie('_ttp'),
  })
  return true
}

/** Đọc cookie server vừa ghi khi trừ credit / mua gói, bắn Purchase một lần rồi xóa. */
export function flushPlatformPurchaseCookie(): void {
  if (!canTrack()) return
  const raw = readCookie(NANO_PLATFORM_PURCHASE_COOKIE)
  if (!raw) return
  document.cookie = `${NANO_PLATFORM_PURCHASE_COOKIE}=; Max-Age=0; path=/`
  const rows: PlatformPurchaseRow[] = parsePlatformPurchases(raw)
  for (const row of rows) {
    broadcastNanoAiCommerce({
      event: 'Purchase',
      contentId: row.contentId,
      contentName: row.contentName,
      valueVnd: row.valueVnd,
      orderId: row.orderId,
      dedupeKey: `nano_buy_${row.orderId}`,
    })
  }
}

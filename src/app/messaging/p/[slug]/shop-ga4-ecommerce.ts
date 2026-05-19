'use client'

import type { MetaViewContentClientPayload } from '@/lib/tracking/meta-view-content'
import type { MetaPurchaseClientPayload } from '@/lib/tracking/meta-purchase-events'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    __nanoShopGa4MeasurementId?: string
  }
}

type Ga4Item = {
  item_id: string
  item_name: string
  quantity?: number
  price?: number
}

type ShopGa4EventName = 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase'

export type ShopGa4ProductInput = {
  itemId?: string | null
  itemName?: string | null
  value?: number | null
  quantity?: number | null
}

function normalizeMeasurementId(raw: string | null | undefined): string {
  const id = String(raw ?? '').trim()
  return /^G-[A-Z0-9]+$/i.test(id) ? id.toUpperCase() : ''
}

function readMeasurementIdFromHead(): string {
  if (typeof document === 'undefined') return ''
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[src*="googletagmanager.com/gtag/js"]'))
  for (const script of scripts) {
    try {
      const id = new URL(script.src).searchParams.get('id')
      const normalized = normalizeMeasurementId(id)
      if (normalized) return normalized
    } catch {
      // Ignore malformed extension-injected script URLs.
    }
  }
  return ''
}

export function resolveShopGa4MeasurementId(explicit?: string | null): string {
  return (
    normalizeMeasurementId(explicit) ||
    normalizeMeasurementId(typeof window !== 'undefined' ? window.__nanoShopGa4MeasurementId : '') ||
    normalizeMeasurementId(readMeasurementIdFromHead())
  )
}

function canSendShopGa4Event(measurementId?: string | null): string {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return ''
  return resolveShopGa4MeasurementId(measurementId)
}

function cleanItem(raw: ShopGa4ProductInput): Ga4Item | null {
  const itemId = String(raw.itemId ?? '').trim()
  const itemName = String(raw.itemName ?? '').trim()
  if (!itemId && !itemName) return null
  const quantity = Math.max(1, Math.floor(Number(raw.quantity) || 1))
  const price = Math.max(0, Math.round(Number(raw.value) || 0))
  return {
    item_id: itemId || itemName.slice(0, 128),
    item_name: itemName || itemId,
    ...(quantity > 1 ? { quantity } : {}),
    ...(price > 0 ? { price } : {}),
  }
}

function sendShopGa4Event(
  eventName: ShopGa4EventName,
  measurementId: string | null | undefined,
  params: Record<string, unknown>
): void {
  const id = canSendShopGa4Event(measurementId)
  if (!id) return
  window.gtag?.('event', eventName, {
    send_to: id,
    currency: 'VND',
    ...params,
  })
}

export function trackShopGa4ViewItem(
  measurementId: string | null | undefined,
  payload: MetaViewContentClientPayload
): void {
  const item = cleanItem({
    itemId: payload.content_ids[0] || payload.remarketing_id || '',
    itemName: payload.content_name,
    value: payload.value,
  })
  if (!item) return
  sendShopGa4Event('view_item', measurementId, {
    value: payload.value,
    items: [item],
  })
}

export function trackShopGa4AddToCart(
  measurementId: string | null | undefined,
  payload: Pick<MetaViewContentClientPayload, 'content_ids' | 'content_name' | 'value'>
): void {
  const item = cleanItem({
    itemId: payload.content_ids[0] || '',
    itemName: payload.content_name,
    value: payload.value,
  })
  if (!item) return
  sendShopGa4Event('add_to_cart', measurementId, {
    value: payload.value,
    items: [item],
  })
}

export function trackShopGa4ProductEvent(
  eventName: 'view_item' | 'add_to_cart',
  measurementId: string | null | undefined,
  product: ShopGa4ProductInput
): void {
  const item = cleanItem(product)
  if (!item) return
  sendShopGa4Event(eventName, measurementId, {
    value: Math.max(0, Math.round(Number(product.value) || 0)),
    items: [item],
  })
}

export function trackShopGa4BeginCheckout(
  measurementId: string | null | undefined,
  value: number,
  items: ShopGa4ProductInput[]
): void {
  const gaItems = items.map(cleanItem).filter((item): item is Ga4Item => Boolean(item))
  if (gaItems.length === 0) return
  sendShopGa4Event('begin_checkout', measurementId, {
    value: Math.max(0, Math.round(Number(value) || 0)),
    items: gaItems,
  })
}

export function trackShopGa4Purchase(
  measurementId: string | null | undefined,
  payload: MetaPurchaseClientPayload
): void {
  const items = payload.contents
    .map((item) =>
      cleanItem({
        itemId: item.id,
        itemName: item.title || item.id,
        quantity: item.quantity,
        value: item.item_price,
      })
    )
    .filter((item): item is Ga4Item => Boolean(item))
  if (items.length === 0) return
  sendShopGa4Event('purchase', measurementId, {
    transaction_id: payload.order_id,
    value: payload.value,
    items,
  })
}

export function trackShopGa4PurchaseEvent(params: {
  measurementId: string | null | undefined
  transactionId: string
  value: number
  items: ShopGa4ProductInput[]
}): void {
  const transactionId = params.transactionId.trim()
  if (!transactionId) return
  const items = params.items.map(cleanItem).filter((item): item is Ga4Item => Boolean(item))
  if (items.length === 0) return
  sendShopGa4Event('purchase', params.measurementId, {
    transaction_id: transactionId,
    value: Math.max(0, Math.round(Number(params.value) || 0)),
    items,
  })
}

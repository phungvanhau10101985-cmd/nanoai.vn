'use client'

import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { fireMetaStandardEvent } from '@/lib/tracking/meta-standard-events-client'
import {
  WEDDING_COMMERCE_CONTENT_ID,
  weddingAddToCartCustomData,
  weddingPackPaymentCustomData,
  weddingPurchaseEventId,
  weddingViewContentCustomData,
  type WeddingCommerceCustomData,
  type WeddingCommerceEventName,
} from '@/lib/wedding/wedding-commerce-events'
import type { WeddingGuestPackId } from '@/lib/wedding/wedding-guest-pack'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

const GA4_EVENT: Record<WeddingCommerceEventName, string> = {
  ViewContent: 'view_item',
  AddToCart: 'add_to_cart',
  InitiateCheckout: 'begin_checkout',
  Purchase: 'purchase',
}

function canTrack(): boolean {
  return typeof window !== 'undefined' && !isLikelyBotTraffic() && window.top === window.self
}

function pushCommerce(eventName: WeddingCommerceEventName, custom: WeddingCommerceCustomData): void {
  const gaEvent = GA4_EVENT[eventName]
  const item = {
    item_id: WEDDING_COMMERCE_CONTENT_ID,
    item_name: custom.content_name,
    price: custom.value,
    quantity: 1,
    item_category: custom.content_category,
  }
  const params: Record<string, unknown> = {
    currency: custom.currency,
    value: custom.value,
    items: [item],
  }
  if (custom.order_id && eventName === 'Purchase') params.transaction_id = custom.order_id
  if (typeof window.gtag === 'function') {
    window.gtag('event', gaEvent, params)
  }
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push({
    event: gaEvent,
    ecommerce: {
      currency: custom.currency,
      value: custom.value,
      ...(custom.order_id && eventName === 'Purchase' ? { transaction_id: custom.order_id } : {}),
      items: [item],
    },
  })
}

function fire(
  eventName: WeddingCommerceEventName,
  custom: WeddingCommerceCustomData,
  options?: { dedupeKey?: string; skipDedupe?: boolean; eventId?: string },
): boolean {
  if (!canTrack()) return false
  pushCommerce(eventName, custom)
  return fireMetaStandardEvent(eventName, {
    customData: { ...custom },
    dedupeKey: options?.dedupeKey,
    skipDedupe: options?.skipDedupe,
    eventId: options?.eventId,
  })
}

/** Mở trang tạo thiệp. Giá mặc định 149.000đ, cùng id catalog. */
export function trackWeddingViewContent(): boolean {
  return fire('ViewContent', weddingViewContentCustomData(), { skipDedupe: true })
}

/** Bấm Lưu và xuất bản thành công. */
export function trackWeddingAddToCart(cardId: string): boolean {
  const id = cardId.trim()
  if (!id) return false
  return fire('AddToCart', weddingAddToCartCustomData(id), {
    dedupeKey: `wedding_add_to_cart_${id}`,
  })
}

/** Hiện mã QR của gói khách vừa chọn. */
export function trackWeddingGuestPackCheckout(input: {
  packId: WeddingGuestPackId
  amountVnd: number
  paymentId: string
}): boolean {
  const paymentId = input.paymentId.trim()
  if (!paymentId || input.amountVnd <= 0) return false
  return fire('InitiateCheckout', weddingPackPaymentCustomData(input), {
    dedupeKey: `wedding_checkout_${paymentId}`,
  })
}

/** Ngân hàng báo tiền về (quét QR thành công). Giá = số tiền của gói đang trả. */
export function trackWeddingGuestPackPurchase(input: {
  packId: WeddingGuestPackId
  amountVnd: number
  paymentId: string
}): boolean {
  const paymentId = input.paymentId.trim()
  if (!paymentId || input.amountVnd <= 0) return false
  return fire('Purchase', weddingPackPaymentCustomData(input), {
    dedupeKey: `wedding_purchase_${paymentId}`,
    eventId: weddingPurchaseEventId(paymentId),
  })
}

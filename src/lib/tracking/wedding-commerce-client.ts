'use client'

import { isLikelyBotTraffic } from '@/lib/analytics-bot-filter'
import { broadcastNanoAiCommerce } from '@/lib/tracking/nanoai-platform-commerce-client'
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

function canTrack(): boolean {
  return typeof window !== 'undefined' && !isLikelyBotTraffic() && window.top === window.self
}

function fire(
  eventName: WeddingCommerceEventName,
  custom: WeddingCommerceCustomData,
  options?: { dedupeKey?: string; skipDedupe?: boolean; eventId?: string },
): boolean {
  if (!canTrack()) return false
  return broadcastNanoAiCommerce({
    event: eventName,
    contentId: WEDDING_COMMERCE_CONTENT_ID,
    contentName: custom.content_name,
    valueVnd: custom.value,
    orderId: custom.order_id,
    eventId: options?.eventId,
    dedupeKey: options?.dedupeKey,
    skipDedupe: options?.skipDedupe,
    category: custom.content_category,
    extra: { ...custom },
  })
}

/** Mở trang tạo thiệp. Giá mặc định 149.000đ, cùng id catalog. */
export function trackWeddingViewContent(): boolean {
  return fire('ViewContent', weddingViewContentCustomData(), { skipDedupe: true })
}

/** Tạo thiệp mới thành công. Cùng sự kiện thêm giỏ, id và giá niêm yết khớp feed catalog. */
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

/** Ngân hàng báo tiền về (quét QR thành công). Giá trị đơn = số tiền của gói vừa trả. */
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

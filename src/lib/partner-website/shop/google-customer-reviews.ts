/** Google Customer Reviews — opt-in khảo sát sau đơn (Merchant Center). Mọi shop. */

export const PW_GCR_SHOW_ORDER_PREFIX = 'pw_gcr_show_order_'
export const PW_GCR_HANDLED_ORDER_PREFIX = 'pw_gcr_handled_order_'

export type GoogleCustomerReviewsHandledOutcome = 'accepted' | 'declined'

export function isGoogleCustomerReviewsHandled(orderId: string): boolean {
  const id = orderId.trim()
  if (typeof sessionStorage === 'undefined' || !id) return false
  try {
    return sessionStorage.getItem(`${PW_GCR_HANDLED_ORDER_PREFIX}${id}`) != null
  } catch {
    return false
  }
}

export function markGoogleCustomerReviewsHandled(
  orderId: string,
  outcome: GoogleCustomerReviewsHandledOutcome
): void {
  const id = orderId.trim()
  if (typeof sessionStorage === 'undefined' || !id) return
  try {
    sessionStorage.setItem(`${PW_GCR_HANDLED_ORDER_PREFIX}${id}`, outcome)
    sessionStorage.removeItem(`${PW_GCR_SHOW_ORDER_PREFIX}${id}`)
  } catch {
    /* private mode */
  }
}

export function markGoogleCustomerReviewsForOrder(orderId: string): void {
  const id = orderId.trim()
  if (typeof sessionStorage === 'undefined' || !id) return
  try {
    sessionStorage.setItem(`${PW_GCR_SHOW_ORDER_PREFIX}${id}`, '1')
  } catch {
    /* private mode */
  }
}

export function shouldShowGoogleCustomerReviewsForOrder(
  orderId: string,
  createdAt?: string | null,
  maxAgeHours = 48
): boolean {
  const id = orderId.trim()
  if (!id || isGoogleCustomerReviewsHandled(id)) return false

  if (typeof sessionStorage !== 'undefined') {
    try {
      if (sessionStorage.getItem(`${PW_GCR_SHOW_ORDER_PREFIX}${id}`) === '1') {
        return true
      }
    } catch {
      /* ignore */
    }
  }
  if (!createdAt) return false
  const t = new Date(createdAt).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t < maxAgeHours * 60 * 60 * 1000
}

/**
 * Đơn cần cọc: chỉ hiện khảo sát sau khi đã cọc (hoặc đơn COD: ngay sau đặt hàng).
 */
export function isOrderEligibleForGoogleReviewsOptIn(order: {
  required_amount?: number | string | null
  status?: string | null
  paid_amount?: number | string | null
}): boolean {
  const status = String(order.status || '').trim()
  if (status === 'cancelled') return false
  const required = Number(order.required_amount ?? 0)
  if (!Number.isFinite(required) || required <= 0) return true
  const paid = Number(order.paid_amount ?? 0)
  if (Number.isFinite(paid) && paid > 0) return true
  return (
    status === 'paid_verified' ||
    status === 'pending_manual_review' ||
    status === 'deposit_paid' ||
    status === 'confirmed' ||
    status === 'processing' ||
    status === 'shipping' ||
    status === 'delivered' ||
    status === 'completed'
  )
}

export function clearGoogleCustomerReviewsShowFlag(orderId: string): void {
  const id = orderId.trim()
  if (typeof sessionStorage === 'undefined' || !id) return
  try {
    sessionStorage.removeItem(`${PW_GCR_SHOW_ORDER_PREFIX}${id}`)
  } catch {
    /* ignore */
  }
}

export function googleCustomerReviewsOptInStyle(): string {
  return 'CENTER_DIALOG'
}

export function isLikelyMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 767px)').matches
}

export function googleCustomerReviewsPromptDelayMs(): number {
  return isLikelyMobileViewport() ? 1200 : 900
}

export function deliveryCountryForGoogleReviews(): string {
  return 'VN'
}

export function estimatedDeliveryDateForGoogleReviews(order: {
  estimated_delivery?: string | null
  created_at?: string | null
}): string {
  const raw = order.estimated_delivery || order.created_at
  const base = raw ? new Date(raw) : new Date()
  const d = Number.isFinite(base.getTime()) ? base : new Date()
  if (!order.estimated_delivery) {
    d.setDate(d.getDate() + 7)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseGoogleCustomerReviewsMerchantId(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null
  return n
}

import type { WebLocale } from '@/lib/i18n/config'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

type OrderStatus =
  | 'awaiting_payment'
  | 'payment_checking'
  | 'paid_verified'
  | 'pending_manual_review'
  | 'cancelled'
  | string
  | null
  | undefined

type ShippingStatus =
  | 'pending'
  | 'confirmed'
  | 'packing'
  | 'shipping'
  | 'delivered'
  | 'returned'
  | 'cancelled'
  | string
  | null
  | undefined

export function formatPartnerSiteOrderStatus(locale: WebLocale, status: OrderStatus): string {
  const t = getPartnerSiteShopCopy(locale)
  switch (status) {
    case 'awaiting_payment':
      return t.orderStatusAwaitingPayment
    case 'payment_checking':
      return t.orderStatusPaymentChecking
    case 'paid_verified':
      return t.orderStatusPaidVerified
    case 'pending_manual_review':
      return t.orderStatusPendingManualReview
    case 'cancelled':
      return t.orderStatusCancelled
    default:
      return status?.trim() || '—'
  }
}

export function formatPartnerSiteShippingStatus(locale: WebLocale, status: ShippingStatus): string {
  const t = getPartnerSiteShopCopy(locale)
  switch (status) {
    case 'pending':
      return t.orderShippingPending
    case 'confirmed':
      return t.orderShippingConfirmed
    case 'packing':
      return t.orderShippingPacking
    case 'shipping':
      return t.orderShippingShipping
    case 'delivered':
      return t.orderShippingDelivered
    case 'returned':
      return t.orderShippingReturned
    case 'cancelled':
      return t.orderShippingCancelled
    default:
      return status?.trim() || '—'
  }
}

export function formatPartnerSiteOrderDate(locale: WebLocale, iso: string | null | undefined): string {
  const raw = iso?.trim()
  if (!raw) return '—'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

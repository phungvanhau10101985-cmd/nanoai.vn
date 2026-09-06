/**
 * W5.3 — shortcut trạng thái đơn (client-side), map status NanoAI → nhóm UI kiểu 188.
 * Badge đếm trên danh sách đã tải; không gọi endpoint aggregate riêng.
 */

export type PartnerSiteOrderStatusFilterKey =
  | 'all'
  | 'waiting_payment'
  | 'processing'
  | 'delivered'
  | 'reviewed'
  | 'cancelled'
  | 'returned'

export type PartnerSiteOrderFilterInput = {
  status?: string | null
  shipping_status?: string | null
  has_review?: boolean | null
}

/** Nhóm shortcut (không gồm `all`). `other` = trạng thái lạ — chỉ hiện ở "Tất cả". */
export type PartnerSiteOrderStatusBucket = Exclude<PartnerSiteOrderStatusFilterKey, 'all'> | 'other'

export const PARTNER_SITE_ORDER_STATUS_FILTER_KEYS: readonly PartnerSiteOrderStatusFilterKey[] = [
  'all',
  'waiting_payment',
  'processing',
  'delivered',
  'reviewed',
  'cancelled',
  'returned',
] as const

/** Hub `/account` mobile — cùng 6 nhóm 188 (không gồm đơn hoàn). */
export const PARTNER_SITE_ACCOUNT_HUB_ORDER_FILTER_KEYS: readonly PartnerSiteOrderStatusFilterKey[] = [
  'all',
  'waiting_payment',
  'processing',
  'delivered',
  'reviewed',
  'cancelled',
] as const

export function classifyPartnerSiteOrderStatusBucket(
  order: PartnerSiteOrderFilterInput
): PartnerSiteOrderStatusBucket {
  const status = String(order.status ?? '').trim()
  const ship = String(order.shipping_status ?? '').trim()

  if (status === 'cancelled' || ship === 'cancelled') return 'cancelled'
  if (order.has_review) return 'reviewed'
  if (ship === 'delivered') return 'delivered'
  if (ship === 'returned') return 'returned'
  if (status === 'awaiting_payment' || status === 'payment_checking') return 'waiting_payment'
  if (
    status === 'paid_verified' ||
    status === 'pending_manual_review' ||
    ship === 'pending' ||
    ship === 'confirmed' ||
    ship === 'packing' ||
    ship === 'shipping'
  ) {
    return 'processing'
  }
  return 'other'
}

export function orderMatchesPartnerSiteStatusFilter(
  order: PartnerSiteOrderFilterInput,
  filter: PartnerSiteOrderStatusFilterKey
): boolean {
  if (filter === 'all') return true
  return classifyPartnerSiteOrderStatusBucket(order) === filter
}

export function countPartnerSiteOrdersByStatusFilter(
  orders: readonly PartnerSiteOrderFilterInput[]
): Record<PartnerSiteOrderStatusFilterKey, number> {
  const counts: Record<PartnerSiteOrderStatusFilterKey, number> = {
    all: orders.length,
    waiting_payment: 0,
    processing: 0,
    delivered: 0,
    reviewed: 0,
    cancelled: 0,
    returned: 0,
  }
  for (const order of orders) {
    const bucket = classifyPartnerSiteOrderStatusBucket(order)
    if (bucket === 'other') continue
    counts[bucket] += 1
  }
  return counts
}

export function parsePartnerSiteOrderStatusFilter(
  raw: string | null | undefined
): PartnerSiteOrderStatusFilterKey {
  const value = String(raw ?? '').trim()
  if ((PARTNER_SITE_ORDER_STATUS_FILTER_KEYS as readonly string[]).includes(value)) {
    return value as PartnerSiteOrderStatusFilterKey
  }
  return 'all'
}

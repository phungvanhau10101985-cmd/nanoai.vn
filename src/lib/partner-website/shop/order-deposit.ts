/**
 * Luồng đặt cọc sau checkout — cùng nguyên lý 188 `/account/orders/:id/deposit`.
 * Mọi shop: `required_amount > 0` + `awaiting_payment` → trang cọc; đã cọc → mặt cảm ơn.
 */

export type PartnerShopDepositOrderLike = {
  status?: string | null
  required_amount?: number | string | null
  paid_amount?: number | string | null
}

function money(value: number | string | null | undefined): number {
  if (value == null) return 0
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

const POST_DEPOSIT_STATUSES = new Set([
  'paid_verified',
  'pending_manual_review',
  'deposit_paid',
  'confirmed',
  'processing',
  'shipping',
  'delivered',
  'completed',
])

/** Sau POST tạo đơn: đi thẳng trang đặt cọc nếu đơn còn chờ CK. */
export function shouldRedirectToDepositAfterCreate(order: PartnerShopDepositOrderLike): boolean {
  if (money(order.required_amount) <= 0) return false
  const status = String(order.status ?? '').trim()
  return status === 'awaiting_payment' || status === 'waiting_deposit'
}

/** Đơn đã cọc xong — kể cả khi webhook đẩy status sang packing ngay. */
export function shouldShowDepositSuccessPage(order: PartnerShopDepositOrderLike): boolean {
  const status = String(order.status ?? '').trim()
  if (status === 'cancelled' || status === 'pending') return false
  if (money(order.required_amount) <= 0) return false
  if (money(order.paid_amount) > 0) return true
  if (status === 'awaiting_payment' || status === 'waiting_deposit') return false
  if (status === 'payment_checking') return money(order.paid_amount) > 0
  return POST_DEPOSIT_STATUSES.has(status)
}

export function partnerOrderPayableTotal(order: {
  amount_after_discount?: number | string | null
  shipping_fee_amount?: number | string | null
}): number {
  return Math.max(0, Math.round(money(order.amount_after_discount) + money(order.shipping_fee_amount)))
}

export function partnerOrderRemainingAfterDeposit(order: {
  amount_after_discount?: number | string | null
  shipping_fee_amount?: number | string | null
  required_amount?: number | string | null
  paid_amount?: number | string | null
}): number {
  const total = partnerOrderPayableTotal(order)
  const covered = Math.max(money(order.paid_amount), money(order.required_amount))
  return Math.max(0, total - Math.round(covered))
}

export function isPartnerShopDepositWaiting(order: PartnerShopDepositOrderLike): boolean {
  if (money(order.required_amount) <= 0) return false
  if (shouldShowDepositSuccessPage(order)) return false
  const status = String(order.status ?? '').trim()
  return status === 'awaiting_payment' || status === 'waiting_deposit' || status === 'payment_checking'
}

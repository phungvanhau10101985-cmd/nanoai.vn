/** Admin orders lifecycle — cùng tab/cột 188, map sang status + shipping NanoAI. */

export type PartnerAdminOrderStatus =
  | 'awaiting_payment'
  | 'payment_checking'
  | 'paid_verified'
  | 'pending_manual_review'
  | 'cancelled'

export type PartnerAdminShippingStatus =
  | 'pending'
  | 'confirmed'
  | 'packing'
  | 'shipping'
  | 'delivered'
  | 'returned'
  | 'cancelled'

export type PartnerAdminLifecycleTab =
  | 'all'
  | 'waiting_deposit'
  | 'waiting_ship'
  | 'shipping'
  | 'delivered'
  | 'completed'
  | 'returned'
  | 'cancelled'

export type PartnerAdminPaymentFilter = '' | 'pending' | 'deposit_paid' | 'paid' | 'failed'

export type PartnerAdminOrderLifecycleInput = {
  status: PartnerAdminOrderStatus
  shipping_status: PartnerAdminShippingStatus
  required_amount: number
  paid_amount: number
  subtotal_amount?: number
  amount_after_discount?: number
  latest_proof_status?: 'pending' | 'verified' | 'failed' | 'manual_review' | null
  has_customer_review?: boolean
}

export const PARTNER_ADMIN_LIFECYCLE_TABS: { key: PartnerAdminLifecycleTab }[] = [
  { key: 'all' },
  { key: 'waiting_deposit' },
  { key: 'waiting_ship' },
  { key: 'shipping' },
  { key: 'delivered' },
  { key: 'completed' },
  { key: 'returned' },
  { key: 'cancelled' },
]

export const PARTNER_ADMIN_ORDERS_DEFAULT_PAGE_SIZE = 100

export function partnerAdminOrderIsCancelled(r: PartnerAdminOrderLifecycleInput): boolean {
  return r.status === 'cancelled' || r.shipping_status === 'cancelled'
}

export function partnerAdminOrderIsReturned(r: PartnerAdminOrderLifecycleInput): boolean {
  return r.shipping_status === 'returned' && !partnerAdminOrderIsCancelled(r)
}

export type PartnerAdminDepositKind = 'none' | 'partial' | 'full'

export function partnerAdminDepositKind(r: PartnerAdminOrderLifecycleInput): PartnerAdminDepositKind {
  const req = Math.max(0, Math.round(r.required_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  if (req <= 0) return 'full'
  if (paid >= req) return 'full'
  if (paid > 0) return 'partial'
  return 'none'
}

export function partnerAdminNeedsDepositStage(r: PartnerAdminOrderLifecycleInput): boolean {
  if (partnerAdminOrderIsCancelled(r) || partnerAdminOrderIsReturned(r)) return false
  const req = Math.max(0, Math.round(r.required_amount || 0))
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  if (req > 0 && paid >= req) return r.status !== 'paid_verified'
  if (partnerAdminDepositKind(r) !== 'full') return true
  if (r.status === 'awaiting_payment' || r.status === 'payment_checking' || r.status === 'pending_manual_review') {
    return true
  }
  return false
}

export function partnerAdminExpectsDeposit(r: PartnerAdminOrderLifecycleInput): boolean {
  return Math.max(0, Math.round(r.required_amount || 0)) > 0
}

export function partnerAdminAmountDueOnDelivery(r: PartnerAdminOrderLifecycleInput): number {
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  const after = Math.max(0, Math.round(r.amount_after_discount || 0))
  const sub = Math.max(0, Math.round(r.subtotal_amount || 0))
  const base = after > 0 ? after : sub
  return Math.max(0, base - paid)
}

/** SQL remaining COD — cùng công thức `partnerAdminAmountDueOnDelivery`. */
export function partnerAdminAmountDueOnDeliverySql(): string {
  return `greatest(
    0,
    (case
      when coalesce(o.amount_after_discount, 0) > 0 then coalesce(o.amount_after_discount, 0)
      else coalesce(o.subtotal_amount, 0)
    end) - coalesce(o.paid_amount, 0)
  )`
}

export function partnerAdminMatchesLifecycleTab(
  r: PartnerAdminOrderLifecycleInput,
  tab: PartnerAdminLifecycleTab
): boolean {
  if (tab === 'all') return true
  if (tab === 'cancelled') return partnerAdminOrderIsCancelled(r)
  if (tab === 'returned') return partnerAdminOrderIsReturned(r)
  if (partnerAdminOrderIsCancelled(r) || partnerAdminOrderIsReturned(r)) return false
  if (tab === 'completed') return Boolean(r.has_customer_review)
  if (tab === 'delivered') return r.shipping_status === 'delivered' && !r.has_customer_review
  if (tab === 'shipping') return r.shipping_status === 'shipping'
  if (tab === 'waiting_ship') {
    if (r.shipping_status === 'shipping' || r.shipping_status === 'delivered') return false
    return !partnerAdminNeedsDepositStage(r)
  }
  if (tab === 'waiting_deposit') {
    if (r.shipping_status === 'shipping' || r.shipping_status === 'delivered') return false
    return partnerAdminNeedsDepositStage(r)
  }
  return true
}

export function partnerAdminMatchesPaymentFilter(
  r: PartnerAdminOrderLifecycleInput,
  filter: PartnerAdminPaymentFilter
): boolean {
  if (!filter) return true
  if (filter === 'failed') {
    return r.latest_proof_status === 'failed' || partnerAdminOrderIsCancelled(r)
  }
  const key = partnerAdminPayBadgeKey(r)
  if (filter === 'paid' || filter === 'deposit_paid' || filter === 'pending') {
    return key === filter
  }
  return true
}

export function partnerAdminPayBadgeKey(
  r: PartnerAdminOrderLifecycleInput
): 'cancelled' | 'pending' | 'deposit_paid' | 'paid' {
  if (partnerAdminOrderIsCancelled(r)) return 'cancelled'
  const paid = Math.max(0, Math.round(r.paid_amount || 0))
  const due = partnerAdminAmountDueOnDelivery(r)
  // Cọc 30% đã thu nhưng còn COD khi nhận → «Đã đặt cọc», không phải thanh toán hết.
  if (due <= 0 && paid > 0) return 'paid'
  if (paid > 0) return 'deposit_paid'
  return 'pending'
}

export function partnerAdminStageBadgeKey(
  r: PartnerAdminOrderLifecycleInput
): PartnerAdminLifecycleTab | 'cancelled' {
  if (partnerAdminOrderIsCancelled(r)) return 'cancelled'
  if (partnerAdminOrderIsReturned(r)) return 'returned'
  if (r.has_customer_review) return 'completed'
  if (r.shipping_status === 'delivered') return 'delivered'
  if (r.shipping_status === 'shipping') return 'shipping'
  if (partnerAdminNeedsDepositStage(r)) return 'waiting_deposit'
  return 'waiting_ship'
}

export function todayIsoVn(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())
}

export function monthInputToDateRange(value: string): { from: string; to: string } | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  const [year, month] = value.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    from: `${value}-01`,
    to: `${value}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function weekRangeIsoVn(which: 'this_week' | 'last_week', now = new Date()): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now)
  const y = Number(parts.find((p) => p.type === 'year')?.value)
  const m = Number(parts.find((p) => p.type === 'month')?.value)
  const d = Number(parts.find((p) => p.type === 'day')?.value)
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon'
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const dow = map[weekday] ?? 1
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const utc = Date.UTC(y, m - 1, d)
  const shiftDays = which === 'this_week' ? mondayOffset : mondayOffset - 7
  const from = new Date(utc + shiftDays * 86400000)
  const to = new Date(from.getTime() + 6 * 86400000)
  const iso = (dt: Date) => dt.toISOString().slice(0, 10)
  return { from: iso(from), to: iso(to) }
}

export function yearRangeIso(year: number): { from: string; to: string } {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

/** SQL fragment (no user interpolation) for list/count filters. */
export function partnerAdminLifecycleSql(tab: PartnerAdminLifecycleTab): string {
  const cancelled = `(o.status = 'cancelled' or coalesce(o.shipping_status, 'pending') = 'cancelled')`
  const returned = `(coalesce(o.shipping_status, 'pending') = 'returned' and o.status <> 'cancelled')`
  const reviewed = `exists (select 1 from public.messaging_partner_product_reviews rv where rv.order_id = o.id and coalesce(rv.is_imported, false) = false and coalesce(rv.is_active, true) = true)`
  const needsDeposit = `(
    o.status <> 'cancelled'
    and coalesce(o.shipping_status, 'pending') not in ('cancelled', 'returned', 'shipping', 'delivered')
    and (
      (coalesce(o.required_amount, 0) > 0 and coalesce(o.paid_amount, 0) >= coalesce(o.required_amount, 0) and o.status <> 'paid_verified')
      or (coalesce(o.required_amount, 0) > 0 and coalesce(o.paid_amount, 0) < coalesce(o.required_amount, 0))
      or o.status in ('awaiting_payment', 'payment_checking', 'pending_manual_review')
    )
  )`
  if (tab === 'all') return 'true'
  if (tab === 'cancelled') return cancelled
  if (tab === 'returned') return returned
  if (tab === 'completed') return `(not ${cancelled} and not ${returned} and ${reviewed})`
  if (tab === 'delivered') {
    return `(not ${cancelled} and not ${returned} and coalesce(o.shipping_status, 'pending') = 'delivered' and not ${reviewed})`
  }
  if (tab === 'shipping') {
    return `(not ${cancelled} and not ${returned} and coalesce(o.shipping_status, 'pending') = 'shipping')`
  }
  if (tab === 'waiting_deposit') return needsDeposit
  if (tab === 'waiting_ship') {
    return `(not ${cancelled} and not ${returned} and coalesce(o.shipping_status, 'pending') not in ('shipping', 'delivered') and not ${needsDeposit})`
  }
  return 'true'
}

export function partnerAdminPaymentFilterSql(filter: PartnerAdminPaymentFilter): string {
  if (!filter) return 'true'
  const notCancelled = `o.status <> 'cancelled' and coalesce(o.shipping_status, 'pending') <> 'cancelled'`
  const due = partnerAdminAmountDueOnDeliverySql()
  if (filter === 'failed') {
    return `(o.status = 'cancelled' or coalesce(o.shipping_status, 'pending') = 'cancelled' or exists (
      select 1 from public.messaging_partner_payment_proofs p
      where p.order_id = o.id and p.verification_status = 'failed'
    ))`
  }
  if (filter === 'paid') {
    return `(${notCancelled} and coalesce(o.paid_amount, 0) > 0 and ${due} <= 0)`
  }
  if (filter === 'deposit_paid') {
    return `(${notCancelled} and coalesce(o.paid_amount, 0) > 0 and ${due} > 0)`
  }
  return `(${notCancelled} and coalesce(o.paid_amount, 0) <= 0)`
}

/** Hàng chờ gửi: đơn đã cọc, chưa giao, chưa có mã vận chuyển EMS. */

import { partnerAdminDepositedOrderSql, partnerAdminOrderMerchandiseTotal } from '@/lib/messaging/partner-admin-orders-lifecycle'

export const SHIP_QUEUE_LIMIT = 500

export type ShipQueuePeriod = 'all' | 'day' | 'week' | 'month'

export type ShipQueueBucket = {
  orders: number
  totalVnd: number
}

export type ShipQueueStats = {
  all: ShipQueueBucket
  day: ShipQueueBucket
  week: ShipQueueBucket
  month: ShipQueueBucket
}

export type ShipQueuePeriodBounds = {
  day: { from: string; to: string }
  week: { from: string; to: string }
  month: { from: string; to: string }
}

export type ShipQueueOrder = {
  orderId: string
  orderCode: string
  customerName: string
  customerPhone: string
  totalVnd: number
  depositedOn: string
  waitDays: number
}

export function vnTodayIso(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
}

function isoFromUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Kỳ thống kê theo ngày bắt đầu cọc, lịch VN. Tuần bắt đầu thứ Hai. */
export function shipQueuePeriodBounds(todayIso: string): ShipQueuePeriodBounds {
  const today = /^\d{4}-\d{2}-\d{2}$/.test(todayIso) ? todayIso : '1970-01-01'
  const [year, month, day] = today.split('-').map(Number)
  const utc = new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1))
  const weekday = utc.getUTCDay()
  const mondayOffset = weekday === 0 ? 6 : weekday - 1
  const monday = new Date(utc)
  monday.setUTCDate(utc.getUTCDate() - mondayOffset)
  return {
    day: { from: today, to: today },
    week: { from: isoFromUtc(monday), to: today },
    month: { from: `${today.slice(0, 8)}01`, to: today },
  }
}

export function shipQueueListRange(
  period: ShipQueuePeriod,
  bounds: ShipQueuePeriodBounds,
): { from: string; to: string } | null {
  if (period === 'day' || period === 'week' || period === 'month') return bounds[period]
  return null
}

/** Ngày bắt đầu cọc theo giờ Việt Nam. */
export function shipQueueDepositedOnSql(): string {
  return `(coalesce(o.verified_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh')::date`
}

/** Số ngày lịch VN từ ngày bắt đầu cọc đến hôm nay. Cùng ngày = 0. */
export function depositWaitDays(depositedOn: string, todayIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(depositedOn) || !/^\d{4}-\d{2}-\d{2}$/.test(todayIso)) return 0
  const [startYear, startMonth, startDay] = depositedOn.split('-').map(Number)
  const [todayYear, todayMonth, todayDay] = todayIso.split('-').map(Number)
  const start = Date.UTC(startYear, (startMonth || 1) - 1, startDay || 1)
  const today = Date.UTC(todayYear, (todayMonth || 1) - 1, todayDay || 1)
  return Math.max(0, Math.round((today - start) / 86_400_000))
}

/** Chưa bàn giao hãng: còn chờ xác nhận, đóng gói, hoặc chưa có trạng thái giao. */
export function shipQueueNotShippedSql(): string {
  return `coalesce(o.shipping_status, 'pending') not in ('shipping', 'delivered', 'returned', 'cancelled')`
}

/** Chưa có mã trên đơn và chưa có vận đơn EMS gắn theo đơn hoặc mã thanh toán. */
export function shipQueueNoEmsSql(): string {
  return `(
    nullif(btrim(coalesce(o.tracking_number, '')), '') is null
    and not exists (
      select 1
      from public.messaging_partner_ems_shipping_records r
      where r.partner_id = o.partner_id
        and nullif(btrim(coalesce(r.ems_tracking_code, '')), '') is not null
        and (
          r.order_id = o.id
          or (
            nullif(btrim(coalesce(o.payment_reference, '')), '') is not null
            and upper(btrim(coalesce(r.order_code, ''))) = upper(btrim(o.payment_reference))
          )
        )
    )
  )`
}

export function shipQueueFilterSql(): string {
  return `${partnerAdminDepositedOrderSql()}
    and ${shipQueueNotShippedSql()}
    and ${shipQueueNoEmsSql()}`
}

/** Tổng tiền hàng sau giảm giá — cùng số trên danh sách đơn. */
export function shipQueueOrderTotalSql(): string {
  return `(case
    when coalesce(o.amount_after_discount, 0) > 0 then coalesce(o.amount_after_discount, 0)
    else coalesce(o.subtotal_amount, 0)
  end)`
}

export function assembleShipQueueOrder(
  input: {
    orderId: string
    orderCode: string
    customerName: string
    customerPhone: string
    subtotalAmount: number
    amountAfterDiscount: number
    depositedOn: string
  },
  todayIso: string,
): ShipQueueOrder {
  return {
    orderId: input.orderId,
    orderCode: input.orderCode || input.orderId,
    customerName: input.customerName.trim(),
    customerPhone: input.customerPhone.trim(),
    totalVnd: partnerAdminOrderMerchandiseTotal({
      subtotal_amount: input.subtotalAmount,
      amount_after_discount: input.amountAfterDiscount,
    }),
    depositedOn: input.depositedOn,
    waitDays: depositWaitDays(input.depositedOn, todayIso),
  }
}

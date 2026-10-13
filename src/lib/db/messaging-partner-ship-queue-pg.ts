import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import {
  assembleShipQueueOrder,
  SHIP_QUEUE_LIMIT,
  shipQueueDepositedOnSql,
  shipQueueFilterSql,
  shipQueueListRange,
  shipQueueOrderTotalSql,
  shipQueuePeriodBounds,
  vnTodayIso,
  type ShipQueueOrder,
  type ShipQueuePeriod,
  type ShipQueueStats,
} from '@/lib/messaging/partner-ship-queue'
import { isValidUuidString } from '@/lib/validate-uuid'

export type PartnerShipQueue = {
  period: ShipQueuePeriod
  orders: ShipQueueOrder[]
  orderCount: number
  totalVnd: number
  truncated: boolean
  stats: ShipQueueStats
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

async function partnerShipQueueAllowed(ownerUserId: string, partnerId: string): Promise<boolean> {
  const row = await pgQueryOne(
    `select mp.id::text as id
     from public.messaging_partners mp
     where mp.id = $2::uuid
       and ${sqlPartnerMpActorHasPerm(1, 'orders_profit', { parentKey: 'orders', markerKey: 'orders_profit' })}
     limit 1`,
    [ownerUserId, partnerId],
  )
  return Boolean(row)
}

function bucket(row: Record<string, unknown> | null, ordersKey: string, totalKey: string) {
  return {
    orders: Math.max(0, Math.floor(num(row?.[ordersKey]))),
    totalVnd: Math.round(num(row?.[totalKey])),
  }
}

/** Đơn đã cọc, chưa giao, chưa có mã EMS. Thống kê ngày / tuần / tháng theo ngày bắt đầu cọc. */
export async function fetchPartnerShipQueueFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  period?: ShipQueuePeriod | null
}): Promise<PartnerShipQueue | null> {
  if (!isPgConfigured()) return null
  const partnerId = String(input.partnerId ?? '').trim()
  if (!partnerId || !isValidUuidString(partnerId)) return null
  if (!(await partnerShipQueueAllowed(input.ownerUserId, partnerId))) return null
  const period: ShipQueuePeriod =
    input.period === 'day' || input.period === 'week' || input.period === 'month' ? input.period : 'all'
  const filter = shipQueueFilterSql()
  const depositedOn = shipQueueDepositedOnSql()
  const totalSql = shipQueueOrderTotalSql()
  const access = sqlPartnerMpActorHasPerm(1, 'orders_profit', { parentKey: 'orders', markerKey: 'orders_profit' })
  const bounds = shipQueuePeriodBounds(vnTodayIso())
  const listRange = shipQueueListRange(period, bounds)
  try {
    const summary = await pgQueryOne<Record<string, unknown>>(
      `select count(*)::int as all_orders,
              coalesce(sum(${totalSql}), 0)::double precision as all_total,
              count(*) filter (where ${depositedOn} >= $3::date and ${depositedOn} <= $4::date)::int as day_orders,
              coalesce(sum(${totalSql}) filter (where ${depositedOn} >= $3::date and ${depositedOn} <= $4::date), 0)::double precision as day_total,
              count(*) filter (where ${depositedOn} >= $5::date and ${depositedOn} <= $6::date)::int as week_orders,
              coalesce(sum(${totalSql}) filter (where ${depositedOn} >= $5::date and ${depositedOn} <= $6::date), 0)::double precision as week_total,
              count(*) filter (where ${depositedOn} >= $7::date and ${depositedOn} <= $8::date)::int as month_orders,
              coalesce(sum(${totalSql}) filter (where ${depositedOn} >= $7::date and ${depositedOn} <= $8::date), 0)::double precision as month_total
       from public.messaging_partner_orders o
       join public.messaging_partners mp
         on mp.id = o.partner_id
        and ${access}
       where o.partner_id = $2::uuid
         and ${filter}`,
      [
        input.ownerUserId,
        partnerId,
        bounds.day.from,
        bounds.day.to,
        bounds.week.from,
        bounds.week.to,
        bounds.month.from,
        bounds.month.to,
      ],
    )
    const stats: ShipQueueStats = {
      all: bucket(summary, 'all_orders', 'all_total'),
      day: bucket(summary, 'day_orders', 'day_total'),
      week: bucket(summary, 'week_orders', 'week_total'),
      month: bucket(summary, 'month_orders', 'month_total'),
    }
    const rows = await pgQuery<Record<string, unknown>>(
      `select o.id::text as order_id,
              coalesce(nullif(btrim(o.payment_reference), ''), o.id::text) as order_code,
              coalesce(o.customer_name, '') as customer_name,
              coalesce(o.customer_phone, '') as customer_phone,
              coalesce(o.subtotal_amount, 0)::double precision as subtotal_amount,
              coalesce(o.amount_after_discount, 0)::double precision as amount_after_discount,
              to_char(${depositedOn}, 'YYYY-MM-DD') as deposited_on
       from public.messaging_partner_orders o
       join public.messaging_partners mp
         on mp.id = o.partner_id
        and ${access}
       where o.partner_id = $2::uuid
         and ${filter}
         and ($3::date is null or ${depositedOn} >= $3::date)
         and ($4::date is null or ${depositedOn} <= $4::date)
       order by coalesce(o.verified_at, o.created_at) asc, o.id asc
       limit ${SHIP_QUEUE_LIMIT}`,
      [input.ownerUserId, partnerId, listRange?.from ?? null, listRange?.to ?? null],
    )
    const today = vnTodayIso()
    const orders = rows
      .map((row) =>
        assembleShipQueueOrder(
          {
            orderId: String(row.order_id ?? ''),
            orderCode: String(row.order_code ?? ''),
            customerName: String(row.customer_name ?? ''),
            customerPhone: String(row.customer_phone ?? ''),
            subtotalAmount: num(row.subtotal_amount),
            amountAfterDiscount: num(row.amount_after_discount),
            depositedOn: String(row.deposited_on ?? ''),
          },
          today,
        ),
      )
      .filter((row) => row.orderId)
    const selected = stats[period]
    return {
      period,
      orders,
      orderCount: selected.orders,
      totalVnd: selected.totalVnd,
      truncated: selected.orders > orders.length,
      stats,
    }
  } catch (error) {
    console.error('[fetchPartnerShipQueueFromPg]', error)
    return null
  }
}

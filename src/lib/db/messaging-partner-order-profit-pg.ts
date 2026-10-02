import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { partnerAdminDepositedOrderSql } from '@/lib/messaging/partner-admin-orders-lifecycle'
import {
  assembleProfitOrder,
  DEFAULT_PROFIT_VND_PER_CNY,
  PROFIT_ORDER_LIMIT,
  type ProfitCatalogLine,
  type ProfitSheetOrder,
} from '@/lib/messaging/partner-order-profit'
import { isValidUuidString } from '@/lib/validate-uuid'

export type PartnerOrderProfitSheet = {
  dateFrom: string
  dateTo: string
  vndPerCny: number
  shipChinaDomesticCny: number
  shipBorderToHanoiCny: number
  shipHanoiToCustomerVnd: number
  truncated: boolean
  orders: ProfitSheetOrder[]
}

export type PartnerOrderProfitSaveOrder = {
  orderId: string
  goodsCny: number | null
  shipChinaDomesticCny: number | null
  shipBorderToHanoiCny: number | null
  shipHanoiToCustomerVnd: number | null
}

function isoDay(value: string): string | null {
  const text = String(value ?? '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

async function partnerOrdersAllowed(ownerUserId: string, partnerId: string): Promise<boolean> {
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

async function loadProfitDefaults(partnerId: string): Promise<{
  vndPerCny: number
  shipChina: number
  shipBorder: number
  shipHanoi: number
}> {
  const row = await pgQueryOne<Record<string, unknown>>(
    `select vnd_per_cny, ship_china_domestic_cny, ship_border_to_hanoi_cny, ship_hanoi_to_customer_vnd
     from public.messaging_partner_ad_spend
     where partner_id = $1::uuid`,
    [partnerId],
  )
  const saved = nullableNum(row?.vnd_per_cny)
  return {
    vndPerCny: saved != null && saved > 0 ? saved : DEFAULT_PROFIT_VND_PER_CNY,
    shipChina: Math.max(0, num(row?.ship_china_domestic_cny)),
    shipBorder: Math.max(0, num(row?.ship_border_to_hanoi_cny)),
    shipHanoi: Math.max(0, num(row?.ship_hanoi_to_customer_vnd)),
  }
}

/** Đơn đã cọc trong kỳ, giá thu sau sale, giá nhập đã lưu và override từng đơn. */
export async function fetchPartnerOrderProfitSheetFromPg(input: {
  ownerUserId: string
  partnerId?: string | null
  dateFrom: string
  dateTo: string
}): Promise<PartnerOrderProfitSheet | null> {
  if (!isPgConfigured()) return null
  const partnerId = String(input.partnerId ?? '').trim()
  const from = isoDay(input.dateFrom)
  const to = isoDay(input.dateTo)
  if (!partnerId || !isValidUuidString(partnerId) || !from || !to) return null
  if (!(await partnerOrdersAllowed(input.ownerUserId, partnerId))) return null
  try {
    const defaults = await loadProfitDefaults(partnerId)
    const rows = await pgQuery<Record<string, unknown>>(
      `with picked as (
         select o.id,
                coalesce(nullif(trim(o.payment_reference), ''), o.id::text) as order_code,
                to_char((coalesce(o.verified_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') as deposited_on,
                coalesce(o.subtotal_amount, 0)::double precision as subtotal_amount,
                coalesce(o.total_discount_amount, 0)::double precision as discount_amount,
                coalesce(o.amount_after_discount, 0)::double precision as amount_after_discount,
                coalesce(o.paid_amount, 0)::double precision as paid_amount,
                (coalesce(o.shipping_status, 'pending') = 'returned' and o.status <> 'cancelled') as returned,
                coalesce(o.verified_at, o.created_at) as deposited_at
         from public.messaging_partner_orders o
         join public.messaging_partners mp
           on mp.id = o.partner_id
          and ${sqlPartnerMpActorHasPerm(1, 'orders_profit', { parentKey: 'orders', markerKey: 'orders_profit' })}
         where o.partner_id = $2::uuid
           and ${partnerAdminDepositedOrderSql()}
           and (coalesce(o.verified_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh')::date >= $3::date
           and (coalesce(o.verified_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh')::date <= $4::date
         order by deposited_at desc, o.id desc
         limit ${PROFIT_ORDER_LIMIT + 1}
       )
       select p.id::text as order_id,
              p.order_code,
              p.deposited_on,
              p.subtotal_amount,
              p.discount_amount,
              p.amount_after_discount,
              p.paid_amount,
              p.returned,
              p.deposited_at,
              l.quantity::int as quantity,
              l.unit_price::double precision as unit_price,
              l.line_subtotal::double precision as line_subtotal,
              l.is_warehouse_item as is_warehouse_item,
              i.cost_cny::double precision as cost_cny,
              i.cost_vnd::double precision as cost_vnd,
              coalesce(i.is_clearance, false) as is_clearance,
              i.catalog_json->>'pro_lower_price' as pro_lower_price,
              c.goods_cny::double precision as goods_cny_override,
              c.ship_china_domestic_cny::double precision as ship_china_override,
              c.ship_border_to_hanoi_cny::double precision as ship_border_override,
              c.ship_hanoi_to_customer_vnd::double precision as ship_hanoi_override
       from picked p
       left join public.messaging_partner_order_lines l on l.order_id = p.id
       left join public.messaging_partner_inventory i on i.id = l.product_inventory_id
       left join public.messaging_partner_ad_spend_order_costs c on c.order_id = p.id
       order by p.deposited_at desc, p.id desc, l.sort_order asc`,
      [input.ownerUserId, partnerId, from, to],
    )
    const grouped = new Map<string, ProfitOrderBucket>()
    const orderIds: string[] = []
    let truncated = false
    for (const raw of rows) {
      const orderId = String(raw.order_id ?? '')
      if (!orderId) continue
      let bucket = grouped.get(orderId)
      if (!bucket) {
        if (orderIds.length >= PROFIT_ORDER_LIMIT) {
          truncated = true
          continue
        }
        orderIds.push(orderId)
        bucket = {
          orderId,
          orderCode: String(raw.order_code ?? orderId),
          depositedOn: String(raw.deposited_on ?? ''),
          subtotal: num(raw.subtotal_amount),
          discount: num(raw.discount_amount),
          amountAfterDiscount: num(raw.amount_after_discount),
          paidAmount: num(raw.paid_amount),
          returned: raw.returned === true,
          lines: [],
          goodsCnyOverride: nullableNum(raw.goods_cny_override),
          shipChinaOverride: nullableNum(raw.ship_china_override),
          shipBorderOverride: nullableNum(raw.ship_border_override),
          shipHanoiOverride: nullableNum(raw.ship_hanoi_override),
        }
        grouped.set(orderId, bucket)
      }
      if (raw.quantity == null) continue
      bucket.lines.push({
        quantity: Math.max(0, Math.round(num(raw.quantity))),
        unitPriceVnd: Math.max(0, num(raw.unit_price)),
        lineTotalVnd: Math.max(0, num(raw.line_subtotal)),
        catalogRaw: raw.pro_lower_price,
        costCny: nullableNum(raw.cost_cny),
        costVnd: nullableNum(raw.cost_vnd),
        isWarehouse: raw.is_warehouse_item === true,
        isClearance: raw.is_clearance === true,
      })
    }
    return {
      dateFrom: from,
      dateTo: to,
      vndPerCny: defaults.vndPerCny,
      shipChinaDomesticCny: defaults.shipChina,
      shipBorderToHanoiCny: defaults.shipBorder,
      shipHanoiToCustomerVnd: defaults.shipHanoi,
      truncated,
      orders: orderIds.map((orderId) => assembleProfitOrder(grouped.get(orderId)!, defaults.vndPerCny)),
    }
  } catch (error) {
    console.error('[fetchPartnerOrderProfitSheetFromPg]', error)
    return null
  }
}

type ProfitOrderBucket = {
  orderId: string
  orderCode: string
  depositedOn: string
  subtotal: number
  discount: number
  amountAfterDiscount: number
  paidAmount: number
  returned: boolean
  lines: ProfitCatalogLine[]
  goodsCnyOverride: number | null
  shipChinaOverride: number | null
  shipBorderOverride: number | null
  shipHanoiOverride: number | null
}

function nonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} không được âm.`)
  return value
}

function optionalNonNegative(value: number | null, label: string): number | null {
  if (value == null) return null
  return nonNegative(value, label)
}

export async function savePartnerOrderProfitInputsFromPg(input: {
  ownerUserId: string
  partnerId: string
  vndPerCny: number
  shipChinaDomesticCny: number
  shipBorderToHanoiCny: number
  shipHanoiToCustomerVnd: number
  orders: PartnerOrderProfitSaveOrder[]
}): Promise<void> {
  if (!isPgConfigured()) throw new Error('DATABASE_URL is not set.')
  const partnerId = input.partnerId.trim()
  if (!isValidUuidString(partnerId)) throw new Error('Invalid partner id.')
  if (!(await partnerOrdersAllowed(input.ownerUserId, partnerId))) throw new Error('Không lưu được hạch toán.')
  const rate = nonNegative(input.vndPerCny, 'Tỷ giá')
  if (rate <= 0) throw new Error('Tỷ giá phải lớn hơn 0.')
  const shipChina = nonNegative(input.shipChinaDomesticCny, 'Ship Trung Quốc nội địa')
  const shipBorder = nonNegative(input.shipBorderToHanoiCny, 'Ship cửa khẩu về Hà Nội')
  const shipHanoi = nonNegative(input.shipHanoiToCustomerVnd, 'Ship Hà Nội đến khách')
  const orders = input.orders || []
  if (orders.length > PROFIT_ORDER_LIMIT) throw new Error('Quá nhiều đơn để lưu một lúc.')
  const orderIds: string[] = []
  for (const item of orders) {
    if (!isValidUuidString(item.orderId)) throw new Error('Mã đơn không hợp lệ.')
    orderIds.push(item.orderId)
  }
  if (new Set(orderIds).size !== orderIds.length) throw new Error('Danh sách đơn bị trùng.')
  const normalized = orders.map((item) => ({
    orderId: item.orderId,
    goods: optionalNonNegative(item.goodsCny, 'Giá hàng tệ'),
    china: optionalNonNegative(item.shipChinaDomesticCny, 'Ship Trung Quốc nội địa'),
    border: optionalNonNegative(item.shipBorderToHanoiCny, 'Ship cửa khẩu về Hà Nội'),
    hanoi: optionalNonNegative(item.shipHanoiToCustomerVnd, 'Ship Hà Nội đến khách'),
  }))

  const pool = getPgPool()
  const client = await pool.connect()
  try {
    await client.query('begin')
    if (orderIds.length) {
      const found = await client.query<{ id: string }>(
        `select id::text as id
         from public.messaging_partner_orders
         where partner_id = $1::uuid and id = any($2::uuid[])`,
        [partnerId, orderIds],
      )
      if (found.rows.length !== orderIds.length) throw new Error('Có đơn không tồn tại.')
    }
    await client.query(
      `insert into public.messaging_partner_ad_spend (
         partner_id, vnd_per_cny, ship_china_domestic_cny, ship_border_to_hanoi_cny, ship_hanoi_to_customer_vnd, updated_at
       ) values ($1::uuid, $2, $3, $4, $5, now())
       on conflict (partner_id) do update set
         vnd_per_cny = excluded.vnd_per_cny,
         ship_china_domestic_cny = excluded.ship_china_domestic_cny,
         ship_border_to_hanoi_cny = excluded.ship_border_to_hanoi_cny,
         ship_hanoi_to_customer_vnd = excluded.ship_hanoi_to_customer_vnd,
         updated_at = now()`,
      [partnerId, rate, shipChina, shipBorder, shipHanoi],
    )
    for (const item of normalized) {
      if (item.goods == null && item.china == null && item.border == null && item.hanoi == null) {
        await client.query(`delete from public.messaging_partner_ad_spend_order_costs where order_id = $1::uuid`, [
          item.orderId,
        ])
        continue
      }
      await client.query(
        `insert into public.messaging_partner_ad_spend_order_costs (
           order_id, partner_id, goods_cny, ship_china_domestic_cny, ship_border_to_hanoi_cny, ship_hanoi_to_customer_vnd, updated_at
         ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, now())
         on conflict (order_id) do update set
           partner_id = excluded.partner_id,
           goods_cny = excluded.goods_cny,
           ship_china_domestic_cny = excluded.ship_china_domestic_cny,
           ship_border_to_hanoi_cny = excluded.ship_border_to_hanoi_cny,
           ship_hanoi_to_customer_vnd = excluded.ship_hanoi_to_customer_vnd,
           updated_at = now()`,
        [item.orderId, partnerId, item.goods, item.china, item.border, item.hanoi],
      )
    }
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

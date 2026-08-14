import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/**
 * M2.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CRM nhẹ: khách đã đăng ký tài khoản shop.
 * Nguồn danh sách = `messaging_guest_accounts` (đã tạo tài khoản), không phải mọi người từng đặt đơn.
 * Khách checkout không tài khoản không hiện. Khách đăng ký nhưng chưa mua vẫn hiện (số đơn = 0).
 * Tổng chi tiêu / đơn đã giao chỉ tính `paid_verified` + `delivered`.
 */

export type PartnerCustomerSummaryRow = {
  emailNormalized: string
  customerName: string
  customerPhone: string
  orderCount: number
  completedOrderCount: number
  totalSpent: number
  firstOrderAt: string
  lastOrderAt: string
}

type CustomerDbRow = {
  email_key: string
  customer_name: string
  customer_phone: string
  order_count: number
  completed_order_count: number
  total_spent: string | number
  first_order_at: unknown
  last_order_at: unknown
}

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function mapCustomerRow(r: CustomerDbRow): PartnerCustomerSummaryRow {
  return {
    emailNormalized: r.email_key,
    customerName: r.customer_name ?? '',
    customerPhone: r.customer_phone ?? '',
    orderCount: r.order_count ?? 0,
    completedOrderCount: r.completed_order_count ?? 0,
    totalSpent: num(r.total_spent, 0),
    firstOrderAt: String(r.first_order_at ?? ''),
    lastOrderAt: String(r.last_order_at ?? ''),
  }
}

/**
 * Danh sách khách đã tạo tài khoản tại shop, kèm thống kê đơn (có thể = 0).
 * Tên/SĐT: hồ sơ khách, fallback đơn gần nhất.
 */
export async function fetchPartnerCustomersForAdminFromPg(input: {
  partnerId: string
  page?: number
  pageSize?: number
  search?: string
}): Promise<{ rows: PartnerCustomerSummaryRow[]; total: number } | null> {
  if (!isPgConfigured()) return null
  const page = Math.max(1, Math.floor(input.page ?? 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(input.pageSize ?? 20)))
  const offset = (page - 1) * pageSize
  const search = (input.search ?? '').trim().toLowerCase()

  const searchClause = search
    ? `and (
         a.email_key ilike $2
         or a.email_raw ilike $2
         or lower(coalesce(nullif(trim(p.customer_name), ''), nullif(trim(lo.customer_name), ''), '')) ilike $2
         or coalesce(nullif(trim(p.customer_phone), ''), nullif(trim(lo.customer_phone), ''), '') ilike $2
       )`
    : ''
  const params: unknown[] = search ? [input.partnerId, `%${search}%`] : [input.partnerId]

  const ctes = `
    with accounts as (
      select
        ga.email_normalized as email_key,
        ga.email_raw,
        ga.last_login_at,
        ga.created_at as registered_at
      from public.messaging_guest_accounts ga
      where ga.partner_id = $1::uuid
    ),
    order_agg as (
      select
        lower(trim(customer_email)) as email_key,
        count(*)::int as order_count,
        count(*) filter (
          where status = 'paid_verified' and coalesce(shipping_status, 'pending') = 'delivered'
        )::int as completed_order_count,
        sum(
          case when status = 'paid_verified' and coalesce(shipping_status, 'pending') = 'delivered'
            then greatest(
              0::numeric,
              coalesce(
                nullif(amount_after_discount, 0),
                subtotal_amount - coalesce(total_discount_amount, 0) - coalesce(promo_discount_amount, 0),
                subtotal_amount,
                0
              )
            )
            else 0::numeric
          end
        ) as total_spent,
        max(created_at) as last_order_at,
        min(created_at) as first_order_at
      from public.messaging_partner_orders
      where partner_id = $1::uuid and trim(coalesce(customer_email, '')) <> ''
      group by 1
    ),
    latest_order as (
      select distinct on (lower(trim(customer_email)))
        lower(trim(customer_email)) as email_key,
        customer_name,
        customer_phone
      from public.messaging_partner_orders
      where partner_id = $1::uuid and trim(coalesce(customer_email, '')) <> ''
      order by lower(trim(customer_email)), created_at desc
    )
  `

  const joins = `
    from accounts a
    left join public.messaging_partner_customer_profiles p
      on p.partner_id = $1::uuid and p.email_normalized = a.email_key
    left join order_agg oa using (email_key)
    left join latest_order lo using (email_key)
    where true ${searchClause}
  `

  try {
    const rows = await pgQuery<CustomerDbRow>(
      `${ctes}
       select
         a.email_key,
         coalesce(nullif(trim(p.customer_name), ''), nullif(trim(lo.customer_name), ''), '') as customer_name,
         coalesce(nullif(trim(p.customer_phone), ''), nullif(trim(lo.customer_phone), ''), '') as customer_phone,
         coalesce(oa.order_count, 0) as order_count,
         coalesce(oa.completed_order_count, 0) as completed_order_count,
         coalesce(oa.total_spent, 0) as total_spent,
         oa.first_order_at,
         oa.last_order_at
       ${joins}
       order by a.last_login_at desc nulls last, a.registered_at desc
       limit ${pageSize} offset ${offset}`,
      params
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `${ctes} select count(*)::int as c ${joins}`,
      params
    )
    return { rows: rows.map(mapCustomerRow), total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerCustomersForAdminFromPg]', e)
    return null
  }
}

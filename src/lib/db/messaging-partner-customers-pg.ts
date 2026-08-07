import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/**
 * M2.1 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — CRM nhẹ: danh sách khách hàng theo shop.
 * Khác `partner-website-leads-panel.tsx` (đó là lead form, đây là khách ĐÃ ĐẶT ĐƠN thật).
 * Gộp theo email chuẩn hoá (nguồn duy nhất luôn có trên mọi đơn — guest_account_id/linked_user_id
 * có thể null tuỳ kênh, xem docs/188_BEHAVIOR_SPEC.md không đề cập mục này nhưng theo đúng nguyên
 * tắc "1 nguồn sự thật" đã áp dụng cho W4/W1.5).
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
 * Danh sách khách hàng đã có ít nhất 1 đơn (mọi trạng thái) tại shop, gộp theo email chuẩn hoá.
 * `totalSpent`/`completedOrderCount` chỉ tính đơn `paid_verified` + `delivered` (doanh thu thật).
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

  const searchClause = search ? `and (email_key ilike $2 or lower(customer_name) ilike $2 or customer_phone ilike $2)` : ''
  const params: unknown[] = search ? [input.partnerId, `%${search}%`] : [input.partnerId]

  try {
    const rows = await pgQuery<CustomerDbRow>(
      `with order_agg as (
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
       select oa.email_key, coalesce(lo.customer_name, '') as customer_name,
              coalesce(lo.customer_phone, '') as customer_phone,
              oa.order_count, oa.completed_order_count, oa.total_spent, oa.first_order_at, oa.last_order_at
       from order_agg oa
       join latest_order lo using (email_key)
       where true ${searchClause}
       order by oa.last_order_at desc
       limit ${pageSize} offset ${offset}`,
      params
    )
    const totalRow = await pgQueryOne<{ c: number }>(
      `with latest_order as (
         select distinct on (lower(trim(customer_email)))
           lower(trim(customer_email)) as email_key,
           customer_name,
           customer_phone
         from public.messaging_partner_orders
         where partner_id = $1::uuid and trim(coalesce(customer_email, '')) <> ''
         order by lower(trim(customer_email)), created_at desc
       )
       select count(*)::int as c from latest_order
       where true ${searchClause}`,
      params
    )
    return { rows: rows.map(mapCustomerRow), total: totalRow?.c ?? 0 }
  } catch (e) {
    console.warn('[fetchPartnerCustomersForAdminFromPg]', e)
    return null
  }
}

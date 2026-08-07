import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'

/**
 * S0.8 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — dashboard doanh thu/conversion/UTM.
 * Doanh thu THẬT = đơn `paid_verified` + `delivered`, dùng `amount_after_discount` (đã trừ cả
 * loyalty/birthday lẫn voucher — nhất quán với M2.1/W1.4). "Khách truy cập" là ƯỚC TÍNH từ
 * `messaging_partner_visitor_personalization` (không có bảng đếm lượt xem trang riêng) — hiển thị
 * rõ đây là ước tính, không nói dối là số liệu chính xác tuyệt đối.
 */

export type PartnerRevenueSummary = {
  totalRevenue: number
  completedOrderCount: number
  totalOrderCount: number
  avgOrderValue: number
  estimatedVisitors: number
  estimatedConversionRatePercent: number
}

export type PartnerRevenueByDay = { date: string; revenue: number; orderCount: number }

export type PartnerRevenueByUtmSource = {
  utmSource: string
  utmCampaign: string
  revenue: number
  orderCount: number
}

export type PartnerTopProduct = {
  productKey: string
  productName: string
  revenue: number
  quantity: number
}

const REVENUE_EXPR = `greatest(
  0::numeric,
  coalesce(nullif(o.amount_after_discount, 0), o.subtotal_amount - coalesce(o.total_discount_amount, 0) - coalesce(o.promo_discount_amount, 0), o.subtotal_amount, 0)
)`

const COMPLETED_FILTER = `o.status = 'paid_verified' and coalesce(o.shipping_status, 'pending') = 'delivered'`

function num(v: string | number | null | undefined, fallback = 0): number {
  if (v === null || v === undefined) return fallback
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

export async function fetchPartnerRevenueSummaryFromPg(input: {
  partnerId: string
  dateFrom: string
  dateTo: string
}): Promise<PartnerRevenueSummary | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<{
      total_revenue: string | number
      completed_order_count: number
      total_order_count: number
    }>(
      `select
         coalesce(sum(case when ${COMPLETED_FILTER} then ${REVENUE_EXPR} else 0 end), 0) as total_revenue,
         count(*) filter (where ${COMPLETED_FILTER})::int as completed_order_count,
         count(*)::int as total_order_count
       from public.messaging_partner_orders o
       where o.partner_id = $1::uuid
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date`,
      [input.partnerId, input.dateFrom, input.dateTo]
    )
    const visitorRow = await pgQueryOne<{ c: number }>(
      `select count(distinct account_key)::int as c
       from public.messaging_partner_visitor_personalization
       where partner_id = $1::uuid
         and (updated_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
         and (updated_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date`,
      [input.partnerId, input.dateFrom, input.dateTo]
    ).catch(() => null)

    const totalRevenue = num(row?.total_revenue, 0)
    const completedOrderCount = row?.completed_order_count ?? 0
    const totalOrderCount = row?.total_order_count ?? 0
    const estimatedVisitors = visitorRow?.c ?? 0
    return {
      totalRevenue,
      completedOrderCount,
      totalOrderCount,
      avgOrderValue: completedOrderCount > 0 ? Math.round(totalRevenue / completedOrderCount) : 0,
      estimatedVisitors,
      estimatedConversionRatePercent:
        estimatedVisitors > 0 ? Math.round((completedOrderCount / estimatedVisitors) * 1000) / 10 : 0,
    }
  } catch (e) {
    console.warn('[fetchPartnerRevenueSummaryFromPg]', e)
    return null
  }
}

export async function fetchPartnerRevenueByDayFromPg(input: {
  partnerId: string
  dateFrom: string
  dateTo: string
}): Promise<PartnerRevenueByDay[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{ d: string; revenue: string | number; order_count: number }>(
      `select (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date::text as d,
              coalesce(sum(case when ${COMPLETED_FILTER} then ${REVENUE_EXPR} else 0 end), 0) as revenue,
              count(*) filter (where ${COMPLETED_FILTER})::int as order_count
       from public.messaging_partner_orders o
       where o.partner_id = $1::uuid
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date
       group by 1
       order by 1 asc`,
      [input.partnerId, input.dateFrom, input.dateTo]
    )
    return rows.map((r) => ({ date: r.d, revenue: num(r.revenue, 0), orderCount: r.order_count ?? 0 }))
  } catch (e) {
    console.warn('[fetchPartnerRevenueByDayFromPg]', e)
    return null
  }
}

/**
 * Gộp theo UTM source/campaign của khách — join qua `conversation` để lấy `account_key` (đúng thứ
 * tự ưu tiên `guest_account_id -> linked_user_id -> external_thread_id`, khớp
 * `visitorAccountKeyFromThread`). Đơn không khớp được UTM nào -> nhóm "Trực tiếp/Không rõ".
 */
export async function fetchPartnerRevenueByUtmSourceFromPg(input: {
  partnerId: string
  dateFrom: string
  dateTo: string
}): Promise<PartnerRevenueByUtmSource[] | null> {
  if (!isPgConfigured()) return null
  try {
    const rows = await pgQuery<{
      utm_source: string | null
      utm_campaign: string | null
      revenue: string | number
      order_count: number
    }>(
      `select
         nullif(trim(vp.utm_context->>'utm_source'), '') as utm_source,
         nullif(trim(vp.utm_context->>'utm_campaign'), '') as utm_campaign,
         coalesce(sum(case when ${COMPLETED_FILTER} then ${REVENUE_EXPR} else 0 end), 0) as revenue,
         count(*) filter (where ${COMPLETED_FILTER})::int as order_count
       from public.messaging_partner_orders o
       left join public.customer_care_conversations c on c.id = o.conversation_id
       left join public.messaging_partner_visitor_personalization vp
         on vp.partner_id = o.partner_id
         and vp.account_key = coalesce(
           nullif(c.guest_account_id::text, ''),
           nullif(c.linked_user_id::text, ''),
           nullif(o.external_thread_id, '')
         )
       where o.partner_id = $1::uuid
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
         and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date
       group by 1, 2
       order by revenue desc`,
      [input.partnerId, input.dateFrom, input.dateTo]
    )
    return rows.map((r) => ({
      utmSource: r.utm_source ?? 'Trực tiếp / Không rõ',
      utmCampaign: r.utm_campaign ?? '',
      revenue: num(r.revenue, 0),
      orderCount: r.order_count ?? 0,
    }))
  } catch (e) {
    console.warn('[fetchPartnerRevenueByUtmSourceFromPg]', e)
    return null
  }
}

/**
 * Top sản phẩm theo doanh thu — ưu tiên `messaging_partner_order_lines`; UNION thêm đơn CHƯA có
 * dòng nào trong bảng lines (không có ràng buộc DB đảm bảo mọi đơn đều có ≥1 line — xem
 * `20260505215000_messaging_partner_order_lines.sql`, chỉ backfill 1 lần tại thời điểm migrate).
 */
export async function fetchPartnerTopProductsByRevenueFromPg(input: {
  partnerId: string
  dateFrom: string
  dateTo: string
  limit?: number
}): Promise<PartnerTopProduct[] | null> {
  if (!isPgConfigured()) return null
  const limit = Math.min(50, Math.max(1, input.limit ?? 10))
  try {
    const rows = await pgQuery<{ product_key: string; product_name: string; revenue: string | number; quantity: number }>(
      `with line_revenue as (
         select
           coalesce(l.product_inventory_id::text, o.id::text) as product_key,
           coalesce(nullif(l.product_name, ''), o.product_name, 'Sản phẩm') as product_name,
           l.quantity as quantity,
           l.line_subtotal as revenue
         from public.messaging_partner_order_lines l
         join public.messaging_partner_orders o on o.id = l.order_id
         where o.partner_id = $1::uuid
           and ${COMPLETED_FILTER}
           and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
           and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date
         union all
         select
           coalesce(o.product_inventory_id::text, o.id::text) as product_key,
           coalesce(nullif(o.product_name, ''), 'Sản phẩm') as product_name,
           o.quantity as quantity,
           o.subtotal_amount as revenue
         from public.messaging_partner_orders o
         where o.partner_id = $1::uuid
           and ${COMPLETED_FILTER}
           and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= $2::date
           and (o.created_at at time zone 'Asia/Ho_Chi_Minh')::date <= $3::date
           and not exists (select 1 from public.messaging_partner_order_lines l2 where l2.order_id = o.id)
       )
       select product_key, product_name, sum(revenue) as revenue, sum(quantity)::int as quantity
       from line_revenue
       group by product_key, product_name
       order by revenue desc
       limit ${limit}`,
      [input.partnerId, input.dateFrom, input.dateTo]
    )
    return rows.map((r) => ({
      productKey: r.product_key,
      productName: r.product_name,
      revenue: num(r.revenue, 0),
      quantity: r.quantity ?? 0,
    }))
  } catch (e) {
    console.warn('[fetchPartnerTopProductsByRevenueFromPg]', e)
    return null
  }
}

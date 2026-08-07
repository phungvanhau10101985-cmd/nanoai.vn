// Smoke test (S0.8): dashboard doanh thu/conversion/UTM — DB layer.
// Chạy: npx tsx scripts/test-revenue-analytics-s0_8.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  fetchPartnerRevenueByDayFromPg,
  fetchPartnerRevenueByUtmSourceFromPg,
  fetchPartnerRevenueSummaryFromPg,
  fetchPartnerTopProductsByRevenueFromPg,
} from '../src/lib/db/messaging-partner-revenue-analytics-pg'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'S0.8 Revenue Test Shop', $2) returning id`,
    [ownerId, `s0-8-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const invA = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'SP A test S0.8', '100.000đ', 'https://placehold.co/100', 'https://example.com/a', true) returning id`,
    [partnerId]
  )
  const invAId = invA.rows[0].id as string
  const invB = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'SP B test S0.8', '50.000đ', 'https://placehold.co/100', 'https://example.com/b', true) returning id`,
    [partnerId]
  )
  const invBId = invB.rows[0].id as string

  async function seedVisitor(accountKey: string, utmSource: string | null, updatedAt: string): Promise<void> {
    await pool.query(
      `insert into public.messaging_partner_visitor_personalization (partner_id, account_key, utm_context, updated_at)
       values ($1::uuid, $2, $3::jsonb, $4::timestamptz)`,
      [partnerId, accountKey, JSON.stringify(utmSource ? { utm_source: utmSource, utm_campaign: 'test_campaign' } : {}), updatedAt]
    )
  }

  async function seedOrderWithLine(opts: {
    guestAccountId: string
    status: string
    shippingStatus: string
    lineInvId: string
    lineName: string
    unitPrice: number
    qty: number
    createdAt: string
  }): Promise<void> {
    const conv = await pool.query(
      `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
       values ('widget', $1, $2::uuid, $3::uuid) returning id`,
      [`s0_8-thread-${opts.guestAccountId}-${Date.now()}-${Math.random()}`, opts.guestAccountId, partnerId]
    )
    const subtotal = opts.unitPrice * opts.qty
    const order = await pool.query(
      `insert into public.messaging_partner_orders (
        partner_id, conversation_id, status, shipping_status, subtotal_amount, amount_after_discount, created_at
      ) values ($1::uuid, $2::uuid, $3, $4, $5, $5, $6::timestamptz) returning id`,
      [partnerId, conv.rows[0].id, opts.status, opts.shippingStatus, subtotal, opts.createdAt]
    )
    await pool.query(
      `insert into public.messaging_partner_order_lines (order_id, product_inventory_id, product_name, unit_price, quantity, line_subtotal)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6)`,
      [order.rows[0].id, opts.lineInvId, opts.lineName, opts.unitPrice, opts.qty, subtotal]
    )
  }

  async function seedGuestAccount(emailTag: string): Promise<string> {
    const r = await pool.query(
      `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
       values ($1::uuid, $2, $2) returning id`,
      [partnerId, `${emailTag}-${tag}@example.com`]
    )
    return r.rows[0].id as string
  }

  const today = new Date().toISOString().slice(0, 10)
  const guestFb = await seedGuestAccount('s08-fb-buyer')
  const guestGoogle = await seedGuestAccount('s08-google-buyer')
  const guestDirect = await seedGuestAccount('s08-direct-buyer')
  const guestVisitorOnly = await seedGuestAccount('s08-visitor-only')

  try {
    // Khách đến từ Facebook -> mua SP A (delivered, tính doanh thu).
    await seedVisitor(guestFb, 'facebook', `${today}T02:00:00Z`)
    await seedOrderWithLine({
      guestAccountId: guestFb, status: 'paid_verified', shippingStatus: 'delivered',
      lineInvId: invAId, lineName: 'SP A test S0.8', unitPrice: 100000, qty: 2, createdAt: `${today}T03:00:00Z`,
    })

    // Khách đến từ Google -> mua SP B (delivered).
    await seedVisitor(guestGoogle, 'google', `${today}T04:00:00Z`)
    await seedOrderWithLine({
      guestAccountId: guestGoogle, status: 'paid_verified', shippingStatus: 'delivered',
      lineInvId: invBId, lineName: 'SP B test S0.8', unitPrice: 50000, qty: 1, createdAt: `${today}T05:00:00Z`,
    })

    // Khách không có UTM (trực tiếp) -> đơn awaiting_payment (KHÔNG tính doanh thu, có tính order count).
    await seedOrderWithLine({
      guestAccountId: guestDirect, status: 'awaiting_payment', shippingStatus: 'pending',
      lineInvId: invAId, lineName: 'SP A test S0.8', unitPrice: 100000, qty: 1, createdAt: `${today}T06:00:00Z`,
    })

    // Khách chỉ ghé thăm, chưa mua (tính vào estimatedVisitors nhưng không tính order/revenue).
    await seedVisitor(guestVisitorOnly, 'facebook', `${today}T07:00:00Z`)

    const range = { partnerId, dateFrom: today, dateTo: today }

    const summary = await fetchPartnerRevenueSummaryFromPg(range)
    assert(summary, 'summary null')
    assert(summary!.totalRevenue === 250000, `totalRevenue phải = 200000+50000=250000, thực tế ${summary!.totalRevenue}`)
    assert(summary!.completedOrderCount === 2, `completedOrderCount phải = 2, thực tế ${summary!.completedOrderCount}`)
    assert(summary!.totalOrderCount === 3, `totalOrderCount phải = 3 (gồm cả awaiting_payment), thực tế ${summary!.totalOrderCount}`)
    assert(summary!.avgOrderValue === 125000, `avgOrderValue phải = 250000/2=125000, thực tế ${summary!.avgOrderValue}`)
    assert(summary!.estimatedVisitors === 3, `estimatedVisitors phải = 3 (fb+google+visitor-only), thực tế ${summary!.estimatedVisitors}`)
    console.log('OK fetchPartnerRevenueSummaryFromPg: doanh thu/order count/AOV/visitors tính đúng, KHÔNG tính đơn chưa thanh toán vào doanh thu')

    const byDay = await fetchPartnerRevenueByDayFromPg(range)
    assert(byDay && byDay.length === 1 && byDay[0].revenue === 250000 && byDay[0].orderCount === 2, `byDay sai: ${JSON.stringify(byDay)}`)
    console.log('OK fetchPartnerRevenueByDayFromPg: gộp theo ngày đúng')

    const byUtm = await fetchPartnerRevenueByUtmSourceFromPg(range)
    assert(byUtm, 'byUtm null')
    const fbRow = byUtm!.find((r) => r.utmSource === 'facebook')
    const googleRow = byUtm!.find((r) => r.utmSource === 'google')
    assert(fbRow && fbRow.revenue === 200000, `facebook phải có doanh thu 200000, thực tế ${JSON.stringify(fbRow)}`)
    assert(googleRow && googleRow.revenue === 50000, `google phải có doanh thu 50000, thực tế ${JSON.stringify(googleRow)}`)
    const directRow = byUtm!.find((r) => r.utmSource === 'Trực tiếp / Không rõ')
    assert(directRow !== undefined, 'phải có nhóm "Trực tiếp / Không rõ" cho đơn không có UTM')
    console.log('OK fetchPartnerRevenueByUtmSourceFromPg: gộp đúng theo utm_source, đơn không rõ UTM vào nhóm riêng')

    const topProducts = await fetchPartnerTopProductsByRevenueFromPg({ ...range, limit: 10 })
    assert(topProducts, 'topProducts null')
    assert(topProducts![0].productKey === invAId && topProducts![0].revenue === 200000, `sản phẩm A phải đứng đầu doanh thu 200000: ${JSON.stringify(topProducts![0])}`)
    assert(topProducts![1].productKey === invBId && topProducts![1].revenue === 50000, `sản phẩm B phải đứng thứ 2 doanh thu 50000: ${JSON.stringify(topProducts![1])}`)
    console.log('OK fetchPartnerTopProductsByRevenueFromPg: top sản phẩm theo doanh thu đúng thứ tự')

    console.log('\n✅ ALL S0.8 (dashboard doanh thu/conversion/UTM — DB layer) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.customer_care_conversations where partner_id = $1::uuid`, [partnerId])
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})

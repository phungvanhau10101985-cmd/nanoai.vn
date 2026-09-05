// Smoke test Phase 2 (S0.8): API /api/messaging/partners/{id}/revenue-analytics qua HTTP thật +
// trang /dashboard/messaging/analytics render 200.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-revenue-analytics-s0_8-phase2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const devUserRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
  assert(devUserRes.rows.length, "cần user dev@local.test trong auth.users (dev bypass)")
  const ownerId = devUserRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'S0.8 Phase2 Shop', $2) returning id`,
    [ownerId, `s0-8-p2-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const conv = await pool.query(
    `insert into public.customer_care_conversations (channel, external_thread_id, partner_id)
     values ('widget', $1, $2::uuid) returning id`,
    [`s0_8-p2-thread-${tag}`, partnerId]
  )
  await pool.query(
    `insert into public.messaging_partner_orders (
      partner_id, conversation_id, status, shipping_status, subtotal_amount, amount_after_discount
    ) values ($1::uuid, $2::uuid, 'paid_verified', 'delivered', 300000, 300000)`,
    [partnerId, conv.rows[0].id]
  )

  try {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const res = await fetch(
      `${BASE}/api/messaging/partners/${partnerId}/revenue-analytics?dateFrom=${today}&dateTo=${today}`
    )
    assert(res.status === 200, `analytics API status ${res.status}`)
    const json = (await res.json()) as { summary: { totalRevenue: number; completedOrderCount: number } }
    assert(json.summary.totalRevenue === 300000, `totalRevenue phải = 300000, thực tế ${json.summary.totalRevenue}`)
    assert(json.summary.completedOrderCount === 1, `completedOrderCount phải = 1, thực tế ${json.summary.completedOrderCount}`)
    console.log('OK GET /api/messaging/partners/{id}/revenue-analytics (dev bypass) trả đúng dữ liệu qua HTTP thật')

    const otherRes = await pool.query(`select id from auth.users where lower(coalesce(email, '')) <> 'dev@local.test' limit 1`)
    if (otherRes.rows.length) {
      const otherPartner = await pool.query(
        `insert into public.messaging_partners (owner_user_id, display_name, slug)
         values ($1::uuid, 'Other Shop S0.8', $2) returning id`,
        [otherRes.rows[0].id, `other-s0-8-${tag}`]
      )
      const forbidden = await fetch(`${BASE}/api/messaging/partners/${otherPartner.rows[0].id}/revenue-analytics`)
      assert(forbidden.status === 403, `dev user không sở hữu shop khác phải 403, thực tế ${forbidden.status}`)
      await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [otherPartner.rows[0].id])
      console.log('OK admin API chặn đúng cách ly quyền theo tenant (403)')
    }

    const pageRes = await fetch(`${BASE}/dashboard/messaging/analytics`, { redirect: 'manual' })
    assert(pageRes.status === 200 || pageRes.status === 302 || pageRes.status === 307, `trang analytics phải render hoặc redirect login, thực tế ${pageRes.status}`)
    console.log(`OK GET /dashboard/messaging/analytics render (status ${pageRes.status})`)

    console.log('\n✅ ALL S0.8 PHASE 2 (API + trang admin qua HTTP thật) CHECKS PASSED')
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

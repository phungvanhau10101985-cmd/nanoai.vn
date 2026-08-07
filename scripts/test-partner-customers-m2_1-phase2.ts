// Smoke test Phase 2 (M2.1): API admin /api/messaging/partners/{id}/customers qua HTTP thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-customers-m2_1-phase2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
  assert(ownerRes.rows.length, "cần user dev@local.test trong auth.users (dev bypass)")
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'M2.1 Phase2 Shop', $2) returning id`,
    [ownerId, `m2-1-p2-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const conv = await pool.query(
    `insert into public.customer_care_conversations (channel, external_thread_id, partner_id)
     values ('widget', $1, $2::uuid) returning id`,
    [`m2_1-p2-thread-${tag}`, partnerId]
  )
  const email = `khach-p2-${tag}@example.com`
  await pool.query(
    `insert into public.messaging_partner_orders (
      partner_id, conversation_id, status, shipping_status, customer_email, customer_name, customer_phone,
      subtotal_amount, amount_after_discount
    ) values ($1::uuid, $2::uuid, 'paid_verified', 'delivered', $3, 'Khách P2', '0911111111', 700000, 700000)`,
    [partnerId, conv.rows[0].id, email]
  )

  try {
    const res = await fetch(`${BASE}/api/messaging/partners/${partnerId}/customers`)
    assert(res.status === 200, `admin customers API status ${res.status}`)
    const json = (await res.json()) as { customers: Array<{ emailNormalized: string; totalSpent: number }>; total: number }
    assert(json.total === 1, `phải có đúng 1 khách hàng, thực tế ${json.total}`)
    assert(json.customers[0].emailNormalized === email.toLowerCase() && json.customers[0].totalSpent === 700000, `dữ liệu khách hàng sai: ${JSON.stringify(json.customers[0])}`)
    console.log('OK GET /api/messaging/partners/{id}/customers (admin, dev bypass) trả đúng dữ liệu qua HTTP thật')

    const noAuthPartner = await pool.query(
      `select id from auth.users where lower(coalesce(email, '')) <> 'dev@local.test' limit 1`
    )
    if (noAuthPartner.rows.length) {
      const otherPartner = await pool.query(
        `insert into public.messaging_partners (owner_user_id, display_name, slug)
         values ($1::uuid, 'Other Shop M2.1', $2) returning id`,
        [noAuthPartner.rows[0].id, `other-m2-1-${tag}`]
      )
      const forbiddenRes = await fetch(`${BASE}/api/messaging/partners/${otherPartner.rows[0].id}/customers`)
      assert(forbiddenRes.status === 403, `dev user không sở hữu shop khác phải 403, thực tế ${forbiddenRes.status}`)
      await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [otherPartner.rows[0].id])
      console.log('OK admin API chặn đúng cách ly quyền theo tenant (403)')
    }

    console.log('\n✅ ALL M2.1 PHASE 2 (admin API qua HTTP thật) CHECKS PASSED')
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

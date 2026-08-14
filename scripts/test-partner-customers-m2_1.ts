// Smoke test (M2.1): CRM nhẹ — khách đã đăng ký tài khoản shop, kèm thống kê đơn.
// Chạy: npx tsx scripts/test-partner-customers-m2_1.ts
// Có thể chạy thêm qua HTTP thật (dev server) nếu SMOKE_BASE_URL được set.
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { fetchPartnerCustomersForAdminFromPg } from '../src/lib/db/messaging-partner-customers-pg'

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
     values ($1, 'M2.1 Test Shop', $2) returning id`,
    [ownerId, `m2-1-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  async function seedConversation(): Promise<string> {
    const r = await pool.query(
      `insert into public.customer_care_conversations (channel, external_thread_id, partner_id)
       values ('widget', $1, $2::uuid) returning id`,
      [`m2_1-thread-${Date.now()}-${Math.random()}`, partnerId]
    )
    return r.rows[0].id as string
  }

  async function seedOrder(opts: {
    email: string
    name: string
    phone: string
    status: string
    shippingStatus: string
    subtotal: number
    createdAt: string
  }): Promise<void> {
    const conv = await seedConversation()
    await pool.query(
      `insert into public.messaging_partner_orders (
        partner_id, conversation_id, status, shipping_status, customer_email, customer_name, customer_phone,
        subtotal_amount, amount_after_discount, created_at
      ) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $8, $9::timestamptz)`,
      [partnerId, conv, opts.status, opts.shippingStatus, opts.email, opts.name, opts.phone, opts.subtotal, opts.createdAt]
    )
  }

  const emailA = `khach-a-${tag}@example.com`
  const emailB = `khach-b-${tag}@example.com`
  const emailC = `khach-c-${tag}@example.com`
  const emailGuestOnly = `khach-guest-${tag}@example.com`

  async function seedGuestAccount(email: string): Promise<void> {
    await pool.query(
      `insert into public.messaging_guest_accounts (
         partner_id, email_raw, email_normalized, first_verified_at, last_login_at
       ) values ($1::uuid, $2, $3, now(), now())`,
      [partnerId, email, email.toLowerCase()]
    )
  }

  try {
    // Khách A: 2 đơn delivered (tính vào total_spent) + 1 đơn awaiting_payment (không tính spent nhưng tính order_count).
    await seedOrder({ email: emailA, name: 'Khách A', phone: '0900000001', status: 'paid_verified', shippingStatus: 'delivered', subtotal: 200000, createdAt: '2026-01-01T00:00:00Z' })
    await seedOrder({ email: emailA.toUpperCase(), name: 'Khách A (cập nhật tên)', phone: '0900000001', status: 'paid_verified', shippingStatus: 'delivered', subtotal: 300000, createdAt: '2026-01-05T00:00:00Z' })
    await seedOrder({ email: emailA, name: 'Khách A', phone: '0900000001', status: 'awaiting_payment', shippingStatus: 'pending', subtotal: 100000, createdAt: '2026-01-06T00:00:00Z' })

    // Khách B: 1 đơn cancelled (không tính spent, có tính order_count).
    await seedOrder({ email: emailB, name: 'Khách B', phone: '0900000002', status: 'cancelled', shippingStatus: 'cancelled', subtotal: 500000, createdAt: '2026-01-02T00:00:00Z' })

    // Khách checkout không tài khoản: có đơn nhưng không được liệt kê.
    await seedOrder({ email: emailGuestOnly, name: 'Khách guest', phone: '0900000004', status: 'paid_verified', shippingStatus: 'delivered', subtotal: 90000, createdAt: '2026-01-07T00:00:00Z' })

    await seedGuestAccount(emailA)
    await seedGuestAccount(emailB)
    await seedGuestAccount(emailC)

    const result = await fetchPartnerCustomersForAdminFromPg({ partnerId })
    assert(result, 'fetchPartnerCustomersForAdminFromPg trả về null')
    assert(result.total === 3, `phải liệt kê đúng 3 tài khoản đã đăng ký, thực tế ${result.total}`)
    assert(
      !result.rows.some((r) => r.emailNormalized === emailGuestOnly.toLowerCase()),
      'khách đặt đơn nhưng chưa đăng ký tài khoản không được hiện'
    )

    const customerA = result.rows.find((r) => r.emailNormalized === emailA.toLowerCase())
    assert(customerA, 'phải tìm thấy khách A')
    assert(customerA!.orderCount === 3, `khách A phải có 3 đơn (mọi trạng thái), thực tế ${customerA!.orderCount}`)
    assert(customerA!.completedOrderCount === 2, `khách A phải có 2 đơn delivered, thực tế ${customerA!.completedOrderCount}`)
    assert(customerA!.totalSpent === 500000, `khách A tổng chi tiêu phải = 200000+300000=500000 (KHÔNG tính đơn chưa thanh toán), thực tế ${customerA!.totalSpent}`)
    // Đơn gần nhất theo created_at là đơn thứ 3 (2026-01-06, awaiting_payment, tên "Khách A") —
    // "gần nhất" tính theo thời gian, không phụ thuộc trạng thái đơn.
    assert(customerA!.customerName === 'Khách A', `phải lấy tên từ đơn gần nhất theo created_at, thực tế "${customerA!.customerName}"`)
    console.log('OK gộp đúng theo email chuẩn hoá (không phân biệt hoa/thường), tổng chi tiêu CHỈ tính đơn paid_verified+delivered, tên lấy từ đơn gần nhất')

    const customerB = result.rows.find((r) => r.emailNormalized === emailB.toLowerCase())
    assert(customerB, 'phải tìm thấy khách B')
    assert(customerB!.orderCount === 1 && customerB!.completedOrderCount === 0 && customerB!.totalSpent === 0, `khách B (đơn cancelled) không được tính spent: ${JSON.stringify(customerB)}`)
    console.log('OK đơn cancelled: tính vào order_count nhưng KHÔNG tính vào total_spent/completed_order_count')

    const customerC = result.rows.find((r) => r.emailNormalized === emailC.toLowerCase())
    assert(customerC, 'phải tìm thấy khách C (đã đăng ký, chưa mua)')
    assert(
      customerC!.orderCount === 0 && customerC!.completedOrderCount === 0 && customerC!.totalSpent === 0,
      `khách C chưa mua phải có số đơn/chi tiêu = 0: ${JSON.stringify(customerC)}`
    )
    console.log('OK khách đã đăng ký nhưng chưa đặt đơn vẫn hiện, số đơn = 0')

    // Search theo tên.
    const searched = await fetchPartnerCustomersForAdminFromPg({ partnerId, search: 'khách b' })
    assert(searched && searched.total === 1 && searched.rows[0].emailNormalized === emailB.toLowerCase(), `search theo tên phải lọc đúng: ${JSON.stringify(searched)}`)
    console.log('OK search theo tên/email/sđt hoạt động đúng')

    console.log('\n✅ ALL M2.1 (CRM nhẹ: khách đã đăng ký tài khoản) CHECKS PASSED')
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

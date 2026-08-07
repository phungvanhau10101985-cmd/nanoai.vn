// Smoke test (M4.1): thông báo admin (đơn mới/khách hỏi/review mới) cho chủ shop.
// Chạy: npx tsx scripts/test-partner-admin-notifications-m4_1.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  notifyPartnerOwnerNewOrder,
  notifyPartnerOwnerNewQuestion,
  notifyPartnerOwnerNewReview,
} from '../src/lib/messaging/partner-admin-notifications'
import type { PartnerOrderRow } from '../src/lib/db/messaging-partner-orders-pg'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function fakeOrder(overrides: Partial<PartnerOrderRow>): PartnerOrderRow {
  return {
    id: 'order-fake-id', partner_id: '', conversation_id: '', external_thread_id: '',
    status: 'awaiting_payment', customer_name: 'Khách Test', customer_email: '', customer_phone: '',
    shipping_address: '', variant_color: '', variant_size: '', variant_image_urls: '', quantity: 1, note: '',
    product_inventory_id: null, product_name: 'Sản phẩm test', product_image_url: '', product_url: '',
    unit_price: 200000, subtotal_amount: 200000, loyalty_tier_code: '', loyalty_tier_name: '',
    loyalty_discount_percent: 0, loyalty_discount_amount: 0, birthday_discount_percent: 0,
    birthday_discount_amount: 0, total_discount_percent: 0, total_discount_amount: 0,
    amount_after_discount: 200000, deposit_percent: 30, required_amount: 60000, paid_amount: 0,
    currency: 'VND', payment_reference: '', payment_qr_url: '', verified_note: '', shipping_status: 'pending',
    created_at: '', updated_at: '', verified_at: null, locked_at: null, google_sheet_row: null,
    google_sheet_row_count: null, promo_id: null, promo_code: '', promo_discount_amount: 0,
    ...overrides,
  }
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'M4.1 Test Shop', $2) returning id`,
    [ownerId, `m4-1-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  async function latestNotificationFor(type: string): Promise<{ title: string; body: string; meta: Record<string, unknown> } | null> {
    const r = await pool.query(
      `select title, body, meta from public.notifications where user_id = $1::uuid and type = $2 order by created_at desc limit 1`,
      [ownerId, type]
    )
    return r.rows[0] ?? null
  }

  try {
    await notifyPartnerOwnerNewOrder(partnerId, fakeOrder({ partner_id: partnerId, customer_name: 'Nguyễn Văn A', subtotal_amount: 350000, amount_after_discount: 350000 }))
    const orderNotif = await latestNotificationFor('messaging_partner_new_order')
    assert(orderNotif, 'phải có thông báo đơn hàng mới cho chủ shop')
    assert(orderNotif!.body.includes('Nguyễn Văn A') && orderNotif!.body.includes('350.000đ'), `nội dung thông báo đơn hàng sai: ${JSON.stringify(orderNotif)}`)
    assert(orderNotif!.meta.push_url === `/dashboard/messaging/orders?partner=${partnerId}`, 'push_url phải trỏ đúng trang đơn hàng')
    console.log('OK notifyPartnerOwnerNewOrder: chủ shop nhận thông báo đúng nội dung + push_url')

    await notifyPartnerOwnerNewQuestion({ partnerId, askerName: 'Khách B', content: 'Sản phẩm này có size XL không ạ?' })
    const questionNotif = await latestNotificationFor('messaging_partner_new_question')
    assert(questionNotif && questionNotif.body.includes('Khách B') && questionNotif.body.includes('size XL'), `nội dung thông báo câu hỏi sai: ${JSON.stringify(questionNotif)}`)
    console.log('OK notifyPartnerOwnerNewQuestion: chủ shop nhận thông báo đúng nội dung')

    await notifyPartnerOwnerNewReview({ partnerId, reviewerName: 'Khách C', rating: 5, content: 'Sản phẩm rất tốt!' })
    const reviewNotif = await latestNotificationFor('messaging_partner_new_review')
    assert(reviewNotif && reviewNotif.title.includes('5') && reviewNotif.body.includes('Khách C'), `nội dung thông báo review sai: ${JSON.stringify(reviewNotif)}`)
    console.log('OK notifyPartnerOwnerNewReview: chủ shop nhận thông báo đúng nội dung + số sao')

    // Partner không có owner hợp lệ (uuid ngẫu nhiên) -> không throw, chỉ bỏ qua an toàn.
    await notifyPartnerOwnerNewOrder('00000000-0000-0000-0000-000000000000', fakeOrder({ partner_id: '00000000-0000-0000-0000-000000000000' }))
    console.log('OK partner không tồn tại: bỏ qua an toàn, không throw lỗi')

    console.log('\n✅ ALL M4.1 (thông báo admin đơn mới/khách hỏi/review mới) CHECKS PASSED')
  } finally {
    await pool.query(`delete from public.notifications where user_id = $1::uuid and meta->>'partner_id' = $2`, [ownerId, partnerId])
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partnerId])
    await pool.end()
  }
}

main().catch((e) => {
  console.error('\n❌ TEST FAILED:', e.message)
  process.exit(1)
})

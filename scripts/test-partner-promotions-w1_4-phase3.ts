// Smoke test Phase 3 (W1.4): tích hợp voucher vào checkout AI chat đơn lẻ (`completeOrderCheckout`)
// — nợ còn lại của Phase 6 đã ghi trong docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md.
// Gọi trực tiếp hàm nghiệp vụ (không qua HTTP) vì luồng tạo draft phụ thuộc AI product-pick.
// Chạy: npx tsx scripts/test-partner-promotions-w1_4-phase3.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { createOrderDraftFromProductPick, completeOrderCheckout } from '../src/lib/messaging/guest-chat-ordering'
import { insertPartnerPromotionFromPg } from '../src/lib/db/messaging-partner-promotions-pg'

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
     values ($1, 'W1.4 Phase3 Shop', $2) returning id`,
    [ownerId, `w1-4-p3-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_payment_settings (
       partner_id, bank_name, bank_bin, account_number, account_holder, default_deposit_mode, default_deposit_percent
     ) values ($1::uuid, 'Vietcombank', '970436', '0123456789', 'W14 P3 TEST SHOP', 'percent', 100)`,
    [partnerId]
  )

  const productUrl = `https://example.com/w14-p3-${tag}`
  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Sản phẩm test W1.4 P3', '800.000đ', 'https://placehold.co/200', $2, true)
     returning id`,
    [partnerId, productUrl]
  )
  const inventoryId = invRes.rows[0].id as string

  const guestRes = await pool.query(
    `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
     values ($1::uuid, $2, $2) returning id`,
    [partnerId, `w14-p3-buyer-${tag}@example.com`]
  )
  const guestAccountId = guestRes.rows[0].id as string

  const promo = await insertPartnerPromotionFromPg(partnerId, {
    code: 'p3chat15', name: 'Giảm 15% chat', discountType: 'percent', discountPercent: 15,
  })
  assert(promo.ok, `tạo voucher thất bại: ${JSON.stringify(promo)}`)

  try {
    const externalThreadId = `w1_4-p3-thread-${tag}`
    const draft = await createOrderDraftFromProductPick({
      partnerId,
      externalThreadId,
      customerName: 'Khách Chat P3',
      guestAccountId,
      card: {
        name: 'Sản phẩm test W1.4 P3',
        image_url: 'https://placehold.co/200',
        product_url: productUrl,
        price_hint: '800.000đ',
        inventory_id: inventoryId,
      },
    })
    assert(draft.ok, `tạo draft đơn chat thất bại: ${JSON.stringify(draft)}`)
    console.log('OK createOrderDraftFromProductPick: tạo draft đơn AI chat thành công')

    // Checkout KHÔNG mã — regression: hoạt động y hệt trước khi có W1.4.
    const noPromo = await completeOrderCheckout({
      partnerId,
      externalThreadId,
      orderId: draft.order.id,
      guestAccountId,
      form: {
        customerName: 'Khách Chat P3', customerEmail: `w14-p3-buyer-${tag}@example.com`,
        customerPhone: '0900000099', shippingAddress: '456 Chat Street', color: '', size: '', quantity: 1, note: '',
      },
    })
    assert('ok' in noPromo && noPromo.ok, `checkout chat không mã thất bại: ${JSON.stringify(noPromo)}`)
    const orderNoPromo = noPromo.ok ? noPromo.order : null
    assert(orderNoPromo!.promo_discount_amount === 0 && orderNoPromo!.promo_code === '', 'không mã thì promo fields phải rỗng/0')
    assert(orderNoPromo!.required_amount === 800000, `deposit 100% không mã -> required_amount phải = 800000, thực tế ${orderNoPromo!.required_amount}`)
    console.log('OK REGRESSION: checkout AI chat đơn lẻ KHÔNG mã hoạt động y hệt trước đây')

    // Draft thứ 2 cho lần checkout CÓ mã (đơn đầu đã lock sau checkout, không sửa lại được).
    const draft2 = await createOrderDraftFromProductPick({
      partnerId,
      externalThreadId: `${externalThreadId}-2`,
      customerName: 'Khách Chat P3',
      guestAccountId,
      card: {
        name: 'Sản phẩm test W1.4 P3', image_url: 'https://placehold.co/200', product_url: productUrl,
        price_hint: '800.000đ', inventory_id: inventoryId,
      },
    })
    assert(draft2.ok, 'tạo draft đơn chat thứ 2 thất bại')

    const withPromo = await completeOrderCheckout({
      partnerId,
      externalThreadId: `${externalThreadId}-2`,
      orderId: draft2.order.id,
      guestAccountId,
      form: {
        customerName: 'Khách Chat P3', customerEmail: `w14-p3-buyer-${tag}@example.com`,
        customerPhone: '0900000099', shippingAddress: '456 Chat Street', color: '', size: '', quantity: 1, note: '',
        promoCode: 'p3chat15',
      },
    })
    assert('ok' in withPromo && withPromo.ok, `checkout chat với mã thất bại: ${JSON.stringify(withPromo)}`)
    const orderWithPromo = withPromo.ok ? withPromo.order : null
    assert(orderWithPromo!.promo_code === 'P3CHAT15', `promo_code phải lưu đúng, thực tế "${orderWithPromo!.promo_code}"`)
    assert(orderWithPromo!.promo_discount_amount === 120000, `promo_discount_amount phải = 15% * 800000 = 120000, thực tế ${orderWithPromo!.promo_discount_amount}`)
    assert(orderWithPromo!.amount_after_discount === 680000, `amount_after_discount phải = 680000, thực tế ${orderWithPromo!.amount_after_discount}`)
    assert(orderWithPromo!.required_amount === 680000, `deposit 100% có mã -> required_amount phải = 680000, thực tế ${orderWithPromo!.required_amount}`)
    console.log('OK checkout AI chat đơn lẻ VỚI mã: promo_discount_amount/amount_after_discount/required_amount tính đúng')

    console.log('\n✅ ALL W1.4 PHASE 3 (tích hợp voucher vào checkout AI chat đơn lẻ) CHECKS PASSED')
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

// Smoke test (W1.7): phí ship + phương thức thanh toán (COD/chuyển khoản/ví điện tử) + hoàn tiền.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-w1_7-shipping-ewallet-refund.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  fetchPartnerPaymentSettingsFromPg,
  upsertPartnerPaymentSettingsFromPg,
  updatePartnerOrderRefundForOwnerFromPg,
} from '../src/lib/db/messaging-partner-orders-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

function guestHeaders(accountId: string): Record<string, string> {
  return { 'x-guest-account-id': accountId, 'Content-Type': 'application/json' }
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
  assert(ownerRes.rows.length, "cần user dev@local.test trong auth.users (dev bypass)")
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const partnerSlug = `w1-7-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'W1.7 Test Shop', $2) returning id`,
    [ownerId, partnerSlug]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_payment_settings (
       partner_id, bank_name, bank_bin, account_number, account_holder, default_deposit_mode, default_deposit_percent
     ) values ($1::uuid, 'Vietcombank', '970436', '0123456789', 'W17 TEST SHOP', 'percent', 100)`,
    [partnerId]
  )

  const productUrl = `https://example.com/w17-${tag}`
  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Sản phẩm test W1.7', '1.000.000đ', 'https://placehold.co/200', $2, true)
     returning id`,
    [partnerId, productUrl]
  )
  const inventoryId = invRes.rows[0].id as string

  async function seedGuestAccount(emailTag: string): Promise<string> {
    const r = await pool.query(
      `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
       values ($1::uuid, $2, $2) returning id`,
      [partnerId, `${emailTag}-${tag}@example.com`]
    )
    return r.rows[0].id as string
  }

  console.log('Seed OK. partnerSlug =', partnerSlug, ' inventoryId =', inventoryId)

  try {
    // 1) DB layer — upsert + fetch round-trip cho cột shipping/ewallet mới.
    const upserted = await upsertPartnerPaymentSettingsFromPg({
      partnerId,
      bankName: 'Vietcombank',
      bankBin: '970436',
      accountNumber: '0123456789',
      accountHolder: 'W17 TEST SHOP',
      defaultDepositPercent: 100,
      defaultDepositMode: 'percent',
      notifyEmail: '',
      requirePaymentProof: true,
      shippingFeeAmount: 20000,
      shippingFreeThresholdAmount: 2000000,
      ewalletEnabled: true,
      ewalletProviderLabel: 'Momo',
      ewalletAccountName: 'SHOP TEST',
      ewalletAccountNumber: '0909000000',
      ewalletQrUrl: 'https://placehold.co/300x300?text=ewallet-qr',
    })
    assert(upserted, 'upsertPartnerPaymentSettingsFromPg thất bại')
    const settings = await fetchPartnerPaymentSettingsFromPg(partnerId)
    assert(settings?.shipping_fee_amount === 20000, `shipping_fee_amount phải = 20000, thực tế ${settings?.shipping_fee_amount}`)
    assert(
      settings?.shipping_free_threshold_amount === 2000000,
      `shipping_free_threshold_amount phải = 2000000, thực tế ${settings?.shipping_free_threshold_amount}`
    )
    assert(settings?.ewallet_enabled === true, 'ewallet_enabled phải = true')
    assert(settings?.ewallet_qr_url === 'https://placehold.co/300x300?text=ewallet-qr', 'ewallet_qr_url phải khớp')
    console.log('OK upsertPartnerPaymentSettingsFromPg/fetchPartnerPaymentSettingsFromPg: round-trip đúng cột shipping/ewallet')

    async function cartCheckout(input: {
      guestAccountId: string
      quantity: number
      paymentMethod?: string
    }): Promise<{ status: number; json: Record<string, unknown> }> {
      const card = {
        name: 'Sản phẩm test W1.7',
        image_url: 'https://placehold.co/200',
        product_url: productUrl,
        price_hint: '1.000.000đ',
        inventory_id: inventoryId,
      }
      const putRes = await fetch(`${BASE}/api/messaging/guest/${partnerSlug}/cart`, {
        method: 'PUT',
        headers: guestHeaders(input.guestAccountId),
        body: JSON.stringify({ items: [{ id: crypto.randomUUID(), card, quantity: input.quantity, color: '', size: '', note: '' }] }),
      })
      assert(putRes.status === 200, `PUT cart thất bại: ${putRes.status}`)

      const checkoutRes = await fetch(`${BASE}/api/messaging/guest/${partnerSlug}/order`, {
        method: 'PATCH',
        headers: guestHeaders(input.guestAccountId),
        body: JSON.stringify({
          action: 'cart_checkout',
          form: {
            customerName: 'Khách Test W1.7',
            customerPhone: '0900000000',
            shippingAddress: '123 Test Street',
            note: '',
            ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
          },
          items: [{ card, quantity: input.quantity, color: '', size: '', note: '' }],
        }),
      })
      const json = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>
      return { status: checkoutRes.status, json }
    }

    // 2) Checkout dưới ngưỡng free-ship (subtotal 1.000.000 < 2.000.000) — phải thu phí ship + mặc định bank_transfer.
    const buyer1 = await seedGuestAccount('w17-p1')
    const r1 = await cartCheckout({ guestAccountId: buyer1, quantity: 1 })
    assert(r1.status === 200, `checkout buyer1 thất bại: ${JSON.stringify(r1.json)}`)
    const order1 = (r1.json as { order: Record<string, unknown> }).order
    assert(Number(order1.shipping_fee_amount) === 20000, `shipping_fee_amount phải = 20000, thực tế ${order1.shipping_fee_amount}`)
    assert(order1.payment_method === 'bank_transfer', `payment_method mặc định phải = bank_transfer, thực tế ${order1.payment_method}`)
    assert(Number(order1.amount_after_discount) === 1000000, `amount_after_discount KHÔNG được cộng ship, phải = 1000000, thực tế ${order1.amount_after_discount}`)
    console.log('OK checkout dưới ngưỡng free-ship: thu đúng phí ship, KHÔNG cộng vào amount_after_discount (giữ nguyên cơ sở tính cọc/doanh thu)')

    // 3) Checkout chọn ewallet (có cọc) — payment_method=ewallet, QR = ewallet_qr_url đã cấu hình.
    const buyer2 = await seedGuestAccount('w17-p2')
    const r2 = await cartCheckout({ guestAccountId: buyer2, quantity: 1, paymentMethod: 'ewallet' })
    assert(r2.status === 200, `checkout buyer2 (ewallet) thất bại: ${JSON.stringify(r2.json)}`)
    const order2 = (r2.json as { order: Record<string, unknown> }).order
    assert(order2.payment_method === 'ewallet', `payment_method phải = ewallet, thực tế ${order2.payment_method}`)
    assert(order2.payment_qr_url === 'https://placehold.co/300x300?text=ewallet-qr', `QR phải là ảnh ewallet đã cấu hình, thực tế ${order2.payment_qr_url}`)
    console.log('OK checkout chọn ví điện tử: payment_method=ewallet + QR đúng ảnh merchant tự cấu hình (không sinh QR ngân hàng)')

    // 4) Checkout đạt ngưỡng free-ship (subtotal 3.000.000 >= 2.000.000) — miễn phí ship.
    const buyer3 = await seedGuestAccount('w17-p3')
    const r3 = await cartCheckout({ guestAccountId: buyer3, quantity: 3 })
    assert(r3.status === 200, `checkout buyer3 thất bại: ${JSON.stringify(r3.json)}`)
    const order3 = (r3.json as { order: Record<string, unknown> }).order
    assert(Number(order3.shipping_fee_amount) === 0, `đạt ngưỡng free-ship thì shipping_fee_amount phải = 0, thực tế ${order3.shipping_fee_amount}`)
    console.log('OK checkout đạt ngưỡng free-ship: miễn phí vận chuyển đúng như cấu hình')

    // 5) REGRESSION — shop KHÔNG cấu hình ship/ewallet vẫn hoạt động y hệt trước W1.7.
    const partner2Res = await pool.query(
      `insert into public.messaging_partners (owner_user_id, display_name, slug) values ($1::uuid, 'W1.7 Regression Shop', $2) returning id`,
      [ownerId, `w1-7-regress-${tag}`]
    )
    const partner2Id = partner2Res.rows[0].id as string
    await pool.query(
      `insert into public.messaging_partner_payment_settings (partner_id, bank_name, bank_bin, account_number, account_holder, default_deposit_mode, default_deposit_percent)
       values ($1::uuid, 'Vietcombank', '970436', '0999999999', 'REGRESS SHOP', 'percent', 100)`,
      [partner2Id]
    )
    const productUrl2 = `https://example.com/w17-regress-${tag}`
    const invRes2 = await pool.query(
      `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
       values ($1::uuid, 'SP Regression', '500.000đ', 'https://placehold.co/200', $2, true) returning id`,
      [partner2Id, productUrl2]
    )
    const inventoryId2 = invRes2.rows[0].id as string
    const regressGuestRes = await pool.query(
      `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized) values ($1::uuid, $2, $2) returning id`,
      [partner2Id, `w17-regress-${tag}@example.com`]
    )
    const regressGuestId = regressGuestRes.rows[0].id as string
    const partner2Slug = `w1-7-regress-${tag}`
    const putRegress = await fetch(`${BASE}/api/messaging/guest/${partner2Slug}/cart`, {
      method: 'PUT',
      headers: guestHeaders(regressGuestId),
      body: JSON.stringify({
        items: [
          {
            id: crypto.randomUUID(),
            card: { name: 'SP Regression', image_url: 'https://placehold.co/200', product_url: productUrl2, price_hint: '500.000đ', inventory_id: inventoryId2 },
            quantity: 1, color: '', size: '', note: '',
          },
        ],
      }),
    })
    assert(putRegress.status === 200, 'PUT cart regression thất bại')
    const checkoutRegress = await fetch(`${BASE}/api/messaging/guest/${partner2Slug}/order`, {
      method: 'PATCH',
      headers: guestHeaders(regressGuestId),
      body: JSON.stringify({
        action: 'cart_checkout',
        form: { customerName: 'Khách Regression', customerPhone: '0911111111', shippingAddress: 'Test', note: '' },
        items: [{ card: { name: 'SP Regression', image_url: 'https://placehold.co/200', product_url: productUrl2, price_hint: '500.000đ', inventory_id: inventoryId2 }, quantity: 1, color: '', size: '', note: '' }],
      }),
    })
    const checkoutRegressText = await checkoutRegress.text()
    assert(checkoutRegress.status === 200, `checkout regression thất bại: ${checkoutRegressText}`)
    const orderRegress = (JSON.parse(checkoutRegressText) as { order: Record<string, unknown> }).order
    assert(Number(orderRegress.shipping_fee_amount) === 0, `shop chưa cấu hình ship -> shipping_fee_amount phải = 0, thực tế ${orderRegress.shipping_fee_amount}`)
    assert(orderRegress.payment_method === 'bank_transfer', `shop chưa bật ewallet -> payment_method phải fallback bank_transfer, thực tế ${orderRegress.payment_method}`)
    assert(Number(orderRegress.required_amount) === 500000, `required_amount phải = 500000 y hệt trước W1.7, thực tế ${orderRegress.required_amount}`)
    console.log('OK REGRESSION: shop chưa cấu hình ship/ewallet — checkout hoạt động y hệt trước W1.7 (shipping_fee=0, payment_method=bank_transfer, required_amount không đổi)')
    await pool.query(`delete from public.customer_care_conversations where partner_id = $1::uuid`, [partner2Id])
    await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [partner2Id])

    // 6) Admin — hoàn tiền thủ công.
    const refunded = await updatePartnerOrderRefundForOwnerFromPg({
      ownerUserId: ownerId,
      orderId: String(order1.id),
      refundStatus: 'refunded',
      refundAmount: 20000,
      refundNote: 'Hoàn phí ship do giao trễ',
    })
    assert(refunded, 'updatePartnerOrderRefundForOwnerFromPg thất bại')
    assert(refunded!.refund_status === 'refunded', `refund_status phải = refunded, thực tế ${refunded!.refund_status}`)
    assert(refunded!.refund_amount === 20000, `refund_amount phải = 20000, thực tế ${refunded!.refund_amount}`)
    assert(refunded!.refunded_at !== null, 'refunded_at phải được set')
    console.log('OK updatePartnerOrderRefundForOwnerFromPg: đánh dấu hoàn tiền đúng (status/amount/refunded_at)')

    console.log('\n✅ ALL W1.7 (shipping fee / payment method / e-wallet / refund) CHECKS PASSED')
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

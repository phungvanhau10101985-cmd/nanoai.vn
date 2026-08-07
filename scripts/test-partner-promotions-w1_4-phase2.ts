// Smoke test Phase 2 (W1.4): checkout thật qua HTTP (giỏ hàng + mã giảm giá) — kiểm tra KHÔNG hồi
// quy hành vi checkout cũ (không mã) và tính đúng khi có mã, cộng admin CRUD + validate API.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-promotions-w1_4-phase2.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'

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
  assert(ownerRes.rows.length, "cần user dev@local.test trong auth.users (dev bypass) để test admin API")
  const ownerId = ownerRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const partnerSlug = `w1-4-p2-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1::uuid, 'W1.4 Phase2 Shop', $2) returning id`,
    [ownerId, partnerSlug]
  )
  const partnerId = partnerRes.rows[0].id as string

  // Deposit 100% + bank info giả (chỉ build URL QR local, không gọi API ngân hàng thật) để required_amount
  // phản ánh trực tiếp payableSubtotal — dễ kiểm tra promo giảm đúng vào required_amount.
  await pool.query(
    `insert into public.messaging_partner_payment_settings (
       partner_id, bank_name, bank_bin, account_number, account_holder, default_deposit_mode, default_deposit_percent
     ) values ($1::uuid, 'Vietcombank', '970436', '0123456789', 'W14 TEST SHOP', 'percent', 100)`,
    [partnerId]
  )

  const productUrl = `https://example.com/w14-p2-${tag}`
  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Sản phẩm test W1.4 P2', '1.000.000đ', 'https://placehold.co/200', $2, true)
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

  const buyerNoPromo = await seedGuestAccount('p2-no-promo')
  const buyerWithPromo = await seedGuestAccount('p2-with-promo')

  console.log('Seed OK. partnerSlug =', partnerSlug, ' inventoryId =', inventoryId)

  try {
    // 0) Tạo voucher qua admin API (M2.2) — dev bypass, không cần cookie.
    const createRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'p2test10', name: 'Giảm 10% test P2', discountType: 'percent', discountPercent: 10, perUserLimit: 1,
      }),
    })
    assert(createRes.status === 200, `tạo voucher qua admin API thất bại: ${createRes.status}`)
    const createJson = (await createRes.json()) as { promotion: { id: string; code: string } }
    assert(createJson.promotion.code === 'P2TEST10', 'code phải tự uppercase')
    console.log('OK POST admin promotions: tạo voucher qua HTTP thật')

    async function cartCheckout(input: {
      guestAccountId: string
      promoCode?: string
    }): Promise<{ status: number; json: Record<string, unknown> }> {
      // Thêm sản phẩm vào giỏ.
      const putRes = await fetch(`${BASE}/api/messaging/guest/${partnerSlug}/cart`, {
        method: 'PUT',
        headers: guestHeaders(input.guestAccountId),
        body: JSON.stringify({
          items: [
            {
              id: crypto.randomUUID(),
              card: {
                name: 'Sản phẩm test W1.4 P2',
                image_url: 'https://placehold.co/200',
                product_url: productUrl,
                price_hint: '1.000.000đ',
                inventory_id: inventoryId,
              },
              quantity: 1,
              color: '',
              size: '',
              note: '',
            },
          ],
        }),
      })
      assert(putRes.status === 200, `PUT cart thất bại: ${putRes.status}`)

      const checkoutRes = await fetch(`${BASE}/api/messaging/guest/${partnerSlug}/order`, {
        method: 'PATCH',
        headers: guestHeaders(input.guestAccountId),
        body: JSON.stringify({
          action: 'cart_checkout',
          form: {
            customerName: 'Khách Test P2',
            customerPhone: '0900000000',
            shippingAddress: '123 Test Street',
            note: '',
            ...(input.promoCode ? { promoCode: input.promoCode } : {}),
          },
          items: [
            {
              card: {
                name: 'Sản phẩm test W1.4 P2',
                image_url: 'https://placehold.co/200',
                product_url: productUrl,
                price_hint: '1.000.000đ',
                inventory_id: inventoryId,
              },
              quantity: 1,
              color: '',
              size: '',
              note: '',
            },
          ],
        }),
      })
      const json = (await checkoutRes.json().catch(() => ({}))) as Record<string, unknown>
      return { status: checkoutRes.status, json }
    }

    // 2) REGRESSION: checkout KHÔNG mã — phải hoạt động y hệt trước khi có W1.4.
    const noPromoResult = await cartCheckout({ guestAccountId: buyerNoPromo })
    assert(noPromoResult.status === 200, `checkout không mã thất bại: ${JSON.stringify(noPromoResult.json)}`)
    const orderNoPromo = (noPromoResult.json as { order: Record<string, unknown> }).order
    assert(Number(orderNoPromo.subtotal_amount) === 1000000, `subtotal phải = 1000000, thực tế ${orderNoPromo.subtotal_amount}`)
    assert(Number(orderNoPromo.promo_discount_amount) === 0, `không mã thì promo_discount_amount phải = 0, thực tế ${orderNoPromo.promo_discount_amount}`)
    assert(orderNoPromo.promo_code === '', `không mã thì promo_code phải rỗng, thực tế "${orderNoPromo.promo_code}"`)
    assert(Number(orderNoPromo.required_amount) === 1000000, `deposit 100% không mã -> required_amount phải = 1000000, thực tế ${orderNoPromo.required_amount}`)
    assert(Number(orderNoPromo.amount_after_discount) === 1000000, `không mã thì amount_after_discount = subtotal, thực tế ${orderNoPromo.amount_after_discount}`)
    console.log('OK REGRESSION: checkout không mã giảm giá hoạt động y hệt trước đây (subtotal/required_amount/amount_after_discount đúng)')

    // 3) Checkout VỚI mã hợp lệ — giảm đúng 10%, required_amount giảm tương ứng (deposit 100%).
    const withPromoResult = await cartCheckout({ guestAccountId: buyerWithPromo, promoCode: 'p2test10' })
    assert(withPromoResult.status === 200, `checkout với mã thất bại: ${JSON.stringify(withPromoResult.json)}`)
    const orderWithPromo = (withPromoResult.json as { order: Record<string, unknown> }).order
    assert(Number(orderWithPromo.promo_discount_amount) === 100000, `promo_discount_amount phải = 100000 (10% của 1tr), thực tế ${orderWithPromo.promo_discount_amount}`)
    assert(orderWithPromo.promo_code === 'P2TEST10', `promo_code phải lưu đúng, thực tế "${orderWithPromo.promo_code}"`)
    assert(Number(orderWithPromo.amount_after_discount) === 900000, `amount_after_discount phải = 900000, thực tế ${orderWithPromo.amount_after_discount}`)
    assert(Number(orderWithPromo.required_amount) === 900000, `deposit 100% có mã -> required_amount phải = 900000, thực tế ${orderWithPromo.required_amount}`)
    console.log('OK checkout với mã giảm giá: promo_discount_amount/amount_after_discount/required_amount tính đúng qua HTTP thật')

    // 4) used_count tăng đúng qua admin API sau khi checkout thật thành công.
    const adminListRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/promotions`)
    const adminListJson = (await adminListRes.json()) as { promotions: Array<{ code: string; usedCount: number }> }
    const p2 = adminListJson.promotions.find((p) => p.code === 'P2TEST10')
    assert(p2 && p2.usedCount === 1, `used_count phải = 1 sau 1 lần checkout thành công, thực tế ${p2?.usedCount}`)
    console.log('OK used_count tăng đúng sau checkout thật (ghi nhận qua recordPromotionUsageFromPg)')

    // 5) per_user_limit=1 -> khách đã dùng thử checkout lại với cùng mã phải bị chặn ở bước checkout.
    const putAgain = await fetch(`${BASE}/api/messaging/guest/${partnerSlug}/cart`, {
      method: 'PUT',
      headers: guestHeaders(buyerWithPromo),
      body: JSON.stringify({
        items: [
          {
            id: crypto.randomUUID(),
            card: { name: 'Sản phẩm test W1.4 P2', image_url: 'https://placehold.co/200', product_url: productUrl, price_hint: '1.000.000đ', inventory_id: inventoryId },
            quantity: 1, color: '', size: '', note: '',
          },
        ],
      }),
    })
    assert(putAgain.status === 200, 'PUT cart lần 2 thất bại')
    const secondAttempt = await cartCheckout({ guestAccountId: buyerWithPromo, promoCode: 'p2test10' })
    assert(secondAttempt.status === 400, `dùng lại mã (per_user_limit=1) phải bị chặn 400, thực tế ${secondAttempt.status}`)
    assert(
      String(secondAttempt.json.error ?? '').includes('per_user_limit_reached'),
      `lỗi phải là per_user_limit_reached, thực tế: ${JSON.stringify(secondAttempt.json)}`
    )
    console.log('OK backend chặn đúng khi dùng lại mã vượt per_user_limit (không tin client, tính lại từ đầu)')

    console.log('\n✅ ALL W1.4 PHASE 2 (checkout thật qua HTTP + regression an toàn) CHECKS PASSED')
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

// Smoke test (W5.4): API ví quà công khai /api/site/{slug}/promotions/wallet qua HTTP thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-promotions-w5_4-wallet.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { grantPromotionToCustomerFromPg, insertPartnerPromotionFromPg } from '../src/lib/db/messaging-partner-promotions-pg'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const siteSlug = `w5-4-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W5.4 Test Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'W5.4 Test Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  const guestRes = await pool.query(
    `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
     values ($1::uuid, $2, $2) returning id`,
    [partnerId, `w54-buyer-${tag}@example.com`]
  )
  const guestAccountId = guestRes.rows[0].id as string
  const inventoryRes = await pool.query(
    `insert into public.messaging_partner_inventory
       (partner_id, name, price_hint, price_amount, image_url, product_url, is_active)
     values ($1::uuid, 'Quote test product', '1.000.000đ', 1000000,
             'https://placehold.co/200', $2, true)
     returning id::text`,
    [partnerId, `https://example.com/quote-${tag}`]
  )
  const inventoryId = String(inventoryRes.rows[0].id)

  try {
    // Không đăng nhập -> ví rỗng (không lỗi, đúng như 188: khách vãng lai không có ví).
    const anonRes = await fetch(`${BASE}/api/site/${siteSlug}/promotions/wallet`)
    assert(anonRes.status === 200, `anon wallet status ${anonRes.status}`)
    const anonJson = (await anonRes.json()) as { vouchers: unknown[] }
    assert(Array.isArray(anonJson.vouchers) && anonJson.vouchers.length === 0, 'khách chưa đăng nhập phải có ví rỗng')
    console.log('OK GET wallet không đăng nhập -> ví rỗng, không lỗi')

    const promo = await insertPartnerPromotionFromPg(partnerId, {
      code: 'GIFT50', name: 'Quà tặng 50k', discountType: 'fixed_amount', discountAmount: 50000, isPublicRedeemable: false,
    })
    assert(promo.ok, 'tạo voucher thất bại')
    const grant = await grantPromotionToCustomerFromPg({
      partnerId, promotionId: promo.row.id, guestAccountId, source: 'admin_gift', validDays: 30,
    })
    assert(grant, 'cấp voucher vào ví thất bại')

    const walletRes = await fetch(`${BASE}/api/site/${siteSlug}/promotions/wallet`, {
      headers: { 'x-guest-account-id': guestAccountId },
    })
    assert(walletRes.status === 200, `wallet status ${walletRes.status}`)
    const walletJson = (await walletRes.json()) as { vouchers: Array<{ code: string; discountAmount: number }> }
    assert(walletJson.vouchers.length === 1 && walletJson.vouchers[0].code === 'GIFT50', `ví phải có đúng 1 voucher GIFT50: ${JSON.stringify(walletJson)}`)
    assert(walletJson.vouchers[0].discountAmount === 50000, 'discountAmount phải đúng 50000')
    console.log('OK GET wallet đã đăng nhập -> hiện đúng voucher đã được tặng qua HTTP thật')

    const quoteRes = await fetch(`${BASE}/api/site/${siteSlug}/cart/quote`, {
      method: 'POST',
      headers: { 'x-guest-account-id': guestAccountId, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        promoCode: 'GIFT50',
        lines: [{
          lineId: 'line-1',
          inventoryId,
          quantity: 1,
          fallbackUnitPrice: 1_000_000,
        }],
      }),
    })
    assert(quoteRes.status === 200, `cart quote status ${quoteRes.status}`)
    const quoteJson = (await quoteRes.json()) as {
      promo?: { code?: string; discountAmount?: number }
      breakdown?: { voucherDiscountAmount?: number; amountAfterDiscount?: number }
      lines?: Array<{ lineId?: string; effectiveUnitPrice?: number }>
    }
    assert(quoteJson.promo?.code === 'GIFT50', `quote phải áp GIFT50: ${JSON.stringify(quoteJson)}`)
    assert(quoteJson.breakdown?.voucherDiscountAmount === 50_000, 'quote phải giảm voucher 50.000đ')
    assert(quoteJson.breakdown?.amountAfterDiscount === 950_000, 'quote phải còn 950.000đ')
    assert(quoteJson.lines?.[0]?.lineId === 'line-1', 'quote phải giữ đúng lineId cho UI')
    console.log('OK POST cart quote -> định giá server + voucher wallet đúng trước checkout')

    const browserPauseMs = Math.max(0, Number(process.env.SMOKE_BROWSER_PAUSE_MS) || 0)
    if (browserPauseMs > 0) {
      console.log(`BROWSER_FIXTURE site=${siteSlug} partner=${siteSlug}-partner inventory=${inventoryId}`)
      await new Promise((resolve) => setTimeout(resolve, browserPauseMs))
    }

    console.log('\n✅ ALL W5.4 (ví quà công khai) CHECKS PASSED')
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

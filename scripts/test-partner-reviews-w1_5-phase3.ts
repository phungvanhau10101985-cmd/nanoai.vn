// Smoke test Phase 3 (W1.5/M1.2/M1.3): admin API + PDP render (JSON-LD aggregateRating + Q&A UI) qua dev server thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-reviews-w1_5-phase3.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import { buildPartnerSiteProductKey } from '../src/lib/partner-website/shop/partner-site-product-slug'

const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const pool = getPgPool()
  // Local dev bypass auth (`isAuthRequired()===false`) dùng user `dev@local.test` — không cookie/JWT
  // cần thiết cho request tới API admin khi chạy dev server ở localhost (xem src/lib/auth.ts).
  const devUserRes = await pool.query(`select id from auth.users where lower(email) = 'dev@local.test' limit 1`)
  assert(devUserRes.rows.length, 'cần user dev@local.test trong auth.users (dev bypass) để test admin API')
  const ownerId = devUserRes.rows[0].id as string

  const tag = Date.now().toString(36)
  const siteSlug = `w1-5-p3-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W1.5 Phase3 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale, is_published)
     values ($1::uuid, $2, 'W1.5 Phase3 Shop', 'vi', true)`,
    [partnerId, siteSlug]
  )

  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Áo khoác test P3', '350.000đ', 'https://placehold.co/400', 'https://example.com/p', true)
     returning id`,
    [partnerId]
  )
  const inventoryId = invRes.rows[0].id as string
  const canonicalKey = buildPartnerSiteProductKey('Áo khoác test P3', inventoryId)

  const guestA = (
    await pool.query(
      `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
       values ($1::uuid, $2, $2) returning id`,
      [partnerId, `p3-buyer-a-${tag}@example.com`]
    )
  ).rows[0].id as string

  const convRes = await pool.query(
    `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
     values ('widget', $1, $2::uuid, $3::uuid) returning id`,
    [`w1_5-p3-thread-${Date.now()}`, guestA, partnerId]
  )
  const conversationId = convRes.rows[0].id as string
  const orderRes = await pool.query(
    `insert into public.messaging_partner_orders (partner_id, conversation_id, status, shipping_status)
     values ($1::uuid, $2::uuid, 'paid_verified', 'delivered') returning id`,
    [partnerId, conversationId]
  )
  const orderId = orderRes.rows[0].id as string
  await pool.query(
    `insert into public.messaging_partner_order_lines (order_id, product_inventory_id, product_name, unit_price, quantity, line_subtotal)
     values ($1::uuid, $2::uuid, 'Áo khoác test P3', 350000, 1, 350000)`,
    [orderId, inventoryId]
  )

  console.log('Seed OK. siteSlug =', siteSlug, ' inventoryId =', inventoryId)

  try {
    // Seed 1 review qua API công khai để có dữ liệu cho admin + JSON-LD.
    const reviewRes = await fetch(`${BASE}/api/site/${siteSlug}/products/${inventoryId}/reviews`, {
      method: 'POST',
      headers: { 'x-guest-account-id': guestA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 4, content: 'Áo ấm và đẹp, giao hàng nhanh', locale: 'vi' }),
    })
    assert(reviewRes.status === 200, `seed review status ${reviewRes.status}`)
    const reviewJson = (await reviewRes.json()) as { review: { id: string } }
    const reviewId = reviewJson.review.id

    const questionRes = await fetch(`${BASE}/api/site/${siteSlug}/products/${inventoryId}/questions`, {
      method: 'POST',
      headers: { 'x-guest-account-id': guestA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Áo có form rộng không?' }),
    })
    const questionJson = (await questionRes.json()) as { question: { id: string } }
    const questionId = questionJson.question.id

    // 1) PDP render — JSON-LD aggregateRating dùng dữ liệu review THẬT (S0.6 hoàn tất phần rating).
    const pdpRes = await fetch(`${BASE}/site/${siteSlug}/products/${canonicalKey}`)
    assert(pdpRes.status === 200, `PDP status ${pdpRes.status}`)
    const pdpHtml = await pdpRes.text()
    assert(pdpHtml.includes('"aggregateRating"'), 'PDP phải chứa JSON-LD aggregateRating')
    assert(pdpHtml.includes('"ratingValue":4'), `PDP phải chứa ratingValue=4 thật từ review: ${pdpHtml.match(/"ratingValue":[^,}]+/)?.[0]}`)
    assert(pdpHtml.includes('"reviewCount":1'), 'PDP phải chứa reviewCount=1 thật từ review')
    assert(pdpHtml.includes('Đánh giá sản phẩm'), 'PDP phải render section reviews (W1.5 UI)')
    console.log('OK PDP render kèm JSON-LD aggregateRating THẬT (rating=4, count=1) + section reviews/QA')

    // 2) Admin API (M1.2) — local dev bypass auth, không cần cookie.
    const adminListRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/reviews`)
    assert(adminListRes.status === 200, `admin reviews list status ${adminListRes.status}`)
    const adminListJson = (await adminListRes.json()) as { reviews: Array<{ id: string }>; total: number }
    assert(adminListJson.total === 1 && adminListJson.reviews[0].id === reviewId, 'admin phải thấy đúng 1 review vừa seed')
    console.log('OK GET /api/messaging/partners/{id}/reviews (admin) trả đúng dữ liệu')

    // 3) Admin inline auto-save (M1.2) — sửa merchantReply + ẩn review.
    const patchRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/reviews/${reviewId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantReply: 'Cảm ơn bạn đã mua hàng!', isActive: false }),
    })
    assert(patchRes.status === 200, `admin patch review status ${patchRes.status}`)
    const patchJson = (await patchRes.json()) as { review: { merchantReply: string; merchantReplyBy: string; isActive: boolean } }
    assert(patchJson.review.merchantReply === 'Cảm ơn bạn đã mua hàng!', 'merchant reply phải lưu đúng')
    assert(patchJson.review.merchantReplyBy === 'W1.5 Phase3 Shop', `merchantReplyBy phải mặc định = tên shop, thực tế: ${patchJson.review.merchantReplyBy}`)
    assert(patchJson.review.isActive === false, 'ẩn review phải lưu isActive=false')
    console.log('OK PATCH admin review: inline auto-save + merchantReplyBy mặc định = tên shop')

    // 4) Review vừa ẩn không còn hiện công khai.
    const publicAfterHideRes = await fetch(`${BASE}/api/site/${siteSlug}/products/${inventoryId}/reviews`)
    const publicAfterHideJson = (await publicAfterHideRes.json()) as { summary: { total: number } }
    assert(publicAfterHideJson.summary.total === 0, 'review ẩn (is_active=false) không được tính vào summary công khai')
    console.log('OK review bị admin ẩn -> biến mất khỏi rating summary + danh sách công khai')

    // 5) Admin Q&A (M1.3) — trả lời với vai trò shop (không cần điều kiện mua hàng).
    const adminAnswerRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/questions/${questionId}/answers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Dạ áo form rộng thoải mái ạ' }),
    })
    assert(adminAnswerRes.status === 200, `admin answer status ${adminAnswerRes.status}`)
    const adminAnswerJson = (await adminAnswerRes.json()) as { answer: { answerType: string; responderName: string } }
    assert(adminAnswerJson.answer.answerType === 'admin', 'câu trả lời admin phải có answerType=admin')
    assert(adminAnswerJson.answer.responderName === 'W1.5 Phase3 Shop', 'tên trả lời mặc định phải = tên shop')
    console.log('OK POST admin answer: trả lời với vai trò shop, tên mặc định = tên shop')

    // 6) Admin xoá review (M1.2 — xoá từng dòng).
    const deleteRes = await fetch(`${BASE}/api/messaging/partners/${partnerId}/reviews/${reviewId}`, {
      method: 'DELETE',
    })
    assert(deleteRes.status === 200, `admin delete review status ${deleteRes.status}`)
    console.log('OK DELETE admin review xoá từng dòng thành công')

    // 7) Partner khác (không phải chủ shop này) bị chặn 403 — cách ly quyền theo tenant.
    const otherOwnerRes = await pool.query(
      `select id from auth.users where lower(coalesce(email, '')) <> 'dev@local.test' limit 1`
    )
    if (otherOwnerRes.rows.length) {
      const otherOwnerId = otherOwnerRes.rows[0].id as string
      const otherPartnerRes = await pool.query(
        `insert into public.messaging_partners (owner_user_id, display_name, slug)
         values ($1::uuid, 'Other Owner Shop', $2) returning id`,
        [otherOwnerId, `other-owner-${tag}`]
      )
      const otherPartnerId = otherPartnerRes.rows[0].id as string
      const forbiddenRes = await fetch(`${BASE}/api/messaging/partners/${otherPartnerId}/reviews`)
      assert(forbiddenRes.status === 403, `dev user không sở hữu shop khác phải 403, thực tế ${forbiddenRes.status}`)
      await pool.query(`delete from public.messaging_partners where id = $1::uuid`, [otherPartnerId])
      console.log('OK admin API chặn đúng khi dev user không sở hữu shop (403 Permission denied)')
    } else {
      console.log('SKIP (7): không có user auth.users nào khác dev@local.test để test cách ly quyền')
    }

    console.log('\n✅ ALL W1.5 PHASE 3 (admin M1.2/M1.3 + PDP JSON-LD rating THẬT) CHECKS PASSED')
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

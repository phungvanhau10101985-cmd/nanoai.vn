// Smoke test Phase 2 (W1.5): API công khai /api/site/{slug}/products/{id}/reviews|questions qua dev server thật.
// Yêu cầu: dev server đang chạy tại http://localhost:3000 (npm run dev).
// Chạy: npx tsx scripts/test-partner-reviews-w1_5-phase2.ts
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
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id

  const tag = Date.now().toString(36)
  const siteSlug = `w1-5-p2-shop-${tag}`
  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'W1.5 Phase2 Shop', $2) returning id`,
    [ownerId, `${siteSlug}-partner`]
  )
  const partnerId = partnerRes.rows[0].id as string

  await pool.query(
    `insert into public.messaging_partner_websites (partner_id, site_slug, title, locale)
     values ($1::uuid, $2, 'W1.5 Phase2 Shop', 'vi')`,
    [partnerId, siteSlug]
  )

  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Giày sneaker test P2', '500.000đ', 'https://placehold.co/400', 'https://example.com/p', true)
     returning id`,
    [partnerId]
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

  async function seedOrder(opts: { guestAccountId: string; status: string; shippingStatus: string }): Promise<void> {
    const convRes = await pool.query(
      `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
       values ('widget', $1, $2::uuid, $3::uuid) returning id`,
      [`w1_5-p2-thread-${opts.guestAccountId}-${Date.now()}-${Math.random()}`, opts.guestAccountId, partnerId]
    )
    const conversationId = convRes.rows[0].id as string
    const orderRes = await pool.query(
      `insert into public.messaging_partner_orders (partner_id, conversation_id, status, shipping_status)
       values ($1::uuid, $2::uuid, $3, $4) returning id`,
      [partnerId, conversationId, opts.status, opts.shippingStatus]
    )
    const orderId = orderRes.rows[0].id as string
    await pool.query(
      `insert into public.messaging_partner_order_lines (order_id, product_inventory_id, product_name, unit_price, quantity, line_subtotal)
       values ($1::uuid, $2::uuid, 'Giày sneaker test P2', 500000, 1, 500000)`,
      [orderId, inventoryId]
    )
  }

  const buyerA = await seedGuestAccount('p2-buyer-a')
  await seedOrder({ guestAccountId: buyerA, status: 'paid_verified', shippingStatus: 'delivered' })
  const nonBuyer = await seedGuestAccount('p2-non-buyer')

  console.log('Seed OK. siteSlug =', siteSlug, ' inventoryId =', inventoryId)

  try {
    const basePath = `${BASE}/api/site/${siteSlug}/products/${inventoryId}`

    // 1) Không login -> 401 login_required khi gửi review.
    const noAuthRes = await fetch(`${basePath}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: 5, content: 'test' }),
    })
    assert(noAuthRes.status === 401, `chưa login phải 401, thực tế ${noAuthRes.status}`)
    console.log('OK POST reviews không login -> 401 login_required')

    // 2) Khách chưa mua hàng -> 403 not_eligible.
    const notEligibleRes = await fetch(`${basePath}/reviews`, {
      method: 'POST',
      headers: guestHeaders(nonBuyer),
      body: JSON.stringify({ rating: 5, content: 'Rất tốt' }),
    })
    assert(notEligibleRes.status === 403, `chưa mua hàng phải 403, thực tế ${notEligibleRes.status}`)
    console.log('OK POST reviews chưa mua hàng -> 403 not_eligible')

    // 3) Buyer A (đã mua, delivered) -> gửi review thành công, title tự sinh theo rating+locale.
    const reviewRes = await fetch(`${basePath}/reviews`, {
      method: 'POST',
      headers: guestHeaders(buyerA),
      body: JSON.stringify({ rating: 5, content: 'Giày rất đẹp và vừa chân!', imageUrls: ['https://example.com/r1.jpg'], locale: 'vi' }),
    })
    assert(reviewRes.status === 200, `buyer A phải review được, status ${reviewRes.status}`)
    const reviewJson = (await reviewRes.json()) as { ok: boolean; review: { id: string; title: string; imageUrls: string[] } }
    assert(reviewJson.ok, 'review phải ok=true')
    assert(reviewJson.review.title === 'Rất hài lòng với sản phẩm', `title tự sinh sai: ${reviewJson.review.title}`)
    assert(reviewJson.review.imageUrls.length === 1, 'ảnh review phải được lưu + trả về')
    console.log('OK POST reviews buyer đã mua (delivered) -> thành công, title tự sinh đúng locale vi')

    // 4) Gửi lần 2 -> 409 already_reviewed (enforce unique thật, không chỉ ẩn UI).
    const dupRes = await fetch(`${basePath}/reviews`, {
      method: 'POST',
      headers: guestHeaders(buyerA),
      body: JSON.stringify({ rating: 4, content: 'Review lần 2' }),
    })
    assert(dupRes.status === 409, `review trùng phải 409, thực tế ${dupRes.status}`)
    console.log('OK POST reviews lần 2 cùng khách -> 409 already_reviewed')

    // 5) GET reviews — rating summary thật + review hiện trong danh sách.
    const listRes = await fetch(`${basePath}/reviews`)
    assert(listRes.status === 200, `GET reviews status ${listRes.status}`)
    const listJson = (await listRes.json()) as {
      summary: { average: number; total: number }
      reviews: Array<{ id: string; usefulCount: number }>
    }
    assert(listJson.summary.total === 1 && listJson.summary.average === 5, `summary sai: ${JSON.stringify(listJson.summary)}`)
    assert(listJson.reviews.length === 1, 'phải có đúng 1 review công khai')
    console.log('OK GET reviews trả rating summary thật (avg=5, total=1)')

    // 6) Vote hữu ích — toggle.
    const reviewId = listJson.reviews[0].id
    const vote1 = await fetch(`${basePath}/reviews/${reviewId}/vote`, { method: 'POST', headers: guestHeaders(nonBuyer) })
    const vote1Json = (await vote1.json()) as { ok: boolean; voted: boolean; usefulCount: number }
    assert(vote1.status === 200 && vote1Json.voted === true && vote1Json.usefulCount === 1, `vote lần 1 sai: ${JSON.stringify(vote1Json)}`)
    const vote2 = await fetch(`${basePath}/reviews/${reviewId}/vote`, { method: 'POST', headers: guestHeaders(nonBuyer) })
    const vote2Json = (await vote2.json()) as { ok: boolean; voted: boolean; usefulCount: number }
    assert(vote2Json.voted === false && vote2Json.usefulCount === 0, `toggle lại phải bỏ vote: ${JSON.stringify(vote2Json)}`)
    console.log('OK POST reviews/{id}/vote toggle đúng qua HTTP thật')

    // 7) Q&A — hỏi không cần mua hàng (nonBuyer).
    const askRes = await fetch(`${basePath}/questions`, {
      method: 'POST',
      headers: guestHeaders(nonBuyer),
      body: JSON.stringify({ content: 'Sản phẩm này có size 40 không?' }),
    })
    assert(askRes.status === 200, `hỏi phải thành công (không cần mua hàng), status ${askRes.status}`)
    const askJson = (await askRes.json()) as { ok: boolean; question: { id: string } }
    console.log('OK POST questions: khách chưa mua hàng vẫn hỏi được (đúng hành vi C.2)')

    // 8) Trả lời buyer — nonBuyer (chưa mua) bị chặn, buyerA (đã mua) OK.
    const answerFailRes = await fetch(`${basePath}/questions/${askJson.question.id}/answers`, {
      method: 'POST',
      headers: guestHeaders(nonBuyer),
      body: JSON.stringify({ content: 'chắc là có' }),
    })
    assert(answerFailRes.status === 403, `chưa mua hàng phải bị chặn trả lời, status ${answerFailRes.status}`)
    const answerOkRes = await fetch(`${basePath}/questions/${askJson.question.id}/answers`, {
      method: 'POST',
      headers: guestHeaders(buyerA),
      body: JSON.stringify({ content: 'Có bạn nhé, mình mua vừa chân' }),
    })
    assert(answerOkRes.status === 200, `buyer đã mua phải trả lời được, status ${answerOkRes.status}`)
    console.log('OK POST questions/{id}/answers: enforce đúng điều kiện mua hàng qua HTTP thật')

    // 9) GET questions — câu hỏi + câu trả lời hiện đúng công khai.
    const qListRes = await fetch(`${basePath}/questions`)
    const qListJson = (await qListRes.json()) as { questions: Array<{ id: string; answers: Array<{ answerType: string }> }> }
    assert(qListJson.questions.length === 1, 'phải có đúng 1 câu hỏi công khai')
    assert(qListJson.questions[0].answers.length === 1, 'phải có đúng 1 câu trả lời (buyer)')
    console.log('OK GET questions trả đúng câu hỏi + câu trả lời qua HTTP thật')

    console.log('\n✅ ALL W1.5 PHASE 2 (public API HTTP thật) CHECKS PASSED')
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

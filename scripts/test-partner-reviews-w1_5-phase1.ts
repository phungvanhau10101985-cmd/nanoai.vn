// Smoke test Phase 1 (W1.5): DB layer cho đánh giá + hỏi đáp sản phẩm.
// Chạy: npx tsx scripts/test-partner-reviews-w1_5-phase1.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  checkAnyPurchaseFromPg,
  checkDeliveredPurchaseFromPg,
  deletePartnerProductReviewFromPg,
  fetchPartnerProductQuestionsPageFromPg,
  fetchPartnerProductRatingSummaryFromPg,
  fetchPartnerProductReviewsForAdminFromPg,
  fetchPartnerProductReviewsPageFromPg,
  insertPartnerProductAdminAnswerFromPg,
  insertPartnerProductBuyerAnswerFromPg,
  insertPartnerProductQuestionFromPg,
  insertPartnerProductReviewFromPg,
  togglePartnerProductReviewVoteFromPg,
  updatePartnerProductReviewFromPg,
} from '../src/lib/db/messaging-partner-reviews-pg'

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
     values ($1, 'W1.5 Test Shop', $2) returning id`,
    [ownerId, `w1-5-partner-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const invRes = await pool.query(
    `insert into public.messaging_partner_inventory (partner_id, name, price_hint, image_url, product_url, is_active)
     values ($1::uuid, 'Áo thun test review', '200.000đ', 'https://placehold.co/100', 'https://example.com/p', true)
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

  async function seedOrder(opts: {
    guestAccountId: string
    status: string
    shippingStatus: string
  }): Promise<string> {
    const convRes = await pool.query(
      `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
       values ('widget', $1, $2::uuid, $3::uuid) returning id`,
      [`w1_5-thread-${opts.guestAccountId}-${Date.now()}-${Math.random()}`, opts.guestAccountId, partnerId]
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
       values ($1::uuid, $2::uuid, 'Áo thun test review', 200000, 1, 200000)`,
      [orderId, inventoryId]
    )
    return orderId
  }

  // A: đơn paid_verified + delivered -> đủ điều kiện review.
  const guestA = await seedGuestAccount('buyer-a')
  await seedOrder({ guestAccountId: guestA, status: 'paid_verified', shippingStatus: 'delivered' })

  // B: đơn awaiting_payment (chưa giao) -> KHÔNG đủ điều kiện review, nhưng đủ điều kiện trả lời Q&A.
  const guestB = await seedGuestAccount('buyer-b')
  await seedOrder({ guestAccountId: guestB, status: 'awaiting_payment', shippingStatus: 'pending' })

  // C: chưa từng mua hàng.
  const guestC = await seedGuestAccount('non-buyer-c')

  // D: đơn paid_verified + delivered (giống A) — dùng để test slot Q&A đầy (2 buyer trả lời).
  const guestD = await seedGuestAccount('buyer-d')
  await seedOrder({ guestAccountId: guestD, status: 'paid_verified', shippingStatus: 'delivered' })

  try {
    // 1) checkDeliveredPurchaseFromPg
    const purchaseA = await checkDeliveredPurchaseFromPg({ partnerId, inventoryId, guestAccountId: guestA })
    assert(purchaseA, 'A phải có đơn delivered')
    const purchaseB = await checkDeliveredPurchaseFromPg({ partnerId, inventoryId, guestAccountId: guestB })
    assert(!purchaseB, 'B chưa delivered -> không đủ điều kiện review')
    console.log('OK checkDeliveredPurchaseFromPg phân biệt đúng delivered vs chưa delivered')

    // 2) checkAnyPurchaseFromPg
    assert(await checkAnyPurchaseFromPg({ partnerId, inventoryId, guestAccountId: guestA }), 'A phải qualify Q&A (any purchase)')
    assert(await checkAnyPurchaseFromPg({ partnerId, inventoryId, guestAccountId: guestB }), 'B phải qualify Q&A (any non-cancelled)')
    assert(!(await checkAnyPurchaseFromPg({ partnerId, inventoryId, guestAccountId: guestC })), 'C chưa mua -> không qualify Q&A trả lời')
    console.log('OK checkAnyPurchaseFromPg: A/B qualify, C (chưa mua) không qualify')

    // 3) Gửi review — A OK, B not_eligible
    const reviewA = await insertPartnerProductReviewFromPg({
      partnerId, inventoryId, guestAccountId: guestA, reviewerName: 'Buyer A',
      rating: 5, title: '', content: 'Sản phẩm rất tốt, đóng gói cẩn thận!', imageUrls: ['https://example.com/img1.jpg'],
    })
    assert(reviewA.ok, `A phải review được: ${JSON.stringify(reviewA)}`)
    console.log('OK insertPartnerProductReviewFromPg: A (delivered) review thành công (title tự sinh xử lý ở API route theo locale)')

    const reviewB = await insertPartnerProductReviewFromPg({
      partnerId, inventoryId, guestAccountId: guestB, reviewerName: 'Buyer B',
      rating: 3, title: 'Tạm ổn', content: 'Chưa nhận được hàng', imageUrls: [],
    })
    assert(!reviewB.ok && reviewB.error === 'not_eligible', `B chưa delivered phải bị chặn: ${JSON.stringify(reviewB)}`)
    console.log('OK B (chưa delivered) bị chặn review — not_eligible')

    // 4) Enforce unique review/khách/sản phẩm THẬT ở backend (khác 188 chỉ ẩn UI)
    const dupA = await insertPartnerProductReviewFromPg({
      partnerId, inventoryId, guestAccountId: guestA, reviewerName: 'Buyer A',
      rating: 4, title: '', content: 'Review lần 2 để test unique', imageUrls: [],
    })
    assert(!dupA.ok && dupA.error === 'already_reviewed', `A review lần 2 phải bị chặn: ${JSON.stringify(dupA)}`)
    console.log('OK enforce unique (partner, inventory, guest_account) ở DB — review trùng bị chặn')

    // 5) D review thêm (rating 3) để test rating trung bình + histogram thật
    const reviewD = await insertPartnerProductReviewFromPg({
      partnerId, inventoryId, guestAccountId: guestD, reviewerName: 'Buyer D',
      rating: 3, title: '', content: 'Sản phẩm tạm ổn, giao hơi lâu', imageUrls: [],
    })
    assert(reviewD.ok, `D phải review được: ${JSON.stringify(reviewD)}`)

    const summary = await fetchPartnerProductRatingSummaryFromPg(partnerId, inventoryId)
    assert(summary.total === 2, `total phải = 2, thực tế ${summary.total}`)
    assert(summary.average === 4, `average phải = (5+3)/2 = 4, thực tế ${summary.average}`)
    assert(summary.histogram['5'] === 1 && summary.histogram['3'] === 1, `histogram sai: ${JSON.stringify(summary.histogram)}`)
    console.log('OK fetchPartnerProductRatingSummaryFromPg: rating trung bình + histogram TÍNH THẬT từ review, average=', summary.average)

    // 6) Thứ tự trang review: review của chính khách đang xem lên đầu
    const pageForD = await fetchPartnerProductReviewsPageFromPg({ partnerId, inventoryId, viewerAccountKey: guestD })
    assert(pageForD && pageForD.rows[0]?.guestAccountId === guestD, 'review của D (viewer) phải lên đầu')
    console.log('OK fetchPartnerProductReviewsPageFromPg: review của viewer hiện lên đầu')

    // 7) Ảnh review hiển thị công khai (khác 188 — 188 giấu ảnh)
    assert(reviewA.ok && reviewA.row.imageUrls.length === 1, 'ảnh review của A phải được lưu và trả về công khai')
    console.log('OK ảnh review lưu + trả về trong dữ liệu công khai (imageUrls)')

    // 8) Vote hữu ích — toggle unique (review_id, voter_key)
    const reviewAId = reviewA.ok ? reviewA.row.id : ''
    const vote1 = await togglePartnerProductReviewVoteFromPg({ reviewId: reviewAId, voterKey: guestB })
    assert(vote1.ok && vote1.voted === true && vote1.usefulCount === 1, `vote lần 1 sai: ${JSON.stringify(vote1)}`)
    const vote2 = await togglePartnerProductReviewVoteFromPg({ reviewId: reviewAId, voterKey: guestB })
    assert(vote2.ok && vote2.voted === false && vote2.usefulCount === 0, `toggle lại phải bỏ vote, sàn 0: ${JSON.stringify(vote2)}`)
    console.log('OK togglePartnerProductReviewVoteFromPg: toggle đúng, sàn 0')

    // 9) Admin: inline update (M1.2) + list + delete
    const adminList = await fetchPartnerProductReviewsForAdminFromPg({ partnerId })
    assert(adminList && adminList.total === 2, `admin phải thấy 2 review, thực tế ${adminList?.total}`)
    const merchantReplied = await updatePartnerProductReviewFromPg(partnerId, reviewAId, {
      merchantReply: 'Cảm ơn bạn đã ủng hộ shop!', merchantReplyBy: 'W1.5 Test Shop',
    })
    assert(merchantReplied?.merchantReply === 'Cảm ơn bạn đã ủng hộ shop!', 'merchant reply phải lưu đúng')
    console.log('OK admin list + inline update (merchant reply) hoạt động')

    const deleted = await deletePartnerProductReviewFromPg(partnerId, reviewAId)
    assert(deleted, 'xoá review A phải thành công')
    console.log('OK deletePartnerProductReviewFromPg xoá từng dòng')

    // 10) Q&A: hỏi không cần mua hàng (C chưa mua vẫn hỏi được)
    const question = await insertPartnerProductQuestionFromPg({
      partnerId, inventoryId, guestAccountId: guestC, askerName: 'Khách C', content: 'Sản phẩm này có size XL không?',
    })
    assert(question, 'C (chưa mua) vẫn phải hỏi được')
    console.log('OK Q&A: hỏi không cần điều kiện mua hàng')

    // 11) Trả lời buyer: A (đã mua) OK, C (chưa mua) not_eligible
    const answerA = await insertPartnerProductBuyerAnswerFromPg({
      partnerId, questionId: question!.id, inventoryId, guestAccountId: guestA, responderName: 'Buyer A', content: 'Có bạn nhé, mình mua size L rất vừa',
    })
    assert(answerA.ok, `A phải trả lời được: ${JSON.stringify(answerA)}`)
    const answerCFail = await insertPartnerProductBuyerAnswerFromPg({
      partnerId, questionId: question!.id, inventoryId, guestAccountId: guestC, responderName: 'Khách C', content: 'Mình đoán là có',
    })
    assert(!answerCFail.ok && answerCFail.error === 'not_eligible', `C chưa mua phải bị chặn trả lời: ${JSON.stringify(answerCFail)}`)
    console.log('OK Q&A: chỉ khách đã mua hàng (không huỷ) mới trả lời được')

    // 12) Giới hạn slot buyer-answer (QA_BUYER_ANSWER_LIMIT=2)
    const answerB = await insertPartnerProductBuyerAnswerFromPg({
      partnerId, questionId: question!.id, inventoryId, guestAccountId: guestB, responderName: 'Buyer B', content: 'Mình cũng mua rồi, đẹp lắm',
    })
    assert(answerB.ok, `B phải trả lời được (slot 2/2): ${JSON.stringify(answerB)}`)
    const answerDFull = await insertPartnerProductBuyerAnswerFromPg({
      partnerId, questionId: question!.id, inventoryId, guestAccountId: guestD, responderName: 'Buyer D', content: 'Mình trả lời thứ 3',
    })
    assert(!answerDFull.ok && answerDFull.error === 'slot_full', `slot thứ 3 phải bị chặn: ${JSON.stringify(answerDFull)}`)
    console.log('OK Q&A: giới hạn 2 slot buyer-answer công khai, slot thứ 3 bị chặn')

    // 13) Trả lời admin — không giới hạn, không cần điều kiện mua hàng
    const adminAnswer = await insertPartnerProductAdminAnswerFromPg({
      partnerId, questionId: question!.id, responderName: 'W1.5 Test Shop', content: 'Dạ shop còn đủ size ạ, bạn liên hệ để được tư vấn nhé',
    })
    assert(adminAnswer, 'admin phải trả lời được không giới hạn')
    console.log('OK Q&A: admin trả lời không giới hạn slot, không cần điều kiện mua hàng')

    // 14) Trang Q&A công khai: admin answer hiện trước, buyer answers theo đúng giới hạn
    const qaPage = await fetchPartnerProductQuestionsPageFromPg({ partnerId, inventoryId })
    assert(qaPage && qaPage.rows.length === 1, 'phải có đúng 1 câu hỏi')
    const answers = qaPage!.rows[0].answers
    assert(answers.length === 3, `phải có 3 câu trả lời (1 admin + 2 buyer), thực tế ${answers.length}`)
    assert(answers[0].answerType === 'admin', 'câu trả lời admin phải hiện đầu tiên')
    assert(answers.filter((a) => a.answerType === 'buyer').length === 2, 'phải đúng 2 câu trả lời buyer')
    console.log('OK fetchPartnerProductQuestionsPageFromPg: admin answer trước, đúng giới hạn buyer answer')

    console.log('\n✅ ALL W1.5 PHASE 1 (DB layer: review + Q&A) CHECKS PASSED')
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

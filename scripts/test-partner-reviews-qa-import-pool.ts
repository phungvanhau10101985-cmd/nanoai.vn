// Import pool + merge + unique + Q&A vote (188 group).
// Chạy: npx tsx scripts/test-partner-reviews-qa-import-pool.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { getPgPool } from '../src/lib/db/pool'
import {
  fetchPartnerProductQuestionsPageFromPg,
  fetchPartnerProductReviewsPageFromPg,
  insertImportedPartnerProductQuestionsFromPg,
  insertImportedPartnerProductReviewsFromPg,
  insertPartnerProductReviewFromPg,
  togglePartnerProductQuestionVoteFromPg,
} from '../src/lib/db/messaging-partner-reviews-pg'
import {
  buildQuestionImportSampleXlsx,
  buildReviewImportSampleXlsx,
  parseQuestionImportWorkbook,
  parseReviewImportWorkbook,
} from '../src/lib/partner-website/reviews/partner-reviews-qa-excel'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`)
}

async function main() {
  const reviewDrafts = parseReviewImportWorkbook(buildReviewImportSampleXlsx())
  assert(reviewDrafts.length === 1, 'sample review xlsx phải parse được 1 dòng')
  const questionDrafts = parseQuestionImportWorkbook(buildQuestionImportSampleXlsx())
  assert(questionDrafts.length === 1, 'sample question xlsx phải parse được 1 dòng')

  const pool = getPgPool()
  const ownerRes = await pool.query(`select id from auth.users limit 1`)
  assert(ownerRes.rows.length, 'cần ít nhất 1 user trong auth.users')
  const ownerId = ownerRes.rows[0].id as string
  const tag = Date.now().toString(36)

  const partnerRes = await pool.query(
    `insert into public.messaging_partners (owner_user_id, display_name, slug)
     values ($1, 'Import pool test', $2) returning id`,
    [ownerId, `import-pool-${tag}`]
  )
  const partnerId = partnerRes.rows[0].id as string

  const inv12 = await pool.query(
    `insert into public.messaging_partner_inventory
       (partner_id, name, price_hint, image_url, is_active, rating_group_id, question_group_id)
     values ($1::uuid, 'SP nhóm 12', '100.000đ', 'https://placehold.co/80', true, 12, 12)
     returning id`,
    [partnerId]
  )
  const inv13 = await pool.query(
    `insert into public.messaging_partner_inventory
       (partner_id, name, price_hint, image_url, is_active, rating_group_id, question_group_id)
     values ($1::uuid, 'SP nhóm 13', '100.000đ', 'https://placehold.co/80', true, 13, 13)
     returning id`,
    [partnerId]
  )
  const inventory12 = inv12.rows[0].id as string
  const inventory13 = inv13.rows[0].id as string

  const guestRes = await pool.query(
    `insert into public.messaging_guest_accounts (partner_id, email_raw, email_normalized)
     values ($1::uuid, $2, $2) returning id`,
    [partnerId, `pool-${tag}@example.com`]
  )
  const guestId = guestRes.rows[0].id as string
  const conv = await pool.query(
    `insert into public.customer_care_conversations (channel, external_thread_id, guest_account_id, partner_id)
     values ('widget', $1, $2::uuid, $3::uuid) returning id`,
    [`pool-thread-${tag}`, guestId, partnerId]
  )
  const order = await pool.query(
    `insert into public.messaging_partner_orders (partner_id, conversation_id, status, shipping_status)
     values ($1::uuid, $2::uuid, 'paid_verified', 'delivered') returning id`,
    [partnerId, conv.rows[0].id]
  )
  await pool.query(
    `insert into public.messaging_partner_order_lines
       (order_id, product_inventory_id, product_name, unit_price, quantity, line_subtotal)
     values ($1::uuid, $2::uuid, 'SP nhóm 12', 100000, 1, 100000)`,
    [order.rows[0].id, inventory12]
  )

  try {
    const imported = await insertImportedPartnerProductReviewsFromPg(partnerId, [
      {
        ...reviewDrafts[0]!,
        importGroup: 12,
        content: 'Import nhóm 12 — không cần đơn delivered',
      },
    ])
    assert(imported === 1, `import review phải tạo 1 dòng, thực tế ${imported}`)

    const page12 = await fetchPartnerProductReviewsPageFromPg({
      partnerId,
      inventoryId: inventory12,
      importGroup: 12,
    })
    assert(page12 && page12.rows.some((r) => r.isImported && r.importGroup === 12), 'SP nhóm 12 phải thấy import nhóm 12')

    const page13 = await fetchPartnerProductReviewsPageFromPg({
      partnerId,
      inventoryId: inventory13,
      importGroup: 13,
    })
    assert(page13 && !page13.rows.some((r) => r.isImported), 'SP nhóm 13 không được thấy import nhóm 12')
    console.log('OK merge: nhóm 12 thấy import, nhóm 13 không')

    const first = await insertPartnerProductReviewFromPg({
      partnerId,
      inventoryId: inventory12,
      guestAccountId: guestId,
      reviewerName: 'Buyer',
      rating: 5,
      title: 'Thật',
      content: 'Review thật sau khi nhận hàng',
      imageUrls: [],
    })
    assert(first.ok, `review thật lần 1 phải OK: ${JSON.stringify(first)}`)
    const dup = await insertPartnerProductReviewFromPg({
      partnerId,
      inventoryId: inventory12,
      guestAccountId: guestId,
      reviewerName: 'Buyer',
      rating: 4,
      title: '',
      content: 'Lần 2',
      imageUrls: [],
    })
    assert(!dup.ok && dup.error === 'already_reviewed', `review thật lần 2 phải 409 already_reviewed: ${JSON.stringify(dup)}`)
    console.log('OK unique review thật vẫn already_reviewed')

    const qCreated = await insertImportedPartnerProductQuestionsFromPg(partnerId, [
      {
        ...questionDrafts[0]!,
        importGroup: 12,
        content: 'Câu hỏi import nhóm 12?',
      },
    ])
    assert(qCreated === 1, `import question phải tạo 1 dòng, thực tế ${qCreated}`)
    const qa12 = await fetchPartnerProductQuestionsPageFromPg({
      partnerId,
      inventoryId: inventory12,
      importGroup: 12,
    })
    assert(qa12 && qa12.rows.length === 1, 'SP nhóm 12 phải thấy câu hỏi import')
    const qid = qa12!.rows[0].id
    const vote1 = await togglePartnerProductQuestionVoteFromPg({ questionId: qid, voterKey: guestId })
    assert(vote1.ok && vote1.voted && vote1.usefulCount >= 1, `vote lần 1 sai: ${JSON.stringify(vote1)}`)
    const vote2 = await togglePartnerProductQuestionVoteFromPg({ questionId: qid, voterKey: guestId })
    assert(vote2.ok && vote2.voted === false, `toggle vote phải tắt: ${JSON.stringify(vote2)}`)
    console.log('OK import không cần đơn + vote hỏi đáp toggle')

    console.log('\n✅ ALL IMPORT POOL / MERGE / UNIQUE / VOTE CHECKS PASSED')
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

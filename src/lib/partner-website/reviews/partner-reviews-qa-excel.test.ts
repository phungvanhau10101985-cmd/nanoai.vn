import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import {
  buildQuestionImportSampleXlsx,
  buildReviewImportSampleXlsx,
  parseQuestionImportWorkbook,
  parseReviewImportWorkbook,
} from '@/lib/partner-website/reviews/partner-reviews-qa-excel'
import { coalesceImportGroup, DEFAULT_IMPORT_GROUP, splitQaReplySlots } from '@/lib/partner-website/reviews/partner-review-types'
import { ensurePdpReviewQaCardsInBuyBox } from '@/lib/partner-website/shop/partner-site-pdp-review-qa'

test('coalesceImportGroup defaults 0/null to 888', () => {
  assert.equal(coalesceImportGroup(null), DEFAULT_IMPORT_GROUP)
  assert.equal(coalesceImportGroup(0), DEFAULT_IMPORT_GROUP)
  assert.equal(coalesceImportGroup(12), 12)
})

test('review sample xlsx parses 188 Vietnamese columns', () => {
  const rows = parseReviewImportWorkbook(buildReviewImportSampleXlsx())
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.reviewerName, 'Anh An')
  assert.equal(rows[0]?.rating, 4)
  assert.equal(rows[0]?.importGroup, 1)
  assert.ok(rows[0]?.content.includes('Sản phẩm'))
})

test('question sample xlsx parses EN columns + buyer reply 1 and 2', () => {
  const rows = parseQuestionImportWorkbook(buildQuestionImportSampleXlsx())
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.askerName, 'Nguyễn Văn A')
  assert.equal(rows[0]?.adminReplyContent.includes('10-12'), true)
  assert.equal(rows[0]?.buyerReplies.length, 2)
  assert.equal(rows[0]?.buyerReplies[0]?.name, 'Minh')
  assert.equal(rows[0]?.buyerReplies[1]?.name, 'Lan')
  assert.equal(rows[0]?.importGroup, DEFAULT_IMPORT_GROUP)
})

test('review workbook accepts English 188 headers', () => {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(
    [
      {
        user_name: 'Lan',
        star: 5,
        title: 'Good',
        content: 'Nice bag',
        reply_name: 'Shop',
        reply_content: 'Thanks',
        useful: 3,
        group: 12,
        img_fake: '["https://example.com/a.jpg"]',
      },
    ],
    {
      header: [
        'user_name',
        'star',
        'title',
        'content',
        'reply_name',
        'reply_content',
        'useful',
        'group',
        'img_fake',
      ],
    }
  )
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  const rows = parseReviewImportWorkbook(buf)
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.reviewerName, 'Lan')
  assert.equal(rows[0]?.importGroup, 12)
  assert.equal(rows[0]?.imageUrls[0], 'https://example.com/a.jpg')
})

test('splitQaReplySlots keeps admin + user 1 + user 2 independently', () => {
  const slots = splitQaReplySlots([
    {
      id: 'a',
      questionId: 'q',
      partnerId: 'p',
      answerType: 'admin',
      replySlot: 'admin',
      guestAccountId: null,
      linkedUserId: null,
      responderName: 'Shop',
      content: 'Admin reply',
      isVerified: false,
      isActive: true,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    {
      id: 'u2',
      questionId: 'q',
      partnerId: 'p',
      answerType: 'buyer',
      replySlot: 'user_two',
      guestAccountId: null,
      linkedUserId: null,
      responderName: 'Lan',
      content: 'User two only',
      isVerified: true,
      isActive: true,
      createdAt: '2026-01-02',
      updatedAt: '2026-01-02',
    },
  ])
  assert.equal(slots.admin?.responderName, 'Shop')
  assert.equal(slots.userOne, null)
  assert.equal(slots.userTwo?.responderName, 'Lan')
})

test('ensurePdpReviewQaCardsInBuyBox injects grid + modals', () => {
  const html = `<!DOCTYPE html><html><head></head><body data-pw-page="product"><main>
    <div data-pw-region="pdp-info"><h1>SP</h1></div>
    <section class="pw-shop-product-detail"></section>
  </main></body></html>`
  const out = ensurePdpReviewQaCardsInBuyBox(html, 'vi')
  assert.match(out, /data-pw-rq-grid/)
  assert.match(out, /id="pw-pdp-reviews"/)
  assert.match(out, /id="pw-pdp-qa-modal"/)
  assert.match(out, /pw-pdp-review-qa-css/)
  assert.match(out, /pw-pdp-helpful-btn/)
  assert.match(out, /id="pw-pdp-write-modal"/)
  assert.match(out, /data-pw-rq-modal="write"/)
  assert.match(out, /Người trả lời|Hỏi đáp về sản phẩm/)
})

test('ensurePdpReviewQaCardsInBuyBox refreshes existing review CSS', () => {
  const html = `<!DOCTYPE html><html><head><style id="pw-pdp-review-qa-css">.pw-pdp-helpful{color:red}</style></head>
  <body data-pw-page="product"><div data-pw-region="pdp-info"></div></body></html>`
  const out = ensurePdpReviewQaCardsInBuyBox(html, 'vi')
  assert.match(out, /pw-pdp-helpful-btn/)
  assert.match(out, /pw-pdp-verified-label/)
  assert.doesNotMatch(out, /\.pw-pdp-helpful\{color:red\}/)
})

test('ensurePdpReviewQaCardsInBuyBox strips nested leftover demo samples', () => {
  const html = `<!DOCTYPE html><html><body data-pw-page="product">
<div class="pw-pdp-rq-grid" data-pw-rq-grid="1" data-pw-pdp-slot="reviews-qa" data-pw-region="reviews">
  <section id="pw-pdp-reviews" class="pw-pdp-rq-card">
    <p data-pw-rq-review-count>12 đánh giá</p>
    <span data-pw-rq-review-score>4.8/5 ★</span>
    <div class="pw-pdp-rq-sample" data-pw-rq-review-sample>
      <div class="pw-pdp-rq-sample-box">
        <article><p>Lan</p><p>Form đẹp, vải mềm, đúng size M. Ảnh sát thực tế.</p>
        <div><img src="https://cdn.example/dress.jpg" alt="Đầm voan" /></div></article>
      </div>
    </div>
  </section>
  <section id="pw-pdp-qa" data-pw-pdp-slot="qa" class="pw-pdp-rq-card">
    <p data-pw-rq-qa-count>8 câu hỏi và trả lời</p>
    <div class="pw-pdp-rq-sample" data-pw-rq-qa-sample>
      <div class="pw-pdp-rq-sample-box">
        <article><p>Minh Anh</p><p>Màu kem dịu, giao nhanh.</p></article>
      </div>
    </div>
  </section>
</div>
</body></html>`
  const out = ensurePdpReviewQaCardsInBuyBox(html, 'vi')
  assert.doesNotMatch(out, /Form đẹp/)
  assert.doesNotMatch(out, /Màu kem dịu/)
  assert.doesNotMatch(out, /cdn\.example\/dress/)
  assert.doesNotMatch(out, /Đầm voan/)
  assert.match(out, /data-pw-rq-review-sample/)
  assert.match(out, /data-pw-rq-qa-sample/)
  assert.match(out, /Chưa có đánh giá/)
  assert.match(out, />0 đánh giá</)
})

test('ensurePdpReviewQaCardsInBuyBox appends after buy-box actions', () => {
  const html = `<!DOCTYPE html><html><head></head><body data-pw-page="product"><main>
    <div data-pw-region="pdp-info">
      <h1>SP</h1>
      <div class="pw-pdp-actions pw-pdp-actions-inline"><button>Mua</button></div>
    </div>
    <section class="pw-shop-product-detail"></section>
  </main></body></html>`
  const out = ensurePdpReviewQaCardsInBuyBox(html, 'vi')
  const actionsAt = out.indexOf('pw-pdp-actions')
  const gridAt = out.indexOf('data-pw-rq-grid')
  const detailAt = out.indexOf('pw-shop-product-detail')
  assert.ok(actionsAt > 0 && gridAt > actionsAt && gridAt < detailAt)
})

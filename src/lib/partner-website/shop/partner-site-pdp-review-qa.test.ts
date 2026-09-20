import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PW_PDP_REVIEW_QA_CSS,
  buildPdpReviewQaCardsHtml,
  buildPdpReviewQaModalsHtml,
} from '@/lib/partner-website/shop/partner-site-pdp-review-qa'

test('PDP review/QA CSS keeps 188 helpful count outside the button', () => {
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-helpful-n\{/)
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-helpful-btn\{/)
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-helpful-label\{/)
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-rq-ctas-wide/)
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-rq-dialog-write/)
  assert.match(PW_PDP_REVIEW_QA_CSS, /\.pw-pdp-write-form/)
  assert.doesNotMatch(PW_PDP_REVIEW_QA_CSS, /#ea580c|#f97316/)
})

test('PDP review/QA factory matches 188 card CTAs and separate write modal', () => {
  const cards = buildPdpReviewQaCardsHtml('vi')
  assert.match(cards, /data-pw-rq-open-reviews/)
  assert.match(cards, /Xem thêm đánh giá/)
  assert.match(cards, /data-pw-rq-open-write/)
  assert.match(cards, /Viết đánh giá/)
  assert.match(cards, /data-pw-rq-open-qa/)
  assert.match(cards, /Xem danh sách câu hỏi/)
  assert.match(cards, /pw-pdp-rq-ctas-empty/)
  assert.match(cards, /pw-pdp-rq-ctas-wide/)

  const modals = buildPdpReviewQaModalsHtml('vi')
  assert.match(modals, /data-pw-rq-modal="reviews"/)
  assert.match(modals, /data-pw-rq-modal="write"/)
  assert.match(modals, /data-pw-rq-modal="qa"/)
  assert.match(modals, /pw-pdp-rq-dialog-write/)
  assert.match(modals, /data-pw-rq-product-strip/)
  const reviewsChunk = modals.slice(
    0,
    Math.max(0, modals.indexOf('data-pw-rq-modal="write"'))
  )
  assert.doesNotMatch(reviewsChunk, /data-pw-pdp-slot="review-form"/)
})

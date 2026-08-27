import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import {
  buildQuestionImportSampleXlsx,
  buildReviewImportSampleXlsx,
  parseQuestionImportWorkbook,
  parseReviewImportWorkbook,
} from '@/lib/partner-website/reviews/partner-reviews-qa-excel'
import { coalesceImportGroup, DEFAULT_IMPORT_GROUP } from '@/lib/partner-website/reviews/partner-review-types'
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

test('question sample xlsx parses EN columns + buyer reply', () => {
  const rows = parseQuestionImportWorkbook(buildQuestionImportSampleXlsx())
  assert.equal(rows.length, 1)
  assert.equal(rows[0]?.askerName, 'Nguyễn Văn A')
  assert.equal(rows[0]?.adminReplyContent.includes('10-12'), true)
  assert.equal(rows[0]?.buyerReplies.length, 1)
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
})

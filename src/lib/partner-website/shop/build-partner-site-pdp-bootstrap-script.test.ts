import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSitePdpBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-pdp-bootstrap-script'

test('PDP bootstrap hydrates reviews, Q&A, and options instead of clearing cards', () => {
  const s = buildPartnerSitePdpBootstrapScript({ siteSlug: '188-shop', locale: 'vi' })
  assert.match(s, /data-pw-pdp-bootstrap/)
  assert.match(s, /\/api\/site\/188-shop\/products\//)
  assert.match(s, /\/reviews/)
  assert.match(s, /\/questions/)
  assert.match(s, /\/options/)
  assert.match(s, /data-pw-pdp-option-value/)
  assert.match(s, /data-pw-review-submit/)
  assert.match(s, /data-pw-review-vote/)
  assert.match(s, /data-pw-qa-submit/)
  assert.match(s, /data-pw-qa-answer-submit/)
  assert.match(s, /LOGIN_PATH/)
  assert.match(s, /Gửi đánh giá/)
  assert.match(s, /Gửi câu hỏi/)
  assert.match(s, /applyOptions/)
  assert.match(s, /pdpPurchasesLabel/)
  assert.match(s, /data-pw-pdp-video-thumb/)
  assert.match(s, /closest\('\[data-pw-el="variant"\]'\)/)
  assert.match(s, /if\(info\.querySelector\('\[data-pw-pdp-option="'\+kind\+'"\]'\)\)return/)
  assert.doesNotMatch(s, /\[data-pw-region="reviews"\] \[data-pw-el="card"\]'\)\.forEach\(function\(card\)\{card\.innerHTML=''/)
  assert.match(s, /function paintPdpLikeCounts/)
  assert.match(s, /data-pw-like-count/)
  assert.match(s, /data-pw-stat="likes"/)
})

test('PDP bootstrap uses shop copy for the requested locale', () => {
  const en = buildPartnerSitePdpBootstrapScript({ siteSlug: '188-shop', locale: 'en' })
  assert.match(en, /Submit review/)
  assert.match(en, /Ask a question|Your question/)
})

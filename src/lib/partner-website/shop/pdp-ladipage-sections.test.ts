import assert from 'node:assert/strict'
import test from 'node:test'
import { formatPdpOfferLine } from '@/lib/partner-website/shop/pdp-ladipage-copy'
import {
  bindPdpLadipageToHtml,
  buildPdpLadipageFaqJsonLd,
  pdpLadipageHeroCopyVisible,
  type PdpLadipageOverlay,
} from '@/lib/partner-website/shop/pdp-ladipage-sections'
import { isPdpCartTriggerForTest, PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS } from '@/lib/partner-website/shop/partner-site-product-variant-modal'

const SHELL = `<html><head></head><body>
<div class="pw-shop-product-layout">
  <div class="pw-shop-pdp-info" data-pw-region="pdp-info">
    <p class="pw-shop-muted" data-pw-pdp-slot="deposit">Đặt cọc theo shop</p>
    <div class="pw-pdp-actions"></div>
  </div>
</div>
<section class="pw-shop-product-detail"></section>
</body></html>`

const overlay: PdpLadipageOverlay = {
  productName: 'Áo sơ mi',
  imageUrl: 'https://cdn.example/ao.jpg',
  offerLine: 'Đặt cọc 20% · Phí giao 30.000đ',
  story: {
    landingId: 'lp1',
    hero: { headline: 'Áo sơ mi', subheadline: 'Vải cotton mặc mát' },
    highlights: [{ title: 'Cotton', desc: 'Thoáng' }],
    material: { material: 'Cotton', body: 'Mỏng nhẹ' },
    trust: { body: 'Đổi size trong 7 ngày', ctaLabel: 'Mua ngay' },
    faq: [{ q: 'Có size không?', a: 'Có S M L' }],
    averageRating: null,
    totalReviews: 0,
  },
}

test('hero copy hides a headline that repeats the product name', () => {
  const same = pdpLadipageHeroCopyVisible('Áo sơ mi', 'Ao so mi', 'Vải cotton mặc mát')
  assert.equal(same.showHeadline, false)
  assert.equal(same.showSub, true)
  const distinct = pdpLadipageHeroCopyVisible('Áo sơ mi', 'Mặc đi làm cả tuần', 'Áo sơ mi')
  assert.equal(distinct.showHeadline, true)
  assert.equal(distinct.showSub, false)
})

test('offer line uses shop deposit mode and shipping, never a fixed 30 percent', () => {
  assert.equal(
    formatPdpOfferLine({
      locale: 'vi',
      depositMode: 'percent',
      depositPercent: 20,
      depositAmount: 0,
      shippingFeeAmount: 15000,
    }).includes('20%'),
    true
  )
  assert.equal(
    formatPdpOfferLine({
      locale: 'vi',
      depositMode: 'none',
      depositPercent: 30,
      depositAmount: 0,
      shippingFeeAmount: 0,
    }),
    'Thanh toán khi nhận hàng · Giao hàng miễn phí'
  )
  assert.equal(
    formatPdpOfferLine({
      locale: 'en',
      depositMode: 'fixed_amount',
      depositPercent: 0,
      depositAmount: 50000,
      shippingFeeAmount: 0,
    }).startsWith('Deposit '),
    true
  )
})

test('mobile injects blurb and story, desktop injects hero, offer replaces deposit', () => {
  const mobile = bindPdpLadipageToHtml(SHELL, overlay, { locale: 'vi', device: 'mobile' })
  assert.match(mobile, /<!--pw-pdp-ladipage-blurb-->/)
  assert.match(mobile, /<!--pw-pdp-ladipage-story-->/)
  assert.doesNotMatch(mobile, /<!--pw-pdp-ladipage-hero-->/)
  assert.match(mobile, /Đặt cọc 20%/)
  assert.doesNotMatch(mobile, /Đặt cọc theo shop/)
  const faq = mobile.indexOf('data-pw-pdp-ladipage-faq-ld')
  assert.ok(faq > 0)

  const desktop = bindPdpLadipageToHtml(SHELL, overlay, { locale: 'vi', device: 'desktop' })
  assert.match(desktop, /<!--pw-pdp-ladipage-hero-->/)
  assert.match(desktop, /data-pw-ladipage-buy/)
  assert.match(desktop, /Chọn lựa kỹ lưỡng/)
  assert.doesNotMatch(desktop, /<!--pw-pdp-ladipage-blurb-->/)
  assert.match(desktop, /Vải cotton mặc mát/)
  const heroAt = desktop.indexOf('<!--pw-pdp-ladipage-hero-->')
  const layoutAt = desktop.indexOf('pw-shop-product-layout')
  const storyAt = desktop.indexOf('<!--pw-pdp-ladipage-story-->')
  const detailAt = desktop.indexOf('pw-shop-product-detail')
  assert.ok(heroAt < layoutAt)
  assert.ok(storyAt < detailAt)

  const again = bindPdpLadipageToHtml(desktop, overlay, { locale: 'vi', device: 'desktop' })
  assert.equal(again.split('<!--pw-pdp-ladipage-hero-->').length, 2)
})

test('offer line still binds when the product has no published story', () => {
  const html = bindPdpLadipageToHtml(
    SHELL,
    { ...overlay, story: null },
    { locale: 'vi', device: 'desktop' }
  )
  assert.match(html, /data-pw-pdp-offer/)
  assert.doesNotMatch(html, /<!--pw-pdp-ladipage-hero-->/)
  assert.doesNotMatch(html, /<!--pw-pdp-ladipage-story-->/)
})

test('faq json-ld only includes published questions', () => {
  const data = buildPdpLadipageFaqJsonLd([
    { q: 'Có đổi không?', a: 'Có' },
    { q: '  ', a: 'Bỏ' },
  ])
  assert.equal(data?.['@type'], 'FAQPage')
  assert.equal((data?.mainEntity as unknown[]).length, 1)
  assert.equal(buildPdpLadipageFaqJsonLd([]), null)
})

test('desktop hero buy opens the variant modal', () => {
  assert.equal(isPdpCartTriggerForTest({ ladipageBuy: true, wideViewport: true }), true)
  assert.match(PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS, /data-pw-ladipage-buy/)
})

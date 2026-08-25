import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOutfitProductsSectionHtml,
  isOutfitCatalogOpenTag,
  outfitListingHref,
} from '@/lib/partner-website/shop/outfit-products'

test('outfit factory stamps complementary grid contract', () => {
  const html = buildOutfitProductsSectionHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    excludeId: '22222222-2222-4222-8222-222222222222',
    added: true,
  })
  assert.match(html, /data-pw-outfit="1"/)
  assert.match(html, /data-pw-grid-kind="outfit"/)
  assert.match(html, /data-pw-grid-cols="5"/)
  assert.match(html, /data-pw-grid-cols-mobile="2"/)
  assert.match(html, /data-exclude="22222222-2222-4222-8222-222222222222"/)
  assert.match(html, /Phối với món này/)
  assert.match(html, /Món khác loại để mặc cùng/)
  assert.match(html, /data-pw-outfit-slot="top"/)
  assert.match(html, /Xem thêm/)
  assert.match(html, /Xem tất cả/)
  assert.doesNotMatch(html, /data-pw-el="card-cart"/)
  assert.doesNotMatch(html, /data-pw-el="card-buy"/)
})

test('outfit live cards keep a square media slot and do not leak name as img alt', () => {
  const html = buildOutfitProductsSectionHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    cards: [
      { id: '33333333-3333-4333-8333-333333333333', name: 'Túi xách nữ', imageUrl: '', priceHint: '450.000₫' },
    ],
  })
  assert.match(html, /class="pw-product-card-media"/)
  assert.doesNotMatch(html, /alt="Túi xách nữ"/)
  assert.match(html, /Túi xách nữ/)
})

test('outfit listing href falls back to products', () => {
  assert.match(outfitListingHref({ siteSlug: 'demo-shop', categoryPath: 'giay-dep/sneaker' }), /giay-dep/)
  assert.match(outfitListingHref({ siteSlug: 'demo-shop' }), /\/products/)
})

test('isOutfitCatalogOpenTag reads outfit contract only', () => {
  assert.equal(isOutfitCatalogOpenTag('<section data-pw-outfit="1">'), true)
  assert.equal(isOutfitCatalogOpenTag('<section data-pw-grid-kind="outfit">'), true)
  assert.equal(isOutfitCatalogOpenTag('<section data-pw-related="1">'), false)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildRelatedProductsSectionHtml,
  isRelatedCatalogOpenTag,
  relatedListingHref,
} from '@/lib/partner-website/shop/related-products'

test('related factory stamps 188-style contract', () => {
  const html = buildRelatedProductsSectionHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    categoryId: '11111111-1111-4111-8111-111111111111',
    categoryPath: 'ao/ao-thun',
    excludeId: '22222222-2222-4222-8222-222222222222',
  })
  assert.match(html, /data-pw-related="1"/)
  assert.match(html, /data-pw-grid-kind="related"/)
  assert.match(html, /data-pw-grid-cols="5"/)
  assert.match(html, /data-pw-grid-cols-mobile="2"/)
  assert.match(html, /data-exclude="22222222-2222-4222-8222-222222222222"/)
  assert.match(html, /data-category-id="11111111-1111-4111-8111-111111111111"/)
  assert.match(html, /Sản phẩm tương tự/)
  assert.match(html, /Xem thêm/)
  assert.match(html, /Xem tất cả/)
  assert.doesNotMatch(html, /data-pw-el="card-cart"/)
  assert.doesNotMatch(html, /data-pw-el="card-buy"/)
})

test('related live cards proxy AliCDN so the photo is not hotlink-blocked', () => {
  const html = buildRelatedProductsSectionHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    cards: [
      {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Váy liền thân Nữ Thiết Kế Pháp',
        imageUrl: 'https://img.alicdn.com/img/ibank/O1CN01aUuPLA2Dd3T8T15w4_!!991128631-0-cib.jpg',
        priceHint: '1.520.000đ',
      },
    ],
  })
  assert.match(html, /\/api\/fetch-image\?url=/)
  assert.doesNotMatch(html, /src="https:\/\/img\.alicdn\.com/)
})

test('related live cards keep a square media slot and do not leak name as img alt', () => {
  const html = buildRelatedProductsSectionHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    cards: [
      { id: '33333333-3333-4333-8333-333333333333', name: 'Giày boot nữ cổ ngắn', imageUrl: '', priceHint: '920.000₫' },
    ],
  })
  assert.match(html, /class="pw-product-card-media"/)
  assert.doesNotMatch(html, /alt="Giày boot nữ cổ ngắn"/)
  assert.match(html, /Giày boot nữ cổ ngắn/)
})

test('related listing href prefers category path', () => {
  assert.match(relatedListingHref({ siteSlug: 'demo-shop', categoryPath: 'ao/ao-thun' }), /ao\/ao-thun/)
  assert.match(relatedListingHref({ siteSlug: 'demo-shop' }), /\/products/)
})

test('isRelatedCatalogOpenTag ignores recommended and added catalogs', () => {
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-related="1">'), true)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-grid-kind="related">'), true)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-region="catalog">'), true)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-catalog data-pw-personalize="recommended">'), false)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-added-catalog="1" data-pw-catalog>'), false)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-grid-kind="catalog">'), false)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-outfit="1" data-pw-region="catalog">'), false)
  assert.equal(isRelatedCatalogOpenTag('<section data-pw-grid-kind="outfit">'), false)
})

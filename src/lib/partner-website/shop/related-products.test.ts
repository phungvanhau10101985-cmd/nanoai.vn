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

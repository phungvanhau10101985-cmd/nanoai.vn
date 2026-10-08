import assert from 'node:assert/strict'
import test from 'node:test'
import { getFeatureSeo } from '@/lib/feature-seo'
import { listNanoAiFacebookCatalogItems } from '@/lib/catalog/nanoai-facebook-catalog'
import {
  WEDDING_ADD_TO_CART_VALUE_VND,
  WEDDING_COMMERCE_CONTENT_ID,
  buildWeddingCommerceProductJsonLd,
  weddingAddToCartCustomData,
  weddingPackPaymentCustomData,
  weddingPurchaseEventId,
  weddingViewContentCustomData,
} from '@/lib/wedding/wedding-commerce-events'

test('wedding catalog price matches the default add-to-cart value', () => {
  const item = listNanoAiFacebookCatalogItems().find((row) => row.linkPath === '/tao-thiep-moi-cuoi-ai')
  assert.ok(item)
  assert.equal(item.id, WEDDING_COMMERCE_CONTENT_ID)
  assert.equal(item.priceVnd, 149_000)
  assert.equal(WEDDING_ADD_TO_CART_VALUE_VND, 149_000)
})

test('view content and add to cart use 149k and the catalog content id', () => {
  const view = weddingViewContentCustomData()
  const cart = weddingAddToCartCustomData('card-1')
  assert.equal(view.value, 149_000)
  assert.equal(cart.value, 149_000)
  assert.deepEqual(view.content_ids, [WEDDING_COMMERCE_CONTENT_ID])
  assert.equal(view.currency, 'VND')
  assert.equal(view.contents[0]?.item_price, 149_000)
  assert.equal(cart.content_card_id, 'card-1')
})

test('purchase value follows the pack the customer pays', () => {
  const first = weddingPackPaymentCustomData({ packId: 'p50', amountVnd: 149_000, paymentId: 'pay-50' })
  const mid = weddingPackPaymentCustomData({ packId: 'p100', amountVnd: 199_000, paymentId: 'pay-100' })
  const upgrade = weddingPackPaymentCustomData({ packId: 'unlimited', amountVnd: 100_000, paymentId: 'pay-up' })
  assert.equal(first.value, 149_000)
  assert.equal(first.list_price, 149_000)
  assert.equal(first.pack_id, 'p50')
  assert.equal(mid.value, 199_000)
  assert.equal(mid.list_price, 199_000)
  assert.equal(upgrade.value, 100_000)
  assert.equal(upgrade.list_price, 299_000)
  assert.equal(upgrade.order_id, 'pay-up')
  assert.equal(weddingPurchaseEventId('abc-123'), 'Purchase_abc-123')
})

test('product json-ld lists the three guest packs', () => {
  const json = buildWeddingCommerceProductJsonLd('https://nanoai.vn/tao-thiep-moi-cuoi-ai', 'Thiệp cưới')
  const offers = json.offers as { lowPrice: number; highPrice: number; offerCount: number }
  assert.equal(json['@type'], 'Product')
  assert.equal(json.sku, WEDDING_COMMERCE_CONTENT_ID)
  assert.equal(offers.lowPrice, 149_000)
  assert.equal(offers.highPrice, 299_000)
  assert.equal(offers.offerCount, 3)
})

test('creator page description states the 149k pack and stays in the meta length band', () => {
  const seo = getFeatureSeo('tao-thiep-moi-cuoi-ai')
  assert.match(seo.pageDescription, /149\.000đ/)
  assert.ok(seo.pageDescription.length >= 150 && seo.pageDescription.length <= 160)
  assert.ok(seo.faqs.some((item) => item.question.includes('giá')))
})

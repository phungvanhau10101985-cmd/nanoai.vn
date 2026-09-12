import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  allocateIntegerTotal,
  classifyLegacyItemSource,
  fulfillmentSourceFromUrl,
  resolveInventoryFulfillmentUrl,
  sourcePlatformFromUrl,
} from './fulfillment-routing'

describe('sourcePlatformFromUrl', () => {
  it('classifies real 1688/taobao/tmall hosts and subdomains', () => {
    assert.equal(sourcePlatformFromUrl('https://detail.1688.com/offer/123.html'), '1688')
    assert.equal(sourcePlatformFromUrl('https://item.taobao.com/item.htm?id=1'), 'taobao')
    assert.equal(sourcePlatformFromUrl('https://detail.tmall.com/item.htm?id=1'), 'tmall')
  })

  it('ignores query-string decoys', () => {
    assert.equal(sourcePlatformFromUrl('https://cdn.example.com/img.jpg?next=https://item.taobao.com/item.htm'), null)
    assert.equal(sourcePlatformFromUrl('https://shop.example.com/p?utm=1688.com'), null)
  })

  it('defaults missing or shop URLs to Vietnam', () => {
    assert.equal(fulfillmentSourceFromUrl(''), 'vietnam')
    assert.equal(fulfillmentSourceFromUrl('https://nanoai.example/site/shop/p/abc'), 'vietnam')
    assert.equal(fulfillmentSourceFromUrl('https://detail.1688.com/offer/1.html'), 'china')
  })
})

describe('resolveInventoryFulfillmentUrl', () => {
  it('prefers a real China host when catalog and product URLs disagree', () => {
    const china = 'https://detail.1688.com/offer/1.html'
    const shop = 'https://shop.example/p/abc'
    assert.equal(
      resolveInventoryFulfillmentUrl({ catalogJson: { link_default: china }, productUrl: shop }),
      china
    )
    assert.equal(
      resolveInventoryFulfillmentUrl({ catalogJson: { link_default: shop }, productUrl: china }),
      china
    )
    assert.equal(
      resolveInventoryFulfillmentUrl({ catalogJson: { link_default: shop }, productUrl: shop, fallbackUrl: china }),
      china
    )
  })
})

describe('classifyLegacyItemSource', () => {
  it('marks missing URL as needs review and does not guess China', () => {
    const out = classifyLegacyItemSource({ productExists: false, snapshotSource: 'china' })
    assert.equal(out.source, 'china')
    assert.equal(out.needsReview, true)
    const missing = classifyLegacyItemSource({ productExists: false })
    assert.equal(missing.source, 'vietnam')
    assert.equal(missing.needsReview, true)
  })
})

describe('allocateIntegerTotal', () => {
  it('puts remainder on the last key', () => {
    const out = allocateIntegerTotal(100, { a: 1, b: 2 }, ['a', 'b'])
    assert.equal(out.a + out.b, 100)
    assert.equal(out.a, 33)
    assert.equal(out.b, 67)
  })
})

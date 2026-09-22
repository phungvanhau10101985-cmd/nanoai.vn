import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPartnerShopReactIslandPath,
  isPartnerShopVisualHtmlPath,
} from '@/lib/partner-website/shop/partner-shop-react-island-path'

test('cart account deposit stay React islands; home listing PDP are visual HTML', () => {
  assert.equal(isPartnerShopReactIslandPath('/site/demo/cart'), true)
  assert.equal(isPartnerShopReactIslandPath('/site/demo/orders/abc/deposit'), true)
  assert.equal(isPartnerShopReactIslandPath('/site/demo/account'), true)
  assert.equal(isPartnerShopReactIslandPath('/site/demo/products/sku/cart/add/A1'), true)
  assert.equal(isPartnerShopVisualHtmlPath('/site/demo'), true)
  assert.equal(isPartnerShopVisualHtmlPath('/site/demo/c/ao'), true)
  assert.equal(isPartnerShopVisualHtmlPath('/site/demo/products/tui-x'), true)
  assert.equal(isPartnerShopReactIslandPath('/cart'), true)
  assert.equal(isPartnerShopVisualHtmlPath('/cart'), false)
  assert.equal(isPartnerShopVisualHtmlPath('/'), true)
})

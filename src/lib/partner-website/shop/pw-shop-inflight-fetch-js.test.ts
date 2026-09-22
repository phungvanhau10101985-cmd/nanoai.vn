import assert from 'node:assert/strict'
import test from 'node:test'
import { PW_SHOP_INFLIGHT_FETCH_JS } from '@/lib/partner-website/shop/pw-shop-inflight-fetch-js'

test('storefront inflight helper shares one fetch then drops the bag', () => {
  assert.match(PW_SHOP_INFLIGHT_FETCH_JS, /function pwShopInflight\(/)
  assert.match(PW_SHOP_INFLIGHT_FETCH_JS, /window\.__pwShopInflight/)
  assert.match(PW_SHOP_INFLIGHT_FETCH_JS, /function pwShopInflightFetch\(/)
  assert.match(PW_SHOP_INFLIGHT_FETCH_JS, /if\(bag\[key\]===started\)delete bag\[key\]/)
  assert.doesNotMatch(PW_SHOP_INFLIGHT_FETCH_JS, /\$\{/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  injectPartnerShopChromeLayoutCss,
  PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID,
} from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'

test('chrome layout css is injected once before </head>', () => {
  const html = '<!DOCTYPE html><html><head><title>Shop</title></head><body><nav class="pw-shop-bottom-nav"></nav></body></html>'
  const once = injectPartnerShopChromeLayoutCss(html)
  const twice = injectPartnerShopChromeLayoutCss(once)
  assert.equal(once.includes(PARTNER_SHOP_CHROME_LAYOUT_STYLE_ID), true)
  assert.equal(once.includes('flex-direction:row'), true)
  assert.equal(once.includes('.pw-header-actions [data-pw-chrome-added]'), true)
  assert.equal(once.includes('data-pw-device="mobile"'), true)
  assert.equal(once.includes('min-width:768px'), true)
  assert.equal(once.includes('white-space:normal'), true)
  assert.equal(once.includes('flex-wrap:nowrap'), true)
  assert.equal(once.includes('pw-shop-chrome-badge-pin'), true)
  assert.equal(twice, once)
  const stale = once.replace('flex-direction:row', 'flex-direction:column')
  const refreshed = injectPartnerShopChromeLayoutCss(stale)
  assert.equal(refreshed.includes('flex-direction:row'), true)
  assert.equal((refreshed.match(/id="pw-shop-chrome-layout"/g) || []).length, 1)
})

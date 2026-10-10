import assert from 'node:assert/strict'
import test from 'node:test'
import { PARTNER_SHOP_CHROME_FLOAT_SCRIPT } from '@/lib/partner-website/shop/chrome-float-widgets'
import {
  staticShopRuntimeForFile,
  staticShopRuntimeSrcForBody,
} from '@/lib/partner-website/shop/pw-shop-static-runtime'
import { PARTNER_SHOP_SCENE_CENTER_SCRIPT } from '@/lib/partner-website/visual-editor/pw-scene'

test('shop-independent runtime body maps to a hashed file that serves the same body', () => {
  for (const body of [PARTNER_SHOP_SCENE_CENTER_SCRIPT, `\n${PARTNER_SHOP_CHROME_FLOAT_SCRIPT}\n`]) {
    const src = staticShopRuntimeSrcForBody(body)
    assert.match(String(src), /^\/pw-shop-runtime\/[a-z0-9-]+\.[a-f0-9]{12}\.js$/)
    const served = staticShopRuntimeForFile(String(src).split('/').pop() || '')
    assert.deepEqual(served, { body: body.trim(), current: true })
  }
})

test('unknown or shop-specific bodies stay inline', () => {
  assert.equal(staticShopRuntimeSrcForBody('(function(){var slug="gudo-vn"})()'), null)
  assert.equal(staticShopRuntimeSrcForBody(`${PARTNER_SHOP_CHROME_FLOAT_SCRIPT};x()`), null)
})

test('stale hash still serves the current body with a short cache flag', () => {
  const src = String(staticShopRuntimeSrcForBody(PARTNER_SHOP_CHROME_FLOAT_SCRIPT))
  const name = src.split('/').pop()!.split('.')[0]
  assert.deepEqual(staticShopRuntimeForFile(`${name}.000000000000.js`), {
    body: PARTNER_SHOP_CHROME_FLOAT_SCRIPT.trim(),
    current: false,
  })
  assert.equal(staticShopRuntimeForFile('nope.000000000000.js'), null)
})

import assert from 'node:assert/strict'
import test from 'node:test'

import { injectMarketplaceLookIntoHtml } from '@/lib/partner-website/shop/marketplace-shop-look-css'
import {
  buildShopLookCss,
  injectShopLookIntoHtml,
  PARTNER_SHOP_LOOK_STYLE_ID,
} from '@/lib/partner-website/shop/shop-look-css'
import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'

test('shop look CSS paints boutique chrome with tokens, not brand hex', () => {
  const css = buildShopLookCss()
  assert.match(
    css,
    /:is\(html\[data-pw-look="shop"\],\.pw-shop\[data-pw-look="shop"\],\[data-pw-inline-visual-root\]\[data-pw-look="shop"\]\)/
  )
  assert.match(css, /background:#fff!important/)
  assert.match(css, /height:42px!important/)
  assert.match(css, /color:var\(--pw-primary\)!important/)
  assert.match(css, /\.pw-nav-main>a:hover/)
  assert.match(css, /aspect-ratio:1!important/)
  assert.doesNotMatch(css, /#f97316|#ea580c|#ff6b00/)
})

test('injectShopLookIntoHtml stamps shop after skip marketplace', () => {
  const html = '<!DOCTYPE html><html lang="vi"><head></head><body><header class="pw-header"></header></body></html>'
  const skipped = injectShopLookIntoHtml(html, { look: 'marketplace' })
  assert.equal(skipped, html)
  const out = injectShopLookIntoHtml(html, { look: 'shop' })
  assert.match(out, /data-pw-look="shop"/)
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_LOOK_STYLE_ID}"`))
})

test('injectShopLookIntoHtml does not override marketplace HTML', () => {
  const html =
    '<!DOCTYPE html><html lang="vi" data-pw-look="marketplace"><head></head><body><header class="pw-header"></header></body></html>'
  const out = injectShopLookIntoHtml(html, { look: undefined })
  assert.equal(out, html)
  const painted = injectMarketplaceLookIntoHtml(html, { look: 'marketplace' })
  const stillMarket = injectShopLookIntoHtml(painted, { look: 'shop' })
  assert.match(stillMarket, /data-pw-look="marketplace"/)
  assert.doesNotMatch(stillMarket, new RegExp(`id="${PARTNER_SHOP_LOOK_STYLE_ID}"`))
})

test('fashion-orange gallery sample uses shop look, photo hero, and slogan', () => {
  const built = buildShopTemplateSampleHtml({ presetId: 'fashion-orange', locale: 'vi' })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.match(built.html, /data-pw-look="shop"/)
  assert.match(built.html, /data-pw-el="media"/)
  assert.match(built.html, /images\.unsplash\.com/)
  assert.match(built.html, /Khám phá xu hướng mới nhất/)
  assert.match(built.html, /Thời trang mỗi ngày/)
  assert.match(built.html, /data-pw-region="header"/)
  assert.match(built.html, /pw-hero-media|data-pw-el="media"/)
  assert.doesNotMatch(built.html, /id="pw-marketplace-look-css"/)
})

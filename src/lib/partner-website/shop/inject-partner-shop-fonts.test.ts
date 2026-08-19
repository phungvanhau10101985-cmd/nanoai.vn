import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopFontCss,
  extractVisualHtmlBodyMarkup,
  injectPartnerShopFontsIntoHtml,
  PARTNER_SHOP_FONT_STYLE_ID,
} from './inject-partner-shop-fonts'
import { injectPartnerShopChromeLayoutCss } from './partner-shop-chrome-layout-css'

test('injectPartnerShopFontsIntoHtml adds font tokens and Google Fonts', () => {
  const html = '<!DOCTYPE html><html><head></head><body><header class="pw-header"></header></body></html>'
  const out = injectPartnerShopFontsIntoHtml(html)
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_FONT_STYLE_ID}"`))
  assert.match(out, /--pw-font-ui:/)
  assert.match(out, /--pw-font-display:/)
  assert.match(out, /fonts\.googleapis\.com/)
  assert.match(out, /Be\+Vietnam\+Pro/)
  assert.match(out, /Fraunces/)
})

test('injectPartnerShopChromeLayoutCss always ships font pack', () => {
  const html = '<html><head></head><body><div class="pw-header"></div></body></html>'
  const out = injectPartnerShopChromeLayoutCss(html)
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_FONT_STYLE_ID}"`))
  assert.match(out, /fonts\.googleapis\.com/)
})

test('extractVisualHtmlBodyMarkup returns inner body only', () => {
  const html = '<html><head><title>x</title></head><body><main>Shop</main></body></html>'
  assert.equal(extractVisualHtmlBodyMarkup(html), '<main>Shop</main>')
})

test('buildPartnerShopFontCss pins UI vs display stacks', () => {
  const css = buildPartnerShopFontCss()
  assert.match(css, /font-family:var\(--pw-font-ui\)/)
  assert.match(css, /font-family:var\(--pw-font-display\)/)
})

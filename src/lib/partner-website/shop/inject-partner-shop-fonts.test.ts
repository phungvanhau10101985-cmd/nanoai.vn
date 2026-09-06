import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopFontCss,
  extractVisualHtmlBodyMarkup,
  extractVisualHtmlDocumentCodes,
  extractVisualHtmlLook,
  extractVisualHtmlPageKind,
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

test('extractVisualHtmlPageKind reads html then body', () => {
  assert.equal(
    extractVisualHtmlPageKind('<html data-pw-page="product"><body data-pw-page="home"></body></html>'),
    'product'
  )
  assert.equal(
    extractVisualHtmlPageKind('<html><body data-pw-page="product"><main></main></body></html>'),
    'product'
  )
  assert.equal(extractVisualHtmlPageKind('<html><body></body></html>'), '')
})

test('extractVisualHtmlLook reads html then body', () => {
  assert.equal(
    extractVisualHtmlLook('<html data-pw-look="marketplace"><body></body></html>'),
    'marketplace'
  )
  assert.equal(
    extractVisualHtmlLook('<html><body data-pw-look="marketplace"></body></html>'),
    'marketplace'
  )
  assert.equal(extractVisualHtmlLook('<html><body></body></html>'), '')
})

test('extractVisualHtmlDocumentCodes copies live document codes from html tags only', () => {
  const codes = extractVisualHtmlDocumentCodes(
    '<html data-pw-page="home" data-pw-look="shop" data-pw-coordinate-version="4" data-pw-edit-device="desktop"><head><style>html[data-pw-look="marketplace"]{}</style></head><body></body></html>'
  )
  assert.equal(codes['data-pw-page'], 'home')
  assert.equal(codes['data-pw-look'], 'shop')
  assert.equal(codes['data-pw-coordinate-version'], '4')
  assert.equal(codes['data-pw-edit-device'], undefined)
})

test('buildPartnerShopFontCss pins UI vs display stacks', () => {
  const css = buildPartnerShopFontCss()
  assert.match(css, /font-family:var\(--pw-font-ui\)/)
  assert.match(css, /font-family:var\(--pw-font-display\)/)
})

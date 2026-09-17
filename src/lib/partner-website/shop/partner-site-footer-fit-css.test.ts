import assert from 'node:assert/strict'
import test from 'node:test'
import {
  injectPartnerShopFooterFitCss,
  PW_SHOP_FOOTER_FIT_CSS,
  PW_SHOP_FOOTER_FIT_STYLE_ID,
} from '@/lib/partner-website/shop/partner-site-footer-fit-css'

test('footer fit CSS stacks newsletter on mobile and lets the email field shrink', () => {
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html \.pw-newsletter[\s\S]*flex-direction:column!important/)
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html \.pw-newsletter input[\s\S]*min-width:0!important/)
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html \.pw-newsletter button[\s\S]*white-space:normal!important/)
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html \.pw-footer-grid[\s\S]*grid-template-columns:minmax\(0,1fr\)!important/)
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html \.pw-footer-grid[\s\S]*min-width:0!important/)
  assert.match(PW_SHOP_FOOTER_FIT_CSS, /html\[data-pw-edit-device="desktop"\] \.pw-newsletter[\s\S]*flex-direction:row!important/)
  assert.doesNotMatch(PW_SHOP_FOOTER_FIT_CSS, /overflow-x:clip/)
})

test('injectPartnerShopFooterFitCss appends once before </body>', () => {
  const html = '<!DOCTYPE html><html><head></head><body><footer class="pw-footer"><form class="pw-newsletter"></form></footer></body></html>'
  const once = injectPartnerShopFooterFitCss(html)
  const twice = injectPartnerShopFooterFitCss(once)
  assert.equal(once.split(`id="${PW_SHOP_FOOTER_FIT_STYLE_ID}"`).length - 1, 1)
  assert.equal(twice.split(`id="${PW_SHOP_FOOTER_FIT_STYLE_ID}"`).length - 1, 1)
  assert.match(once, new RegExp(`<style id="${PW_SHOP_FOOTER_FIT_STYLE_ID}">[\\s\\S]*<\\/style>\\s*<\\/body>`))
})

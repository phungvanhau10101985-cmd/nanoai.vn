import assert from 'node:assert/strict'
import test from 'node:test'
import { WEB_LOCALES } from '@/lib/i18n/config'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildPartnerSiteShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import {
  isPdpCartTriggerForTest,
  PRODUCT_VARIANT_MODAL_COPY,
  PW_PRODUCT_VARIANT_MODAL_CSS,
  PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS,
  resolveVariantModalFace,
  variantModalMaxQty,
  variantModalShowsLowStock,
} from '@/lib/partner-website/shop/partner-site-product-variant-modal'

test('variant modal copy exists for all shop locales', () => {
  for (const locale of WEB_LOCALES) {
    const copy = PRODUCT_VARIANT_MODAL_COPY[locale]
    assert.ok(copy.title)
    assert.ok(copy.sku.includes('{sku}'))
    assert.ok(copy.lineTotal.includes('{n}'))
    assert.ok(copy.add)
    assert.ok(copy.buy)
  }
})

test('variant modal CSS matches 188 layout and theme tokens', () => {
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /data-pw-variant-modal/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /data-pw-variant-face="wide"/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /data-pw-variant-face="compact"/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /max-width:48rem/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /--pw-buy/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_CSS, /--pw-cart/)
  assert.doesNotMatch(PW_PRODUCT_VARIANT_MODAL_CSS, /#ea580c|#f97316/)
  const theme = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(theme, /data-pw-variant-modal/)
})

test('variant modal face follows device lock then viewport', () => {
  assert.equal(resolveVariantModalFace({ editDevice: 'mobile' }), 'compact')
  assert.equal(resolveVariantModalFace({ sceneLock: 'tablet' }), 'wide')
  assert.equal(resolveVariantModalFace({ queryDevice: 'desktop' }), 'wide')
  assert.equal(resolveVariantModalFace({ viewportMinMd: true }), 'wide')
  assert.equal(resolveVariantModalFace({ viewportMinMd: false }), 'compact')
})

test('variant modal does not block purchase when stock is unset', () => {
  assert.equal(variantModalMaxQty(0), 99)
  assert.equal(variantModalMaxQty(null), 99)
  assert.equal(variantModalMaxQty(2), 2)
  assert.equal(variantModalShowsLowStock(0), false)
  assert.equal(variantModalShowsLowStock(2), true)
  assert.equal(variantModalShowsLowStock(9), false)
})

test('PDP add/buy opens variant modal; catalog cards do not', () => {
  assert.equal(isPdpCartTriggerForTest({ inPdp: true }), true)
  assert.equal(isPdpCartTriggerForTest({ pageProduct: true }), true)
  assert.equal(isPdpCartTriggerForTest({ inCatalog: true, pageProduct: true }), false)
})

test('shop-actions injects PDP variant modal before add-to-cart', () => {
  const script = buildPartnerSiteShopActionsBootstrapScript({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(script, /openPdpVariantModal/)
  assert.match(script, /isPdpCartTrigger/)
  assert.match(script, /data-pw-variant-modal/)
  assert.match(script, /Thêm vào Giỏ hàng/)
  assert.match(script, /Số lượng \(hàng order\)/)
  assert.match(PW_PRODUCT_VARIANT_MODAL_RUNTIME_JS, /openPdpVariantModal/)
})

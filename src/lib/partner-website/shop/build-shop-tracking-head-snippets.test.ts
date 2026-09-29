import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopGoogleTagInstall,
  injectPartnerShopLiveTrackingHtml,
} from '@/lib/partner-website/shop/build-shop-tracking-head-snippets'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

const baseHtml = '<!DOCTYPE html><html><head><title>Shop</title></head><body><main>ok</main></body></html>'

test('injectPartnerShopLiveTrackingHtml adds verify metas, GTM noscript, sanitized custom HTML', () => {
  const config: PartnerSiteShopTrackingConfig = {
    ga4MeasurementId: 'G-TEST',
    facebookPixelId: '123',
    googleAdsId: 'AW-1',
    tiktokPixelId: 'CABC',
    gtmContainerId: 'GTM-XXXX',
    googleSearchConsoleVerify: 'gsc-ok',
    facebookDomainVerification: 'fb-ok',
    customEmbedHeadHtml: '<meta name="custom-ok" content="1">',
    customEmbedBodyOpenHtml: '<noscript>open</noscript>',
    customEmbedBodyCloseHtml: '<script src="https://www.googletagmanager.com/gtag/js?id=AW-1"></script>',
  }
  const out = injectPartnerShopLiveTrackingHtml(baseHtml, config)
  assert.match(out, /name="google-site-verification" content="gsc-ok"/)
  assert.match(out, /name="facebook-domain-verification" content="fb-ok"/)
  assert.match(out, /data-pw-shop-gtm-noscript/)
  assert.match(out, /googletagmanager\.com\/ns\.html\?id=GTM-XXXX/)
  assert.match(out, /pw-custom-head/)
  assert.match(out, /name="custom-ok"/)
  assert.match(out, /pw-custom-body-open/)
  assert.match(out, /pw-custom-body-close/)
  assert.doesNotMatch(out, /fbq\('track','PageView'\)/)
  assert.doesNotMatch(out, /ttq\.page\(\)/)
})

test('injectPartnerShopLiveTrackingHtml no-ops without config', () => {
  assert.equal(injectPartnerShopLiveTrackingHtml(baseHtml, null), baseHtml)
})

test('Google tag install measures on arrival with consent granted', () => {
  const install = buildPartnerShopGoogleTagInstall({
    ga4MeasurementId: 'g-ptgcs6yczf',
    googleAdsId: 'AW-999',
  })
  assert.ok(install)
  assert.equal(install.scriptId, 'shop-gtag-js-G-PTGCS6YCZF')
  assert.equal(install.src, 'https://www.googletagmanager.com/gtag/js?id=G-PTGCS6YCZF')
  assert.match(install.inlineJs, /analytics_storage:'granted'/)
  assert.match(install.inlineJs, /gtag\('config','G-PTGCS6YCZF',\{send_page_view:false\}\)/)
  assert.match(install.inlineJs, /gtag\('config','AW-999'\)/)
  assert.doesNotMatch(install.inlineJs, /localStorage/)
  assert.doesNotMatch(install.inlineJs, /denied/)
})

test('Google tag install ignores empty ids', () => {
  assert.equal(buildPartnerShopGoogleTagInstall({ ga4MeasurementId: 'UA-1', googleAdsId: '' }), null)
})

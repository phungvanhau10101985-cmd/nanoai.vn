import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerShopGoogleTagInstall,
  buildPartnerShopGtmInstall,
  buildPartnerShopMetaPixelInstall,
  buildPartnerShopTiktokPixelInstall,
  injectPartnerShopLiveTrackingHtml,
} from '@/lib/partner-website/shop/build-shop-tracking-head-snippets'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

const baseHtml = '<!DOCTYPE html><html><head><title>Shop</title></head><body><main>ok</main></body></html>'

test('injectPartnerShopLiveTrackingHtml adds verify metas and sanitized custom HTML', () => {
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
  assert.doesNotMatch(out, /data-pw-shop-gtm-noscript/)
  assert.doesNotMatch(out, /googletagmanager\.com\/gtm\.js/)
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
  assert.match(install.inlineJs, /__nanoShopAdsPageViewTracked=true/)
  assert.doesNotMatch(install.inlineJs, /localStorage/)
  assert.doesNotMatch(install.inlineJs, /denied/)
})

test('Google tag install ignores empty ids', () => {
  assert.equal(buildPartnerShopGoogleTagInstall({ ga4MeasurementId: 'UA-1', googleAdsId: '' }), null)
})

test('Meta pixel install fires PageView in the first HTML and ignores snippets', () => {
  const install = buildPartnerShopMetaPixelInstall('1282319314072647')
  assert.ok(install)
  assert.equal(install.pixelId, '1282319314072647')
  assert.match(install.inlineJs, /connect\.facebook\.net\/en_US\/fbevents\.js/)
  assert.match(install.inlineJs, /fbq\('set','autoConfig',false,'1282319314072647'\)/)
  assert.match(install.inlineJs, /fbq\('init','1282319314072647'\)/)
  assert.match(install.inlineJs, /fbq\('track','PageView'\)/)
  assert.match(install.inlineJs, /__nanoShopMetaPageViewTracked=true/)
  assert.equal(buildPartnerShopMetaPixelInstall("fbq('init','1282319314072647')"), null)
  assert.equal(buildPartnerShopMetaPixelInstall(''), null)
})

test('TikTok pixel install pages once in the first HTML', () => {
  const install = buildPartnerShopTiktokPixelInstall('D1A2B3C4E5F6')
  assert.ok(install)
  assert.match(install.inlineJs, /analytics\.tiktok\.com\/i18n\/pixel\/events\.js/)
  assert.match(install.inlineJs, /ttq\.load\('D1A2B3C4E5F6'\)/)
  assert.match(install.inlineJs, /ttq\.page\(\)/)
  assert.match(install.inlineJs, /__nanoShopTiktokPageTracked=true/)
  assert.match(install.inlineJs, /__nanoShopTiktokPixelId='D1A2B3C4E5F6'/)
  assert.equal(buildPartnerShopTiktokPixelInstall('short'), null)
  assert.equal(buildPartnerShopTiktokPixelInstall(''), null)
})

test('GTM install loads the container in the first HTML', () => {
  const install = buildPartnerShopGtmInstall('gtm-abc123')
  assert.ok(install)
  assert.equal(install.containerId, 'GTM-ABC123')
  assert.match(install.inlineJs, /shop-gtm-js-/)
  assert.match(install.inlineJs, /googletagmanager\.com\/gtm\.js\?id=/)
  assert.match(install.inlineJs, /GTM-ABC123/)
  assert.equal(buildPartnerShopGtmInstall('G-PTGCS6YCZF'), null)
})

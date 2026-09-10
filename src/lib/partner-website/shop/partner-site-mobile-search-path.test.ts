import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPartnerCustomDomainPathToInternal } from '@/lib/messaging/partner-custom-domain-site-path'
import {
  isPartnerMobileSearchComposePath,
  isPartnerShopMobileSearchComposeFace,
  partnerSiteMobileSearchPath,
} from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import { partnerSiteSearchPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

test('mobile compose path is /tim-kiem, results stay on /search?q=', () => {
  assert.equal(partnerSiteMobileSearchPath('188-shop'), '/site/188-shop/tim-kiem')
  assert.equal(
    partnerSiteMobileSearchPath('188-shop', { q: 'váy hoa' }),
    '/site/188-shop/tim-kiem?q=' + encodeURIComponent('váy hoa')
  )
  assert.equal(partnerSiteMobileSearchPath('188-shop', { customDomain: true }), '/tim-kiem')
  assert.equal(
    partnerSiteMobileSearchPath('188-shop', { customDomain: true, q: 'túi' }),
    '/tim-kiem?q=' + encodeURIComponent('túi')
  )
  assert.equal(partnerSiteSearchPath('188-shop', { q: 'váy hoa' }), '/site/188-shop/search?q=' + encodeURIComponent('váy hoa'))
})

test('compose path detector matches platform and custom-domain URLs', () => {
  assert.equal(isPartnerMobileSearchComposePath('/tim-kiem'), true)
  assert.equal(isPartnerMobileSearchComposePath('/tim-kiem/'), true)
  assert.equal(isPartnerMobileSearchComposePath('/site/188-shop/tim-kiem'), true)
  assert.equal(isPartnerMobileSearchComposePath('/site/188-shop/search'), false)
  assert.equal(isPartnerMobileSearchComposePath('/site/188-shop/tim-theo-anh'), false)
})

test('compose face is phone-only — stamp wins over viewport', () => {
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ sceneLock: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ queryDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'desktop', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'tablet', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'laptop', viewportMobile: true }), false)
  assert.equal(isPartnerShopMobileSearchComposeFace({ viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ viewportMobile: false }), false)
})

test('custom domain /tim-kiem maps to the shop compose route', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/tim-kiem'), '/site/188-shop/tim-kiem')
})

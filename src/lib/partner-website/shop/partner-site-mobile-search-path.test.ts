import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPartnerCustomDomainPathToInternal } from '@/lib/messaging/partner-custom-domain-site-path'
import {
  isPartnerMobileSearchComposePath,
  isPartnerShopMobileSearchComposeFace,
  partnerSiteMobileSearchPath,
} from '@/lib/partner-website/shop/partner-site-mobile-search-path'
import { partnerSiteSearchPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

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

test('compose face is every device — like 188 Header Link to /tim-kiem', () => {
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ sceneLock: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ queryDevice: 'mobile' }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'desktop', viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'tablet', viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ editDevice: 'laptop', viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ viewportMobile: true }), true)
  assert.equal(isPartnerShopMobileSearchComposeFace({ viewportMobile: false }), true)
})

test('custom domain /tim-kiem maps to the shop compose route', () => {
  assert.equal(mapPartnerCustomDomainPathToInternal('188-shop', '/tim-kiem'), '/site/188-shop/tim-kiem')
})

test('mobile compose copy has a visual empty-history hint in every locale', () => {
  for (const locale of ['vi', 'en', 'zh', 'ja', 'ko'] as const) {
    const copy = getPartnerSiteShopCopy(locale)
    assert.equal(copy.searchHistoryEmptyHint.length > 8, true)
    assert.equal(copy.searchQuickNew.length > 1, true)
    assert.equal(copy.searchQuickAria.length > 1, true)
    assert.equal(copy.searchTileBadge.length > 0, true)
    assert.equal(copy.searchSuggestTapTyped.length > 4, true)
  }
})

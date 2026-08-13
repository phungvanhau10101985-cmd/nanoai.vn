import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVisualEditorChromeWidgetHtml,
  chromeWidgetAppearance,
  chromeWidgetHost,
  chromeWidgetHref,
  isVisualEditorChromeWidgetKind,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  partnerSiteAccountPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteInfoPath,
  partnerSiteNanoAiLoginHref,
  partnerSiteOrdersPath,
  partnerSiteRecentlyViewedPath,
  partnerSiteWishlistPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'

test('chrome widgets accept shop header kinds', () => {
  assert.equal(isVisualEditorChromeWidgetKind('wishlist'), true)
  assert.equal(isVisualEditorChromeWidgetKind('orders'), true)
  assert.equal(isVisualEditorChromeWidgetKind('contact'), true)
  assert.equal(isVisualEditorChromeWidgetKind('login'), true)
  assert.equal(isVisualEditorChromeWidgetKind('favorites-link'), true)
  assert.equal(isVisualEditorChromeWidgetKind('orders-link'), true)
  assert.equal(isVisualEditorChromeWidgetKind('account'), true)
  assert.equal(isVisualEditorChromeWidgetKind('wallet'), false)
})

test('chrome widgets place icons in header actions and text in topbar', () => {
  assert.equal(chromeWidgetHost('cart'), 'actions')
  assert.equal(chromeWidgetHost('orders'), 'actions')
  assert.equal(chromeWidgetAppearance('wishlist'), 'icon')
  assert.equal(chromeWidgetHost('contact'), 'topbar')
  assert.equal(chromeWidgetHost('login'), 'topbar')
  assert.equal(chromeWidgetAppearance('favorites-link'), 'link')
})

test('chrome widgets wire each kind to the real shop route', () => {
  assert.equal(chromeWidgetHref('wishlist', '188-shop'), partnerSiteWishlistPath('188-shop'))
  assert.equal(
    chromeWidgetHref('recently-viewed', '188-shop'),
    partnerSiteRecentlyViewedPath('188-shop')
  )
  assert.equal(chromeWidgetHref('cart', '188-shop'), partnerSiteCartPath('188-shop'))
  assert.equal(chromeWidgetHref('orders', '188-shop'), partnerSiteOrdersPath('188-shop'))
  assert.equal(chromeWidgetHref('orders-link', '188-shop'), partnerSiteOrdersPath('188-shop'))
  assert.equal(chromeWidgetHref('account', '188-shop'), partnerSiteAccountPath('188-shop'))
  assert.equal(chromeWidgetHref('addresses', '188-shop'), partnerSiteAddressesPath('188-shop'))
  assert.equal(chromeWidgetHref('contact', '188-shop'), partnerSiteInfoPath('188-shop', 'contact'))
  assert.equal(chromeWidgetHref('favorites-link', '188-shop'), partnerSiteWishlistPath('188-shop'))
  assert.equal(
    chromeWidgetHref('login', '188-shop'),
    partnerSiteNanoAiLoginHref(partnerSiteAccountPath('188-shop'))
  )
})

test('chrome widgets emit icon markup with API badge hook', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'wishlist',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(html, /data-pw-chrome-btn="wishlist"/)
  assert.match(html, /class="pw-icon-btn"/)
  assert.match(html, /data-pw-chrome-badge/)
  assert.ok(html.includes(partnerSiteWishlistPath('188-shop')))
  assert.match(html, /draggable="false"/)
})

test('chrome widgets emit topbar text links without icon badge', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'orders-link',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(html, /data-pw-chrome-btn="orders-link"/)
  assert.match(html, /class="pw-chrome-link"/)
  assert.doesNotMatch(html, /data-pw-chrome-badge/)
  assert.ok(html.includes(partnerSiteOrdersPath('188-shop')))
  assert.match(html, /Đơn hàng/)
})

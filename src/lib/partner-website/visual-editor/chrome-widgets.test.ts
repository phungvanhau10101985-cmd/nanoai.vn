import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildVisualEditorChromeWidgetHtml,
  chromeWidgetAppearance,
  chromeWidgetHost,
  chromeWidgetHref,
  isVisualEditorChromeWidgetKind,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
  partnerSiteAccountTabPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
  partnerSiteNanoAiLoginHref,
  partnerSiteOrdersPath,
  partnerSiteOrderTrackingPath,
  partnerSiteProductsPath,
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
  assert.equal(isVisualEditorChromeWidgetKind('wallet'), true)
  assert.equal(isVisualEditorChromeWidgetKind('home'), true)
  assert.equal(isVisualEditorChromeWidgetKind('categories'), true)
  assert.equal(isVisualEditorChromeWidgetKind('search'), true)
  assert.equal(isVisualEditorChromeWidgetKind('search-image'), true)
  assert.equal(isVisualEditorChromeWidgetKind('chat'), true)
  assert.equal(isVisualEditorChromeWidgetKind('notifications'), true)
})

test('chrome widget picker lists every shop destination in each place group', () => {
  assert.deepEqual(
    VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS.map((group) => group.id),
    ['header', 'mid', 'nav']
  )
  const kinds = VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS[0]?.kinds || []
  assert.equal(new Set(kinds).size, kinds.length)
  assert.ok(kinds.includes('home'))
  assert.ok(kinds.includes('categories'))
  assert.ok(kinds.includes('search'))
  assert.ok(kinds.includes('search-image'))
  assert.ok(kinds.includes('wallet'))
  assert.ok(kinds.includes('blog'))
  assert.ok(!kinds.includes('favorites-link'))
  assert.ok(!kinds.includes('orders-link'))
  for (const group of VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS) {
    assert.deepEqual(group.kinds, kinds)
  }
})

test('chrome widgets place icons in header actions and text in topbar', () => {
  assert.equal(chromeWidgetHost('cart'), 'actions')
  assert.equal(chromeWidgetHost('orders'), 'actions')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label'), 'actions')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label', 'header'), 'actions')
  assert.equal(chromeWidgetHost('login', 'icon-label', 'nav'), 'nav')
  assert.equal(chromeWidgetHost('login', 'text', 'nav'), 'nav')
  assert.equal(chromeWidgetHost('login', 'icon-label', 'mid'), 'mid')
  assert.equal(chromeWidgetHost('login', 'text', 'header'), 'topbar')
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
  assert.equal(chromeWidgetHref('home', '188-shop'), partnerSiteHomePath('188-shop'))
  assert.equal(chromeWidgetHref('products', '188-shop'), partnerSiteProductsPath('188-shop'))
  assert.equal(chromeWidgetHref('sale', '188-shop'), partnerSiteInfoPath('188-shop', 'sale'))
  assert.equal(chromeWidgetHref('wallet', '188-shop'), partnerSiteAccountTabPath('188-shop', 'wallet'))
  assert.equal(chromeWidgetHref('edit-profile', '188-shop'), partnerSiteAccountEditPath('188-shop'))
  assert.equal(chromeWidgetHref('order-tracking', '188-shop'), partnerSiteOrderTrackingPath('188-shop'))
  assert.equal(chromeWidgetHref('about', '188-shop'), partnerSiteInfoPath('188-shop', 'about'))
  assert.equal(
    chromeWidgetHref('login', '188-shop'),
    partnerSiteNanoAiLoginHref(partnerSiteAccountPath('188-shop'))
  )
})

test('chrome widgets emit chat as a shop chat button', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(html, /<button type="button"/)
  assert.match(html, /data-pw-chrome-btn="chat"/)
  assert.match(html, /data-nanoai-open-chat/)
  assert.match(html, /Chat mua/)
  assert.doesNotMatch(html, / href=/)
})

test('chrome widgets emit category toggle as cat-toggle button', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'categories',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(html, /<button type="button"/)
  assert.match(html, /data-pw-el="cat-toggle"/)
  assert.match(html, /data-pw-cat-toggle/)
  assert.match(html, /aria-controls="pw-shop-cat-panel"/)
  assert.match(html, /Danh mục/)
  assert.doesNotMatch(html, / href=/)
  assert.doesNotMatch(html, /data-pw-chrome-btn/)
})

test('chrome widgets emit search box with image search and submit', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'search',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(html, /data-pw-el="search"/)
  assert.match(html, /data-pw-search/)
  assert.match(html, /data-pw-image-search/)
  assert.match(html, /pw-search-submit/)
  assert.match(html, /Tìm sản phẩm/)
  assert.match(html, /Tìm bằng ảnh/)
  assert.doesNotMatch(html, /data-pw-chrome-btn/)
  assert.doesNotMatch(html, / href=/)
})

test('chrome widgets emit image-search camera button', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'search-image',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(html, /<button type="button"/)
  assert.match(html, /data-pw-image-search/)
  assert.match(html, /Tìm bằng ảnh/)
  assert.doesNotMatch(html, / href=/)
  assert.doesNotMatch(html, /data-pw-chrome-btn/)
})

test('chrome widgets emit icon markup with API badge hook', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'wishlist',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(html, /data-pw-chrome-btn="wishlist"/)
  assert.match(html, /class="pw-icon-btn pw-shop-icon-btn pw-chrome-has-label"/)
  assert.match(html, /class="pw-shop-nav-icon"/)
  assert.match(html, /width="20"/)
  assert.match(html, /height="20"/)
  assert.match(html, /pw-chrome-btn-label/)
  assert.match(html, /pw-shop-nav-label/)
  assert.match(html, /data-pw-chrome-badge/)
  assert.match(html, /data-pw-chrome-count/)
  assert.match(html, /pw-chrome-icon-wrap/)
  assert.ok(html.includes(partnerSiteWishlistPath('188-shop')))
  assert.match(html, /draggable="false"/)
  const notif = buildVisualEditorChromeWidgetHtml({
    kind: 'notifications',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(notif, /data-pw-chrome-btn="notifications"/)
  assert.match(notif, /data-pw-chrome-badge/)
  assert.match(notif, /data-pw-chrome-count/)
  const viewed = buildVisualEditorChromeWidgetHtml({
    kind: 'recently-viewed',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(viewed, /data-pw-chrome-btn="recently-viewed"/)
  assert.match(viewed, /data-pw-chrome-badge/)
  assert.match(viewed, /data-pw-chrome-count/)
})

test('chrome widgets can emit icon-only or icon+label', () => {
  const iconOnly = buildVisualEditorChromeWidgetHtml({
    kind: 'cart',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(iconOnly, /pw-chrome-icon-only/)
  assert.doesNotMatch(iconOnly, /pw-chrome-btn-label/)
  const both = buildVisualEditorChromeWidgetHtml({
    kind: 'cart',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(both, /pw-chrome-has-label/)
  assert.match(both, /pw-chrome-btn-label/)
  assert.match(both, /Giỏ hàng/)
})

test('chrome widgets emit topbar text links without icon badge', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'orders-link',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'text',
  })
  assert.match(html, /data-pw-chrome-btn="orders-link"/)
  assert.match(html, /class="pw-chrome-link"/)
  assert.doesNotMatch(html, /data-pw-chrome-badge/)
  assert.ok(html.includes(partnerSiteOrdersPath('188-shop')))
  assert.match(html, /Đơn hàng/)
})

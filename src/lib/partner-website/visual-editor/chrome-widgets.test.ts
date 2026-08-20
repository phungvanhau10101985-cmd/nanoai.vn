import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerSiteChatMuaButtonHtml,
  buildVisualEditorChromeWidgetHtml,
  CHROME_FACEBOOK_CHAT_LOGO_SVG,
  CHROME_ZALO_LOGO_SVG,
  chromeWidgetAppearance,
  chromeWidgetHost,
  chromeWidgetHref,
  chromeWidgetLiveHook,
  htmlHasChromeChatMua,
  isChromeFloatKind,
  isVisualEditorChromeWidgetKind,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS,
  VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS,
} from '@/lib/partner-website/visual-editor/chrome-widgets'
import {
  partnerSiteAccountEditPath,
  partnerSiteAccountPath,
  partnerSiteAccountTabPath,
  partnerSiteAddressesPath,
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSiteInfoPath,
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
  assert.equal(isVisualEditorChromeWidgetKind('chat-zalo'), true)
  assert.equal(isVisualEditorChromeWidgetKind('chat-facebook'), true)
  assert.equal(isVisualEditorChromeWidgetKind('topup'), true)
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
  assert.ok(kinds.includes('chat-zalo'))
  assert.ok(kinds.includes('chat-facebook'))
  assert.ok(kinds.includes('topup'))
  assert.ok(kinds.includes('wallet'))
  assert.ok(kinds.includes('blog'))
  assert.ok(!kinds.includes('favorites-link'))
  assert.ok(!kinds.includes('orders-link'))
  for (const group of VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS) {
    assert.deepEqual(group.kinds, kinds)
  }
})

test('chrome widgets place icons in header actions and text in topbar', () => {
  assert.equal(chromeWidgetHost('chat'), 'float')
  assert.equal(chromeWidgetHost('chat', 'icon', 'nav'), 'float')
  assert.equal(chromeWidgetHost('chat-zalo', 'icon-label', 'header'), 'float')
  assert.equal(chromeWidgetHost('topup', 'icon', 'nav'), 'float')
  assert.equal(chromeWidgetHost('cart'), 'actions')
  assert.equal(chromeWidgetHost('orders'), 'actions')
  assert.equal(chromeWidgetHost('wishlist', 'icon-square'), 'actions')
  assert.equal(chromeWidgetAppearance('wishlist', 'icon-square'), 'icon')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label'), 'actions')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label-below'), 'actions')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label-left'), 'actions')
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

test('every picker chrome widget has a live shop hook', () => {
  for (const kind of VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS) {
    const hook = chromeWidgetLiveHook(kind)
    if (hook === 'route') {
      const href = chromeWidgetHref(kind, 'demo-shop')
      assert.notEqual(href, '#')
      assert.match(href, /\/site\/demo-shop(?:\/|$)/)
    } else {
      assert.ok(['search', 'search-image', 'categories', 'chat', 'contact', 'topup'].includes(hook))
    }
  }
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
    partnerSiteAccountPath('188-shop')
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
  assert.match(html, /data-pw-chrome-float="1"/)
  assert.doesNotMatch(html, / href=/)
})

test('chrome float widgets pin chat and top-up on the viewport', () => {
  assert.equal(isChromeFloatKind('chat'), true)
  assert.equal(isChromeFloatKind('chat-zalo'), true)
  assert.equal(isChromeFloatKind('chat-facebook'), true)
  assert.equal(isChromeFloatKind('topup'), true)
  assert.equal(isChromeFloatKind('cart'), false)
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'topup',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(html, /data-pw-chrome-btn="topup"/)
  assert.match(html, /data-pw-chrome-float="1"/)
  assert.match(html, /<button type="button"/)
  assert.match(html, /Lên đầu trang/)
})

test('chrome Chat Zalo and Facebook use official logos and settings URLs', () => {
  assert.equal(isVisualEditorChromeWidgetKind('chat-zalo'), true)
  assert.equal(isVisualEditorChromeWidgetKind('chat-facebook'), true)
  const zalo = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-zalo',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    href: 'https://zalo.me/188shop',
  })
  assert.match(zalo, /data-pw-chrome-btn="chat-zalo"/)
  assert.match(zalo, /data-pw-chrome-float="1"/)
  assert.match(zalo, /data-pw-contact-channel="zalo"/)
  assert.match(zalo, /href="https:\/\/zalo\.me\/188shop"/)
  assert.match(zalo, /Chat Zalo/)
  assert.ok(zalo.includes(CHROME_ZALO_LOGO_SVG) || zalo.includes('pw-chrome-brand-logo'))
  assert.match(zalo, /#0068FF/)
  const fb = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-facebook',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    href: 'https://m.me/188shop',
  })
  assert.match(fb, /data-pw-chrome-btn="chat-facebook"/)
  assert.match(fb, /data-pw-chrome-float="1"/)
  assert.match(fb, /data-pw-contact-channel="facebook"/)
  assert.match(fb, /href="https:\/\/m\.me\/188shop"/)
  assert.match(fb, /Chat Facebook/)
  assert.ok(fb.includes(CHROME_FACEBOOK_CHAT_LOGO_SVG) || fb.includes('pw-chrome-brand-logo'))
  assert.match(fb, /#1877F2/)
})

test('chrome Chat mua helper stamps logo and embed API, never a NanoAI FAB', () => {
  const html = buildPartnerSiteChatMuaButtonHtml({
    siteSlug: '188-shop',
    locale: 'vi',
    logoUrl: 'https://cdn.example.com/shop-logo.png',
  })
  assert.equal(htmlHasChromeChatMua(html), true)
  assert.match(html, /data-nanoai-open-chat/)
  assert.match(html, /pw-chrome-chat-logo/)
  assert.doesNotMatch(html, /pw-fab-chat/)
  assert.equal(htmlHasChromeChatMua('<button class="pw-fab-chat" data-nanoai-open-chat>💬</button>'), false)
})

test('chrome chat button uses shop logo when provided', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    logoUrl: 'https://cdn.example.com/chat-logo.png',
  })
  assert.match(html, /pw-chrome-chat-logo/)
  assert.match(html, /src="https:\/\/cdn\.example\.com\/chat-logo\.png"/)
  assert.doesNotMatch(html, /<svg/)
})

test('chrome chat button prefers shared chat icon logo over shop logo', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    logoUrl: 'https://cdn.example.com/shop-logo.png',
    chatIconLogoUrl: 'https://cdn.example.com/chat-icon.png',
  })
  assert.match(html, /src="https:\/\/cdn\.example\.com\/chat-icon\.png"/)
  assert.match(html, /data-pw-chat-icon-logo="1"/)
  assert.doesNotMatch(html, /shop-logo\.png/)
})

test('chrome widgets emit category toggle as cat-toggle button', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'categories',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
  })
  assert.match(html, /pw-chrome-cat-wrap/)
  assert.match(html, /<button type="button"/)
  assert.match(html, /data-pw-el="cat-toggle"/)
  assert.match(html, /data-pw-cat-toggle/)
  assert.match(html, /aria-controls="pw-shop-cat-panel"/)
  assert.match(html, /data-pw-cat-panel/)
  assert.match(html, /id="pw-shop-cat-panel"/)
  assert.match(html, /Danh mục/)
  assert.doesNotMatch(html, / href=/)
  assert.match(html, /data-pw-chrome-btn="categories"/)
})

test('chrome widgets emit account link to account page (no dropdown)', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'account',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(html, /data-pw-chrome-btn="account"/)
  assert.match(html, /data-pw-el="account"/)
  assert.ok(html.includes(partnerSiteAccountPath('188-shop')))
  assert.doesNotMatch(html, /data-pw-account-toggle/)
  assert.doesNotMatch(html, /data-pw-account-panel/)
  assert.doesNotMatch(html, /data-pw-el="menu-item"/)
  assert.doesNotMatch(html, />Tài khoản<\/span>/)
})

test('chrome Chat Zalo without settings URL stays pending (no # href)', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-zalo',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(html, /data-pw-contact-pending="1"/)
  assert.match(html, /data-pw-contact-channel="zalo"/)
  assert.doesNotMatch(html, / href=/)
  assert.doesNotMatch(html, /href="#"/)
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
  assert.match(html, /pw-shop-search-submit-icon/)
  assert.match(html, /<circle cx="11" cy="11" r="7"/)
  assert.match(html, /Tìm sản phẩm/)
  assert.match(html, /Tìm bằng ảnh/)
  assert.match(html, /data-pw-chrome-btn="search"/)
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
  assert.match(html, /data-pw-chrome-btn="search-image"/)
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

test('chrome widgets stamp icon size for the add slider', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-zalo',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    iconSize: 30,
  })
  assert.match(html, /data-pw-chrome-size="30"/)
  assert.match(html, /--pw-chrome-size:30px/)
  assert.match(html, /pw-chrome-icon-only/)
  const pill = buildVisualEditorChromeWidgetHtml({
    kind: 'cart',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label',
    iconSize: 18,
  })
  assert.match(pill, /data-pw-chrome-size="18"/)
  assert.match(pill, /pw-chrome-has-label/)
  const saleText = buildVisualEditorChromeWidgetHtml({
    kind: 'sale',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'text',
    iconSize: 40,
  })
  assert.match(saleText, /data-pw-chrome-size="40"/)
  assert.match(saleText, /data-pw-chrome-style="text"/)
})

test('chrome widgets can emit rounded-square icon-only', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-facebook',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-square',
  })
  assert.match(html, /pw-chrome-icon-square/)
  assert.match(html, /pw-chrome-icon-only/)
  assert.match(html, /data-pw-chrome-style="icon-square"/)
  assert.doesNotMatch(html, /pw-chrome-btn-label/)
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
  const below = buildVisualEditorChromeWidgetHtml({
    kind: 'recently-viewed',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label-below',
  })
  assert.match(below, /pw-chrome-label-below/)
  assert.match(below, /data-pw-chrome-style="icon-label-below"/)
  const left = buildVisualEditorChromeWidgetHtml({
    kind: 'wishlist',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label-left',
  })
  assert.match(left, /pw-chrome-label-left/)
  assert.match(left, /data-pw-chrome-style="icon-label-left"/)
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

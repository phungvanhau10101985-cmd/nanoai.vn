import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerSiteChatMuaButtonHtml,
  buildVisualEditorChromeWidgetHtml,
  PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS,
  PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS,
  PW_CHROME_TOKEN_VARS_CSS,
  PW_SEARCH_IMAGE_IN_FORM_BTN_CSS,
  PW_STOCK_CHROME_EDIT_CSS,
  PW_CHROME_LABELED_MIN_W_CSS,
  PW_CHROME_ICON_CIRCLE_CSS,
  PW_CHROME_ICON_SQUARE_CSS,
  PW_CHROME_LABEL_FACE_CSS,
  PW_CHROME_FACE_EXTRAS_CSS,
  PW_CHROME_LABEL_BELOW_CSS,
  PW_CHROME_ICON_SIZE_MAX,
  chromeKindDefaultLabels,
  chromeKindShowsCountBadge,
  clampPwImageRadius,
  clampPwChromeLabelSize,
  chromeLabelSizeFromIcon,
  CHROME_FACEBOOK_CHAT_LOGO_SVG,
  CHROME_INSTAGRAM_LOGO_SVG,
  CHROME_WHATSAPP_LOGO_SVG,
  CHROME_ZALO_LOGO_SVG,
  chromeWidgetAppearance,
  chromeWidgetHost,
  chromeWidgetHref,
  chromeWidgetLiveHook,
  htmlHasChromeChatMua,
  isChromeFloatKind,
  isFooterAddChromeKind,
  isGapOnlyChromeAddKind,
  isProductActionChromeKind,
  isVisualEditorChromeWidgetKind,
  FOOTER_ADD_CHROME_KINDS,
  PW_FOOTER_ADDED_ATTR,
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
  partnerSiteLoginPath,
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

test('chrome widget picker lists every shop destination once', () => {
  const kinds = VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS
  assert.equal(new Set(kinds).size, kinds.length)
  assert.ok(kinds.includes('home'))
  assert.ok(kinds.includes('categories'))
  assert.ok(kinds.includes('search'))
  assert.ok(kinds.includes('search-image'))
  assert.ok(kinds.includes('chat-zalo'))
  assert.ok(kinds.includes('chat-facebook'))
  assert.ok(kinds.includes('topup'))
  assert.ok(kinds.includes('wallet'))
  assert.ok(kinds.includes('try-on'))
  assert.ok(kinds.includes('favorite-product'))
  assert.ok(kinds.includes('add-cart'))
  assert.ok(kinds.includes('buy-now'))
  assert.ok(kinds.includes('blog'))
  assert.ok(!kinds.includes('favorites-link'))
  assert.ok(!kinds.includes('orders-link'))
  assert.ok(VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS.length >= 1)
  assert.deepEqual(VISUAL_EDITOR_CHROME_WIDGET_PICKER_GROUPS[0]?.kinds, kinds)
})

test('form sections are gap-only adds, not toolbar Thêm', () => {
  assert.equal(isGapOnlyChromeAddKind('lead-form'), true)
  assert.equal(isGapOnlyChromeAddKind('coupon'), true)
  assert.equal(isGapOnlyChromeAddKind('stores'), false)
  assert.equal(isGapOnlyChromeAddKind('contact'), false)
})

test('footer add kinds stay in-flow links, never float or head kit', () => {
  assert.equal(PW_FOOTER_ADDED_ATTR, 'data-pw-footer-added')
  assert.ok(FOOTER_ADD_CHROME_KINDS.includes('home'))
  assert.ok(FOOTER_ADD_CHROME_KINDS.includes('about'))
  assert.ok(FOOTER_ADD_CHROME_KINDS.includes('contact'))
  assert.ok(FOOTER_ADD_CHROME_KINDS.includes('privacy'))
  assert.ok(FOOTER_ADD_CHROME_KINDS.includes('phone'))
  assert.equal(isFooterAddChromeKind('privacy'), true)
  assert.equal(isFooterAddChromeKind('chat'), false)
  assert.equal(isFooterAddChromeKind('chat-zalo'), false)
  assert.equal(isFooterAddChromeKind('chat-facebook'), false)
  assert.equal(isFooterAddChromeKind('topup'), false)
  assert.equal(isFooterAddChromeKind('search'), false)
  assert.equal(isFooterAddChromeKind('categories'), false)
  assert.equal(isFooterAddChromeKind('cart'), false)
  assert.equal(isFooterAddChromeKind('lead-form'), false)
  assert.equal(isFooterAddChromeKind('coupon'), false)
  for (const kind of FOOTER_ADD_CHROME_KINDS) {
    assert.equal(isVisualEditorChromeWidgetKind(kind), true)
    assert.equal(isChromeFloatKind(kind), false)
    assert.ok(VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS.includes(kind))
  }
})

test('chrome widgets from Thêm land on canvas, float kinds stay float', () => {
  assert.equal(chromeWidgetHost('chat'), 'float')
  assert.equal(chromeWidgetHost('chat', 'icon', 'nav'), 'float')
  assert.equal(chromeWidgetHost('chat-zalo', 'icon-label', 'header'), 'float')
  assert.equal(chromeWidgetHost('topup', 'icon', 'nav'), 'float')
  assert.equal(chromeWidgetHost('cart'), 'canvas')
  assert.equal(chromeWidgetHost('orders'), 'canvas')
  assert.equal(chromeWidgetHost('wishlist', 'icon-square'), 'canvas')
  assert.equal(chromeWidgetAppearance('wishlist', 'icon-square'), 'icon')
  assert.equal(chromeWidgetAppearance('wishlist', 'icon-circle'), 'icon')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label'), 'canvas')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label-below'), 'canvas')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label-left'), 'canvas')
  assert.equal(chromeWidgetHost('wishlist', 'icon-label', 'header'), 'canvas')
  assert.equal(chromeWidgetHost('login', 'icon-label', 'nav'), 'canvas')
  assert.equal(chromeWidgetHost('login', 'text', 'nav'), 'canvas')
  assert.equal(chromeWidgetHost('login', 'icon-label', 'mid'), 'canvas')
  assert.equal(chromeWidgetHost('login', 'text', 'header'), 'canvas')
  assert.equal(chromeWidgetAppearance('wishlist'), 'icon')
  assert.equal(chromeWidgetHost('contact'), 'canvas')
  assert.equal(chromeWidgetHost('login'), 'canvas')
  assert.equal(chromeWidgetAppearance('favorites-link'), 'link')
  assert.equal(chromeWidgetAppearance('contact'), 'link')
  for (const kind of VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS) {
    const host = chromeWidgetHost(kind)
    if (isChromeFloatKind(kind)) assert.equal(host, 'float')
    else assert.equal(host, 'canvas')
    assert.notEqual(host, 'actions')
    assert.notEqual(host, 'topbar')
    assert.notEqual(host, 'mid')
    assert.notEqual(host, 'nav')
  }
})

test('every picker chrome widget has a live shop hook', () => {
  for (const kind of VISUAL_EDITOR_CHROME_WIDGET_PICKER_KINDS) {
    const hook = chromeWidgetLiveHook(kind)
    if (hook === 'route') {
      const href = chromeWidgetHref(kind, 'demo-shop')
      assert.notEqual(href, '#')
      assert.match(href, /\/site\/demo-shop(?:\/|$)/)
    } else {
      assert.ok(
        [
          'search',
          'search-image',
          'categories',
          'chat',
          'contact',
          'topup',
          'try-on',
          'favorite',
          'add-cart',
          'buy-now',
          'share',
          'logout',
          'coupon',
          'lead',
        ].includes(hook)
      )
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
    partnerSiteLoginPath('188-shop')
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
  assert.match(html, /data-pw-el="cat-toggle"[^>]*data-pw-chrome-added="1"/)
  assert.doesNotMatch(html, /pw-chrome-cat-wrap" data-pw-chrome-added/)
  assert.doesNotMatch(html, /pw-chrome-cat-wrap"[^>]*data-pw-chrome-style/)
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
  assert.match(html, /pw-search-default-icon/)
  assert.match(html, /data-pw-image-search/)
  assert.match(html, /data-pw-search-glyph="camera"/)
  assert.match(html, /data-pw-search-glyph="lens"/)
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
  assert.match(html, /data-pw-search-glyph="camera"/)
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
  assert.match(html, /--pw-chrome-w:30px/)
  assert.match(html, /--pw-chrome-h:30px/)
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
  const box = buildVisualEditorChromeWidgetHtml({
    kind: 'add-cart',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-square',
    iconWidth: 80,
    iconHeight: 40,
  })
  assert.match(box, /data-pw-chrome-w="80"/)
  assert.match(box, /data-pw-chrome-h="40"/)
  assert.match(box, /--pw-chrome-w:80px/)
  assert.match(box, /--pw-chrome-h:40px/)
  assert.match(box, /--pw-chrome-size:60px/)
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

test('chrome widgets can emit circular icon-only', () => {
  const html = buildVisualEditorChromeWidgetHtml({
    kind: 'topup',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-circle',
  })
  assert.match(html, /pw-chrome-icon-circle/)
  assert.match(html, /pw-chrome-icon-only/)
  assert.match(html, /data-pw-chrome-style="icon-circle"/)
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
  assert.match(iconOnly, /data-pw-chrome-glyph="cart"/)
  assert.match(left, /data-pw-chrome-glyph="heart"/)
})

test('chrome widgets stamp a chosen glyph and skip brand chat icons', () => {
  const home = buildVisualEditorChromeWidgetHtml({
    kind: 'home',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    glyph: 'home-door',
  })
  assert.match(home, /data-pw-chrome-glyph="home-door"/)
  const chat = buildVisualEditorChromeWidgetHtml({
    kind: 'chat',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.doesNotMatch(chat, /data-pw-chrome-glyph=/)
  const zalo = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-zalo',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.doesNotMatch(zalo, /data-pw-chrome-glyph=/)
})

test('chrome size tokens pad X from width and pad Y from height', () => {
  assert.match(PW_CHROME_TOKEN_VARS_CSS, /--pw-chrome-pad-x:calc\(var\(--pw-chrome-w/)
  assert.match(PW_CHROME_TOKEN_VARS_CSS, /--pw-chrome-pad-y:calc\(var\(--pw-chrome-h/)
  assert.match(PW_CHROME_TOKEN_VARS_CSS, /--pw-chrome-label:13px/)
  assert.doesNotMatch(PW_CHROME_TOKEN_VARS_CSS, /--pw-chrome-pad-x:calc\(var\(--pw-chrome-size,22px\)\*/)
  assert.doesNotMatch(PW_CHROME_TOKEN_VARS_CSS, /--pw-chrome-pad-y:calc\(var\(--pw-chrome-size,22px\)\*/)
})

test('chrome label size follows icon scale and clamps', () => {
  assert.equal(chromeLabelSizeFromIcon(22), 13)
  assert.equal(chromeLabelSizeFromIcon(44), 26)
  assert.equal(clampPwChromeLabelSize(5), 10)
  assert.equal(clampPwChromeLabelSize(99), 48)
})

test('search image button in the form stretches to the pill height', () => {
  assert.match(PW_SEARCH_IMAGE_IN_FORM_BTN_CSS, /align-self:stretch!important/)
  assert.match(PW_SEARCH_IMAGE_IN_FORM_BTN_CSS, /min-height:100%!important/)
  assert.match(PW_SEARCH_IMAGE_IN_FORM_BTN_CSS, /height:auto!important/)
})

test('circle chrome style is a square box with full round corners', () => {
  assert.match(PW_CHROME_ICON_CIRCLE_CSS, /icon-circle/)
  assert.match(PW_CHROME_ICON_CIRCLE_CSS, /border-radius:999px!important/)
  assert.match(PW_CHROME_ICON_CIRCLE_CSS, /aspect-ratio:1!important/)
  assert.match(PW_CHROME_ICON_CIRCLE_CSS, /\.pw-chrome-icon-circle \.pw-chrome-icon-wrap svg/)
  assert.match(PW_CHROME_ICON_CIRCLE_CSS, /width:var\(--pw-chrome-w,var\(--pw-chrome-size,22px\)\)!important/)
})

test('square chrome style is the same equal box with rounded corners', () => {
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /icon-square/)
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /border-radius:10px!important/)
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /aspect-ratio:1!important/)
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /\.pw-chrome-icon-square \.pw-chrome-icon-wrap svg/)
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /width:var\(--pw-chrome-w,var\(--pw-chrome-size,22px\)\)!important/)
  assert.match(PW_CHROME_ICON_SQUARE_CSS, /\[data-pw-chrome-radius\]\[data-pw-chrome-style="icon-square"\]/)
})

test('labeled chrome buttons hug icon and text', () => {
  assert.equal(PW_CHROME_ICON_SIZE_MAX >= 200, true)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /width:auto!important/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /min-width:0!important/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /height:auto!important/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /icon-label-below/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /max-width:none!important/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /font-size:var\(--pw-chrome-label,13px\)!important/)
  assert.match(PW_CHROME_LABELED_MIN_W_CSS, /:not\(\[data-pw-chrome-style="icon-square"\]\)/)
})

test('chrome label face CSS sizes stock bottom-nav .pw-shop-icon-label', () => {
  assert.match(PW_CHROME_LABEL_FACE_CSS, /\.pw-shop-icon-label/)
  assert.match(PW_CHROME_LABEL_FACE_CSS, /\.pw-bottom-nav \.pw-shop-icon-label/)
  assert.match(PW_CHROME_LABEL_FACE_CSS, /font-size:var\(--pw-chrome-label,13px\)!important/)
})

test('chrome label-below CSS wins row layout for every chrome host', () => {
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /html \[data-pw-chrome-style="icon-label-below"\]/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /flex-direction:column!important/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /pw-account-btn/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /pw-account-btn-label/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /pw-header-actions/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /pw-bottom-nav/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /pw-pdp-sticky/)
  assert.match(PW_CHROME_LABEL_BELOW_CSS, /cat-toggle/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /:not\(\.pw-chrome-label-below\):not\(\[data-pw-chrome-style="icon-label-below"\]\)/)
})

test('chrome face extras cover bold, gap, radius, hover, and column text', () => {
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-chrome-weight="700"/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-chrome-gap/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-chrome-radius/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-el="cta"\]\[data-pw-chrome-radius/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /pw-btn-hero\[data-pw-chrome-radius/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-chrome-hover/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-btn-text/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-el="nav-link"\]\[data-pw-btn-text/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-el="link"\]\[data-pw-btn-text/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-el="nav-link"\]\[data-pw-btn-color/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-el="link"\]\[data-pw-btn-color/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-icon-color/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-btn-color/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /--pw-btn-border/)
  assert.doesNotMatch(PW_CHROME_FACE_EXTRAS_CSS, /\[data-pw-btn-text\],\[data-pw-btn-text\] \.pw-chrome-btn-label/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /data-pw-chrome-text-flow="col"/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /writing-mode:horizontal-tb/)
  assert.match(PW_CHROME_FACE_EXTRAS_CSS, /width:min-content/)
  assert.doesNotMatch(PW_CHROME_FACE_EXTRAS_CSS, /vertical-rl/)
  assert.doesNotMatch(PW_CHROME_FACE_EXTRAS_CSS, /\[data-pw-chrome-style="text"\]\[data-pw-chrome-layout="col"\]\{flex-direction:column/)
  assert.equal(chromeKindShowsCountBadge('cart'), true)
  assert.equal(chromeKindShowsCountBadge('wishlist'), true)
  assert.equal(chromeKindShowsCountBadge('notifications'), true)
  assert.equal(chromeKindShowsCountBadge('account'), false)
  assert.equal(chromeKindDefaultLabels('vi').account, 'Tài khoản')
})

test('stock chrome CSS uses size vars and style hooks without locking 22px', () => {
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /--pw-chrome-w:var\(--pw-chrome-size\)/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /\.pw-bottom-nav svg/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /width:var\(--pw-chrome-w,var\(--pw-chrome-size,22px\)\)!important/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /\[data-pw-chrome-style="text"\]/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /\.pw-chrome-icon-only/)
  assert.match(PW_STOCK_CHROME_EDIT_CSS, /\[data-pw-icon-color\].*color:inherit!important/)
  assert.doesNotMatch(PW_STOCK_CHROME_EDIT_CSS, /\.pw-bottom-nav svg\{width:22px!important/)
})

test('text-only chrome CSS hides leftover icon wrap with !important', () => {
  assert.match(PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS, /\[data-pw-chrome-style="text"\] \.pw-chrome-icon-wrap/)
  assert.match(PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS, /\.pw-chrome-link \.pw-chrome-icon-wrap/)
  assert.match(PW_CHROME_TEXT_ONLY_HIDE_ICON_CSS, /display:none!important/)
})

test('icon-only chrome CSS hides leftover labels with !important', () => {
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\.pw-chrome-icon-only/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\[data-pw-chrome-style="icon"\]/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\[data-pw-chrome-style="icon-square"\]/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\[data-pw-chrome-style="icon-circle"\]/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\.pw-account-btn-label/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, />span:not\(\.pw-chrome-icon-wrap\)/)
  assert.match(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /display:none!important/)
  assert.doesNotMatch(PW_CHROME_ICON_ONLY_HIDE_LABEL_CSS, /\[data-pw-chrome-style\^="icon"\]/)
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

test('try-on and favorite-product widgets wire live shop actions', () => {
  assert.equal(isProductActionChromeKind('try-on'), true)
  assert.equal(isProductActionChromeKind('favorite-product'), true)
  assert.equal(isProductActionChromeKind('add-cart'), true)
  assert.equal(isProductActionChromeKind('buy-now'), true)
  assert.equal(isProductActionChromeKind('wishlist'), false)
  assert.equal(chromeWidgetLiveHook('try-on'), 'try-on')
  assert.equal(chromeWidgetLiveHook('favorite-product'), 'favorite')
  assert.equal(chromeWidgetLiveHook('add-cart'), 'add-cart')
  assert.equal(chromeWidgetLiveHook('buy-now'), 'buy-now')
  const tryOn = buildVisualEditorChromeWidgetHtml({
    kind: 'try-on',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label-below',
  })
  assert.match(tryOn, /<button type="button"/)
  assert.match(tryOn, /data-pw-chrome-btn="try-on"/)
  assert.match(tryOn, /data-nanoai-try-on/)
  assert.match(tryOn, /Thử đồ AI/)
  assert.doesNotMatch(tryOn, / href=/)
  const fav = buildVisualEditorChromeWidgetHtml({
    kind: 'favorite-product',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon-label-below',
  })
  assert.match(fav, /<button type="button"/)
  assert.match(fav, /data-pw-chrome-btn="favorite-product"/)
  assert.match(fav, /data-pw-favorite/)
  assert.match(fav, /Thích sản phẩm/)
  assert.doesNotMatch(fav, / href=/)
  const addCart = buildVisualEditorChromeWidgetHtml({
    kind: 'add-cart',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'text',
  })
  assert.match(addCart, /<button type="button"/)
  assert.match(addCart, /data-pw-chrome-btn="add-cart"/)
  assert.match(addCart, /data-pw-add-cart/)
  assert.match(addCart, /Thêm giỏ/)
  assert.match(addCart, /pw-shop-btn-cart/)
  assert.doesNotMatch(addCart, / href=/)
  const buyNow = buildVisualEditorChromeWidgetHtml({
    kind: 'buy-now',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'text',
  })
  assert.match(buyNow, /<button type="button"/)
  assert.match(buyNow, /data-pw-chrome-btn="buy-now"/)
  assert.match(buyNow, /data-pw-buy/)
  assert.match(buyNow, /Mua hàng/)
  assert.match(buyNow, /pw-shop-btn-buy/)
  assert.doesNotMatch(buyNow, / href=/)
})

test('phone Instagram WhatsApp share logout coupon and lead form wire live APIs', () => {
  assert.equal(chromeWidgetLiveHook('phone'), 'contact')
  assert.equal(chromeWidgetLiveHook('chat-instagram'), 'contact')
  assert.equal(chromeWidgetLiveHook('chat-whatsapp'), 'contact')
  assert.equal(chromeWidgetLiveHook('share'), 'share')
  assert.equal(chromeWidgetLiveHook('logout'), 'logout')
  assert.equal(chromeWidgetLiveHook('coupon'), 'coupon')
  assert.equal(chromeWidgetLiveHook('lead-form'), 'lead')
  assert.equal(chromeWidgetHref('register', '188-shop'), partnerSiteLoginPath('188-shop'))
  const phone = buildVisualEditorChromeWidgetHtml({
    kind: 'phone',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    href: '+84901234567',
  })
  assert.match(phone, /data-pw-chrome-btn="phone"/)
  assert.match(phone, /data-pw-contact-channel="phone"/)
  assert.match(phone, /href="tel:\+84901234567"/)
  const ig = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-instagram',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    href: 'https://instagram.com/shop',
  })
  assert.match(ig, /data-pw-contact-channel="instagram"/)
  assert.ok(ig.includes(CHROME_INSTAGRAM_LOGO_SVG) || ig.includes('pw-chrome-brand-logo'))
  const wa = buildVisualEditorChromeWidgetHtml({
    kind: 'chat-whatsapp',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
    href: '0901234567',
  })
  assert.match(wa, /data-pw-contact-channel="whatsapp"/)
  assert.match(wa, /href="https:\/\/wa.me\/0901234567"/)
  assert.ok(wa.includes(CHROME_WHATSAPP_LOGO_SVG) || wa.includes('#25D366'))
  const share = buildVisualEditorChromeWidgetHtml({
    kind: 'share',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(share, /data-pw-share="1"/)
  const logout = buildVisualEditorChromeWidgetHtml({
    kind: 'logout',
    siteSlug: '188-shop',
    locale: 'vi',
    style: 'icon',
  })
  assert.match(logout, /data-pw-account-logout="1"/)
  const coupon = buildVisualEditorChromeWidgetHtml({
    kind: 'coupon',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(coupon, /data-pw-coupon-form/)
  assert.match(coupon, /\/api\/site\/188-shop\/promotions\/validate/)
  const lead = buildVisualEditorChromeWidgetHtml({
    kind: 'lead-form',
    siteSlug: '188-shop',
    locale: 'vi',
  })
  assert.match(lead, /data-pw-lead-form/)
  assert.match(lead, /\/api\/site\/188-shop\/lead/)
  assert.match(lead, /name="name"/)
})

test('clampPwImageRadius keeps square and rounded within range', () => {
  assert.equal(clampPwImageRadius(0), 0)
  assert.equal(clampPwImageRadius(16), 16)
  assert.equal(clampPwImageRadius(-4), 0)
  assert.equal(clampPwImageRadius(200), 80)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { bindLiveProductToPdpHtml } from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { ensurePartnerSitePdpBottomNavInHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
import { DEMO_PDP_BIND_PRODUCT } from '@/lib/partner-website/shop/demo-pdp-bind-product'

test('default demo PDP shell includes gallery, sizes, colors, qty, and reviews', () => {
  const html = buildDefaultDemoPdpShellHtml({ locale: 'vi' })
  assert.match(html, /data-pw-page="product"/)
  assert.match(html, /class="pw-header"/)
  assert.match(html, /data-pw-region="header"/)
  assert.match(html, /class="pw-bottom-nav"/)
  assert.match(html, /data-pw-region="gallery"/)
  assert.match(html, /data-pw-el="main-image"/)
  assert.match(html, /data-pw-el="thumb"/)
  assert.match(html, /data-pw-pdp-option="size"/)
  assert.match(html, /data-pw-pdp-option="color"/)
  assert.match(html, /data-pw-pdp-option-value="/)
  assert.match(html, /data-pw-el="qty"/)
  assert.match(html, /data-pw-el="buy"/)
  assert.match(html, /data-pw-el="card-cart"/)
  assert.match(html, /data-pw-region="reviews"/)
  assert.match(html, /data-pw-region="catalog"/)
  assert.match(html, /data-pw-related="1"/)
  assert.match(html, /Sản phẩm tương tự/)
  assert.match(html, /data-pw-outfit="1"/)
  assert.match(html, /Phối với món này/)
  assert.match(html, /data-pw-region="breadcrumb"/)
  assert.match(html, /pw-pdp-sticky/)
  assert.match(html, /<svg width="17" height="17"/)
  assert.match(html, /data-pw-like-count/)
  assert.match(html, /pw-pdp-like-copy/)
  assert.match(html, /id="pw-pdp-qa"/)
  assert.match(html, /pw-shop-product-video/)
  assert.match(html, /data-pw-pdp-slot="size-guide"/)
  assert.match(html, /data-pw-pdp-slot="consult"/)
  assert.match(html, /data-pw-pdp-slot="review-form"/)
  assert.match(html, /data-pw-pdp-slot="low-stock"/)
  assert.match(html, /pw-pdp-save/)
  assert.ok((DEMO_PDP_BIND_PRODUCT.sizes ?? []).length >= 3)
  assert.ok((DEMO_PDP_BIND_PRODUCT.colors ?? []).length >= 2)
  assert.ok((DEMO_PDP_BIND_PRODUCT.galleryImages ?? []).length >= 4)
})

test('binding the demo product onto the default shell keeps size and color pills', () => {
  const html = buildDefaultDemoPdpShellHtml({ locale: 'vi' })
  const next = bindLiveProductToPdpHtml(html, DEMO_PDP_BIND_PRODUCT)
  assert.match(next, /Đầm voan/)
  assert.match(next, />S</)
  assert.match(next, /pw-pdp-color/)
  assert.equal((next.match(/data-pw-pdp-option="size"/g) || []).length, 1)
  assert.equal((next.match(/data-pw-pdp-option="color"/g) || []).length, 1)
  assert.match(next, /id="pw-pdp-qa"/)
  assert.match(next, /Đầm có lót/)
  assert.match(next, /data-pw-pdp-slot="video"/)
})

test('bind keeps size, color, consult, and actions inside the buy box', () => {
  const html = buildDefaultDemoPdpShellHtml({ locale: 'vi', variant: 'desktop' })
  const next = bindLiveProductToPdpHtml(html, DEMO_PDP_BIND_PRODUCT)
  const open = next.match(/<div\b[^>]*\bpw-shop-pdp-info\b[^>]*>/)
  assert.ok(open && open.index != null)
  const start = open.index + open[0].length
  const slice = next.slice(start)
  const re = /<div\b[^>]*>|<\/div>/gi
  let depth = 1
  let end = -1
  let match: RegExpExecArray | null
  while ((match = re.exec(slice))) {
    if (match[0][1] === '/') {
      depth -= 1
      if (depth === 0) {
        end = match.index
        break
      }
    } else {
      depth += 1
    }
  }
  assert.ok(end >= 0)
  const buyBox = slice.slice(0, end)
  assert.match(buyBox, /data-pw-pdp-option="size"/)
  assert.match(buyBox, /data-pw-pdp-option="color"/)
  assert.match(buyBox, /data-pw-pdp-slot="consult"/)
  assert.match(buyBox, /pw-pdp-actions/)
  assert.match(buyBox, /data-pw-el="qty"/)
  assert.equal((buyBox.match(/data-pw-pdp-option="color"/g) || []).length, 1)
})

test('default demo PDP shell uses shop title and logo on the fallback header', () => {
  const html = buildDefaultDemoPdpShellHtml({
    locale: 'vi',
    title: '188 Fashion',
    logoUrl: 'https://cdn.example/logo.png',
  })
  assert.match(html, /188 Fashion/)
  assert.match(html, /https:\/\/cdn\.example\/logo\.png/)
})

test('default desktop shell does not duplicate the mobile hero gallery', () => {
  const desktop = buildDefaultDemoPdpShellHtml({ locale: 'vi', variant: 'desktop' })
  assert.match(desktop, /pw-pdp-gallery-desktop/)
  assert.doesNotMatch(desktop, /pw-pdp-hero/)
  const mobile = buildDefaultDemoPdpShellHtml({ locale: 'vi', variant: 'mobile' })
  assert.match(mobile, /pw-pdp-hero/)
  assert.doesNotMatch(mobile, /pw-pdp-gallery-desktop/)
  assert.match(mobile, /data-pw-chrome-kit="dock"/)
  assert.match(mobile, /data-pw-chrome-btn="try-on"/)
  assert.match(mobile, /data-pw-chrome-btn="favorite-product"/)
  assert.match(mobile, /data-pw-chrome-btn="add-cart"/)
  assert.match(mobile, /data-pw-chrome-btn="buy-now"/)
})

test('ensure upgrades a legacy PDP sticky bar to the 188 like + two-line layout', () => {
  const html = `<body data-pw-page="product">
    <nav class="pw-bottom-nav pw-pdp-sticky" data-pw-pdp-bottom="1">
      <a data-pw-chrome-btn="home">Trang chủ</a>
      <button type="button" class="is-fav" data-pw-favorite data-pw-pdp-favorite="1">Thích sản phẩm</button>
      <button type="button" data-pw-add-cart>Thêm giỏ</button>
    </nav>
  </body>`
  const next = ensurePartnerSitePdpBottomNavInHtml(html, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    pageKey: 'product_detail',
  })
  assert.match(next, /data-pw-like-count/)
  assert.match(next, /pw-pdp-like-copy/)
  assert.match(next, /pw-pdp-sticky-copy/)
  assert.match(next, />Trang</)
  assert.match(next, />chủ</)
  assert.match(next, />Thích</)
  assert.doesNotMatch(next, /Thích sản phẩm/)
  const again = ensurePartnerSitePdpBottomNavInHtml(next, {
    locale: 'vi',
    siteSlug: 'demo-shop',
    pageKey: 'product_detail',
  })
  assert.equal(again, next)
})

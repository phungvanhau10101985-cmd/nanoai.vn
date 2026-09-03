import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPartnerSiteFooterHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import {
  inferFooterColumnKitKind,
  inferFooterLinkKitKind,
  footerLinkKitKind,
  PW_FOOTER_KIT_ATTR,
  stampFooterKitInHtml,
} from '@/lib/partner-website/shop/partner-site-footer-kit'

test('factory footer stamps brand, four columns, copyright', () => {
  const html = buildPartnerSiteFooterHtml({
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
    brand: '188.com.vn',
    logoUrl: 'https://example.com/logo.png',
  })
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="brand"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="col:shop"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="col:shopping"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="col:support"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="col:legal"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="copyright"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="moit"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="link:shipping"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="link:payment"`))
  assert.match(html, new RegExp(`${PW_FOOTER_KIT_ATTR}="link:orders"`))
})

test('stampFooterKitInHtml is idempotent on factory footer', () => {
  const html = buildPartnerSiteFooterHtml({
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Demo',
  })
  const once = stampFooterKitInHtml(html)
  assert.equal(stampFooterKitInHtml(once), once)
})

test('stampFooterKitInHtml infers columns on leftover full footer', () => {
  const raw = `<footer class="pw-footer" data-pw-region="footer" data-pw-footer="full">
    <div class="pw-shop-footer-inner">
      <div class="pw-shop-footer-brand"><p>Shop</p></div>
      <nav class="pw-shop-footer-col" data-pw-el="col" aria-label="Cửa hàng">
        <a data-pw-el="link" href="/site/x/about">Giới thiệu</a>
      </nav>
      <nav class="pw-shop-footer-col" data-pw-el="col">
        <a data-pw-el="link" href="/site/x/products">Sản phẩm</a>
      </nav>
      <nav class="pw-shop-footer-col" data-pw-el="col">
        <a data-pw-el="link" href="/site/x/faq">FAQ</a>
      </nav>
      <nav class="pw-shop-footer-col" data-pw-el="col">
        <a data-pw-el="link" href="/site/x/privacy">Bảo mật</a>
      </nav>
    </div>
    <div class="pw-shop-footer-bar" data-pw-el="copyright"><p>© 2026</p></div>
  </footer>`
  const next = stampFooterKitInHtml(raw)
  assert.match(next, /data-pw-footer-kit="brand"/)
  assert.match(next, /data-pw-footer-kit="col:shop"/)
  assert.match(next, /data-pw-footer-kit="col:shopping"/)
  assert.match(next, /data-pw-footer-kit="col:support"/)
  assert.match(next, /data-pw-footer-kit="col:legal"/)
  assert.match(next, /data-pw-footer-kit="copyright"/)
  assert.match(next, /data-pw-footer-kit="link:about"/)
  assert.match(next, /data-pw-footer-kit="link:products"/)
  assert.match(next, /data-pw-footer-kit="link:faq"/)
  assert.match(next, /data-pw-footer-kit="link:privacy"/)
  assert.equal(stampFooterKitInHtml(next), next)
})

test('inferFooterLinkKitKind reads stock footer hrefs', () => {
  assert.equal(inferFooterLinkKitKind('/site/x/shipping'), footerLinkKitKind('shipping'))
  assert.equal(inferFooterLinkKitKind('/site/188.com.vn/156/payment'), footerLinkKitKind('payment'))
  assert.equal(inferFooterLinkKitKind('/site/x/orders'), footerLinkKitKind('orders'))
  assert.equal(inferFooterLinkKitKind('/site/demo-shop'), footerLinkKitKind('home'))
  assert.equal(inferFooterLinkKitKind(''), null)
})

test('inferFooterColumnKitKind reads policy vs shop hrefs', () => {
  assert.equal(inferFooterColumnKitKind('<a href="/privacy">Bảo mật</a>'), 'col:legal')
  assert.equal(inferFooterColumnKitKind('<a href="/site/x/about">Giới thiệu</a>'), 'col:shop')
  assert.equal(inferFooterColumnKitKind('<a href="/products">Sản phẩm</a>'), 'col:shopping')
  assert.equal(inferFooterColumnKitKind('<a href="/faq">Hỏi đáp</a>'), 'col:support')
})

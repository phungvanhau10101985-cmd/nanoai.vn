import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerSiteFooterHtml,
  ensureFullPartnerSiteFooterInHtml,
  isSkeletalPartnerSiteFooter,
  pinPaintedFooterThemeVarsInHtml,
  PW_FOOTER_PAINT_STYLE_ID,
} from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { withPartnerSiteFooterLegalLinks } from '@/lib/partner-website/shop/partner-site-nav-footer'
import { resolveShopThemeColors, themeCssVarMap } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'

test('full footer has four columns and required policy links', () => {
  const html = buildPartnerSiteFooterHtml({
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
    brand: '188.com.vn',
    logoUrl: 'https://example.com/logo.png',
  })
  assert.match(html, /data-pw-footer="full"/)
  assert.match(html, /data-pw-region="footer"/)
  assert.match(html, /data-pw-token="footer"/)
  assert.match(html, /data-pw-el="logo"/)
  assert.equal((html.match(/data-pw-el="col"/g) || []).length, 4)
  assert.match(html, /privacy/)
  assert.match(html, /terms/)
  assert.match(html, /how-to-buy/)
  assert.match(html, /brand-origin/)
  assert.match(html, /reviews-policy/)
  assert.match(html, /\/trust/)
  assert.match(html, /\/company/)
  assert.match(html, /payment/)
  assert.match(html, /shipping/)
  assert.match(html, /returns/)
  assert.match(html, /\/site\/188-com-vn-rl56\/products/)
  assert.match(html, /Cửa hàng/)
  assert.match(html, /Chính sách/)
  assert.match(html, /data-pw-footer-kit="brand"/)
  assert.match(html, /data-pw-footer-kit="col:shop"/)
  assert.match(html, /data-pw-footer-kit="copyright"/)
  assert.match(html, /data-pw-footer-kit="moit"/)
  assert.match(html, /online\.gov\.vn/)
  assert.match(html, /Đã thông báo với Bộ Công Thương/)
  assert.match(html, /data-pw-footer-kit="link:shipping"/)
  assert.match(html, /data-pw-el="slogan"/)
  assert.match(html, /data-pw-slogan="1"/)
  assert.match(html, /data-pw-seed-slogan=/)
})

test('skeletal policy-only footer is upgraded when site slug exists', () => {
  const skinny = `<html><body>
  <footer class="pw-footer" data-pw-region="footer">
    <div class="pw-footer-col" data-pw-el="col">
      <a data-pw-el="link" href="/privacy">Chính sách bảo mật</a>
      <a data-pw-el="link" href="/terms">Điều khoản</a>
    </div>
    <p data-pw-el="copyright">© 2026 188.com.vn. Bảo lưu mọi quyền.</p>
  </footer>
  </body></html>`
  assert.equal(isSkeletalPartnerSiteFooter(skinny), true)
  const next = ensureFullPartnerSiteFooterInHtml(skinny, {
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
    brand: '188.com.vn',
  })
  assert.match(next, /data-pw-footer="full"/)
  assert.equal((next.match(/data-pw-el="col"/g) || []).length, 4)
  const again = ensureFullPartnerSiteFooterInHtml(next, {
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
  })
  assert.equal(again, next)
})

test('does not rewrite footer without a shop slug', () => {
  const skinny = `<footer class="pw-footer">Foot</footer>`
  const next = ensureFullPartnerSiteFooterInHtml(skinny, { locale: 'vi', siteSlug: '' })
  assert.match(next, /Foot/)
  assert.ok(!/data-pw-footer="full"/.test(next))
  assert.match(next, /data-pw-footer-kit="moit"/)
})

test('injects a full footer when the document has none, even without a shop slug', () => {
  const html = `<html><body><main>Home</main><nav class="pw-bottom-nav"></nav></body></html>`
  const next = ensureFullPartnerSiteFooterInHtml(html, {
    locale: 'vi',
    siteSlug: '',
    brand: 'Sàn mua sắm',
  })
  assert.match(next, /data-pw-footer="full"/)
  assert.match(next, /data-pw-region="footer"/)
  assert.match(next, /Sàn mua sắm/)
  assert.match(next, /<main>Home<\/main>\s*<footer[\s\S]*<\/footer>\s*<nav class="pw-bottom-nav"/)
})

test('ensure injects MoIT button into leftover full footer', () => {
  const full = `<html><body>
  <footer class="pw-footer" data-pw-region="footer" data-pw-footer="full">
    <div class="pw-shop-footer-inner">
      <div class="pw-shop-footer-brand" data-pw-footer-kit="brand"><p>Shop</p></div>
      <nav class="pw-shop-footer-col" data-pw-el="col" data-pw-footer-kit="col:shop"></nav>
      <nav class="pw-shop-footer-col" data-pw-el="col" data-pw-footer-kit="col:shopping"></nav>
      <nav class="pw-shop-footer-col" data-pw-el="col" data-pw-footer-kit="col:support"></nav>
      <nav class="pw-shop-footer-col" data-pw-el="col" data-pw-footer-kit="col:legal"></nav>
    </div>
    <div class="pw-shop-footer-bar" data-pw-el="copyright" data-pw-footer-kit="copyright"><p>© 2026</p></div>
  </footer>
  </body></html>`
  const next = ensureFullPartnerSiteFooterInHtml(full, {
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
    brand: '188.com.vn',
  })
  assert.match(next, /data-pw-footer-kit="moit"/)
  assert.match(next, /Đã thông báo với Bộ Công Thương/)
  assert.match(next, /online\.gov\.vn/)
  assert.equal((next.match(/data-pw-el="col"/g) || []).length, 4)
  const again = ensureFullPartnerSiteFooterInHtml(next, {
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
  })
  assert.equal((again.match(/data-pw-footer-kit="moit"/g) || []).length, 1)
  assert.match(next, /how-to-buy/)
  assert.match(next, /data-pw-footer-kit="link:how-to-buy"/)
  assert.match(next, /data-pw-footer-kit="link:brand-origin"/)
  assert.match(next, /data-pw-footer-kit="link:reviews-policy"/)
  assert.match(next, /data-pw-footer-kit="link:trust"/)
  assert.match(next, /data-pw-footer-kit="link:company"/)
  const twice = ensureFullPartnerSiteFooterInHtml(next, {
    locale: 'vi',
    siteSlug: '188-com-vn-rl56',
  })
  assert.equal((twice.match(/data-pw-footer-kit="link:how-to-buy"/g) || []).length, 1)
})

test('theme footerColor maps to --pw-footer', () => {
  const resolved = resolveShopThemeColors({
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    footerColor: '#111827',
  })
  assert.equal(resolved.footerColor, '#111827')
  assert.equal(themeCssVarMap({ ...DEFAULT_PARTNER_WEBSITE_THEME, footerColor: '#111827' })['--pw-footer'], '#111827')
  assert.equal(
    themeCssVarMap({ ...DEFAULT_PARTNER_WEBSITE_THEME, footerColor: '#111827' })['--pw-footer-ink'],
    '#111827'
  )
})

test('pinPaintedFooterThemeVarsInHtml keeps Sửa nhanh footer paint on live', () => {
  const painted = pinPaintedFooterThemeVarsInHtml(
    `<footer class="pw-footer" data-pw-region="footer" style="--pw-footer:#f5f5f5;background-color:rgb(245,245,245)">cols</footer>`
  )
  assert.match(painted, /--pw-footer:\s*#f5f5f5\s*!important/i)
  assert.match(painted, /background-color:\s*rgb\(245,\s*245,\s*245\)\s*!important/i)
  assert.match(painted, new RegExp(`id="${PW_FOOTER_PAINT_STYLE_ID}"`))
  assert.match(painted, /background-color:#f5f5f5!important/i)
  assert.match(painted, /:root,html,body,\[data-pw-inline-visual-root\]\{--pw-footer:#f5f5f5!important\}/)

  const fromBg = pinPaintedFooterThemeVarsInHtml(
    `<footer class="pw-footer" data-pw-region="footer" style="background-color:#f5f5f5">cols</footer>`
  )
  assert.match(fromBg, /--pw-footer:\s*#f5f5f5\s*!important/i)
  assert.match(fromBg, /background-color:\s*#f5f5f5\s*!important/i)

  const leftover = pinPaintedFooterThemeVarsInHtml(
    `<style>:is(html[data-pw-look="marketplace"],.pw-shop[data-pw-look="marketplace"]) .pw-shop-footer{background:var(--pw-footer,#111827)!important;color:var(--pw-footer-ink,#e5e7eb)}</style><footer class="pw-shop-footer" data-pw-region="footer" style="--pw-footer:#f5f5f5">cols</footer>`
  )
  assert.match(leftover, /var\(--pw-footer,#f5f5f5\)/)
  assert.doesNotMatch(leftover, /var\(--pw-footer,#111827\)/)
  assert.match(leftover, /var\(--pw-footer-ink,#111827\)/)

  const moit = pinPaintedFooterThemeVarsInHtml(
    `<a class="pw-shop-footer-moit" style="--pw-btn-color:#ff6b00;background:#ff6b00;color:#fff">MoIT</a>`
  )
  assert.match(moit, /--pw-btn-color:\s*#ff6b00\s*!important/i)
})

test('saved footer JSON keeps merchant hides and appends missing legal keys', () => {
  const merged = withPartnerSiteFooterLegalLinks([
    { id: 'ft_privacy', hrefKey: 'privacy', visible: false, sortOrder: 0 },
    { id: 'ft_terms', hrefKey: 'terms', visible: true, sortOrder: 1 },
  ])
  assert.equal(merged.find((x) => x.hrefKey === 'privacy')?.visible, false)
  assert.ok(merged.some((x) => x.hrefKey === 'how-to-buy' && x.visible))
  assert.ok(merged.some((x) => x.hrefKey === 'company' && x.visible))
})

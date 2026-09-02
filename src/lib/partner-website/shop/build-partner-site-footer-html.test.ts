import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerSiteFooterHtml,
  ensureFullPartnerSiteFooterInHtml,
  isSkeletalPartnerSiteFooter,
} from '@/lib/partner-website/shop/build-partner-site-footer-html'
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
  assert.match(html, /payment/)
  assert.match(html, /shipping/)
  assert.match(html, /returns/)
  assert.match(html, /\/site\/188-com-vn-rl56\/products/)
  assert.match(html, /Cửa hàng/)
  assert.match(html, /Chính sách/)
  assert.match(html, /data-pw-footer-kit="brand"/)
  assert.match(html, /data-pw-footer-kit="col:shop"/)
  assert.match(html, /data-pw-footer-kit="copyright"/)
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
  assert.equal(next, skinny)
})

test('theme footerColor maps to --pw-footer', () => {
  const resolved = resolveShopThemeColors({
    ...DEFAULT_PARTNER_WEBSITE_THEME,
    footerColor: '#111827',
  })
  assert.equal(resolved.footerColor, '#111827')
  assert.equal(themeCssVarMap({ ...DEFAULT_PARTNER_WEBSITE_THEME, footerColor: '#111827' })['--pw-footer'], '#111827')
})

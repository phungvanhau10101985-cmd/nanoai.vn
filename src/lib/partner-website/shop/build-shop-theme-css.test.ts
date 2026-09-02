import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
import {
  buildPartnerSiteHtmlChromeCss,
  buildPartnerSiteShopThemeCss,
  injectPartnerShopThemeCss,
  PARTNER_SHOP_THEME_STYLE_ID,
} from '@/lib/partner-website/shop/build-shop-theme-css'
import { preparePartnerVisualHtmlForEditor } from '@/lib/partner-website/shop/render-partner-visual-html'

test('shop theme CSS styles profile form selects and recommendation cohort hint', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-shop-form select/)
  assert.match(css, /\.pw-shop-form input\[readonly\]/)
  assert.match(css, /\.pw-cohort-hint/)
  assert.match(css, /\.pw-cohort-hint-cta\{[^}]*background:var\(--pw-buy\)/)
  assert.doesNotMatch(css, /\.pw-cohort-hint[^{]*\{[^}]*#ea580c/)
})

test('shop theme CSS keeps desktop account nav as a compact left column', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-shop-account-nav-item\.is-active\{background:var\(--pw-surface\);color:var\(--pw-primary\)/)
  assert.match(css, /@media\(min-width:768px\)\{\.pw-shop-account-layout\{grid-template-columns:224px minmax\(0,1fr\)/)
  assert.match(css, /\.pw-shop-cart-actions/)
  assert.match(css, /\.pw-shop-deposit-head\{background:linear-gradient\(90deg,var\(--pw-primary\),var\(--pw-accent\)/)
  assert.match(css, /\.pw-shop-deposit-sepay/)
  assert.match(css, /\.pw-shop-deposit-instruct/)
})

test('shop theme CSS turns mega L2/L3 hover text to the primary token', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-cat-mega-l2:hover,\.pw-cat-mega-l3:hover\{background:var\(--pw-surface\);color:var\(--pw-primary\)!important\}/)
  assert.match(css, /html \.pw-cat-mega-l2:hover,html \.pw-cat-mega-l3:hover/)
  assert.match(css, /html \.pw-cat-mega-l2:hover[\s\S]*?color:var\(--pw-primary\)!important/)
})

test('shop theme CSS hides leftover icons on text-only chrome widgets', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\[data-pw-chrome-style="text"\] \.pw-chrome-icon-wrap/)
  assert.match(css, /\.pw-chrome-link \.pw-chrome-icon-wrap/)
  assert.match(css, /display:none!important/)
})

test('shop theme CSS hugs labeled chrome buttons around icon and text', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\[data-pw-chrome-style="icon-label-below"\]/)
  assert.match(css, /width:auto!important/)
  assert.match(css, /min-width:0!important/)
  assert.match(css, /--pw-chrome-label:13px/)
  assert.match(css, /\.pw-bottom-nav \.pw-shop-icon-label/)
  assert.match(css, /font-size:var\(--pw-chrome-label,13px\)!important/)
})

test('shop theme CSS keeps dock account gray, not header white', () => {
  const css = buildPartnerSiteHtmlChromeCss()
  assert.match(css, /\.pw-header-actions \.pw-account-btn/)
  assert.doesNotMatch(css, /(?:,|})\s*\.pw-account-btn\{color:#fff/)
})

test('shop theme CSS sizes stock bottom-nav icons from chrome vars', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-bottom-nav svg\{width:var\(--pw-chrome-w/)
  assert.match(css, /\.pw-pdp-sticky svg,.pw-pdp-sticky-nav svg\{width:var\(--pw-chrome-w/)
  assert.doesNotMatch(css, /\.pw-bottom-nav svg\{width:22px/)
  assert.doesNotMatch(css, /\.pw-pdp-sticky svg,.pw-pdp-sticky-nav svg\{width:22px!important/)
  assert.match(css, /\.pw-pdp-sticky-nav svg\{width:17px!important/)
  assert.match(css, /button\.is-fav\[aria-pressed="true"\]/)
  assert.doesNotMatch(css, /\.pw-pdp-sticky-nav button\.is-fav\{color:#e11d48\}/)
})

test('HTML chrome CSS colors the factory header used by visual PDP', () => {
  const css = buildPartnerSiteHtmlChromeCss()
  assert.match(css, /\.pw-topbar\{[^}]*background:var\(--pw-primary\)/)
  assert.match(css, /\.pw-topbar a,\.pw-topbar button\{[^}]*color:#fff/)
  assert.match(css, /\.pw-header\{/)
  assert.match(css, /\.pw-wordmark\{[^}]*color:var\(--pw-primary\)/)
  assert.match(css, /\.pw-search-form\{[^}]*border:2px solid var\(--pw-primary\)/)
  assert.match(css, /\.pw-search-submit\{[^}]*background:var\(--pw-primary\)/)
})

test('shop theme CSS hides leftover PDP line-total and keeps buy controls in the right column', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-pdp-total,\.pw-pdp-notes/)
  assert.match(css, /display:none!important/)
  assert.match(css, /\.pw-shop-product-layout>\.pw-shop-pdp-info/)
  assert.match(css, /grid-column:2/)
})

test('shop theme CSS hides broken PDP images after retry', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\[data-pw-pdp-img-broken="1"\]\{display:none!important\}/)
  assert.match(css, /\[data-pw-pdp-slot="consult"\]\{display:none!important\}/)
})

test('shop theme CSS lets the stamped device win over @media for PDP gallery', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /html\[data-pw-edit-device="desktop"\] \.pw-pdp-gallery-desktop/)
  assert.match(css, /html\[data-pw-edit-device="mobile"\] \.pw-pdp-hero/)
  assert.match(css, /html\[data-pw-scene-lock="desktop"\] \.pw-pdp-hero/)
  assert.match(css, /\[data-pw-visual-device\]:not\(:has\(\.pw-pdp-gallery-desktop\)\) \.pw-pdp-hero/)
  assert.match(css, /html:not\(:has\(\[data-pw-visual-device\]\)\):not\(:has\(\.pw-pdp-gallery-desktop\)\) \.pw-pdp-hero/)
})

test('shop theme CSS ships HTML chrome alongside React pw-shop-header', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-topbar\{[^}]*background:var\(--pw-primary\)/)
  assert.match(css, /\.pw-shop-header\{/)
  assert.match(css, /\.pw-header\{/)
})

test('shop theme CSS keeps listing filters compact and sticky under the head', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-shop-filters[\s\S]*?top:var\(--pw-sticky-head,56px\)!important/)
  assert.match(css, /\.pw-shop-filter-label\{position:absolute/)
  assert.match(css, /\.pw-shop-filter-clear[\s\S]*?color:var\(--pw-primary\)/)
  assert.match(css, /height:32px/)
  assert.match(css, /\[data-pw-listing-filter-slot\]/)
  assert.match(css, /html\[data-pw-page="listing"\]\[data-pw-head-compact="1"\] \.pw-nav-main/)
  assert.doesNotMatch(css, /\.pw-shop-filters label\{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:600/)
})

test('injecting theme CSS onto the default PDP shell styles the HTML header', () => {
  const html = buildDefaultDemoPdpShellHtml({ locale: 'vi' })
  const out = injectPartnerShopThemeCss(html, DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_THEME_STYLE_ID}"`))
  assert.match(out, /\.pw-topbar\{[^}]*background:var\(--pw-primary\)/)
  assert.match(out, /class="pw-header"/)
})

test('Sửa nhanh PDP receives HTML header colors from the shop theme pack', () => {
  const html = buildDefaultDemoPdpShellHtml({ locale: 'vi' })
  const out = preparePartnerVisualHtmlForEditor(html, {
    variant: 'desktop',
    theme: DEFAULT_PARTNER_WEBSITE_THEME,
    pageKey: 'product_detail',
  })
  assert.match(out, new RegExp(`id="${PARTNER_SHOP_THEME_STYLE_ID}"`))
  assert.match(out, /\.pw-topbar\{[^}]*background:var\(--pw-primary\)/)
  assert.match(out, /\.pw-search-submit\{[^}]*background:var\(--pw-primary\)/)
  assert.match(out, /class="pw-header"/)
})

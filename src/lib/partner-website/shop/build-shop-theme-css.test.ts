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
  assert.match(css, /\.pw-rec-title/)
  assert.match(css, /\.pw-rec-actions/)
  assert.match(css, /\.pw-rec-badge/)
  assert.match(css, /\.pw-rec-fav/)
  assert.match(css, /\.pw-rec-picker/)
  assert.doesNotMatch(css, /\[data-pw-personalize="recommended"\][^{]*\{[^}]*#ea580c/)
})

test('shop theme CSS keeps desktop account nav as a compact left column', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-shop-account-nav-item\.is-active\{background:color-mix\(in srgb,var\(--pw-primary\) 10%,#fff\);color:var\(--pw-primary\);border-left-color:var\(--pw-primary\)/)
  assert.match(css, /@media\(min-width:768px\)\{\.pw-shop-account-layout\{flex-direction:row;gap:24px/)
  assert.match(css, /\.pw-shop-account-nav-item\{[^}]*font-weight:500;font-size:14px;color:#374151/)
  assert.match(css, /\.pw-shop-account-content\{[^}]*background:#fff/)
  assert.match(css, /\.pw-shop-account-hub-mobile\{display:block/)
  assert.match(css, /\.pw-shop-account-content h1,\.pw-shop-account-links h2,\.pw-shop-account-edit h2\{[^}]*font-size:1\.35rem/)
  assert.match(css, /\.pw-shop-account-content \.pw-shop-form label/)
  assert.match(css, /\.pw-shop-cart-actions/)
  assert.match(css, /\.pw-shop-deposit-head\{background:linear-gradient\(90deg,var\(--pw-primary\),var\(--pw-accent\)/)
  assert.match(css, /\.pw-shop-deposit-sepay/)
  assert.match(css, /\.pw-shop-deposit-instruct/)
})

test('shop theme CSS turns header nav pill hover text to the primary token', () => {
  const chrome = buildPartnerSiteHtmlChromeCss()
  assert.match(chrome, /\.pw-nav-main a:hover,\.pw-nav-main button:hover,\.pw-nav-pill:hover a/)
  assert.match(chrome, /color:var\(--pw-primary\)/)
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-shop-nav-row a:hover/)
  assert.match(css, /\.pw-shop-nav-row \.pw-nav-pill:hover a\{color:var\(--pw-primary\)/)
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

test('shop theme CSS narrows desktop/laptop PDP description so white columns match the header', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(
    css,
    /html\[data-pw-edit-device="desktop"\] \.pw-shop-product-detail,html\[data-pw-edit-device="laptop"\] \.pw-shop-product-detail/
  )
  assert.match(css, /html\[data-pw-scene-lock="desktop"\] \.pw-shop-product-detail/)
  assert.match(
    css,
    /\.pw-shop-product-detail\{width:100%;max-width:var\(--pw-content,1200px\);margin-left:auto;margin-right:auto/
  )
})

test('shop theme CSS defaults desktop/laptop PDP detail photos to half the description column', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-pdp-detail-photos\{[^}]*width:50%;max-width:50%/)
  assert.match(
    css,
    /html:not\(\[data-pw-edit-device\]\):not\(\[data-pw-scene-lock\]\) \.pw-pdp-detail-photos\{width:50%;max-width:50%/
  )
  assert.match(css, /max-height:calc\(70vh \/ var\(--pw-scene-zoom,1\)\)/)
  assert.match(css, /html:is\(\[data-pw-edit-device="desktop"\],\[data-pw-edit-device="laptop"\]/)
  assert.match(css, /\.pw-pdp-detail-photos img\{[^}]*max-width:100%/)
  assert.match(css, /content-visibility:auto/)
  assert.doesNotMatch(css, /\[data-pw-pdp-slot="material"\][^}]*width:50%/)
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

test('shop theme CSS shows the mobile PDP hero full-bleed at the image natural size', () => {
  const css = buildPartnerSiteShopThemeCss(DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(css, /\.pw-pdp-hero-img,\.pw-pdp-hero \[data-pw-el="main-image"\]\{[^}]*height:auto!important/)
  assert.match(css, /\.pw-pdp-hero-img,\.pw-pdp-hero \[data-pw-el="main-image"\]\{[^}]*aspect-ratio:auto!important/)
  assert.match(css, /\.pw-pdp-hero-img,\.pw-pdp-hero \[data-pw-el="main-image"\]\{[^}]*object-fit:contain!important/)
  assert.doesNotMatch(css, /\.pw-pdp-hero-img\{[^}]*aspect-ratio:3\/4/)
  assert.doesNotMatch(css, /\.pw-pdp-hero-img\{[^}]*object-fit:cover/)
  assert.match(css, /\.pw-pdp-hero\{display:grid;grid-template-columns:minmax\(0,1fr\);width:calc\(100% \+ 2 \* var\(--pw-page-gutter,4px\)\)/)
  assert.match(css, /html\[data-pw-edit-device="mobile"\] \.pw-pdp-hero,html\[data-pw-scene-lock="mobile"\] \.pw-pdp-hero/)
  assert.match(css, /margin-inline:calc\(-1 \* var\(--pw-page-gutter,4px\)\)/)
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
  assert.match(out, /data-pw-look="shop"/)
})

test('injecting theme CSS keeps marketplace look when HTML already stamped it', () => {
  const html =
    '<!DOCTYPE html><html data-pw-look="marketplace"><head></head><body><header class="pw-header"></header></body></html>'
  const out = injectPartnerShopThemeCss(html, DEFAULT_PARTNER_WEBSITE_THEME)
  assert.match(out, /data-pw-look="marketplace"/)
  assert.match(out, /html\[data-pw-look="marketplace"\] \.pw-header/)
  assert.match(out, /\.pw-marketplace-trust/)
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

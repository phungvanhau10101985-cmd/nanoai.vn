import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  bannerWidgetLabel,
  buildVisualEditorBannerHtml,
  ensurePromoMarketingBannerInHtml,
  isUnifiedPromoBannerHtml,
  isVisualEditorBannerKind,
  restoreMarketingBannerSeedsInDocument,
  VISUAL_EDITOR_PICKER_LIVE_BANNER_KINDS,
} from '@/lib/partner-website/visual-editor/banner-widgets'
import {
  PARTNER_SHOP_BANNER_LIVE_MATCH_CSS,
  PARTNER_SHOP_BANNER_MEDIA_FILL_CSS,
} from '@/lib/partner-website/visual-editor/pw-scene'

test('recognizes banner kinds', () => {
  assert.equal(isVisualEditorBannerKind('hero'), true)
  assert.equal(isVisualEditorBannerKind('slider'), true)
  assert.equal(isVisualEditorBannerKind('promo'), true)
  assert.equal(isVisualEditorBannerKind('birthday'), true)
  assert.equal(isVisualEditorBannerKind('sale-calendar'), true)
  assert.equal(isVisualEditorBannerKind('catalog'), false)
  assert.deepEqual([...VISUAL_EDITOR_PICKER_LIVE_BANNER_KINDS], ['promo'])
})

test('factory always stamps one unified swipe banner', () => {
  const html = buildVisualEditorBannerHtml({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.equal(isUnifiedPromoBannerHtml(html), true)
  assert.match(html, /data-pw-region="banner"/)
  assert.match(html, /data-pw-bg-role="banner"/)
  assert.match(html, /data-pw-added-banner="1"/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-banner-kind="promo"/)
  assert.match(html, /data-pw-personalize-banner="promo"/)
  assert.match(html, /data-pw-slider="1"/)
  assert.match(html, /data-pw-full-slides="1"/)
  assert.match(html, /data-pw-slide-wait="6500"/)
  assert.match(html, /data-pw-promo-slot="birthday"/)
  assert.match(html, /data-pw-promo-slot="sale"/)
  assert.match(html, /data-pw-promo-slot="warehouse"/)
  assert.match(html, /data-pw-promo-slot="regular"/)
  assert.match(html, /Chúc mừng sinh nhật/)
  assert.match(html, /Sale cùng ngày cùng tháng/)
  assert.match(html, /Sale kho/)
  assert.match(html, /Banner thường/)
  assert.match(html, /\/site\/demo-shop\/kho-sale/)
  assert.match(html, /\/site\/demo-shop\/products/)
  assert.match(html, /var\(--pw-primary\)/)
  assert.match(html, /var\(--pw-accent\)/)
  assert.match(html, /var\(--pw-buy/)
  assert.match(html, /aspect-ratio:21\/9/)
  assert.doesNotMatch(html, /#f97316|#ea580c|#fff7ed|#d1d5db/)
  assert.equal(bannerWidgetLabel('promo', 'vi'), 'Thêm banner')
})

test('hero and slider kinds also emit the unified promo block', () => {
  const hero = buildVisualEditorBannerHtml({ kind: 'hero', siteSlug: 'demo-shop', locale: 'vi' })
  const slider = buildVisualEditorBannerHtml({ kind: 'slider', siteSlug: 'demo-shop', locale: 'vi' })
  assert.equal(isUnifiedPromoBannerHtml(hero), true)
  assert.equal(isUnifiedPromoBannerHtml(slider), true)
  assert.doesNotMatch(slider, /data-pw-banner-kind="slider"/)
})

test('live CSS paints added banner from theme tokens', () => {
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /data-pw-added-banner/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /var\(--pw-primary\)/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /var\(--pw-accent\)/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /::after\{display:none/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /data-pw-banner-wash/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /img\[data-pw-el="media"\]/)
})

test('save restores marketing banner placeholders and drops live carousel', () => {
  const { document } = parseHTML(
    '<section data-pw-personalize-banner="promo" data-pw-banner-live="1">' +
      '<div data-pw-promo-carousel="1"><a href="/kho-sale"><img src="https://cdn.example/live.png"/></a></div>' +
      '<div data-pw-promo-slot="birthday"><img data-pw-el="media" src="https://cdn.example/sale.png"/></div>' +
      '<h1 data-pw-el="title">Live title</h1>' +
      '</section>' +
      '<p data-pw-banner-greeting="1">Hello</p>'
  )
  restoreMarketingBannerSeedsInDocument(document)
  const img = document.querySelector('[data-pw-promo-slot] img[data-pw-el="media"]')
  assert.match(String(img?.getAttribute('src') || ''), /^data:image\/svg\+xml/)
  assert.equal(document.querySelector('[data-pw-personalize-banner]')?.hasAttribute('data-pw-banner-live'), false)
  assert.equal(document.querySelector('[data-pw-promo-carousel]'), null)
  assert.equal(document.querySelector('[data-pw-banner-greeting]'), null)
})

test('home seed injects one unified host when missing', () => {
  const home = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="home"><header></header><main></main></body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'home' }
  )
  assert.equal(isUnifiedPromoBannerHtml(home), true)
  assert.equal(home.split('data-pw-personalize-banner="promo"').length - 1, 1)
  const listing = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="listing"><header></header><main></main></body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'products' }
  )
  assert.doesNotMatch(listing, /data-pw-personalize-banner/)
})

test('converts leftover hero and extra promo hosts into one unified block', () => {
  const leftover = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="home"><header></header>' +
      '<section class="pw-hero" data-pw-region="banner" data-pw-block-h="465"><h1>sưu tập mới</h1></section>' +
      '<section data-pw-personalize-banner="birthday"></section>' +
      '</body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'home' }
  )
  assert.equal(isUnifiedPromoBannerHtml(leftover), true)
  assert.match(leftover, /data-pw-block-h="465"/)
  assert.doesNotMatch(leftover, /sưu tập mới/)
  assert.doesNotMatch(leftover, /data-pw-personalize-banner="birthday"/)
  assert.equal(leftover.split('data-pw-region="banner"').length - 1, 1)
})

test('live banner CSS keeps Sửa nhanh CTA row when desktop is stamped', () => {
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /text-transform:none!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /flex-direction:row!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /html\[data-pw-edit-device="desktop"\] \.pw-hero/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /html\[data-pw-scene-lock="laptop"\] \.pw-hero/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /margin-top:0!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /:not\(\[data-pw-image-radius\]\)/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /\[data-pw-image-radius="0"\]\{border-radius:0!important\}/)
})

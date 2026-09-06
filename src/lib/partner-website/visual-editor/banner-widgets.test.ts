import assert from 'node:assert/strict'
import test from 'node:test'
import { parseHTML } from 'linkedom'
import {
  bannerWidgetLabel,
  buildVisualEditorBannerHtml,
  ensurePromoMarketingBannerInHtml,
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

test('stamps packaged banner contract', () => {
  const html = buildVisualEditorBannerHtml({ siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-region="banner"/)
  assert.match(html, /data-pw-bg-role="banner"/)
  assert.match(html, /data-pw-added-banner="1"/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-el="media"/)
  assert.match(html, /data-pw-el="copy"/)
  assert.match(html, /data-pw-el="badge"/)
  assert.match(html, /data-pw-el="title"/)
  assert.match(html, /data-pw-el="subtitle"/)
  assert.match(html, /data-pw-el="cta"/)
  assert.match(html, /data-pw-el="cta-secondary"/)
  assert.match(html, /data-pw-el="dots"/)
  assert.match(html, /data-pw-edit="heroTitle"/)
  assert.match(html, /\/site\/demo-shop\/products/)
  assert.match(html, /var\(--pw-primary\)/)
  assert.match(html, /var\(--pw-accent\)/)
  assert.match(html, /var\(--pw-buy/)
  assert.match(html, /data-pw-banner-placeholder="1"/)
  assert.match(html, /data-pw-image-radius="0"/)
  assert.match(html, /data-pw-token="buy"/)
  assert.doesNotMatch(html, /#f97316|#ea580c|#fff7ed|#d1d5db/)
  assert.equal(bannerWidgetLabel('hero', 'vi'), 'Banner')
})

test('stamps horizontal slider contract', () => {
  const html = buildVisualEditorBannerHtml({ kind: 'slider', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(html, /data-pw-region="banner"/)
  assert.match(html, /data-pw-slider="1"/)
  assert.match(html, /data-pw-scene="2"/)
  assert.match(html, /data-pw-banner-kind="slider"/)
  assert.match(html, /data-pw-slide-wait="4000"/)
  assert.match(html, /data-pw-slide-arrows="1"/)
  assert.match(html, /data-pw-slides/)
  assert.match(html, /data-pw-slide-prev/)
  assert.match(html, /data-pw-slide-next/)
  assert.match(html, /data-pw-slide-to="0"/)
  assert.match(html, /data-pw-el="dots"/)
  assert.match(html, /var\(--pw-primary\)/)
  assert.match(html, /var\(--pw-buy/)
  assert.doesNotMatch(html, /#f97316|#ea580c|#fff7ed/)
  assert.equal(bannerWidgetLabel('slider', 'vi'), 'Banner ngang')
})

test('live CSS paints added banner from theme tokens', () => {
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /data-pw-added-banner/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /var\(--pw-primary\)/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /var\(--pw-accent\)/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /::after\{display:none/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /data-pw-banner-wash/)
  assert.match(PARTNER_SHOP_BANNER_MEDIA_FILL_CSS, /img\[data-pw-el="media"\]/)
})

test('stamps promo personalize banner; leftover birthday/sale kinds still parse', () => {
  const promo = buildVisualEditorBannerHtml({ kind: 'promo', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(promo, /data-pw-region="banner"/)
  assert.match(promo, /data-pw-personalize-banner="promo"/)
  assert.match(promo, /data-pw-banner-kind="promo"/)
  assert.match(promo, /data-pw-el="media"/)
  assert.match(promo, /aspect-ratio:21\/9/)
  assert.match(promo, /var\(--pw-primary\)/)
  assert.doesNotMatch(promo, /#f97316|#ea580c|#fff7ed/)
  assert.equal(bannerWidgetLabel('promo', 'vi'), 'Banner ưu đãi')

  const birthday = buildVisualEditorBannerHtml({ kind: 'birthday', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(birthday, /data-pw-personalize-banner="birthday"/)
  assert.equal(bannerWidgetLabel('birthday', 'vi'), 'Banner chúc mừng SN')

  const sale = buildVisualEditorBannerHtml({ kind: 'sale-calendar', siteSlug: 'demo-shop', locale: 'vi' })
  assert.match(sale, /data-pw-personalize-banner="sale-calendar"/)
  assert.equal(bannerWidgetLabel('sale-calendar', 'vi'), 'Banner sale cùng ngày cùng tháng')
})

test('save restores marketing banner seed image and drops live carousel', () => {
  const { document } = parseHTML(
    '<section data-pw-personalize-banner="promo" data-pw-seed-src="data:image/svg+xml,seed" data-pw-seed-title="Ưu đãi dành cho bạn" data-pw-banner-live="1">' +
      '<div data-pw-promo-carousel="1"><a href="/kho-sale"><img src="https://cdn.example/live.png"/></a></div>' +
      '<img data-pw-el="media" src="https://cdn.example/sale.png"/>' +
      '<h1 data-pw-el="title">Live title</h1>' +
      '</section>' +
      '<p data-pw-banner-greeting="1">Hello</p>'
  )
  restoreMarketingBannerSeedsInDocument(document)
  const section = document.querySelector('[data-pw-personalize-banner]')
  const img = document.querySelector('img[data-pw-el="media"]')
  assert.equal(img?.getAttribute('src'), 'data:image/svg+xml,seed')
  assert.equal(section?.querySelector('[data-pw-el="title"]')?.textContent, 'Ưu đãi dành cho bạn')
  assert.equal(section?.hasAttribute('data-pw-banner-live'), false)
  assert.equal(document.querySelector('[data-pw-promo-carousel]'), null)
  assert.equal(document.querySelector('[data-pw-banner-greeting]'), null)
})

test('home seed injects one promo host when missing; skips leftover widgets', () => {
  const home = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="home"><header></header><main></main></body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'home' }
  )
  assert.match(home, /data-pw-personalize-banner="promo"/)
  const leftover = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="home"><header></header><section data-pw-personalize-banner="birthday"></section></body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'home' }
  )
  assert.match(leftover, /data-pw-personalize-banner="birthday"/)
  assert.doesNotMatch(leftover, /data-pw-personalize-banner="promo"/)
  const listing = ensurePromoMarketingBannerInHtml(
    '<html><body data-pw-page="listing"><header></header><main></main></body></html>',
    { siteSlug: 'demo-shop', locale: 'vi', pageKey: 'products' }
  )
  assert.doesNotMatch(listing, /data-pw-personalize-banner/)
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

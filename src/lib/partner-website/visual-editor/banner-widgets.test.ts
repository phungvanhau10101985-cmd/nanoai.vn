import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bannerWidgetLabel,
  buildVisualEditorBannerHtml,
  isVisualEditorBannerKind,
} from '@/lib/partner-website/visual-editor/banner-widgets'
import {
  PARTNER_SHOP_BANNER_LIVE_MATCH_CSS,
  PARTNER_SHOP_BANNER_MEDIA_FILL_CSS,
} from '@/lib/partner-website/visual-editor/pw-scene'

test('recognizes banner kinds', () => {
  assert.equal(isVisualEditorBannerKind('hero'), true)
  assert.equal(isVisualEditorBannerKind('slider'), true)
  assert.equal(isVisualEditorBannerKind('catalog'), false)
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

test('live banner CSS keeps Sửa nhanh CTA row when desktop is stamped', () => {
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /text-transform:none!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /flex-direction:row!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /html\[data-pw-edit-device="desktop"\] \.pw-hero/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /html\[data-pw-scene-lock="laptop"\] \.pw-hero/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /margin-top:0!important/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /:not\(\[data-pw-image-radius\]\)/)
  assert.match(PARTNER_SHOP_BANNER_LIVE_MATCH_CSS, /\[data-pw-image-radius="0"\]\{border-radius:0!important\}/)
})

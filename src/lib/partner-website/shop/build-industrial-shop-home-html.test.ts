import assert from 'node:assert/strict'
import test from 'node:test'

import { buildIndustrialShopHomeHtml } from '@/lib/partner-website/shop/build-industrial-shop-home-html'
import { buildIndustrialShopPdpHtml } from '@/lib/partner-website/shop/build-industrial-shop-pdp-html'
import { getShopTemplatePreset } from '@/lib/partner-website/template/shop-template-presets'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildShopTemplateSampleHtml } from '@/lib/partner-website/template/build-shop-template-sample-html'

const theme = { ...DEFAULT_PARTNER_WEBSITE_THEME, ...getShopTemplatePreset('GD09').theme }

test('GD09 home is industrial machinery on desktop and mobile', () => {
  for (const variant of ['desktop', 'mobile'] as const) {
    const html = buildIndustrialShopHomeHtml({
      variant,
      locale: variant === 'mobile' ? 'vi' : 'en',
      siteSlug: 'may-moc',
      brand: 'Tin Song Phat',
      theme,
    })
    assert.match(html, /pw-industrial-home/)
    assert.match(html, /data-pw-look="shop"/)
    assert.match(html, /data-pw-personalize-banner="promo"/)
    assert.match(html, /data-pw-promo-slot="regular"/)
    assert.match(html, /data-pw-featured-categories="1"/)
    assert.match(html, /data-pw-catalog/)
    assert.match(html, /data-pw-personalize="flash-sale"/)
    assert.match(html, /data-pw-chrome-btn="phone"/)
    assert.match(html, /pw-industrial-why/)
    assert.match(html, /pw-industrial-news/)
    assert.match(html, /pw-header/)
    assert.match(html, /data-pw-footer="full"/)
    assert.match(html, /data-pw-chrome-kit="dock"/)
    const catalog = html.match(/<section\b[^>]*\bdata-pw-catalog\b[^>]*>[\s\S]*?<\/section>/i)?.[0] || ''
    assert.match(catalog, /data-pw-el="card"/)
    assert.doesNotMatch(catalog, /data-pw-el="card-cart"/)
    assert.doesNotMatch(catalog, /data-pw-el="card-buy"/)
    if (variant === 'mobile') {
      assert.match(html, /GIẢI PHÁP MÁY MÓC CÔNG NGHIỆP TOÀN DIỆN/)
      assert.match(html, /Máy móc bán chạy/)
      assert.match(html, /LIÊN HỆ TƯ VẤN MIỄN PHÍ/)
      assert.match(html, /Máy xây dựng/)
      assert.doesNotMatch(html, /Áo sơ mi/)
    } else {
      assert.match(html, /RELIABLE MACHINERY FOR YOUR GROWTH/)
      assert.match(html, /Latest arrivals/)
      assert.match(html, /Why choose us/)
    }
  }
})

test('GD09 product page matches machinery detail on mobile and desktop', () => {
  const mobile = buildIndustrialShopPdpHtml({ variant: 'mobile', locale: 'vi', siteSlug: 'may-moc', title: 'Tin Song Phat' })
  assert.match(mobile, /pw-industrial-pdp/)
  assert.match(mobile, /pw-industrial-chrome/)
  assert.match(mobile, /Máy tiện CNC X-2000/)
  assert.match(mobile, /data-pw-pdp-slot="machine-specs"/)
  assert.match(mobile, /Liên hệ tư vấn/)
  assert.match(mobile, /data-pw-el="buy"/)
  assert.match(mobile, /pw-pdp-hero/)
  assert.match(mobile, /Liên kết nhanh/)
  const desktop = buildIndustrialShopPdpHtml({ variant: 'desktop', locale: 'vi', siteSlug: 'may-moc', title: 'Tin Song Phat' })
  assert.match(desktop, /pw-pdp-gallery-desktop/)
  assert.match(desktop, /Thêm vào giỏ hàng/)
  assert.match(desktop, /Liên hệ báo giá/)
  assert.match(desktop, /Sản phẩm liên quan/)
  assert.match(desktop, /data-pw-region="breadcrumb"/)
  assert.match(desktop, /550\.000\.000 VNĐ/)
  assert.doesNotMatch(desktop, /Đầm sequin/)
})

test('GD09 gallery sample paints machinery instead of fashion tiles', () => {
  const built = buildShopTemplateSampleHtml({ presetId: 'GD09', locale: 'vi' })
  assert.equal(built.ok, true)
  if (!built.ok) return
  assert.match(built.html, /Máy phay CNC/)
  assert.match(built.html, /Máy xây dựng/)
  assert.match(built.html, /data-pw-sample-colors="1"/)
  assert.doesNotMatch(built.html, /Đầm sequin/)
  assert.doesNotMatch(built.html, /Túi xách/)
})

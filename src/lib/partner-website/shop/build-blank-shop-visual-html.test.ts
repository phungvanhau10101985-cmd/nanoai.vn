import assert from 'node:assert/strict'
import test from 'node:test'

import { adsPlatformPolicyParagraph } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { VISUAL_DEVICE_VARIANTS } from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { visualHtmlLooksUsable } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { getShopTemplatePreset, isShopTemplatePresetId } from '@/lib/partner-website/template/shop-template-presets'
import {
  BLANK_SHOP_VISUAL_PAGE_KEYS,
  buildBlankShopVisualHtml,
  seedBlankShopVisualWebsite,
} from './build-blank-shop-visual-html'

test('blank-white is a shop preset with a white theme', () => {
  assert.equal(isShopTemplatePresetId('blank-white'), true)
  const preset = getShopTemplatePreset('blank-white')
  assert.equal(preset.id, 'blank-white')
  assert.equal(preset.theme.backgroundColor, '#ffffff')
  assert.equal(preset.theme.primaryColor, '#111827')
  assert.equal(preset.flags.products, true)
  assert.equal(preset.flags.lead, false)
})

test('blank home canvas is white, stamped, and has no stock header or catalog', () => {
  const html = buildBlankShopVisualHtml({
    pageKey: 'home',
    variant: 'desktop',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Demo Shop',
  })
  assert.equal(visualHtmlLooksUsable(html), true)
  assert.match(html, /data-pw-page="home"/)
  assert.match(html, /data-pw-look="shop"/)
  assert.match(html, /data-pw-region="content"/)
  assert.match(html, /data-pw-region="footer"/)
  assert.match(html, /data-pw-edit-device="desktop"/)
  assert.match(html, /data-pw-scene-lock="desktop"/)
  assert.match(html, /--pw-bg|#fff/)
  assert.equal(/data-pw-region="header"/.test(html), false)
  assert.equal(/data-pw-region="banner"/.test(html), false)
  assert.equal(/data-pw-region="catalog"/.test(html), false)
  assert.equal(/#f97316|#ea580c|#fff7ed/.test(html), false)
  assert.equal(/pw-header|pw-hero|pw-product-grid/.test(html), false)
})

test('blank visual HTML covers four devices and ads policy pages', () => {
  for (const variant of VISUAL_DEVICE_VARIANTS) {
    const html = buildBlankShopVisualHtml({
      pageKey: 'home',
      variant,
      locale: 'vi',
      siteSlug: 'demo-shop',
      brand: 'Demo Shop',
    })
    assert.equal(visualHtmlLooksUsable(html), true)
    assert.match(html, new RegExp(`data-pw-edit-device="${variant}"`))
    assert.match(html, /data-pw-chrome-btn="home"/)
  }

  const privacy = buildBlankShopVisualHtml({
    pageKey: 'privacy',
    variant: 'mobile',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Demo Shop',
  })
  assert.match(privacy, /data-pw-page="info"/)
  assert.ok(privacy.includes(adsPlatformPolicyParagraph('vi')))

  const pdp = buildBlankShopVisualHtml({
    pageKey: 'product_detail',
    variant: 'mobile',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Demo Shop',
  })
  assert.match(pdp, /data-pw-page="product"/)
  assert.match(pdp, /data-pw-region="gallery"/)
  assert.match(pdp, /data-pw-pdp-bottom="1"/)
  assert.equal(/data-pw-region="header"/.test(pdp), false)
})

test('seedBlankShopVisualWebsite writes visual flags and home htmlSource', () => {
  const seeded = seedBlankShopVisualWebsite({
    project: { entryPath: 'site.config.json', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: false },
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Demo Shop',
  })
  assert.equal(seeded.theme.useVisualHtml, true)
  assert.equal(seeded.theme.useVisualMobileHtml, true)
  assert.equal(seeded.theme.useVisualTabletHtml, true)
  assert.equal(seeded.theme.useVisualLaptopHtml, true)
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('product_detail'))
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('privacy'))
  assert.equal(visualHtmlLooksUsable(seeded.htmlSource), true)
  assert.match(seeded.htmlSource, /data-pw-page="home"/)
  const htmlFiles = seeded.project.files.filter((f) => f.kind === 'html')
  assert.equal(htmlFiles.length, BLANK_SHOP_VISUAL_PAGE_KEYS.length * VISUAL_DEVICE_VARIANTS.length)
})

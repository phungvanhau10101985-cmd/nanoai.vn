import assert from 'node:assert/strict'
import test from 'node:test'

import { adsPlatformPolicyParagraph } from '@/lib/partner-website/shop/partner-site-shop-info-pages'
import { visualHtmlLooksUsable } from '@/lib/partner-website/visual-editor/serialize-visual-editor-html'
import {
  VISUAL_DEVICE_VARIANTS,
  visualEditorHtmlPath,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { getShopTemplatePreset } from '@/lib/partner-website/template/shop-template-presets'
import {
  SHOP_TEMPLATE_VISUAL_PAGE_KEYS,
  buildShopTemplateHomeVisualHtml,
  seedShopTemplateVisualWebsite,
} from './seed-shop-template-visual-website'

const preset = getShopTemplatePreset('fashion-orange')
const site = buildDefaultLandingV1Site({
  locale: 'vi',
  title: 'Shop Cam',
  briefText: 'Fashion shop',
  logoUrl: null,
  theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, ...preset.theme },
})

test('fashion home seed is stamped and matches live visual contract', () => {
  const html = buildShopTemplateHomeVisualHtml({
    variant: 'desktop',
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    templateId: preset.templateId,
    theme: site.theme,
    pages: site.pages,
  })
  assert.equal(visualHtmlLooksUsable(html), true)
  assert.match(html, /data-pw-page="home"/)
  assert.match(html, /data-pw-edit-device="desktop"/)
  assert.match(html, /data-pw-scene-lock="desktop"/)
  assert.match(html, /data-pw-region="header"/)
  assert.match(html, /data-pw-region="banner"/)
  assert.match(html, /data-pw-region="catalog"/)
  assert.match(html, /data-pw-region="footer"/)
  assert.match(html, /data-pw-catalog/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /data-pw-seo-jsonld="website"/)
  assert.match(html, /html\[data-pw-edit-device="desktop"\] \.pw-product-grid/)
  assert.doesNotMatch(html, /data-pw-header-toggle|data-pw-catalog-bootstrap/)
})

test('seedShopTemplateVisualWebsite writes every built-in page for all four devices', () => {
  const seeded = seedShopTemplateVisualWebsite({
    project: { entryPath: 'site.config.json', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: false },
    pages: site.pages,
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    templateId: preset.templateId,
  })
  assert.equal(seeded.theme.useVisualHtml, true)
  assert.equal(seeded.theme.useVisualMobileHtml, true)
  assert.equal(seeded.theme.useVisualTabletHtml, true)
  assert.equal(seeded.theme.useVisualLaptopHtml, true)
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('product_detail'))
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('privacy'))
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('products'))
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('cart'))
  assert.ok((seeded.theme.visualPageKeys ?? []).includes('account'))
  assert.equal(visualHtmlLooksUsable(seeded.htmlSource), true)
  assert.match(seeded.htmlSource, /data-pw-page="home"/)

  const htmlFiles = seeded.project.files.filter((f) => f.kind === 'html')
  assert.equal(htmlFiles.length, SHOP_TEMPLATE_VISUAL_PAGE_KEYS.length * VISUAL_DEVICE_VARIANTS.length)
  assert.equal(
    htmlFiles.some((f) => /cart\.(mobile\.)?html$/.test(f.path)),
    true
  )
  for (const variant of VISUAL_DEVICE_VARIANTS) {
    for (const pageKey of ['products', 'cart', 'account'] as const) {
      const file = htmlFiles.find((item) => item.path === visualEditorHtmlPath(pageKey, variant))
      assert.ok(file, `${pageKey}/${variant} must have a built-in visual file`)
      assert.match(file.content, new RegExp(`data-pw-edit-device="${variant}"`))
      assert.match(file.content, new RegExp(`data-pw-scene-lock="${variant}"`))
    }
  }

  const privacy = htmlFiles.find((f) => f.path.includes('privacy') && f.path.includes('mobile'))
  assert.ok(privacy)
  assert.ok(privacy.content.includes(adsPlatformPolicyParagraph('vi')))

  const pdp = htmlFiles.find((f) => f.path.includes('product-detail') && !f.path.includes('mobile'))
  assert.ok(pdp)
  assert.match(pdp.content, /data-pw-page="product"/)
  assert.match(pdp.content, /data-pw-region="gallery"|data-pw-region="pdp-info"/)

  const productsDesktop = htmlFiles.find((f) => f.path === visualEditorHtmlPath('products', 'desktop'))
  assert.ok(productsDesktop)
  assert.match(productsDesktop.content, /data-pw-page="listing"/)
  assert.match(productsDesktop.content, /data-pw-catalog/)
  assert.match(productsDesktop.content, /data-pw-region="filters"/)
  assert.match(productsDesktop.content, /data-pw-region="breadcrumb"/)
  assert.match(productsDesktop.content, /<meta name="description"/)

  const productsMobile = htmlFiles.find((f) => f.path === visualEditorHtmlPath('products', 'mobile'))
  assert.ok(productsMobile)
  assert.match(productsMobile.content, /data-pw-grid-cols-mobile="2"/)
  assert.match(productsMobile.content, /grid-template-columns:repeat\(2,/)

  const about = htmlFiles.find((f) => f.path === visualEditorHtmlPath('about', 'laptop'))
  assert.ok(about)
  assert.match(about.content, /data-pw-info-title/)
  assert.match(about.content, /data-pw-info-body/)
  assert.match(about.content, /data-pw-text-article="1"/)
})

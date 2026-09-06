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
  fillMissingShopVisualDeviceFiles,
  seedShopTemplateVisualWebsite,
} from './seed-shop-template-visual-website'
import { resolvePartnerVisualHtmlVariantsForTarget } from '@/lib/partner-website/shop/render-partner-visual-html'

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
  assert.match(html, /data-pw-personalize-banner="promo"/)
  assert.match(html, /data-pw-promo-slot="birthday"/)
  assert.match(html, /data-pw-promo-slot="sale"/)
  assert.match(html, /data-pw-promo-slot="warehouse"/)
  assert.match(html, /data-pw-promo-slot="regular"/)
  assert.match(html, /data-pw-region="catalog"/)
  assert.match(html, /data-pw-region="footer"/)
  assert.match(html, /data-pw-catalog/)
  assert.match(html, /<meta name="description"/)
  assert.match(html, /data-pw-seo-jsonld="website"/)
  assert.match(html, /html\[data-pw-edit-device="desktop"\] \.pw-product-grid/)
  assert.match(html, /data-pw-kit-gap="8"/)
  assert.match(html, /data-pw-chrome-size="20"/)
  assert.match(html, /data-pw-float-size="44"/)
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
  assert.match(productsMobile.content, /data-pw-kit-gap="4"/)
  assert.match(productsMobile.content, /data-pw-chrome-size="22"/)
  assert.match(productsMobile.content, /data-pw-float-size="48"/)
  assert.match(productsMobile.content, /data-pw-float-gap="64"/)

  const about = htmlFiles.find((f) => f.path === visualEditorHtmlPath('about', 'laptop'))
  assert.ok(about)
  assert.match(about.content, /data-pw-info-title/)
  assert.match(about.content, /data-pw-info-body/)
  assert.match(about.content, /data-pw-text-article="1"/)
})

test('seeded shop live variants include all four devices', () => {
  const seeded = seedShopTemplateVisualWebsite({
    project: { entryPath: 'site.config.json', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: false },
    pages: site.pages,
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    templateId: preset.templateId,
  })
  const variants = resolvePartnerVisualHtmlVariantsForTarget(seeded, { kind: 'page', pageKey: 'home' })
  for (const device of VISUAL_DEVICE_VARIANTS) {
    const html = variants[device] || ''
    assert.ok(html.length >= 40, `${device} must be in live htmlByDevice`)
    assert.match(html, new RegExp(`data-pw-edit-device="${device}"`))
  }
})

test('fillMissingShopVisualDeviceFiles adds other devices without overwriting desktop', () => {
  const seeded = seedShopTemplateVisualWebsite({
    project: { entryPath: 'site.config.json', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: false },
    pages: site.pages,
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    templateId: preset.templateId,
  })
  const desktopHome = seeded.project.files.find((f) => f.path === 'index.html')?.content || ''
  assert.ok(desktopHome)
  const desktopOnly = {
    project: {
      entryPath: 'index.html',
      files: seeded.project.files.filter(
        (f) => f.kind !== 'html' || (!f.path.includes('.mobile.') && !f.path.includes('.tablet.') && !f.path.includes('.laptop.'))
      ),
    },
    theme: {
      ...DEFAULT_PARTNER_WEBSITE_THEME,
      useVisualHtml: true,
      useVisualMobileHtml: false,
      useVisualTabletHtml: false,
      useVisualLaptopHtml: false,
    },
    pages: site.pages,
    locale: 'vi' as const,
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    logoUrl: null,
    templateId: preset.templateId,
    htmlSource: desktopHome,
    pageKeys: ['home' as const],
  }
  const filled = fillMissingShopVisualDeviceFiles(desktopOnly)
  assert.equal(filled.changed, true)
  assert.equal(filled.theme.useVisualMobileHtml, true)
  assert.equal(filled.theme.useVisualTabletHtml, true)
  assert.equal(filled.theme.useVisualLaptopHtml, true)
  const afterDesktop = filled.project.files.find((f) => f.path === 'index.html')?.content || ''
  assert.equal(afterDesktop, desktopHome)
  for (const device of ['laptop', 'tablet', 'mobile'] as const) {
    const file = filled.project.files.find((f) => f.path === visualEditorHtmlPath('home', device))
    assert.ok(file, `home ${device} must be filled`)
    assert.match(file.content, new RegExp(`<html[^>]*data-pw-edit-device="${device}"`))
    assert.doesNotMatch(file.content, /<html[^>]*data-pw-edit-device="desktop"/)
  }
  const again = fillMissingShopVisualDeviceFiles({
    ...desktopOnly,
    project: filled.project,
    theme: filled.theme,
    htmlSource: filled.htmlSource,
  })
  assert.equal(again.changed, false)
  const variants = resolvePartnerVisualHtmlVariantsForTarget(filled, { kind: 'page', pageKey: 'home' })
  for (const device of VISUAL_DEVICE_VARIANTS) {
    assert.ok((variants[device] || '').length >= 40, `${device} live after fill`)
  }
})

test('fillMissingShopVisualDeviceFiles live path can seed only the viewed machine', () => {
  const filled = fillMissingShopVisualDeviceFiles({
    project: { entryPath: 'index.html', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, useVisualHtml: false },
    pages: site.pages,
    locale: 'vi',
    siteSlug: 'demo-shop',
    brand: 'Shop Cam',
    templateId: preset.templateId,
    pageKeys: ['home', 'products'],
    devices: ['mobile'],
  })
  const htmlFiles = filled.project.files.filter((file) => file.kind === 'html').map((file) => file.path)
  assert.ok(htmlFiles.includes('index.mobile.html'))
  assert.ok(htmlFiles.includes('products.mobile.html'))
  assert.ok(!htmlFiles.includes('index.html'))
  assert.ok(!htmlFiles.includes('index.laptop.html'))
  assert.ok(!htmlFiles.includes('products.html'))
})

test('fashion-marketplace seed stamps look and home API hooks on all four devices', () => {
  const marketplace = getShopTemplatePreset('fashion-marketplace')
  const seeded = seedShopTemplateVisualWebsite({
    project: { entryPath: 'site.config.json', files: [] },
    theme: { ...DEFAULT_PARTNER_WEBSITE_THEME, ...marketplace.theme },
    pages: site.pages,
    locale: 'vi',
    siteSlug: 'demo-market',
    brand: 'Shop San',
    templateId: marketplace.templateId,
  })
  assert.equal(seeded.theme.useVisualHtml, true)
  assert.equal(
    seeded.project.files.filter((f) => f.kind === 'html').length,
    SHOP_TEMPLATE_VISUAL_PAGE_KEYS.length * VISUAL_DEVICE_VARIANTS.length
  )
  for (const variant of VISUAL_DEVICE_VARIANTS) {
    const home = seeded.project.files.find((f) => f.path === visualEditorHtmlPath('home', variant))
    assert.ok(home, `home/${variant}`)
    assert.match(home.content, /data-pw-look="marketplace"/)
    assert.match(home.content, /data-pw-region="banner"/)
    assert.match(home.content, /data-pw-personalize-banner="promo"/)
    assert.match(home.content, /data-pw-slider="1"/)
    assert.match(home.content, /data-pw-featured-categories="1"/)
    assert.match(home.content, /data-pw-trust-bar="1"/)
    assert.match(home.content, /data-pw-catalog/)
    assert.match(home.content, /data-sort="newest"/)
    assert.match(home.content, /data-sale="1"/)
    assert.match(home.content, /data-pw-personalize="recommended"/)
    assert.match(home.content, /data-pw-personalize="recently-viewed"/)
    assert.match(home.content, /data-pw-newsletter="1"/)
    assert.match(home.content, /data-pw-region="header"/)
    assert.match(home.content, /data-pw-region="footer"/)
    assert.match(home.content, /data-pw-chrome-kit="dock"/)
    assert.doesNotMatch(home.content, /188\.com\.vn|Xem là thích/i)
    assert.match(home.content, /background:var\(--pw-primary\)!important/)
    assert.doesNotMatch(home.content, /if \(slug\.includes\('188'\)\)/)
  }
  const pdp = seeded.project.files.find((f) => f.path === visualEditorHtmlPath('product_detail', 'desktop'))
  assert.ok(pdp)
  assert.match(pdp.content, /data-pw-look="marketplace"/)
  const products = seeded.project.files.find((f) => f.path === visualEditorHtmlPath('products', 'mobile'))
  assert.ok(products)
  assert.match(products.content, /data-pw-look="marketplace"/)
  assert.match(products.content, /data-pw-catalog/)
})


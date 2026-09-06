import type { WebLocale } from '@/lib/i18n/config'
import { buildBlankShopVisualHtml } from '@/lib/partner-website/shop/build-blank-shop-visual-html'
import { buildShopTemplateHomeVisualHtml } from '@/lib/partner-website/shop/seed-shop-template-visual-website'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'
import { buildDefaultLandingV1Site } from '@/lib/partner-website/template/default-landing-v1'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'
import {
  getShopTemplatePreset,
  type ShopTemplatePresetId,
  isShopTemplatePresetId,
} from '@/lib/partner-website/template/shop-template-presets'
import {
  getShopTemplateSampleBrand,
  getShopTemplateSampleProducts,
} from '@/lib/partner-website/template/shop-template-sample-products'
import type { PartnerWebsitePage } from '@/lib/partner-website/template/partner-website-template-types'
import { isMarketplaceTemplateId } from '@/lib/partner-website/shop/marketplace-shop-look-css'
import { preparePartnerVisualHtmlForPublic } from '@/lib/partner-website/shop/render-partner-visual-html'

function injectSampleProducts(pages: PartnerWebsitePage[], locale: WebLocale): PartnerWebsitePage[] {
  const products = getShopTemplateSampleProducts(locale)
  const newArrivals = products.slice(0, 4)
  const bestSellers = products.slice(4, 8)
  let productSectionIndex = 0

  return pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.type !== 'products-v1') return section
      const batch = productSectionIndex === 0 ? newArrivals : bestSellers
      productSectionIndex += 1
      return {
        ...section,
        props: {
          ...section.props,
          useInventory: false,
          products: batch,
        },
      }
    }),
  }))
}

/** Full HTML for the public template gallery (no partner / inventory required). */
export function buildShopTemplateSampleHtml(input: {
  presetId: string
  locale: WebLocale
}): { ok: true; html: string; presetId: ShopTemplatePresetId } | { ok: false; error: string } {
  if (!isShopTemplatePresetId(input.presetId)) {
    return { ok: false, error: 'Unknown template' }
  }
  const preset = getShopTemplatePreset(input.presetId)
  const brand =
    isMarketplaceTemplateId(preset.templateId) || preset.theme.look === 'marketplace'
      ? preset.label[input.locale] || preset.label.en
      : getShopTemplateSampleBrand(input.locale)
  if (preset.id === 'blank-white') {
    const html = buildBlankShopVisualHtml({
      pageKey: 'home',
      variant: 'desktop',
      locale: input.locale,
      siteSlug: '',
      brand,
    })
    return { ok: true, html, presetId: preset.id }
  }
  if (isMarketplaceTemplateId(preset.templateId) || preset.theme.look === 'marketplace') {
    const theme = { ...DEFAULT_PARTNER_WEBSITE_THEME, ...preset.theme }
    const seeded = buildShopTemplateHomeVisualHtml({
      variant: 'desktop',
      locale: input.locale,
      siteSlug: '',
      brand,
      templateId: preset.templateId,
      theme,
      pages: [],
      samplePreview: true,
    })
    const html = preparePartnerVisualHtmlForPublic(seeded, {
      theme,
      locale: input.locale,
      variant: 'desktop',
      includeRuntime: false,
      pageKey: 'home',
    })
    return { ok: true, html, presetId: preset.id }
  }
  const site = buildDefaultLandingV1Site({
    locale: input.locale,
    title: brand,
    briefText: brand,
    theme: { ...preset.theme },
  })
  const pages = injectSampleProducts(site.pages, input.locale)
  const html = renderTemplateSiteToHtml({
    locale: input.locale,
    title: brand,
    templateId: preset.templateId,
    theme: { ...site.theme, ...preset.theme },
    pages,
    logoUrl: null,
    samplePreview: true,
  })
  return { ok: true, html, presetId: preset.id }
}

export function shopTemplateSamplePreviewPath(presetId: string, locale?: WebLocale): string {
  const q = locale && locale !== 'vi' ? `?locale=${encodeURIComponent(locale)}` : ''
  return `/mau-giao-dien/${encodeURIComponent(presetId)}${q}`
}

export function shopTemplateGalleryPath(locale?: WebLocale): string {
  const q = locale && locale !== 'vi' ? `?locale=${encodeURIComponent(locale)}` : ''
  return `/mau-giao-dien${q}`
}

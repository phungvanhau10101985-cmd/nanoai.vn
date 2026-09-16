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
import { paintShopTemplateSamplePreviewInHtml } from '@/lib/partner-website/template/shop-template-sample-preview'
import {
  injectShopTemplateSampleColorPickerInHtml,
  shopTemplateSampleThemeForPrimary,
} from '@/lib/partner-website/template/shop-template-sample-color-picker'
import {
  getShopTemplateSampleBrand,
  getShopTemplateSampleProducts,
  getShopTemplateSampleSlogan,
} from '@/lib/partner-website/template/shop-template-sample-products'
import type { PartnerWebsitePage, PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { rewriteThemeCssVarsInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'
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

function withSampleColorPicker(
  html: string,
  locale: WebLocale,
  originalTheme: PartnerWebsiteTheme,
  theme: PartnerWebsiteTheme
): string {
  return injectShopTemplateSampleColorPickerInHtml(html, {
    locale,
    originalTheme,
    selectedHex: theme.primaryColor,
  })
}

/** Full HTML for the public template gallery (no partner / inventory required). */
export function buildShopTemplateSampleHtml(input: {
  presetId: string
  locale: WebLocale
  primaryColor?: string | null
}): { ok: true; html: string; presetId: ShopTemplatePresetId } | { ok: false; error: string } {
  if (!isShopTemplatePresetId(input.presetId)) {
    return { ok: false, error: 'Unknown template' }
  }
  const preset = getShopTemplatePreset(input.presetId)
  const originalTheme = { ...DEFAULT_PARTNER_WEBSITE_THEME, ...preset.theme }
  const theme = shopTemplateSampleThemeForPrimary(originalTheme, input.primaryColor)
  const brand =
    isMarketplaceTemplateId(preset.templateId) || preset.theme.look === 'marketplace'
      ? preset.label[input.locale] || preset.label.en
      : getShopTemplateSampleBrand(input.locale)
  if (preset.id === 'blank-white') {
    const html = withSampleColorPicker(
      rewriteThemeCssVarsInHtml(
        buildBlankShopVisualHtml({
          pageKey: 'home',
          variant: 'desktop',
          locale: input.locale,
          siteSlug: '',
          brand,
        }),
        theme
      ),
      input.locale,
      originalTheme,
      theme
    )
    return { ok: true, html, presetId: preset.id }
  }
  if (isMarketplaceTemplateId(preset.templateId) || preset.theme.look === 'marketplace') {
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
    const prepared = preparePartnerVisualHtmlForPublic(seeded, {
      theme,
      locale: input.locale,
      variant: 'desktop',
      includeRuntime: false,
      pageKey: 'home',
    })
    const html = withSampleColorPicker(
      paintShopTemplateSamplePreviewInHtml(prepared, input.locale),
      input.locale,
      originalTheme,
      theme
    )
    return { ok: true, html, presetId: preset.id }
  }
  const slogan = preset.id === 'fashion-orange' ? getShopTemplateSampleSlogan(input.locale) : undefined
  const themed = {
    ...theme,
    ...(slogan ? { slogan } : {}),
  }
  const site = buildDefaultLandingV1Site({
    locale: input.locale,
    title: brand,
    theme: themed,
  })
  const pages = injectSampleProducts(site.pages, input.locale)
  const html = renderTemplateSiteToHtml({
    locale: input.locale,
    title: brand,
    templateId: preset.templateId,
    theme: { ...site.theme, ...themed },
    pages,
    logoUrl: null,
    samplePreview: true,
  })
  const prepared = preparePartnerVisualHtmlForPublic(html, {
    theme: { ...site.theme, ...themed },
    locale: input.locale,
    variant: 'desktop',
    includeRuntime: false,
    pageKey: 'home',
  })
  return {
    ok: true,
    html: withSampleColorPicker(prepared, input.locale, originalTheme, themed),
    presetId: preset.id,
  }
}

export function shopTemplateSamplePreviewPath(presetId: string, locale?: WebLocale): string {
  const q = locale && locale !== 'vi' ? `?locale=${encodeURIComponent(locale)}` : ''
  return `/mau-giao-dien/${encodeURIComponent(presetId)}${q}`
}

export function shopTemplateGalleryPath(locale?: WebLocale): string {
  const q = locale && locale !== 'vi' ? `?locale=${encodeURIComponent(locale)}` : ''
  return `/mau-giao-dien${q}`
}

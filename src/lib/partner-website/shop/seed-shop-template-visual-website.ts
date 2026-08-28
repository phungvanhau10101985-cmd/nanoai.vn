import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type {
  PartnerWebsitePage,
  PartnerWebsiteTheme,
} from '@/lib/partner-website/template/partner-website-template-types'
import { BLANK_SHOP_VISUAL_PAGE_KEYS } from '@/lib/partner-website/shop/build-blank-shop-visual-html'
import { buildShopTemplatePageVisualHtml } from '@/lib/partner-website/shop/build-shop-template-page-visual-html'
import { buildDefaultDemoPdpShellHtml } from '@/lib/partner-website/shop/build-default-demo-pdp-shell-html'
import { ensureFullPartnerSiteFooterInHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { stampPartnerShopEditorHooksInHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { applySharedChrome, extractSharedChrome } from '@/lib/partner-website/shop/sync-shared-chrome'
import { renderTemplateSiteToHtml } from '@/lib/partner-website/template/render-template-html'
import {
  applyVisualEditThemeFlag,
  ensureVisualHtmlLiveReady,
  isolateVisualHtmlForDevice,
  mergeVisualPageHtmlIntoProject,
  visualEditorHtmlPath,
  VISUAL_DEVICE_VARIANTS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

/** Every built-in route gets a canonical file on every device before the first edit. */
export const SHOP_TEMPLATE_VISUAL_PAGE_KEYS: PartnerWebsitePageKey[] = [
  ...BLANK_SHOP_VISUAL_PAGE_KEYS,
]

function stampHomePageAttr(html: string): string {
  if (/\bdata-pw-page=/.test(html)) {
    return html.replace(/\bdata-pw-page=(["'])[^"']*\1/i, 'data-pw-page="home"')
  }
  return html.replace(/<body\b([^>]*)>/i, '<body$1 data-pw-page="home">')
}

function finishVisualHtml(
  html: string,
  variant: VisualDeviceVariant,
  input: { locale: WebLocale; siteSlug: string; brand: string; logoUrl?: string | null }
): string {
  const isolated = isolateVisualHtmlForDevice(html, variant)
  const withFooter = ensureFullPartnerSiteFooterInHtml(isolated, {
    locale: input.locale,
    siteSlug: input.siteSlug,
    brand: input.brand,
    logoUrl: input.logoUrl,
  })
  const stamped = stampPartnerShopEditorHooksInHtml(withFooter, { siteSlug: input.siteSlug })
  return ensureVisualHtmlLiveReady(stamped, variant)
}

export function buildShopTemplateHomeVisualHtml(input: {
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  templateId: string
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  chatPath?: string
}): string {
  const raw = stampHomePageAttr(
    renderTemplateSiteToHtml({
      locale: input.locale,
      title: input.brand,
      templateId: input.templateId,
      theme: input.theme,
      pages: input.pages,
      siteSlug: input.siteSlug,
      logoUrl: input.logoUrl,
      chatPath: input.chatPath,
      variant: input.variant,
    })
  )
  return finishVisualHtml(raw, input.variant, input)
}

function buildShopTemplatePdpVisualHtml(input: {
  variant: VisualDeviceVariant
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  homeHtml: string
}): string {
  const shell = buildDefaultDemoPdpShellHtml({
    locale: input.locale,
    siteSlug: input.siteSlug,
    variant: input.variant,
    title: input.brand,
    logoUrl: input.logoUrl,
  })
  const chrome = extractSharedChrome(input.homeHtml)
  const withChrome = applySharedChrome(shell, chrome, { targetVariant: input.variant })
  return finishVisualHtml(withChrome, input.variant, input)
}

/**
 * After reset / apply a shop preset, write the same visual HTML Sửa nhanh and live read.
 * Do not leave live on React while Sửa nhanh freezes a different DOM.
 */
export function seedShopTemplateVisualWebsite(input: {
  project: PartnerWebsiteProject
  theme: PartnerWebsiteTheme
  pages: PartnerWebsitePage[]
  locale: WebLocale
  siteSlug: string
  brand: string
  logoUrl?: string | null
  templateId: string
  chatPath?: string
}): { project: PartnerWebsiteProject; theme: PartnerWebsiteTheme; htmlSource: string } {
  let project = input.project
  let theme = { ...input.theme }
  let htmlSource = ''
  const homeByVariant = {} as Record<VisualDeviceVariant, string>

  for (const variant of VISUAL_DEVICE_VARIANTS) {
    const home = buildShopTemplateHomeVisualHtml({
      variant,
      locale: input.locale,
      siteSlug: input.siteSlug,
      brand: input.brand,
      logoUrl: input.logoUrl,
      templateId: input.templateId,
      theme: input.theme,
      pages: input.pages,
      chatPath: input.chatPath,
    })
    homeByVariant[variant] = home
    project = mergeVisualPageHtmlIntoProject(project, home, visualEditorHtmlPath('home', variant))
    theme = applyVisualEditThemeFlag(theme, { pageKey: 'home', variant })
    if (variant === 'desktop') htmlSource = home
  }

  for (const pageKey of SHOP_TEMPLATE_VISUAL_PAGE_KEYS) {
    if (pageKey === 'home') continue
    for (const variant of VISUAL_DEVICE_VARIANTS) {
      const homeHtml = homeByVariant[variant]
      const html =
        pageKey === 'product_detail'
          ? buildShopTemplatePdpVisualHtml({
              variant,
              locale: input.locale,
              siteSlug: input.siteSlug,
              brand: input.brand,
              logoUrl: input.logoUrl,
              homeHtml,
            })
          : finishVisualHtml(
              (() => {
                const professional = buildShopTemplatePageVisualHtml({
                  pageKey,
                  variant,
                  locale: input.locale,
                  siteSlug: input.siteSlug,
                  brand: input.brand,
                })
                const chrome = extractSharedChrome(homeHtml)
                return applySharedChrome(professional, chrome, { targetVariant: variant })
              })(),
              variant,
              input
            )
      project = mergeVisualPageHtmlIntoProject(project, html, visualEditorHtmlPath(pageKey, variant))
      theme = applyVisualEditThemeFlag(theme, { pageKey, variant })
    }
  }

  return { project, theme, htmlSource }
}

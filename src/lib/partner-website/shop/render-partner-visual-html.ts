import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import { rewriteThemeCssVarsInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { injectPartnerLogoHomeLinkScript } from '@/lib/partner-website/shop/inject-partner-logo-home-link'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'
import {
  isolateVisualHtmlForDevice,
  resolvePublicVisualCategoryHtml,
  resolvePublicVisualCmsHtml,
  resolvePublicVisualPageHtml,
  resolvePublicVisualProductHtml,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'

type VisualWebsite = {
  theme?: PartnerWebsiteTheme | null
  project?: PartnerWebsiteProject | null
  htmlSource?: string | null
}

export type PartnerVisualHtmlTarget =
  | { kind: 'page'; pageKey: PartnerWebsitePageKey }
  | { kind: 'category'; categoryPath: string }
  | { kind: 'product'; productId: string }
  | { kind: 'cms'; cmsSlug: string }

export function preparePartnerVisualHtmlForEditor(
  html: string,
  input: { variant: VisualDeviceVariant; theme?: PartnerWebsiteTheme | null }
): string {
  const normalized = injectPartnerShopChromeLayoutCss(
    isolateVisualHtmlForDevice(stripEmptyLogoPlaceholdersFromHtml(html), input.variant)
  )
  return input.theme ? rewriteThemeCssVarsInHtml(normalized, input.theme) : normalized
}

export function preparePartnerVisualHtmlForPublic(
  html: string,
  input: {
    siteSlug?: string | null
    locale?: WebLocale | null
    onCustomDomain?: boolean
    includeRuntime?: boolean
  }
): string {
  const siteSlug = input.siteSlug?.trim() ?? ''
  const locale = input.locale ?? 'vi'
  const withChrome = injectPartnerShopChromeLayoutCss(stripEmptyLogoPlaceholdersFromHtml(html))
  const withRuntime =
    input.includeRuntime === false
      ? withChrome
      : injectPartnerShopRuntimeScriptsIntoHtml(withChrome, { siteSlug, locale })
  const withLogoHome = siteSlug
    ? injectPartnerLogoHomeLinkScript(withRuntime, siteSlug, Boolean(input.onCustomDomain))
    : withRuntime
  return input.onCustomDomain && siteSlug
    ? injectPartnerCustomDomainLinkRewriteScript(withLogoHome, siteSlug)
    : withLogoHome
}

export function resolvePartnerVisualHtmlForTarget(
  website: VisualWebsite,
  target: PartnerVisualHtmlTarget,
  device?: VisualDeviceVariant | null
): string {
  if (target.kind === 'category') {
    return resolvePublicVisualCategoryHtml(website, target.categoryPath, device)
  }
  if (target.kind === 'product') {
    return resolvePublicVisualProductHtml(website, target.productId, device)
  }
  if (target.kind === 'cms') {
    return resolvePublicVisualCmsHtml(website, target.cmsSlug, device)
  }
  return resolvePublicVisualPageHtml(website, target.pageKey, device)
}

export function renderPartnerVisualHtmlForPublic(
  website: VisualWebsite & { siteSlug?: string | null; locale?: WebLocale | null },
  target: PartnerVisualHtmlTarget,
  input?: {
    device?: VisualDeviceVariant | null
    onCustomDomain?: boolean
    includeRuntime?: boolean
  }
): string {
  const html = resolvePartnerVisualHtmlForTarget(website, target, input?.device)
  if (html.trim().length < 40) return ''
  return preparePartnerVisualHtmlForPublic(html, {
    siteSlug: website.siteSlug,
    locale: website.locale,
    onCustomDomain: input?.onCustomDomain,
    includeRuntime: input?.includeRuntime,
  })
}

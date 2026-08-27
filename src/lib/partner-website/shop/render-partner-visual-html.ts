import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerWebsitePageKey } from '@/lib/partner-website/partner-website-page-catalog'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import type { PartnerWebsiteTheme } from '@/lib/partner-website/template/partner-website-template-types'
import {
  deferOffDevicePdpGalleryMedia,
  restoreDeferredPdpGalleryMediaInHtml,
} from '@/lib/partner-website/shop/bind-live-product-to-pdp-html'
import { rewriteThemeCssVarsInHtml } from '@/lib/partner-website/template/partner-website-theme-tokens'
import { injectPartnerCustomDomainLinkRewriteScript } from '@/lib/partner-website/shop/inject-partner-custom-domain-link-script'
import { injectPartnerLogoHomeLinkScript } from '@/lib/partner-website/shop/inject-partner-logo-home-link'
import {
  injectPartnerShopRuntimeScriptsIntoHtml,
  stampPartnerShopEditorHooksInHtml,
} from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { injectPartnerShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { stripPartnerInfoPageSeoCoachFromHtml } from '@/lib/partner-website/pages/partner-info-page-advanced-seo'
import { ensureAdsPlatformPolicyInHtml } from '@/lib/partner-website/pages/partner-info-page-visual'
import { ensureFullPartnerSiteFooterInHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import { ensurePartnerSitePdpBottomNavInHtml } from '@/lib/partner-website/shop/build-partner-site-header-html'
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
  input: {
    variant: VisualDeviceVariant
    theme?: PartnerWebsiteTheme | null
    siteSlug?: string | null
    locale?: WebLocale | null
    pageKey?: string | null
    cmsSlug?: string | null
  }
): string {
  const locale = input.locale ?? 'vi'
  const withPolicy = ensureAdsPlatformPolicyInHtml(html, locale, input.pageKey || input.cmsSlug)
  const withFooter = ensureFullPartnerSiteFooterInHtml(withPolicy, {
    locale,
    siteSlug: input.siteSlug,
    logoUrl: input.theme?.logoUrl,
  })
  const withPdpBar = ensurePartnerSitePdpBottomNavInHtml(withFooter, {
    locale,
    siteSlug: input.siteSlug,
    pageKey: input.pageKey,
  })
  const isolated = isolateVisualHtmlForDevice(stripEmptyLogoPlaceholdersFromHtml(withPdpBar), input.variant)
  const isProduct =
    input.pageKey === 'product_detail' || /data-pw-page=["']product["']/.test(isolated)
  const light = isProduct ? deferOffDevicePdpGalleryMedia(isolated, input.variant) : isolated
  const withShopCss = isProduct ? injectPartnerShopThemeCss(light, input.theme) : light
  const normalized = injectPartnerShopChromeLayoutCss(withShopCss)
  const themed = input.theme ? rewriteThemeCssVarsInHtml(normalized, input.theme) : normalized
  return preparePartnerVisualHtmlForPublic(themed, {
    siteSlug: input.siteSlug,
    locale,
    onCustomDomain: false,
    includeRuntime: false,
    pageKey: input.pageKey,
    cmsSlug: input.cmsSlug,
    theme: input.theme,
  })
}

export function preparePartnerVisualHtmlForPublic(
  html: string,
  input: {
    siteSlug?: string | null
    locale?: WebLocale | null
    onCustomDomain?: boolean
    includeRuntime?: boolean
    pageKey?: string | null
    cmsSlug?: string | null
    theme?: PartnerWebsiteTheme | null
  }
): string {
  const siteSlug = input.siteSlug?.trim() ?? ''
  const locale = input.locale ?? 'vi'
  const withPolicy = ensureAdsPlatformPolicyInHtml(html, locale, input.pageKey || input.cmsSlug)
  const withFooter = ensureFullPartnerSiteFooterInHtml(withPolicy, {
    locale,
    siteSlug: input.siteSlug,
    logoUrl: input.theme?.logoUrl,
  })
  const withPdpBar = ensurePartnerSitePdpBottomNavInHtml(withFooter, {
    locale,
    siteSlug: input.siteSlug,
    pageKey: input.pageKey,
  })
  const cleaned = restoreDeferredPdpGalleryMediaInHtml(stripPartnerInfoPageSeoCoachFromHtml(withPdpBar))
  const isProduct =
    input.pageKey === 'product_detail' || /data-pw-page=["']product["']/.test(cleaned)
  const withShopCss = isProduct ? injectPartnerShopThemeCss(cleaned, input.theme) : cleaned
  const withChrome = injectPartnerShopChromeLayoutCss(stripEmptyLogoPlaceholdersFromHtml(withShopCss))
  const withRuntime =
    input.includeRuntime === false
      ? stampPartnerShopEditorHooksInHtml(withChrome, { siteSlug })
      : injectPartnerShopRuntimeScriptsIntoHtml(withChrome, { siteSlug, locale })
  const withLogoHome =
    input.includeRuntime === false || !siteSlug
      ? withRuntime
      : injectPartnerLogoHomeLinkScript(withRuntime, siteSlug, Boolean(input.onCustomDomain))
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
  const pageKey = target.kind === 'page' ? target.pageKey : null
  const cmsSlug = target.kind === 'cms' ? target.cmsSlug : null
  return preparePartnerVisualHtmlForPublic(html, {
    siteSlug: website.siteSlug,
    locale: website.locale,
    onCustomDomain: input?.onCustomDomain,
    includeRuntime: input?.includeRuntime,
    pageKey,
    cmsSlug,
    theme: website.theme,
  })
}

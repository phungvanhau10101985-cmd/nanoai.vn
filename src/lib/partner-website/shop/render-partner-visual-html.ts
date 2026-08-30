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
  injectPartnerShopReadOnlyRuntimeScriptsIntoHtml,
  injectPartnerShopRuntimeScriptsIntoHtml,
} from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
import { injectPartnerShopThemeCss } from '@/lib/partner-website/shop/build-shop-theme-css'
import { injectPartnerShopChromeLayoutCss } from '@/lib/partner-website/shop/partner-shop-chrome-layout-css'
import { stripPartnerInfoPageSeoCoachFromHtml } from '@/lib/partner-website/pages/partner-info-page-advanced-seo'
import { ensureAdsPlatformPolicyInHtml } from '@/lib/partner-website/pages/partner-info-page-visual'
import { ensureFullPartnerSiteFooterInHtml } from '@/lib/partner-website/shop/build-partner-site-footer-html'
import {
  ensurePartnerSiteHeaderLogoSlotInHtml,
  ensurePartnerSitePdpBottomNavInHtml,
} from '@/lib/partner-website/shop/build-partner-site-header-html'
import { ensurePartnerSiteChromeKitInHtml } from '@/lib/partner-website/shop/partner-site-chrome-kit'
import { ensureSearchClusterInHtml } from '@/lib/partner-website/visual-editor/search-cluster-icons'
import { PW_PAGE_BY_CATALOG_KEY } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { ensurePdpReviewQaCardsInBuyBox } from '@/lib/partner-website/shop/partner-site-pdp-review-qa'
import { stripEmptyLogoPlaceholdersFromHtml } from '@/lib/partner-website/visual-editor/strip-empty-logo-placeholders'
import {
  isolateVisualHtmlForDevice,
  resolveExactVisualCategoryHtml,
  resolveExactVisualCmsHtml,
  resolveExactVisualPageHtml,
  resolveExactVisualProductHtml,
  servePublicOneDeviceVisualHtml,
  VISUAL_DEVICE_VARIANTS,
  type VisualDeviceVariant,
} from '@/lib/partner-website/visual-editor/visual-editor-pages'
import { normalizeVisualCoordinateContract } from '@/lib/partner-website/visual-editor/normalize-visual-coordinate-contract'

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

export type PartnerVisualHtmlByDevice = Partial<Record<VisualDeviceVariant, string>>

export type PartnerVisualHtmlSelection = {
  requestedDevice: VisualDeviceVariant
  sourceDevice: VisualDeviceVariant
  html: string
}

type PartnerVisualRenderInput = {
  variant?: VisualDeviceVariant
  theme?: PartnerWebsiteTheme | null
  siteSlug?: string | null
  locale?: WebLocale | null
  pageKey?: string | null
  cmsSlug?: string | null
  onCustomDomain?: boolean
  runtime: 'authoring' | 'live'
}

function stampPwPageOnDocumentHtml(html: string, pageKey?: string | null): string {
  const fromBody = html.match(/<body\b[^>]*\bdata-pw-page=["']([^"']+)["']/i)?.[1]?.trim() || ''
  const fromKey = pageKey ? PW_PAGE_BY_CATALOG_KEY[pageKey] || '' : ''
  const page = fromBody || fromKey
  if (!page || !/<html\b/i.test(html)) return html
  return html.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    if (/\bdata-pw-page=/.test(attrs)) {
      return `<html${attrs.replace(/\bdata-pw-page=(["'])[^"']*\1/i, `data-pw-page="${page}"`)}>`
    }
    return `<html${attrs} data-pw-page="${page}">`
  })
}

function renderPartnerVisualDocument(html: string, input: PartnerVisualRenderInput): string {
  const siteSlug = input.siteSlug?.trim() ?? ''
  const locale = input.locale ?? 'vi'
  const source =
    input.runtime === 'authoring' && input.variant
      ? isolateVisualHtmlForDevice(html, input.variant)
      : html
  const canonical = normalizeVisualCoordinateContract(source, { variant: input.variant })
  const withPolicy = ensureAdsPlatformPolicyInHtml(
    canonical,
    locale,
    input.pageKey || input.cmsSlug
  )
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
  const withChromeKit = ensurePartnerSiteChromeKitInHtml(withPdpBar, {
    locale,
    siteSlug: input.siteSlug,
    device: input.variant,
    logoUrl: input.theme?.logoUrl,
    chatIconLogoUrl: input.theme?.chatIconLogoUrl,
  })
  const noSeoCoach = stripPartnerInfoPageSeoCoachFromHtml(withChromeKit)
  const mediaReady =
    input.runtime === 'authoring' && input.variant
      ? deferOffDevicePdpGalleryMedia(noSeoCoach, input.variant)
      : restoreDeferredPdpGalleryMediaInHtml(noSeoCoach)
  const bodyAttrs = mediaReady.match(/<body\b([^>]*)>/i)?.[1] || ''
  const isProduct =
    input.pageKey === 'product_detail' || /\bdata-pw-page=["']product["']/.test(bodyAttrs)
  const withReviewQa = isProduct ? ensurePdpReviewQaCardsInBuyBox(mediaReady, locale) : mediaReady
  const withSearch = ensureSearchClusterInHtml(withReviewQa)
  const wordmark =
    withSearch.match(/<span\b[^>]*\bpw-wordmark\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ||
    ''
  const withLogoSlot = ensurePartnerSiteHeaderLogoSlotInHtml(withSearch, {
    logoUrl: input.theme?.logoUrl,
    title: wordmark,
    siteSlug: input.siteSlug,
  })
  const withShopCss = injectPartnerShopThemeCss(withLogoSlot, input.theme)
  const logosReady =
    input.runtime === 'authoring' ? withShopCss : stripEmptyLogoPlaceholdersFromHtml(withShopCss)
  const withChrome = injectPartnerShopChromeLayoutCss(stampPwPageOnDocumentHtml(logosReady, input.pageKey))
  const withRuntime =
    input.runtime === 'authoring'
      ? injectPartnerShopReadOnlyRuntimeScriptsIntoHtml(withChrome, { siteSlug, locale })
      : injectPartnerShopRuntimeScriptsIntoHtml(withChrome, { siteSlug, locale })
  const themed = input.theme ? rewriteThemeCssVarsInHtml(withRuntime, input.theme) : withRuntime
  const withLogoHome =
    input.runtime === 'authoring' || !siteSlug
      ? themed
      : injectPartnerLogoHomeLinkScript(themed, siteSlug, Boolean(input.onCustomDomain))
  return input.runtime === 'live' && input.onCustomDomain && siteSlug
    ? injectPartnerCustomDomainLinkRewriteScript(withLogoHome, siteSlug)
    : withLogoHome
}

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
  return renderPartnerVisualDocument(html, {
    runtime: 'authoring',
    variant: input.variant,
    theme: input.theme,
    siteSlug: input.siteSlug,
    locale: input.locale,
    onCustomDomain: false,
    pageKey: input.pageKey,
    cmsSlug: input.cmsSlug,
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
  return renderPartnerVisualDocument(html, {
    runtime: input.includeRuntime === false ? 'authoring' : 'live',
    theme: input.theme,
    siteSlug: input.siteSlug,
    locale: input.locale,
    onCustomDomain: input.onCustomDomain,
    pageKey: input.pageKey,
    cmsSlug: input.cmsSlug,
  })
}

export function resolvePartnerVisualHtmlForTarget(
  website: VisualWebsite,
  target: PartnerVisualHtmlTarget,
  device?: VisualDeviceVariant | null
): string {
  const variants = resolvePartnerVisualHtmlVariantsForTarget(website, target)
  return selectPartnerVisualHtmlDevice(variants, device || 'desktop')?.html || ''
}

function resolveExactPartnerVisualHtmlForTarget(
  website: VisualWebsite,
  target: PartnerVisualHtmlTarget,
  device: VisualDeviceVariant
): string {
  const exact =
    target.kind === 'category'
      ? resolveExactVisualCategoryHtml(website, target.categoryPath, device)
      : target.kind === 'product'
        ? resolveExactVisualProductHtml(website, target.productId, device)
        : target.kind === 'cms'
          ? resolveExactVisualCmsHtml(website, target.cmsSlug, device)
          : resolveExactVisualPageHtml(website, target.pageKey, device)
  return exact.trim().length >= 40
    ? servePublicOneDeviceVisualHtml(exact, device, website.theme)
    : ''
}

/** Auto live transports all saved variants, but only one is mounted by the client. */
export function resolvePartnerVisualHtmlVariantsForTarget(
  website: VisualWebsite,
  target: PartnerVisualHtmlTarget
): PartnerVisualHtmlByDevice {
  const out: PartnerVisualHtmlByDevice = {}
  for (const device of VISUAL_DEVICE_VARIANTS) {
    const html = resolveExactPartnerVisualHtmlForTarget(website, target, device)
    if (html.trim().length >= 40) out[device] = html
  }
  return out
}

export function selectPartnerVisualHtmlDevice(
  variants: PartnerVisualHtmlByDevice,
  requestedDevice: VisualDeviceVariant
): PartnerVisualHtmlSelection | null {
  const html = variants[requestedDevice] || ''
  return html.trim().length >= 40
    ? { requestedDevice, sourceDevice: requestedDevice, html }
    : null
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

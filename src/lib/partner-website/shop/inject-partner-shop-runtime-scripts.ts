import type { WebLocale } from '@/lib/i18n/config'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSitePdpBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-pdp-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteOutfitBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-outfit-bootstrap-script'
import { buildPartnerSiteSliderBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-slider-bootstrap-script'
import { stampPartnerSiteChromeWidgetHooksInHtml } from '@/lib/partner-website/shop/stamp-partner-site-chrome-widget-hooks'
import { buildPartnerSitePaperTileBootstrapScript } from '@/lib/partner-website/visual-editor/pw-bg-stack'
import { buildPartnerSiteBirthGenderPromptScript } from '@/lib/partner-website/shop/build-partner-site-birth-gender-prompt-script'
import { buildPartnerSaleCalendarBootstrapScript } from '@/lib/partner-website/shop/build-partner-sale-calendar-bootstrap-script'
import { buildPartnerMarketingBannerBootstrapScript } from '@/lib/partner-website/shop/build-partner-marketing-banner-bootstrap-script'

const PW_RUNTIME_SCRIPT_RE =
  /<script\b[^>]*(?:\bdata-pw-(?:chat-bridge|search-bootstrap|catalog-bootstrap|outfit-bootstrap|pdp-bootstrap|shop-actions-bootstrap|chrome-toggle-bootstrap|personalization-bootstrap|slider-bootstrap|paper-tile-bootstrap|birth-gender-prompt-bootstrap|sale-calendar-bootstrap|marketing-banner-bootstrap|header-toggle|lp-buy)\b|\bid=["']pw-logo-home-link["'])[^>]*>[\s\S]*?<\/script>/gi
const PW_RUNTIME_STYLE_RE =
  /<style\b[^>]*\bdata-pw-(?:chrome-toggle-css|search-image-css|marketing-banner-css)\b[^>]*>[\s\S]*?<\/style>/gi

function stripPartnerShopRuntimeAssets(html: string): string {
  return html.replace(PW_RUNTIME_SCRIPT_RE, '').replace(PW_RUNTIME_STYLE_RE, '')
}

function appendBeforeBody(html: string, snippet: string): string {
  const chunk = snippet.trim()
  if (!chunk) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${chunk}\n</body>`)
  return `${html}\n${chunk}`
}

function hasRuntimeHook(html: string, pattern: RegExp): boolean {
  return pattern.test(html)
}

function runtimeHookMarkup(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
}

const HAS_CATALOG = /\bdata-pw-(?:catalog|related)\b/i
const HAS_OUTFIT = /\bdata-pw-outfit\b/i
const HAS_PERSONALIZATION =
  /\bdata-pw-(?:personalize|featured-categories|greeting|hero-variants)\b|\bclass=["'][^"']*\bpw-categories\b/i
const HAS_PDP =
  /\bdata-pw-page=["']product["']|\bdata-pw-region=["'](?:pdp-info|gallery)["']|\bdata-pw-pdp-slot\b/i
const HAS_MARKETING_BANNER = /\bdata-pw-personalize-banner\b/i
const HAS_SLIDER = /\bdata-pw-(?:slider|full-slides)\b/i
const HAS_PAPER = /\bdata-pw-paper\b/i

/** Stamp chrome hooks and drop live API scripts — Sửa nhanh is display-only. */
export function stampPartnerShopEditorHooksInHtml(
  html: string,
  input: { siteSlug?: string }
): string {
  let out = html
  if (!out.trim()) return html
  const siteSlug = input.siteSlug?.trim() ?? ''
  if (siteSlug) out = stampPartnerSiteChromeWidgetHooksInHtml(out, { siteSlug })
  return stripPartnerShopRuntimeAssets(out)
}

/**
 * Sửa nhanh uses the same read-only data hydration as live so dynamic slots keep
 * identical dimensions. Navigation, checkout and other mutating actions stay off.
 */
export function injectPartnerShopReadOnlyRuntimeScriptsIntoHtml(
  html: string,
  input: { siteSlug?: string; locale?: WebLocale }
): string {
  let out = stampPartnerShopEditorHooksInHtml(html, input)
  const siteSlug = input.siteSlug?.trim() ?? ''
  if (!siteSlug) return out
  const locale = input.locale ?? 'vi'
  const hookMarkup = runtimeHookMarkup(out)
  const hooks = {
    catalog: hasRuntimeHook(hookMarkup, HAS_CATALOG),
    outfit: hasRuntimeHook(hookMarkup, HAS_OUTFIT),
    personalization: hasRuntimeHook(hookMarkup, HAS_PERSONALIZATION),
    marketingBanner: hasRuntimeHook(hookMarkup, HAS_MARKETING_BANNER),
    pdp: hasRuntimeHook(hookMarkup, HAS_PDP),
    slider: hasRuntimeHook(hookMarkup, HAS_SLIDER),
    paper: hasRuntimeHook(hookMarkup, HAS_PAPER),
  }
  if (hooks.catalog) {
    out = appendBeforeBody(out, buildPartnerSiteCatalogBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.outfit) {
    out = appendBeforeBody(out, buildPartnerSiteOutfitBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.personalization) {
    out = appendBeforeBody(out, buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.marketingBanner) {
    out = appendBeforeBody(out, buildPartnerMarketingBannerBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.pdp) {
    out = appendBeforeBody(out, buildPartnerSitePdpBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.slider) out = appendBeforeBody(out, buildPartnerSiteSliderBootstrapScript())
  if (hooks.paper) out = appendBeforeBody(out, buildPartnerSitePaperTileBootstrapScript())
  return out
}

/**
 * Wire live shop APIs onto saved Sửa nhanh HTML (every Thêm-phần-tử widget).
 * Scripts are stripped on save — always replace at serve so new shops inherit the engine.
 */
export function injectPartnerShopRuntimeScriptsIntoHtml(
  html: string,
  input: { siteSlug?: string; locale?: WebLocale; shopTitle?: string | null }
): string {
  let out = html
  if (!out.trim()) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''
  out = stampPartnerSiteChromeWidgetHooksInHtml(out, { siteSlug })
  out = stripPartnerShopRuntimeAssets(out)
  const hookMarkup = runtimeHookMarkup(out)
  const hooks = {
    catalog: hasRuntimeHook(hookMarkup, HAS_CATALOG),
    outfit: hasRuntimeHook(hookMarkup, HAS_OUTFIT),
    personalization: hasRuntimeHook(hookMarkup, HAS_PERSONALIZATION),
    marketingBanner: hasRuntimeHook(hookMarkup, HAS_MARKETING_BANNER),
    pdp: hasRuntimeHook(hookMarkup, HAS_PDP),
    slider: hasRuntimeHook(hookMarkup, HAS_SLIDER),
    paper: hasRuntimeHook(hookMarkup, HAS_PAPER),
  }

  const chatBridge = buildPartnerSiteLandingChatBridgeScript()
  if (chatBridge) out = appendBeforeBody(out, chatBridge)
  if (!siteSlug) return out

  out = appendBeforeBody(out, buildPartnerSiteSearchBootstrapScript({ siteSlug, locale }))
  if (hooks.catalog) {
    out = appendBeforeBody(out, buildPartnerSiteCatalogBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.outfit) {
    out = appendBeforeBody(out, buildPartnerSiteOutfitBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.personalization) {
    out = appendBeforeBody(out, buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale }))
  }
  if (hooks.pdp) {
    out = appendBeforeBody(out, buildPartnerSitePdpBootstrapScript({ siteSlug, locale }))
  }
  out = appendBeforeBody(out, buildPartnerSiteShopActionsBootstrapScript({ siteSlug, locale }))
  out = appendBeforeBody(out, buildPartnerSaleCalendarBootstrapScript({ siteSlug, locale }))
  if (hooks.marketingBanner) {
    out = appendBeforeBody(out, buildPartnerMarketingBannerBootstrapScript({ siteSlug, locale }))
  }
  out = appendBeforeBody(out, buildPartnerSiteBirthGenderPromptScript({
    siteSlug,
    locale,
    shopTitle: input.shopTitle,
  }))
  out = appendBeforeBody(out, buildPartnerSiteChromeToggleBootstrapScript({ siteSlug, locale }))
  if (hooks.slider) out = appendBeforeBody(out, buildPartnerSiteSliderBootstrapScript())
  if (hooks.paper) out = appendBeforeBody(out, buildPartnerSitePaperTileBootstrapScript())
  return out
}

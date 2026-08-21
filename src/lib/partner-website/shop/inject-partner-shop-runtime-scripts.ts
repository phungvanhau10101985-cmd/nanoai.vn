import type { WebLocale } from '@/lib/i18n/config'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSitePdpBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-pdp-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { stampPartnerSiteChromeWidgetHooksInHtml } from '@/lib/partner-website/shop/stamp-partner-site-chrome-widget-hooks'

const PW_RUNTIME_SCRIPT_RE =
  /<script\b[^>]*(?:\bdata-pw-(?:chat-bridge|search-bootstrap|catalog-bootstrap|pdp-bootstrap|shop-actions-bootstrap|chrome-toggle-bootstrap|header-toggle|lp-buy)\b|\bid=["']pw-logo-home-link["'])[^>]*>[\s\S]*?<\/script>/gi
const PW_RUNTIME_STYLE_RE =
  /<style\b[^>]*\bdata-pw-(?:chrome-toggle-css|search-image-css)\b[^>]*>[\s\S]*?<\/style>/gi

function stripPartnerShopRuntimeAssets(html: string): string {
  return html.replace(PW_RUNTIME_SCRIPT_RE, '').replace(PW_RUNTIME_STYLE_RE, '')
}

function appendBeforeBody(html: string, snippet: string): string {
  const chunk = snippet.trim()
  if (!chunk) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${chunk}\n</body>`)
  return `${html}\n${chunk}`
}

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
 * Wire live shop APIs onto saved Sửa nhanh HTML (every Thêm-phần-tử widget).
 * Scripts are stripped on save — always replace at serve so new shops inherit the engine.
 */
export function injectPartnerShopRuntimeScriptsIntoHtml(
  html: string,
  input: { siteSlug?: string; locale?: WebLocale }
): string {
  let out = html
  if (!out.trim()) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''
  out = stampPartnerSiteChromeWidgetHooksInHtml(out, { siteSlug })
  out = stripPartnerShopRuntimeAssets(out)

  const chatBridge = buildPartnerSiteLandingChatBridgeScript()
  if (chatBridge) out = appendBeforeBody(out, chatBridge)
  if (!siteSlug) return out

  out = appendBeforeBody(out, buildPartnerSiteSearchBootstrapScript({ siteSlug, locale }))
  out = appendBeforeBody(out, buildPartnerSiteCatalogBootstrapScript({ siteSlug, locale }))
  out = appendBeforeBody(out, buildPartnerSitePdpBootstrapScript({ siteSlug, locale }))
  out = appendBeforeBody(out, buildPartnerSiteShopActionsBootstrapScript({ siteSlug, locale }))
  out = appendBeforeBody(out, buildPartnerSiteChromeToggleBootstrapScript({ siteSlug, locale }))
  return out
}

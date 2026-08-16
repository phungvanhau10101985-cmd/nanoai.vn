import type { WebLocale } from '@/lib/i18n/config'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSiteChromeToggleBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-chrome-toggle-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'

function appendBeforeBody(html: string, snippet: string): string {
  const chunk = snippet.trim()
  if (!chunk) return html
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${chunk}\n</body>`)
  return `${html}\n${chunk}`
}

/**
 * Wire live shop APIs onto saved Sửa nhanh HTML (search, camera, cart badges,
 * catalog, chat, category menu). Scripts are stripped on save — inject at serve.
 */
export function injectPartnerShopRuntimeScriptsIntoHtml(
  html: string,
  input: { siteSlug?: string; locale?: WebLocale }
): string {
  let out = html
  if (!out.trim()) return html
  const locale = input.locale ?? 'vi'
  const siteSlug = input.siteSlug?.trim() ?? ''

  const chatBridge = buildPartnerSiteLandingChatBridgeScript()
  if (chatBridge && !out.includes('data-pw-chat-bridge') && !out.includes('nanoai-partner-site')) {
    out = appendBeforeBody(out, chatBridge)
  }

  if (!siteSlug) return out

  if (!out.includes('data-pw-search-bootstrap')) {
    out = appendBeforeBody(out, buildPartnerSiteSearchBootstrapScript({ siteSlug, locale }))
  }
  if (!out.includes('data-pw-catalog-bootstrap')) {
    out = appendBeforeBody(out, buildPartnerSiteCatalogBootstrapScript({ siteSlug, locale }))
  }
  if (!out.includes('data-pw-shop-actions-bootstrap')) {
    out = appendBeforeBody(out, buildPartnerSiteShopActionsBootstrapScript({ siteSlug, locale }))
  }
  if (!out.includes('data-pw-chrome-toggle-bootstrap')) {
    out = appendBeforeBody(out, buildPartnerSiteChromeToggleBootstrapScript({ siteSlug, locale }))
  }
  return out
}

import type { WebLocale } from '@/lib/i18n/config'
import { resolvePartnerWebsiteDisplayHtml } from '@/lib/partner-website/partner-website-project'
import { injectPartnerWebsiteLogoGuardIntoHtml } from '@/lib/partner-website/partner-website-logo-guard'
import { injectPartnerWebsiteResponsiveBaselineIntoHtml } from '@/lib/partner-website/partner-website-mockup-build-rules'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { buildPartnerSiteCatalogBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-catalog-bootstrap-script'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteSearchBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-search-bootstrap-script'
import { buildPartnerSiteShopActionsBootstrapScript } from '@/lib/partner-website/shop/build-partner-site-shop-actions-bootstrap-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { injectShopTrackingSnippetsIntoHtml } from '@/lib/partner-website/shop/build-shop-tracking-head-snippets'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

export function renderPartnerWebsiteHtml(input: {
  project: PartnerWebsiteProject
  htmlSource?: string | null
  chatPath?: string
  siteSlug?: string
  locale?: WebLocale
  enablePersonalization?: boolean
  /** When true, prefer pre-composed htmlSource over project files (template preview). */
  preferHtmlSource?: boolean
  facebookPixelId?: string | null
  ga4MeasurementId?: string | null
  googleAdsId?: string | null
  tiktokPixelId?: string | null
}): string {
  const source = input.htmlSource?.trim() || ''
  const base =
    input.preferHtmlSource && source.length >= 40
      ? source
      : resolvePartnerWebsiteDisplayHtml({
          project: input.project,
          htmlSource: input.htmlSource,
        })

  const tracking: PartnerSiteShopTrackingConfig = {
    ga4MeasurementId: input.ga4MeasurementId?.trim() || null,
    facebookPixelId: input.facebookPixelId?.trim() || null,
    googleAdsId: input.googleAdsId?.trim() || null,
    tiktokPixelId: input.tiktokPixelId?.trim() || null,
  }

  let html = injectShopTrackingSnippetsIntoHtml(base, tracking)
  html = injectPartnerWebsiteLogoGuardIntoHtml(html)
  html = injectPartnerWebsiteResponsiveBaselineIntoHtml(html)

  const siteSlug = input.siteSlug?.trim() ?? ''
  const chatBridge = buildPartnerSiteLandingChatBridgeScript()
  if (chatBridge && /<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${chatBridge}\n</body>`)
  else if (chatBridge) html = `${html}\n${chatBridge}`

  const personalizationEnabled = input.enablePersonalization !== false
  const hasPersonalizationBootstrap =
    html.includes('hydrateBlock') && html.includes('/personalization')
  if (siteSlug && personalizationEnabled && !hasPersonalizationBootstrap) {
    const locale = input.locale ?? 'vi'
    const script = buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale })
    if (script && /<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${script}\n</body>`)
    else if (script) html = `${html}\n${script}`
  }

  // Same-platform shops: text + image search always wired (no Bearer / no partner API toggle).
  if (siteSlug && !html.includes('data-pw-search-bootstrap')) {
    const locale = input.locale ?? 'vi'
    const searchScript = buildPartnerSiteSearchBootstrapScript({ siteSlug, locale })
    if (searchScript && /<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${searchScript}\n</body>`)
    } else if (searchScript) {
      html = `${html}\n${searchScript}`
    }
  }

  // Live shop inventory grids ([data-pw-catalog]).
  if (siteSlug && !html.includes('data-pw-catalog-bootstrap')) {
    const locale = input.locale ?? 'vi'
    const catalogScript = buildPartnerSiteCatalogBootstrapScript({ siteSlug, locale })
    if (catalogScript && /<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${catalogScript}\n</body>`)
    } else if (catalogScript) {
      html = `${html}\n${catalogScript}`
    }
  }

  // Cart + favorite actions on AI HTML product cards (no Bearer).
  if (siteSlug && !html.includes('data-pw-shop-actions-bootstrap')) {
    const locale = input.locale ?? 'vi'
    const actionsScript = buildPartnerSiteShopActionsBootstrapScript({ siteSlug, locale })
    if (actionsScript && /<\/body>/i.test(html)) {
      html = html.replace(/<\/body>/i, `${actionsScript}\n</body>`)
    } else if (actionsScript) {
      html = `${html}\n${actionsScript}`
    }
  }

  return html
}

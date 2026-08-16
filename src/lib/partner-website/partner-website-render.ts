import type { WebLocale } from '@/lib/i18n/config'
import { resolvePartnerWebsiteDisplayHtml } from '@/lib/partner-website/partner-website-project'
import { injectPartnerWebsiteLogoGuardIntoHtml } from '@/lib/partner-website/partner-website-logo-guard'
import { injectPartnerWebsiteResponsiveBaselineIntoHtml } from '@/lib/partner-website/partner-website-mockup-build-rules'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { injectPartnerShopRuntimeScriptsIntoHtml } from '@/lib/partner-website/shop/inject-partner-shop-runtime-scripts'
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
  html = injectPartnerShopRuntimeScriptsIntoHtml(html, {
    siteSlug,
    locale: input.locale,
  })

  const personalizationEnabled = input.enablePersonalization !== false
  const hasPersonalizationBootstrap =
    html.includes('hydrateBlock') && html.includes('/personalization')
  if (siteSlug && personalizationEnabled && !hasPersonalizationBootstrap) {
    const locale = input.locale ?? 'vi'
    const script = buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale })
    if (script && /<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${script}\n</body>`)
    else if (script) html = `${html}\n${script}`
  }

  return html
}

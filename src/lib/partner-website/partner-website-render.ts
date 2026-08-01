import type { WebLocale } from '@/lib/i18n/config'
import { composeStandaloneHtml } from '@/lib/partner-website/partner-website-project'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'
import { buildPartnerSitePersonalizationBootstrapScript } from '@/lib/partner-website/shop/build-personalization-bootstrap-script'
import { buildPartnerSiteLandingChatBridgeScript } from '@/lib/partner-website/shop/partner-site-chat-embed'
import { injectShopTrackingSnippetsIntoHtml } from '@/lib/partner-website/shop/build-shop-tracking-head-snippets'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

export function renderPartnerWebsiteHtml(input: {
  project: PartnerWebsiteProject
  htmlSource?: string | null
  chatPath?: string
  siteSlug?: string
  locale?: WebLocale
  facebookPixelId?: string | null
  ga4MeasurementId?: string | null
  googleAdsId?: string | null
  tiktokPixelId?: string | null
}): string {  const base =
    input.htmlSource?.trim() ||
    composeStandaloneHtml(input.project) ||
    '<!DOCTYPE html><html><body><p>Site not ready.</p></body></html>'

  const tracking: PartnerSiteShopTrackingConfig = {
    ga4MeasurementId: input.ga4MeasurementId?.trim() || null,
    facebookPixelId: input.facebookPixelId?.trim() || null,
    googleAdsId: input.googleAdsId?.trim() || null,
    tiktokPixelId: input.tiktokPixelId?.trim() || null,
  }

  let html = injectShopTrackingSnippetsIntoHtml(base, tracking)

  const siteSlug = input.siteSlug?.trim() ?? ''
  const chatBridge = buildPartnerSiteLandingChatBridgeScript()
  if (chatBridge && /<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${chatBridge}\n</body>`)
  else if (chatBridge) html = `${html}\n${chatBridge}`

  if (siteSlug && !html.includes('data-pw-personalize') && !html.includes('/personalization')) {
    const locale = input.locale ?? 'vi'
    const script = buildPartnerSitePersonalizationBootstrapScript({ siteSlug, locale })
    if (script && /<\/body>/i.test(html)) html = html.replace(/<\/body>/i, `${script}\n</body>`)
    else if (script) html = `${html}\n${script}`
  }

  return html
}

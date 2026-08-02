import type { WebLocale } from '@/lib/i18n/config'
import {
  injectPartnerLandingBuyScriptIntoHtml,
} from '@/lib/partner-website/landing/build-landing-buy-script'
import type { PartnerLandingProductSnapshot } from '@/lib/partner-website/landing/partner-landing-types'
import { renderPartnerWebsiteHtml } from '@/lib/partner-website/partner-website-render'
import type { PartnerWebsiteProject } from '@/lib/partner-website/partner-website-types'

export function renderPartnerLandingHtml(input: {
  project: PartnerWebsiteProject
  htmlSource?: string | null
  chatPath?: string
  siteSlug: string
  locale?: WebLocale
  products: PartnerLandingProductSnapshot[]
}): string {
  let html = renderPartnerWebsiteHtml({
    project: input.project,
    htmlSource: input.htmlSource,
    chatPath: input.chatPath,
    siteSlug: input.siteSlug,
    locale: input.locale,
    enablePersonalization: false,
  })
  html = injectPartnerLandingBuyScriptIntoHtml(html, {
    siteSlug: input.siteSlug,
    locale: input.locale ?? 'vi',
    products: input.products,
  })
  return html
}

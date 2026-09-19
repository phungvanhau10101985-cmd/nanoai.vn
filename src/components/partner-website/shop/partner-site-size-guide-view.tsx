import type { WebLocale } from '@/lib/i18n/config'
import { partnerSizeGuideCopy, type PartnerSizeGuideKind } from '@/lib/partner-website/shop/partner-site-size-guide'
import {
  buildPartnerSizeGuideHostHtml,
  PARTNER_SIZE_GUIDE_CSS,
} from '@/lib/partner-website/shop/partner-site-size-guide-html'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

export function PartnerSiteSizeGuideView({
  siteSlug,
  locale,
  kind = null,
  shopName = null,
  customDomain = false,
  title,
}: {
  siteSlug: string
  locale: WebLocale
  kind?: PartnerSizeGuideKind | null
  shopName?: string | null
  customDomain?: boolean
  title?: string
}) {
  const copy = partnerSizeGuideCopy(locale)
  const headline = title || (kind ? copy.cardTitle[kind] : copy.indexTitle)
  const html = buildPartnerSizeGuideHostHtml({
    kind,
    locale,
    siteSlug,
    shopName,
    customDomain,
    includeLead: !kind,
  })
  return (
    <article className="pw-shop-info" data-pw-region={PW_REGION.content} data-pw-info-article="1">
      <h1 data-pw-el={PW_EL.heading} data-pw-info-title="1">
        {headline}
      </h1>
      <div data-pw-info-body="1" data-pw-el={PW_EL.body}>
        <style data-pw-size-guide-css="1">{PARTNER_SIZE_GUIDE_CSS}</style>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </article>
  )
}

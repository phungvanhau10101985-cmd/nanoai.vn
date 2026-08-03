import type { WebLocale } from '@/lib/i18n/config'
import type { FashionHomeCopy } from '@/components/partner-website/shop/partner-site-fashion-home'
import type { PartnerWebsitePage } from '@/lib/partner-website/template/partner-website-template-types'
import {
  industryCopyProfile,
  type PartnerIndustryKey,
} from '@/lib/partner-website/partner-capabilities'
import { buildFashionHomeCopy } from '@/lib/partner-website/shop/build-fashion-home-copy'

function localeKey(locale: WebLocale): 'vi' | 'en' {
  return locale === 'vi' ? 'vi' : 'en'
}

export function buildPartnerSiteHomeCopy(input: {
  pages: PartnerWebsitePage[]
  locale: WebLocale
  siteSlug: string
  brandTitle: string
  industryKey: PartnerIndustryKey
}): FashionHomeCopy {
  const base = buildFashionHomeCopy({
    pages: input.pages,
    locale: input.locale,
    siteSlug: input.siteSlug,
    brandTitle: input.brandTitle,
  })
  const profile = industryCopyProfile(input.industryKey)
  const lk = localeKey(input.locale)
  const catNames = profile.categoriesFallback[lk]

  const categories =
    base.categories.length && input.industryKey === 'fashion'
      ? base.categories
      : base.categories.map((cat, i) => ({
          ...cat,
          name: catNames[i] ?? cat.name,
        }))

  return {
    ...base,
    heroSubtitle: base.heroSubtitle || profile.heroSubtitleFallback[lk],
    heroCta: base.heroCta || profile.heroCtaFallback[lk],
    categoriesTitle: base.categoriesTitle,
    categories: categories.length ? categories : catNames.map((name) => ({ name, imageUrl: '', href: undefined })),
    newArrivalsTitle: base.newArrivalsTitle || profile.newArrivalsFallback[lk],
    bestSellersTitle: base.bestSellersTitle || profile.bestSellersFallback[lk],
  }
}

export function partnerSiteHomeIndustryBadge(
  locale: WebLocale,
  industryKey: PartnerIndustryKey
): string {
  const profile = industryCopyProfile(industryKey)
  return profile.heroBadge[localeKey(locale)]
}

export function partnerSiteHomeSecondaryCta(
  locale: WebLocale,
  industryKey: PartnerIndustryKey
): string {
  const profile = industryCopyProfile(industryKey)
  return profile.secondaryCta[localeKey(locale)]
}

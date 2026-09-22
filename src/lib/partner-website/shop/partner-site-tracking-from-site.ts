import type { PartnerWebsitePublicRow } from '@/lib/partner-website/partner-website-types'
import { normalizePartnerShopCurrency } from '@/lib/partner-website/shop/partner-shop-currency'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { normalizeGoogleAdsConversionLabel } from '@/lib/partner-website/shop/normalize-ads-conversion-label'

export function partnerSiteTrackingFromPublicRow(site: PartnerWebsitePublicRow): PartnerSiteShopTrackingConfig {
  return {
    ga4MeasurementId: site.ga4MeasurementId?.trim() || null,
    facebookPixelId: site.facebookPixelId?.trim() || null,
    googleAdsId: site.googleAdsId?.trim() || null,
    tiktokPixelId: site.tiktokPixelId?.trim() || null,
    siteSlug: site.siteSlug?.trim() || null,
    gtmContainerId: site.gtmContainerId?.trim() || null,
    currency: normalizePartnerShopCurrency(site.defaultCurrency),
    googleMerchantId: site.googleCustomerReviewsMerchantId ?? null,
    adsConversionPdp: normalizeGoogleAdsConversionLabel(site.adsConversionPdp),
    adsConversionAddToCart: normalizeGoogleAdsConversionLabel(site.adsConversionAddToCart),
    adsConversionBeginCheckout: normalizeGoogleAdsConversionLabel(site.adsConversionBeginCheckout),
    adsConversionDepositPage: normalizeGoogleAdsConversionLabel(site.adsConversionDepositPage),
    adsConversionPurchase: normalizeGoogleAdsConversionLabel(site.adsConversionPurchase),
    googleSearchConsoleVerify: site.googleSearchConsoleVerify?.trim() || null,
    googleMerchantCenterVerify: site.googleMerchantCenterVerify?.trim() || null,
    facebookDomainVerification: site.facebookDomainVerification?.trim() || null,
    customEmbedHeadHtml: site.customEmbedHeadHtml || null,
    customEmbedBodyOpenHtml: site.customEmbedBodyOpenHtml || null,
    customEmbedBodyCloseHtml: site.customEmbedBodyCloseHtml || null,
  }
}

/** Server-safe — dùng trên trang guest chat (Server Component). */
export function partnerGuestTrackingFromPartner(partner: {
  ga4_measurement_id?: string | null
  facebook_pixel_id?: string | null
  google_ads_id?: string | null
  tiktok_pixel_id?: string | null
  default_currency?: string | null
}): PartnerSiteShopTrackingConfig {
  return {
    ga4MeasurementId: partner.ga4_measurement_id?.trim() || null,
    facebookPixelId: partner.facebook_pixel_id?.trim() || null,
    googleAdsId: partner.google_ads_id?.trim() || null,
    tiktokPixelId: partner.tiktok_pixel_id?.trim() || null,
    currency: normalizePartnerShopCurrency(partner.default_currency),
  }
}

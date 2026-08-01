export type PartnerSiteShopTrackingConfig = {
  ga4MeasurementId: string | null
  facebookPixelId: string | null
  googleAdsId: string | null
  tiktokPixelId: string | null
}

export type PartnerSiteShopTrackingProduct = {
  itemId: string
  itemName: string
  value: number
  quantity?: number
  sku?: string
  remarketingId?: string
}

export type PartnerSiteShopTrackingLine = PartnerSiteShopTrackingProduct & {
  quantity: number
}

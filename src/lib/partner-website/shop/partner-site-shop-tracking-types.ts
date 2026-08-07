export type PartnerSiteShopTrackingConfig = {
  ga4MeasurementId: string | null
  facebookPixelId: string | null
  googleAdsId: string | null
  tiktokPixelId: string | null
  /** S0.3 — bắt buộc để gọi được route CAPI theo shop (`/api/site/{slug}/tracking/meta-capi`). Không có = chỉ bắn pixel, bỏ qua CAPI (an toàn ngược, không lỗi). */
  siteSlug?: string | null
  /** S0.4 — GTM container do merchant tự nhập (GTM-XXXXXXX), tự sinh bootstrap + noscript iframe. */
  gtmContainerId?: string | null
  /** S0.10 — ISO-like currency for ecommerce events (default VND). */
  currency?: string | null
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

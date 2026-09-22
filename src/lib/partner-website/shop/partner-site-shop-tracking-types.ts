export type PartnerSiteShopAdsConversionKey =
  | 'pdp'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'deposit_page'
  | 'purchase'

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
  /** Google Customer Reviews merchant id — CwCD `aw_merchant_id` trên Purchase. */
  googleMerchantId?: number | null
  adsConversionPdp?: string | null
  adsConversionAddToCart?: string | null
  adsConversionBeginCheckout?: string | null
  adsConversionDepositPage?: string | null
  adsConversionPurchase?: string | null
  googleSearchConsoleVerify?: string | null
  googleMerchantCenterVerify?: string | null
  facebookDomainVerification?: string | null
  customEmbedHeadHtml?: string | null
  customEmbedBodyOpenHtml?: string | null
  customEmbedBodyCloseHtml?: string | null
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

export type PartnerSiteNativeTrackKind =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'begin_checkout'
  | 'purchase'
  | 'place_order'
  | 'deposit_page'

export type PartnerSiteNativeTrackPayload = {
  itemId?: string
  itemName?: string
  value?: number
  quantity?: number
  sku?: string
  remarketingId?: string
  products?: PartnerSiteShopTrackingProduct[]
  lines?: PartnerSiteShopTrackingLine[]
  transactionId?: string
  customerEmail?: string
  customerPhone?: string
}

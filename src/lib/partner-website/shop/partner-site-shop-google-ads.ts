'use client'

import type {
  PartnerSiteShopAdsConversionKey,
  PartnerSiteShopTrackingConfig,
  PartnerSiteShopTrackingLine,
  PartnerSiteShopTrackingProduct,
} from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { normalizeGoogleAdsConversionLabel } from '@/lib/partner-website/shop/normalize-ads-conversion-label'

function adsAwId(raw: string | null | undefined): string | null {
  const id = String(raw ?? '').trim().toUpperCase()
  return /^AW-[A-Z0-9]+$/.test(id) ? id : null
}

export function retailItemId(product: PartnerSiteShopTrackingProduct): string {
  return (product.remarketingId || product.itemId || product.sku || '').trim()
}

export function googleAdsRetailItem(product: PartnerSiteShopTrackingProduct, quantity = 1) {
  const id = retailItemId(product)
  return {
    id,
    item_id: id,
    google_business_vertical: 'retail' as const,
    name: product.itemName.slice(0, 200),
    item_name: product.itemName.slice(0, 200),
    quantity: Math.max(1, quantity),
    ...(product.value > 0 ? { price: product.value } : {}),
  }
}

function conversionLabelFor(
  config: PartnerSiteShopTrackingConfig,
  key: PartnerSiteShopAdsConversionKey
): string | null {
  const map: Record<PartnerSiteShopAdsConversionKey, string | null | undefined> = {
    pdp: config.adsConversionPdp,
    add_to_cart: config.adsConversionAddToCart,
    begin_checkout: config.adsConversionBeginCheckout,
    deposit_page: config.adsConversionDepositPage,
    purchase: config.adsConversionPurchase,
  }
  return normalizeGoogleAdsConversionLabel(map[key])
}

function ecommProdid(products: PartnerSiteShopTrackingProduct[]): string | string[] | undefined {
  const ids = [...new Set(products.map(retailItemId).filter(Boolean))]
  if (ids.length === 1) return ids[0]
  if (ids.length > 1) return ids
  return undefined
}

export function firePartnerSiteGoogleAdsRetailPageView(
  config: PartnerSiteShopTrackingConfig,
  payload: {
    ecomm_pagetype: 'home' | 'searchresults' | 'category' | 'product' | 'cart' | 'purchase' | 'other'
    products?: PartnerSiteShopTrackingProduct[]
    value?: number
  }
): void {
  const aw = adsAwId(config.googleAdsId)
  if (!aw || typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const body: Record<string, unknown> = { send_to: aw, ecomm_pagetype: payload.ecomm_pagetype }
  const prodid = payload.products?.length ? ecommProdid(payload.products) : undefined
  if (prodid != null) body.ecomm_prodid = prodid
  if (payload.value != null && payload.value > 0) body.ecomm_totalvalue = payload.value
  window.gtag('event', 'page_view', body)
}

export function firePartnerSiteGoogleAdsConversion(
  config: PartnerSiteShopTrackingConfig,
  key: PartnerSiteShopAdsConversionKey,
  payload: {
    value: number
    items: ReturnType<typeof googleAdsRetailItem>[]
    transactionId?: string
  }
): void {
  const sendTo = conversionLabelFor(config, key)
  if (!sendTo || typeof window === 'undefined' || typeof window.gtag !== 'function') return
  const convValue = payload.value > 0 ? payload.value : 1
  const body: Record<string, unknown> = {
    send_to: sendTo,
    value: convValue,
    currency: (config.currency || 'VND').toUpperCase(),
    items: payload.items,
  }
  if (payload.transactionId?.trim()) body.transaction_id = payload.transactionId.trim()
  const ids = payload.items.map((it) => String(it.id || it.item_id || '').trim()).filter(Boolean)
  if (ids.length === 1) body.ecomm_prodid = ids[0]
  else if (ids.length > 1) body.ecomm_prodid = ids
  if (convValue > 0) body.ecomm_totalvalue = convValue
  if (key === 'purchase') {
    const merchant = Number(config.googleMerchantId)
    if (Number.isInteger(merchant) && merchant > 0) {
      body.aw_merchant_id = merchant
      body.aw_feed_country = 'VN'
      body.aw_feed_language = 'VI'
    }
  }
  window.gtag('event', key === 'purchase' ? 'purchase' : 'conversion', body)
}

export function partnerSiteAdsConversionLines(lines: PartnerSiteShopTrackingLine[]) {
  return lines.map((line) => googleAdsRetailItem(line, line.quantity))
}

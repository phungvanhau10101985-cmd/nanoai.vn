'use client'

import type {
  PartnerSiteShopAdsConversionKey,
  PartnerSiteShopTrackingConfig,
  PartnerSiteShopTrackingLine,
  PartnerSiteShopTrackingProduct,
} from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import { catalogContentId } from '@/lib/messaging/catalog-content-id'
import { normalizeGoogleAdsConversionLabel } from '@/lib/partner-website/shop/normalize-ads-conversion-label'

function adsAwId(raw: string | null | undefined): string | null {
  const id = String(raw ?? '').trim().toUpperCase()
  return /^AW-[A-Z0-9]+$/.test(id) ? id : null
}

export function retailItemId(product: {
  itemId?: string | null
  id?: string | null
  inventoryId?: string | null
  inventory_id?: string | null
  remarketingId?: string | null
  remarketing_id?: string | null
  [key: string]: unknown
}): string {
  const remarketing = product.remarketingId || product.remarketing_id
  const inventory = product.itemId || product.id || product.inventoryId || product.inventory_id
  return catalogContentId({ remarketingId: remarketing, inventoryId: inventory })
}

export function googleAdsRetailItem(
  product: {
    itemId?: string | null
    id?: string | null
    inventoryId?: string | null
    inventory_id?: string | null
    remarketingId?: string | null
    remarketing_id?: string | null
    itemName?: string | null
    name?: string | null
    value?: number | null
    price?: number | null
    quantity?: number | null
  },
  quantity = 1
) {
  const id = retailItemId(product)
  const name = String(product.itemName || product.name || '').slice(0, 200)
  const val = Number(product.value ?? product.price ?? 0)
  const qty = Math.max(1, Number(product.quantity ?? quantity ?? 1))
  return {
    id,
    item_id: id,
    google_business_vertical: 'retail' as const,
    name,
    item_name: name,
    quantity: qty,
    ...(val > 0 ? { price: val } : {}),
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

export function ecommProdid(products: PartnerSiteShopTrackingProduct[]): string | string[] | undefined {
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

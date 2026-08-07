'use client'

import type {
  PartnerSiteShopTrackingConfig,
  PartnerSiteShopTrackingLine,
  PartnerSiteShopTrackingProduct,
} from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  trackShopGa4AddToCart,
  trackShopGa4BeginCheckout,
  trackShopGa4ProductEvent,
  trackShopGa4PurchaseEvent,
} from '@/app/messaging/p/[slug]/shop-ga4-ecommerce'
import { ensureFbqPixelInitialized } from '@/app/messaging/p/[slug]/meta-pixel-session'
import { parseVndFromPriceHint } from '@/lib/partner-website/shop/cart-line-utils'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteConsent } from '@/lib/partner-website/shop/partner-site-consent'
import { normalizePartnerShopCurrency } from '@/lib/partner-website/shop/partner-shop-currency'

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    fbq?: (...args: unknown[]) => void
    dataLayer?: unknown[]
    ttq?: {
      page?: () => void
      track?: (event: string, params?: Record<string, unknown>) => void
    }
    __nanoShopGa4MeasurementId?: string
    __nanoShopGoogleAdsId?: string
    __nanoShopTiktokPixelId?: string
    __nanoShopCurrency?: string
  }
}

function trackingCurrency(config?: { currency?: string | null }): string {
  return normalizePartnerShopCurrency(config?.currency ?? (typeof window !== 'undefined' ? window.__nanoShopCurrency : null))
}

/**
 * S0.4 — đẩy ecommerce event thô vào `window.dataLayer` (chuẩn GTM), độc lập với GA4/Ads qua
 * `gtag`. Merchant tự cấu hình tag GA4/Google Ads/khác trong GTM container đọc từ đây — không phụ
 * thuộc phải có GTM container ID mới hoạt động (dataLayer luôn tồn tại, GTM chỉ là 1 consumer).
 * Xoá `ecommerce` cũ trước khi push mới — khuyến nghị chính thức của Google để tránh merge nhầm
 * dữ liệu giữa các event liên tiếp.
 */
function pushEcommerceDataLayer(eventName: string, ecommerce: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  window.dataLayer = window.dataLayer || []
  window.dataLayer.push({ ecommerce: null })
  window.dataLayer.push({ event: eventName, ecommerce })
}

/**
 * S0.9 — chặn MỌI event (pixel/CAPI/GA4/Ads/TikTok/dataLayer) cho tới khi khách "Đồng ý" ở banner
 * cookie. Không có `siteSlug` (context cũ/chat, không có banner) = không chặn — giữ hành vi cũ.
 */
function hasTrackingConsent(config: { siteSlug?: string | null }): boolean {
  const slug = (config.siteSlug ?? '').trim()
  if (!slug) return true
  return getPartnerSiteConsent(slug) === 'accepted'
}

function contentIds(product: PartnerSiteShopTrackingProduct): string[] {
  const ids = [product.sku, product.remarketingId, product.itemId]
    .map((x) => (x ?? '').trim())
    .filter(Boolean)
  return [...new Set(ids)]
}

function metaCustom(
  product: PartnerSiteShopTrackingProduct,
  quantity = 1,
  currency = 'VND'
): Record<string, unknown> {
  const ids = contentIds(product)
  const custom: Record<string, unknown> = {
    content_ids: ids.length > 0 ? ids : [product.itemId],
    content_name: product.itemName.slice(0, 500),
    content_type: 'product',
    currency,
    value: Math.max(0, Math.round(product.value)),
    num_items: Math.max(1, quantity),
  }
  if (product.remarketingId) custom.remarketing_id = product.remarketingId
  return custom
}

function googleAdsItem(product: PartnerSiteShopTrackingProduct) {
  const id = (product.sku || product.remarketingId || product.itemId).trim()
  return {
    id,
    google_business_vertical: 'retail' as const,
    name: product.itemName.slice(0, 200),
    ...(product.value > 0 ? { price: product.value } : {}),
  }
}

function trackGoogleAdsEvent(
  googleAdsId: string | null | undefined,
  eventName: 'page_view' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase',
  params: Record<string, unknown>,
  currency = 'VND'
): void {
  const aw = (googleAdsId ?? '').trim().toUpperCase()
  if (!aw || !/^AW-[A-Z0-9]+$/.test(aw) || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, {
    send_to: aw,
    currency,
    ...params,
  })
}

function trackTiktokEvent(
  tiktokPixelId: string | null | undefined,
  eventName: string,
  params: Record<string, unknown>
): void {
  const pid = (tiktokPixelId ?? '').trim()
  if (!pid || typeof window.ttq?.track !== 'function') return
  window.ttq.track(eventName, params)
}

type MetaCapiEventName = 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase'

function randomEventId(eventName: string): string {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${eventName}_${uuid}`
}

/**
 * S0.3 — gửi CAPI qua route nội bộ `/api/site/{slug}/tracking/meta-capi` (secret Meta không lộ ra
 * client). Hỗ trợ `sendBeacon` để không mất event khi khách rời trang ngay sau khi mua — xem
 * docs/188_BEHAVIOR_SPEC.md mục E.3.
 */
function sendPartnerSiteMetaCapi(
  siteSlug: string | null | undefined,
  eventName: MetaCapiEventName,
  eventId: string,
  customData: Record<string, unknown>,
  options?: { useBeacon?: boolean; customerEmail?: string; customerPhone?: string }
): void {
  const slug = (siteSlug ?? '').trim()
  if (!slug || typeof window === 'undefined') return
  const url = `/api/site/${encodeURIComponent(slug)}/tracking/meta-capi`
  const payload = JSON.stringify({
    eventName,
    eventId,
    eventSourceUrl: window.location.href,
    customData,
    customerEmail: options?.customerEmail,
    customerPhone: options?.customerPhone,
  })
  if (options?.useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const sent = navigator.sendBeacon(url, new Blob([payload], { type: 'text/plain' }))
    if (sent) return
  }
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {})
}

function trackMetaEvent(
  config: { facebookPixelId?: string | null; siteSlug?: string | null },
  eventName: MetaCapiEventName,
  custom: Record<string, unknown>,
  options?: { skip?: boolean; eventId?: string; useBeacon?: boolean; customerEmail?: string; customerPhone?: string }
): void {
  if (options?.skip) return
  const pid = (config.facebookPixelId ?? '').trim()
  if (!pid || !ensureFbqPixelInitialized(pid) || typeof window.fbq !== 'function') return
  const eventId = options?.eventId ?? randomEventId(eventName)
  window.fbq('track', eventName, custom, { eventID: eventId })
  sendPartnerSiteMetaCapi(config.siteSlug, eventName, eventId, custom, {
    useBeacon: options?.useBeacon,
    customerEmail: options?.customerEmail,
    customerPhone: options?.customerPhone,
  })
}

export function shopProductToTrackingProduct(
  product: PartnerSiteShopProduct,
  priceHint?: string
): PartnerSiteShopTrackingProduct {
  const hint = (priceHint ?? product.priceHint).trim()
  return {
    itemId: product.id,
    itemName: product.name,
    value: parseVndFromPriceHint(hint),
    sku: product.sku || undefined,
  }
}

export function trackPartnerSitePageView(config: PartnerSiteShopTrackingConfig): void {
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (ga4 && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', { send_to: ga4.toUpperCase() })
  }
  trackGoogleAdsEvent(config.googleAdsId, 'page_view', {}, currency)
  const meta = (config.facebookPixelId ?? '').trim()
  if (meta && ensureFbqPixelInitialized(meta) && typeof window.fbq === 'function') {
    window.fbq('track', 'PageView')
  }
  if (typeof window.ttq?.page === 'function') {
    window.ttq.page()
  }
}

export function trackPartnerSiteViewItem(
  config: PartnerSiteShopTrackingConfig,
  product: PartnerSiteShopTrackingProduct,
  options?: { skipMeta?: boolean }
): void {
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  trackShopGa4ProductEvent('view_item', config.ga4MeasurementId, product)
  trackGoogleAdsEvent(
    config.googleAdsId,
    'view_item',
    {
      value: product.value,
      items: [googleAdsItem(product)],
    },
    currency
  )
  pushEcommerceDataLayer('view_item', {
    currency,
    value: product.value,
    items: [{ item_id: product.itemId, item_name: product.itemName, price: product.value, quantity: 1 }],
  })
  trackMetaEvent(config, 'ViewContent', metaCustom(product, 1, currency), { skip: options?.skipMeta })
  trackTiktokEvent(config.tiktokPixelId, 'ViewContent', {
    content_id: product.itemId,
    content_type: 'product',
    content_name: product.itemName,
    value: product.value,
    currency,
  })
}

export function trackPartnerSiteViewItemList(
  config: PartnerSiteShopTrackingConfig,
  products: PartnerSiteShopTrackingProduct[]
): void {
  if (products.length === 0) return
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (ga4 && typeof window.gtag === 'function') {
    window.gtag('event', 'view_item_list', {
      send_to: ga4.toUpperCase(),
      currency,
      items: products.map((p) => ({
        item_id: p.itemId,
        item_name: p.itemName,
        ...(p.value > 0 ? { price: p.value } : {}),
      })),
    })
  }
}

export function trackPartnerSiteAddToCart(
  config: PartnerSiteShopTrackingConfig,
  product: PartnerSiteShopTrackingProduct,
  quantity = 1,
  options?: { skipMeta?: boolean }
): void {
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  const qty = Math.max(1, Math.min(99, Math.floor(quantity) || 1))
  trackShopGa4AddToCart(config.ga4MeasurementId, {
    content_ids: contentIds(product),
    content_name: product.itemName,
    value: product.value * qty,
  })
  trackGoogleAdsEvent(
    config.googleAdsId,
    'add_to_cart',
    {
      value: product.value * qty,
      items: [{ ...googleAdsItem(product), quantity: qty }],
    },
    currency
  )
  pushEcommerceDataLayer('add_to_cart', {
    currency,
    value: product.value * qty,
    items: [{ item_id: product.itemId, item_name: product.itemName, price: product.value, quantity: qty }],
  })
  trackMetaEvent(config, 'AddToCart', metaCustom(product, qty, currency), { skip: options?.skipMeta })
  trackTiktokEvent(config.tiktokPixelId, 'AddToCart', {
    content_id: product.itemId,
    content_type: 'product',
    content_name: product.itemName,
    value: product.value * qty,
    currency,
    quantity: qty,
  })
}

export function trackPartnerSiteBeginCheckout(
  config: PartnerSiteShopTrackingConfig,
  lines: PartnerSiteShopTrackingLine[]
): void {
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  const value = lines.reduce((sum, line) => sum + line.value * line.quantity, 0)
  trackShopGa4BeginCheckout(
    config.ga4MeasurementId,
    value,
    lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      value: line.value,
      quantity: line.quantity,
    }))
  )
  trackGoogleAdsEvent(
    config.googleAdsId,
    'begin_checkout',
    {
      value,
      items: lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
    },
    currency
  )
  pushEcommerceDataLayer('begin_checkout', {
    currency,
    value,
    items: lines.map((line) => ({
      item_id: line.itemId,
      item_name: line.itemName,
      price: line.value,
      quantity: line.quantity,
    })),
  })
  const ids = [...new Set(lines.flatMap((line) => contentIds(line)))]
  trackMetaEvent(config, 'InitiateCheckout', {
    content_ids: ids,
    content_type: 'product',
    currency,
    value,
    num_items: lines.reduce((n, line) => n + line.quantity, 0),
  })
  trackTiktokEvent(config.tiktokPixelId, 'InitiateCheckout', {
    contents: lines.map((line) => ({
      content_id: line.itemId,
      content_name: line.itemName,
      quantity: line.quantity,
      price: line.value,
    })),
    value,
    currency,
  })
}

export function trackPartnerSitePurchase(
  config: PartnerSiteShopTrackingConfig,
  params: {
    transactionId: string
    value: number
    lines: PartnerSiteShopTrackingLine[]
    /** Advanced Matching — hash SHA-256 nội bộ ở route CAPI, không gửi plaintext ra ngoài. */
    customerEmail?: string
    customerPhone?: string
  },
  options?: { skipMeta?: boolean }
): void {
  const transactionId = params.transactionId.trim()
  if (!transactionId) return
  if (!hasTrackingConsent(config)) return
  const currency = trackingCurrency(config)
  trackShopGa4PurchaseEvent({
    measurementId: config.ga4MeasurementId,
    transactionId,
    value: params.value,
    items: params.lines.map((line) => ({
      itemId: line.itemId,
      itemName: line.itemName,
      value: line.value,
      quantity: line.quantity,
    })),
  })
  trackGoogleAdsEvent(
    config.googleAdsId,
    'purchase',
    {
      transaction_id: transactionId,
      value: params.value,
      items: params.lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
    },
    currency
  )
  pushEcommerceDataLayer('purchase', {
    transaction_id: transactionId,
    currency,
    value: params.value,
    items: params.lines.map((line) => ({
      item_id: line.itemId,
      item_name: line.itemName,
      price: line.value,
      quantity: line.quantity,
    })),
  })
  const ids = [...new Set(params.lines.flatMap((line) => contentIds(line)))]
  trackMetaEvent(config, 'Purchase', {
    content_ids: ids,
    content_type: 'product',
    currency,
    value: params.value,
    order_id: transactionId,
    num_items: params.lines.reduce((n, line) => n + line.quantity, 0),
    contents: params.lines.map((line) => ({
      id: line.itemId,
      quantity: line.quantity,
      item_price: line.value,
    })),
  }, {
    skip: options?.skipMeta,
    // ID ổn định theo đơn (khớp `Purchase_{orderId}` server-side khi thanh toán được xác nhận) —
    // xem docs/188_BEHAVIOR_SPEC.md mục E.1.
    eventId: `Purchase_${transactionId}`,
    useBeacon: true,
    customerEmail: params.customerEmail,
    customerPhone: params.customerPhone,
  })
  trackTiktokEvent(config.tiktokPixelId, 'CompletePayment', {
    contents: params.lines.map((line) => ({
      content_id: line.itemId,
      content_name: line.itemName,
      quantity: line.quantity,
      price: line.value,
    })),
    value: params.value,
    currency,
  })
}

export function normalizeGoogleAdsId(raw: string | null | undefined): string | null {
  const id = String(raw ?? '').trim().toUpperCase()
  return /^AW-[A-Z0-9]+$/.test(id) ? id : null
}

export function normalizeTiktokPixelId(raw: string | null | undefined): string | null {
  const id = String(raw ?? '').trim()
  return /^[A-Z0-9]{10,64}$/i.test(id) ? id : null
}

export function guestCardToTrackingProduct(
  card: { name?: string; sku?: string; inventory_id?: string; product_url?: string; price_hint?: string },
  quantity = 1
): PartnerSiteShopTrackingLine {
  const sku = (card.sku ?? '').trim()
  const inv = (card.inventory_id ?? '').trim()
  const productUrl = (card.product_url ?? '').trim()
  const name = (card.name ?? '').trim()
  const qty = Math.max(1, Math.min(99, Math.floor(quantity) || 1))
  return {
    itemId: sku || inv || productUrl,
    itemName: name || sku || inv || productUrl,
    value: parseVndFromPriceHint(card.price_hint),
    quantity: qty,
    sku: sku || undefined,
  }
}

export function trackingProductFromMetaViewContent(
  payload: import('@/lib/tracking/meta-view-content').MetaViewContentClientPayload
): PartnerSiteShopTrackingProduct {
  return {
    itemId: payload.content_ids[0] || payload.remarketing_id || '',
    itemName: payload.content_name,
    value: payload.value,
    remarketingId: payload.remarketing_id,
    sku: payload.content_ids[0],
  }
}

export function trackingProductFromGa4Input(input: {
  itemId?: string | null
  itemName?: string | null
  value?: number | null
  quantity?: number | null
}): PartnerSiteShopTrackingProduct {
  return {
    itemId: String(input.itemId ?? input.itemName ?? '').trim(),
    itemName: String(input.itemName ?? input.itemId ?? '').trim(),
    value: Math.max(0, Math.round(Number(input.value) || 0)),
    quantity: Math.max(1, Math.floor(Number(input.quantity) || 1)),
    sku: String(input.itemId ?? '').trim() || undefined,
  }
}

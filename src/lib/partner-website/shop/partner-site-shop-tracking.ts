'use client'

import type {
  PartnerSiteNativeTrackKind,
  PartnerSiteNativeTrackPayload,
  PartnerSiteShopTrackingConfig,
  PartnerSiteShopTrackingLine,
  PartnerSiteShopTrackingProduct,
} from '@/lib/partner-website/shop/partner-site-shop-tracking-types'
import {
  ecommProdid,
  firePartnerSiteGoogleAdsConversion,
  firePartnerSiteGoogleAdsRetailPageView,
  googleAdsRetailItem,
  partnerSiteAdsConversionLines,
  retailItemId,
} from '@/lib/partner-website/shop/partner-site-shop-google-ads'
import {
  trackShopGa4AddToCart,
  trackShopGa4BeginCheckout,
  trackShopGa4ProductEvent,
  trackShopGa4PurchaseEvent,
} from '@/app/messaging/p/[slug]/shop-ga4-ecommerce'
import { ensureFbqPixelInitialized } from '@/app/messaging/p/[slug]/meta-pixel-session'
import { parseVndFromPriceHint } from '@/lib/partner-website/shop/cart-line-utils'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
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
    /** Head đã bắn PageView — React bỏ đúng lần đầu, soft-nav sau vẫn bắn. */
    __nanoShopMetaPageViewTracked?: boolean
    __nanoShopAdsPageViewTracked?: boolean
    __nanoShopTiktokPageTracked?: boolean
    __pwShopTrack?: (kind: PartnerSiteNativeTrackKind, payload?: PartnerSiteNativeTrackPayload) => void
    __pwShopTrackEvent?: (kind: PartnerSiteNativeTrackKind, payload?: PartnerSiteNativeTrackPayload) => void
    __pwShopTrackQueue?: Array<{ kind: PartnerSiteNativeTrackKind; payload?: PartnerSiteNativeTrackPayload }>
  }
}

function trackingCurrency(config?: { currency?: string | null }): string {
  return normalizePartnerShopCurrency(config?.currency ?? (typeof window !== 'undefined' ? window.__nanoShopCurrency : null))
}

/** PDP: retail page_view phải là sản phẩm đang xem. Lưới gợi ý không được ghi đè thành category. */
function retailPageIsProduct(): boolean {
  if (typeof document === 'undefined') return false
  const marked = (
    document.documentElement?.getAttribute('data-pw-page') ||
    document.body?.getAttribute('data-pw-page') ||
    ''
  ).trim()
  if (marked === 'product') return true
  const path = typeof location !== 'undefined' ? location.pathname || '' : ''
  return /\/products\/[^/?#]+/.test(path)
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

function contentIds(product: PartnerSiteShopTrackingProduct): string[] {
  const id = retailItemId(product)
  return id ? [id] : []
}

function metaCustom(
  product: PartnerSiteShopTrackingProduct,
  quantity = 1,
  currency = 'VND'
): Record<string, unknown> {
  const ids = contentIds(product)
  const contentIdsOut = ids.length > 0 ? ids : [product.itemId]
  const qty = Math.max(1, quantity)
  const value = Math.max(0, Math.round(product.value))
  const primaryId = contentIdsOut[0] || product.itemId
  const custom: Record<string, unknown> = {
    content_ids: contentIdsOut,
    content_name: product.itemName.slice(0, 500),
    content_type: 'product',
    currency,
    value,
    num_items: qty,
    contents: [{ id: primaryId, quantity: qty, item_price: value }],
  }
  const category = (product.category ?? '').trim()
  if (category) custom.content_category = category.slice(0, 200)
  if (product.remarketingId) custom.remarketing_id = product.remarketingId
  return custom
}

function googleAdsItem(product: PartnerSiteShopTrackingProduct, quantity = 1) {
  return googleAdsRetailItem(product, quantity)
}

function trackGoogleAdsEvent(
  googleAdsId: string | null | undefined,
  eventName:
    | 'page_view'
    | 'view_item'
    | 'view_item_list'
    | 'add_to_cart'
    | 'begin_checkout'
    | 'add_payment_info'
    | 'purchase',
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

type ShopFbq = ((...args: unknown[]) => void) & { callMethod?: unknown; loaded?: boolean }

/** Stub `fbq` đặt `loaded=true` trước khi fbevents.js chạy — Pixel Helper mất ViewContent nếu bắn lúc đó. */
function isShopFbqReady(): boolean {
  if (typeof window === 'undefined') return false
  const fbq = window.fbq as ShopFbq | undefined
  return typeof fbq === 'function' && typeof fbq.callMethod === 'function'
}

function whenShopFbqReady(run: () => void): void {
  if (typeof window === 'undefined') return
  if (isShopFbqReady()) {
    run()
    return
  }
  let done = false
  let ticks = 0
  const id = window.setInterval(() => {
    if (done) return
    if (isShopFbqReady()) {
      done = true
      window.clearInterval(id)
      run()
      return
    }
    ticks += 1
    if (ticks >= 200) {
      window.clearInterval(id)
      if (!done && typeof window.fbq === 'function') {
        done = true
        run()
      }
    }
  }, 100)
}

let lastViewContentFingerprint = ''
let lastViewContentAtMs = 0
const VIEW_CONTENT_DEDUPE_MS = 2500

function shouldDedupeViewContent(custom: Record<string, unknown>): boolean {
  const ids = Array.isArray(custom.content_ids) ? custom.content_ids.join(',') : ''
  const fp = `${ids}|${custom.value ?? ''}|${custom.content_name ?? ''}`
  const now = Date.now()
  if (lastViewContentFingerprint === fp && now - lastViewContentAtMs < VIEW_CONTENT_DEDUPE_MS) return true
  lastViewContentFingerprint = fp
  lastViewContentAtMs = now
  return false
}

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
  if (!pid) return
  if (eventName === 'ViewContent' && shouldDedupeViewContent(custom)) return
  const eventId = options?.eventId ?? randomEventId(eventName)
  const firePixel = () => {
    if (!ensureFbqPixelInitialized(pid) || typeof window.fbq !== 'function') return
    window.fbq('track', eventName, custom, { eventID: eventId })
  }
  if (isShopFbqReady()) firePixel()
  else whenShopFbqReady(firePixel)
  sendPartnerSiteMetaCapi(config.siteSlug, eventName, eventId, custom, {
    useBeacon: options?.useBeacon,
    customerEmail: options?.customerEmail,
    customerPhone: options?.customerPhone,
  })
}

function trackMetaCustom(
  config: { facebookPixelId?: string | null },
  eventName: string,
  custom: Record<string, unknown>
): void {
  const pid = (config.facebookPixelId ?? '').trim()
  if (!pid) return
  const firePixel = () => {
    if (!ensureFbqPixelInitialized(pid) || typeof window.fbq !== 'function') return
    window.fbq('trackCustom', eventName, custom)
  }
  if (isShopFbqReady()) firePixel()
  else whenShopFbqReady(firePixel)
}

/** Giá khách đang trả. `salePriceAmount` chỉ có khi sale đã trừ (lịch active, flash, thanh lý, cửa sổ giá). Teaser để null → giá niêm yết. */
export function partnerShopTrackingChargedUnit(input: {
  priceAmount?: number | null
  salePriceAmount?: number | null
  priceHint?: string | null
}): number {
  const sale = Number(input.salePriceAmount)
  const list = Number(input.priceAmount)
  if (Number.isFinite(sale) && sale > 0 && (!Number.isFinite(list) || list <= 0 || sale < list)) {
    return Math.round(sale)
  }
  if (Number.isFinite(list) && list > 0) return Math.round(list)
  return parseVndFromPriceHint(String(input.priceHint || ''))
}

export function shopProductToTrackingProduct(
  product: PartnerSiteShopProduct,
  priceHint?: string
): PartnerSiteShopTrackingProduct {
  const hint = (priceHint ?? product.priceHint).trim()
  return {
    itemId: product.id,
    itemName: product.name,
    value: partnerShopTrackingChargedUnit({
      priceAmount: product.priceAmount,
      salePriceAmount: product.salePriceAmount,
      priceHint: hint,
    }),
    sku: product.sku || undefined,
    remarketingId: product.remarketingId || undefined,
    category: product.categoryL3 || product.categoryL2 || product.categoryL1 || undefined,
  }
}

export function trackPartnerSitePageView(config: PartnerSiteShopTrackingConfig): void {
  const currency = trackingCurrency(config)
  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (ga4 && typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', { send_to: ga4.toUpperCase() })
  }
  if (window.__nanoShopAdsPageViewTracked) {
    window.__nanoShopAdsPageViewTracked = false
  } else {
    trackGoogleAdsEvent(config.googleAdsId, 'page_view', {}, currency)
  }
  const meta = (config.facebookPixelId ?? '').trim()
  if (meta && typeof window.fbq === 'function') {
    if (window.__nanoShopMetaPageViewTracked) {
      window.__nanoShopMetaPageViewTracked = false
    } else if (ensureFbqPixelInitialized(meta)) {
      window.fbq('track', 'PageView')
    }
  }
  if (typeof window.ttq?.page === 'function') {
    if (window.__nanoShopTiktokPageTracked) {
      window.__nanoShopTiktokPageTracked = false
    } else {
      window.ttq.page()
    }
  }
}

export function trackPartnerSiteViewItem(
  config: PartnerSiteShopTrackingConfig,
  product: PartnerSiteShopTrackingProduct,
  options?: { skipMeta?: boolean }
): void {
  const currency = trackingCurrency(config)
  const prodId = retailItemId(product)
  trackShopGa4ProductEvent('view_item', config.ga4MeasurementId, {
    itemId: prodId,
    itemName: product.itemName,
    value: product.value,
    quantity: 1,
  })
  trackGoogleAdsEvent(
    config.googleAdsId,
    'view_item',
    {
      id: prodId,
      item_id: prodId,
      ecomm_prodid: prodId,
      ecomm_pagetype: 'product',
      ecomm_totalvalue: product.value,
      value: product.value,
      items: [googleAdsItem(product)],
    },
    currency
  )
  firePartnerSiteGoogleAdsRetailPageView(config, {
    ecomm_pagetype: 'product',
    products: [product],
    value: product.value,
  })
  firePartnerSiteGoogleAdsConversion(config, 'pdp', {
    value: product.value,
    items: [googleAdsItem(product)],
  })
  pushEcommerceDataLayer('view_item', {
    currency,
    value: product.value,
    id: prodId,
    item_id: prodId,
    ecomm_prodid: prodId,
    ecomm_pagetype: 'product',
    ecomm_totalvalue: product.value,
    items: [{ item_id: prodId, item_name: product.itemName, price: product.value, quantity: 1 }],
  })
  trackMetaEvent(config, 'ViewContent', metaCustom(product, 1, currency), { skip: options?.skipMeta })
  trackTiktokEvent(config.tiktokPixelId, 'ViewContent', {
    content_id: prodId,
    content_type: 'product',
    content_name: product.itemName,
    quantity: 1,
    price: product.value,
    value: product.value,
    currency,
    contents: [
      {
        content_id: prodId,
        content_type: 'product',
        content_name: product.itemName,
        quantity: 1,
        price: product.value,
      },
    ],
  })
}

export function trackPartnerSiteViewItemList(
  config: PartnerSiteShopTrackingConfig,
  products: PartnerSiteShopTrackingProduct[]
): void {
  if (products.length === 0) return
  const currency = trackingCurrency(config)
  const prodIds = ecommProdid(products)
  const ga4 = (config.ga4MeasurementId ?? '').trim()
  if (ga4 && typeof window.gtag === 'function') {
    window.gtag('event', 'view_item_list', {
      send_to: ga4.toUpperCase(),
      currency,
      items: products.map((p) => ({
        item_id: retailItemId(p),
        item_name: p.itemName,
        ...(p.value > 0 ? { price: p.value } : {}),
      })),
    })
  }
  const onProductPage = retailPageIsProduct()
  if (!onProductPage) {
    trackGoogleAdsEvent(
      config.googleAdsId,
      'view_item_list',
      {
        ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
        ecomm_pagetype: 'category',
        items: products.map((p) => googleAdsItem(p)),
      },
      currency
    )
    firePartnerSiteGoogleAdsRetailPageView(config, {
      ecomm_pagetype: 'category',
      products,
    })
  }
  pushEcommerceDataLayer('view_item_list', {
    currency,
    ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
    ecomm_pagetype: 'category',
    items: products.map((p) => ({
      item_id: retailItemId(p),
      item_name: p.itemName,
      ...(p.value > 0 ? { price: p.value } : {}),
    })),
  })
  trackTiktokEvent(config.tiktokPixelId, 'ViewContent', {
    content_type: 'product_group',
    contents: products.slice(0, 20).map((p) => ({
      content_id: retailItemId(p),
      content_type: 'product',
      content_name: p.itemName,
      ...(p.value > 0 ? { price: p.value } : {}),
    })),
    currency,
  })
}

export function trackPartnerSiteAddToCart(
  config: PartnerSiteShopTrackingConfig,
  product: PartnerSiteShopTrackingProduct,
  quantity = 1,
  options?: { skipMeta?: boolean }
): void {
  const currency = trackingCurrency(config)
  const qty = Math.max(1, Math.min(99, Math.floor(quantity) || 1))
  const prodId = retailItemId(product)
  const totalVal = product.value * qty
  trackShopGa4AddToCart(config.ga4MeasurementId, {
    content_ids: contentIds(product),
    content_name: product.itemName,
    value: totalVal,
  })
  trackGoogleAdsEvent(
    config.googleAdsId,
    'add_to_cart',
    {
      id: prodId,
      item_id: prodId,
      ecomm_prodid: prodId,
      ecomm_pagetype: 'cart',
      ecomm_totalvalue: totalVal,
      value: totalVal,
      items: [{ ...googleAdsItem(product), quantity: qty }],
    },
    currency
  )
  firePartnerSiteGoogleAdsRetailPageView(config, {
    ecomm_pagetype: 'cart',
    products: [product],
    value: totalVal,
  })
  pushEcommerceDataLayer('add_to_cart', {
    currency,
    value: totalVal,
    id: prodId,
    item_id: prodId,
    ecomm_prodid: prodId,
    ecomm_pagetype: 'cart',
    ecomm_totalvalue: totalVal,
    items: [{ item_id: prodId, item_name: product.itemName, price: product.value, quantity: qty }],
  })
  firePartnerSiteGoogleAdsConversion(config, 'add_to_cart', {
    value: totalVal,
    items: [googleAdsItem(product, qty)],
  })
  trackMetaEvent(config, 'AddToCart', metaCustom(product, qty, currency), { skip: options?.skipMeta })
  trackTiktokEvent(config.tiktokPixelId, 'AddToCart', {
    content_id: prodId,
    content_type: 'product',
    content_name: product.itemName,
    quantity: qty,
    price: product.value,
    value: totalVal,
    currency,
    contents: [
      {
        content_id: prodId,
        content_type: 'product',
        content_name: product.itemName,
        quantity: qty,
        price: product.value,
      },
    ],
  })
}

export function trackPartnerSiteBeginCheckout(
  config: PartnerSiteShopTrackingConfig,
  lines: PartnerSiteShopTrackingLine[]
): void {
  const currency = trackingCurrency(config)
  const value = lines.reduce((sum, line) => sum + line.value * line.quantity, 0)
  const prodIds = ecommProdid(lines)
  trackShopGa4BeginCheckout(
    config.ga4MeasurementId,
    value,
    lines.map((line) => ({
      itemId: retailItemId(line),
      itemName: line.itemName,
      value: line.value,
      quantity: line.quantity,
    }))
  )
  trackGoogleAdsEvent(
    config.googleAdsId,
    'begin_checkout',
    {
      ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
      ...(typeof prodIds === 'string' ? { id: prodIds, item_id: prodIds } : {}),
      ecomm_pagetype: 'cart',
      ecomm_totalvalue: value,
      value,
      items: lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
    },
    currency
  )
  pushEcommerceDataLayer('begin_checkout', {
    currency,
    value,
    ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
    ecomm_pagetype: 'cart',
    ecomm_totalvalue: value,
    items: lines.map((line) => ({
      item_id: retailItemId(line),
      item_name: line.itemName,
      price: line.value,
      quantity: line.quantity,
    })),
  })
  firePartnerSiteGoogleAdsRetailPageView(config, {
    ecomm_pagetype: 'cart',
    products: lines,
    value,
  })
  firePartnerSiteGoogleAdsConversion(config, 'begin_checkout', {
    value,
    items: partnerSiteAdsConversionLines(lines),
  })
  const ids = [...new Set(lines.flatMap((line) => contentIds(line)))]
  trackMetaEvent(config, 'InitiateCheckout', {
    content_ids: ids,
    content_type: 'product',
    currency,
    value,
    num_items: lines.reduce((n, line) => n + line.quantity, 0),
  })
  const tiktokLines = lines.map((line) => ({
    content_id: retailItemId(line),
    content_type: 'product',
    content_name: line.itemName,
    quantity: line.quantity,
    price: line.value,
  }))
  const tiktokFirstId = lines.length === 1 ? retailItemId(lines[0]) : undefined
  const tiktokIds = lines.map((line) => retailItemId(line)).filter(Boolean)
  trackTiktokEvent(config.tiktokPixelId, 'InitiateCheckout', {
    content_type: 'product',
    ...(tiktokFirstId ? { content_id: tiktokFirstId } : {}),
    ...(tiktokIds.length ? { content_ids: tiktokIds } : {}),
    contents: tiktokLines,
    value,
    currency,
    num_items: lines.reduce((n, line) => n + line.quantity, 0),
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
  const currency = trackingCurrency(config)
  const prodIds = ecommProdid(params.lines)
  trackShopGa4PurchaseEvent({
    measurementId: config.ga4MeasurementId,
    transactionId,
    value: params.value,
    items: params.lines.map((line) => ({
      itemId: retailItemId(line),
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
      ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
      ...(typeof prodIds === 'string' ? { id: prodIds, item_id: prodIds } : {}),
      ecomm_pagetype: 'purchase',
      ecomm_totalvalue: params.value,
      items: params.lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
    },
    currency
  )
  pushEcommerceDataLayer('purchase', {
    transaction_id: transactionId,
    currency,
    value: params.value,
    ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
    ecomm_pagetype: 'purchase',
    ecomm_totalvalue: params.value,
    items: params.lines.map((line) => ({
      item_id: retailItemId(line),
      item_name: line.itemName,
      price: line.value,
      quantity: line.quantity,
    })),
  })
  firePartnerSiteGoogleAdsRetailPageView(config, {
    ecomm_pagetype: 'purchase',
    products: params.lines,
    value: params.value,
  })
  firePartnerSiteGoogleAdsConversion(config, 'purchase', {
    value: params.value,
    items: partnerSiteAdsConversionLines(params.lines),
    transactionId,
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
      id: retailItemId(line),
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
  const tiktokPurchaseLines = params.lines.map((line) => ({
    content_id: retailItemId(line),
    content_type: 'product',
    content_name: line.itemName,
    quantity: line.quantity,
    price: line.value,
  }))
  const tiktokPurchaseFirstId = params.lines.length === 1 ? retailItemId(params.lines[0]) : undefined
  const tiktokPurchaseIds = params.lines.map((line) => retailItemId(line)).filter(Boolean)
  trackTiktokEvent(config.tiktokPixelId, 'CompletePayment', {
    content_type: 'product',
    ...(tiktokPurchaseFirstId ? { content_id: tiktokPurchaseFirstId } : {}),
    ...(tiktokPurchaseIds.length ? { content_ids: tiktokPurchaseIds } : {}),
    order_id: transactionId,
    contents: tiktokPurchaseLines,
    value: params.value,
    currency,
    num_items: params.lines.reduce((n, line) => n + line.quantity, 0),
  })
}

/** Checkout needs deposit — Meta custom + TikTok PlaceAnOrder, no Purchase. */
export function trackPartnerSitePlaceOrder(
  config: PartnerSiteShopTrackingConfig,
  params: { value: number; lines: PartnerSiteShopTrackingLine[]; transactionId?: string }
): void {
  const currency = trackingCurrency(config)
  const prodIds = ecommProdid(params.lines)
  trackGoogleAdsEvent(
    config.googleAdsId,
    'add_payment_info',
    {
      ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
      value: params.value,
      ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
      ...(typeof prodIds === 'string' ? { id: prodIds, item_id: prodIds } : {}),
      ecomm_pagetype: 'cart',
      ecomm_totalvalue: params.value,
      items: params.lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
    },
    currency
  )
  firePartnerSiteGoogleAdsRetailPageView(config, {
    ecomm_pagetype: 'cart',
    products: params.lines,
    value: params.value,
  })
  pushEcommerceDataLayer('add_payment_info', {
    ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
    currency,
    value: params.value,
    ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
    ecomm_pagetype: 'cart',
    ecomm_totalvalue: params.value,
    items: params.lines.map((line) => ({
      item_id: retailItemId(line),
      item_name: line.itemName,
      price: line.value,
      quantity: line.quantity,
    })),
  })
  const ids = [...new Set(params.lines.flatMap((line) => contentIds(line)))]
  trackMetaCustom(config, 'OrderAwaitingDeposit', {
    content_ids: ids,
    content_type: 'product',
    currency,
    value: params.value,
    num_items: params.lines.reduce((n, line) => n + line.quantity, 0),
    order_id: params.transactionId || '',
  })
  const tiktokPlaceLines = params.lines.map((line) => ({
    content_id: retailItemId(line),
    content_type: 'product',
    content_name: line.itemName,
    quantity: line.quantity,
    price: line.value,
  }))
  const tiktokPlaceFirstId = params.lines.length === 1 ? retailItemId(params.lines[0]) : undefined
  const tiktokPlaceIds = params.lines.map((line) => retailItemId(line)).filter(Boolean)
  trackTiktokEvent(config.tiktokPixelId, 'PlaceAnOrder', {
    content_type: 'product',
    ...(tiktokPlaceFirstId ? { content_id: tiktokPlaceFirstId } : {}),
    ...(tiktokPlaceIds.length ? { content_ids: tiktokPlaceIds } : {}),
    order_id: params.transactionId || '',
    contents: tiktokPlaceLines,
    value: params.value,
    currency,
    num_items: params.lines.reduce((n, line) => n + line.quantity, 0),
  })
}

export function trackPartnerSiteDepositPage(
  config: PartnerSiteShopTrackingConfig,
  params: { value: number; lines?: PartnerSiteShopTrackingLine[]; transactionId?: string }
): void {
  const lines = params.lines ?? []
  const currency = trackingCurrency(config)
  const ids = [...new Set(lines.map((line) => retailItemId(line)).filter(Boolean))]
  if (lines.length) {
    const prodIds = ecommProdid(lines)
    trackGoogleAdsEvent(
      config.googleAdsId,
      'add_payment_info',
      {
        ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
        value: params.value,
        ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
        ...(typeof prodIds === 'string' ? { id: prodIds, item_id: prodIds } : {}),
        ecomm_pagetype: 'cart',
        ecomm_totalvalue: params.value,
        items: lines.map((line) => ({ ...googleAdsItem(line), quantity: line.quantity })),
      },
      currency
    )
    firePartnerSiteGoogleAdsRetailPageView(config, {
      ecomm_pagetype: 'cart',
      products: lines,
      value: params.value,
    })
    pushEcommerceDataLayer('deposit_page', {
      ...(params.transactionId ? { transaction_id: params.transactionId } : {}),
      currency,
      value: params.value,
      ...(prodIds != null ? { ecomm_prodid: prodIds } : {}),
      ecomm_pagetype: 'cart',
      ecomm_totalvalue: params.value,
      items: lines.map((line) => ({
        item_id: retailItemId(line),
        item_name: line.itemName,
        price: line.value,
        quantity: line.quantity,
      })),
    })
    const tiktokDepositLines = lines.map((line) => ({
      content_id: retailItemId(line),
      content_type: 'product',
      content_name: line.itemName,
      quantity: line.quantity,
      price: line.value,
    }))
    const tiktokDepositFirstId = lines.length === 1 ? retailItemId(lines[0]) : undefined
    trackTiktokEvent(config.tiktokPixelId, 'AddPaymentInfo', {
      content_type: 'product',
      ...(tiktokDepositFirstId ? { content_id: tiktokDepositFirstId } : {}),
      ...(ids.length ? { content_ids: ids } : {}),
      order_id: params.transactionId || '',
      contents: tiktokDepositLines,
      value: params.value,
      currency,
      num_items: lines.reduce((n, line) => n + line.quantity, 0),
    })
  }
  firePartnerSiteGoogleAdsConversion(config, 'deposit_page', {
    value: params.value,
    items: lines.length ? partnerSiteAdsConversionLines(lines) : [],
    transactionId: params.transactionId,
  })
  trackMetaCustom(config, 'ViewDepositPayment', {
    ...(ids.length
      ? {
          content_ids: ids,
          content_type: 'product',
          num_items: lines.reduce((n, line) => n + line.quantity, 0),
          contents: lines.map((line) => ({
            id: retailItemId(line),
            quantity: line.quantity,
            item_price: line.value,
          })),
        }
      : {}),
    currency,
    value: params.value,
    order_id: params.transactionId || '',
  })
}

function nativeProduct(payload: PartnerSiteNativeTrackPayload | undefined): PartnerSiteShopTrackingProduct {
  const category = String(payload?.category || '').trim()
  return {
    itemId: String(payload?.itemId || payload?.sku || payload?.remarketingId || '').trim(),
    itemName: String(payload?.itemName || payload?.itemId || '').trim(),
    value: Math.max(0, Math.round(Number(payload?.value) || 0)),
    quantity: Math.max(1, Math.floor(Number(payload?.quantity) || 1)),
    sku: payload?.sku,
    remarketingId: payload?.remarketingId,
    ...(category ? { category } : {}),
  }
}

export function dispatchPartnerSiteNativeTrack(
  config: PartnerSiteShopTrackingConfig,
  kind: PartnerSiteNativeTrackKind,
  payload?: PartnerSiteNativeTrackPayload
): void {
  if (kind === 'page_view') {
    trackPartnerSitePageView(config)
    return
  }
  if (kind === 'view_item') {
    trackPartnerSiteViewItem(config, nativeProduct(payload))
    return
  }
  if (kind === 'view_item_list') {
    const products = Array.isArray(payload?.products) ? payload.products : []
    trackPartnerSiteViewItemList(config, products.length ? products : [nativeProduct(payload)])
    return
  }
  if (kind === 'add_to_cart') {
    trackPartnerSiteAddToCart(config, nativeProduct(payload), payload?.quantity)
    return
  }
  if (kind === 'begin_checkout' && payload?.lines?.length) {
    trackPartnerSiteBeginCheckout(config, payload.lines)
    return
  }
  if (kind === 'purchase' && payload?.transactionId && payload.lines?.length) {
    trackPartnerSitePurchase(config, {
      transactionId: payload.transactionId,
      value: Number(payload.value) || 0,
      lines: payload.lines,
      customerEmail: payload.customerEmail,
      customerPhone: payload.customerPhone,
    })
    return
  }
  if (kind === 'place_order' && payload?.lines?.length) {
    trackPartnerSitePlaceOrder(config, {
      value: Number(payload.value) || 0,
      lines: payload.lines,
      transactionId: payload.transactionId,
    })
    return
  }
  if (kind === 'deposit_page') {
    trackPartnerSiteDepositPage(config, {
      value: Number(payload?.value) || 0,
      lines: payload?.lines,
      transactionId: payload?.transactionId,
    })
  }
}

export function bindPartnerSiteNativeTracking(config: PartnerSiteShopTrackingConfig): void {
  if (typeof window === 'undefined') return
  window.__pwShopTrack = (kind, payload) => dispatchPartnerSiteNativeTrack(config, kind, payload)
  const queued = window.__pwShopTrackQueue || []
  window.__pwShopTrackQueue = []
  queued.forEach((item) => {
    try {
      dispatchPartnerSiteNativeTrack(config, item.kind, item.payload)
    } catch {
      /* ignore */
    }
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
  card: {
    name?: string
    sku?: string
    inventory_id?: string
    product_url?: string
    price_hint?: string
    remarketing_id?: string
  },
  quantity = 1
): PartnerSiteShopTrackingLine {
  const sku = (card.sku ?? '').trim()
  const inv = (card.inventory_id ?? '').trim()
  const productUrl = (card.product_url ?? '').trim()
  const name = (card.name ?? '').trim()
  const qty = Math.max(1, Math.min(99, Math.floor(quantity) || 1))
  const remarketingId = (card.remarketing_id ?? '').trim()
  return {
    itemId: inv || sku || productUrl,
    itemName: name || sku || inv || productUrl,
    value: parseVndFromPriceHint(card.price_hint),
    quantity: qty,
    sku: sku || undefined,
    remarketingId: remarketingId || undefined,
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

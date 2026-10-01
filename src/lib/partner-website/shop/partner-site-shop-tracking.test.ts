import assert from 'node:assert/strict'
import test from 'node:test'
import {
  retailItemId,
  ecommProdid,
} from '@/lib/partner-website/shop/partner-site-shop-google-ads'
import {
  partnerShopTrackingChargedUnit,
  shopProductToTrackingProduct,
  trackPartnerSiteViewItem,
  trackPartnerSiteViewItemList,
  trackPartnerSiteAddToCart,
  trackPartnerSiteBeginCheckout,
  trackPartnerSitePlaceOrder,
  trackPartnerSiteDepositPage,
  trackPartnerSitePurchase,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PW_SHOP_NATIVE_TRACK_JS } from '@/lib/partner-website/shop/build-partner-site-shop-tracking-bridge-script'
import type {
  PartnerSiteShopTrackingConfig,
  PartnerSiteShopTrackingProduct,
  PartnerSiteShopTrackingLine,
} from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

function setupMockWindow() {
  const gtagCalls: Array<{ target: unknown; args: unknown[] }> = []
  const dataLayer: unknown[] = []
  const ttqCalls: Array<{ event: string; params: Record<string, unknown> }> = []
  global.window = {
    ...global.window,
    dataLayer,
    gtag: (...args: unknown[]) => {
      gtagCalls.push({ target: args[0], args })
    },
    ttq: {
      track: (event: string, params?: Record<string, unknown>) => {
        ttqCalls.push({ event, params: params ?? {} })
      },
    },
  } as unknown as Window & typeof globalThis
  return { gtagCalls, dataLayer, ttqCalls }
}

const mockConfig: PartnerSiteShopTrackingConfig = {
  googleAdsId: 'AW-18484324626',
  ga4MeasurementId: 'G-TEST999',
  facebookPixelId: null,
  tiktokPixelId: 'C_TIKTOK_TEST_PIXEL',
}

const sampleProduct: PartnerSiteShopTrackingProduct = {
  itemId: '3c92e92a-fa18-4ad0-b087-73d8eb5ee4cb',
  itemName: 'Đầm hai mảnh ôm body',
  value: 980000,
  sku: 'SP-DAM-01',
  remarketingId: 'A789012345',
}

test('retailItemId matches Google Merchant Feed ID specification', () => {
  // Ưu tiên remarketingId (hoặc remarketing_id)
  assert.equal(
    retailItemId({ id: 'uuid-1', remarketingId: 'A123456' }),
    'A123456'
  )
  assert.equal(
    retailItemId({ id: 'uuid-1', remarketing_id: 'T987654' }),
    'T987654'
  )
  // Fallback về id / inventoryId nếu không có remarketingId
  assert.equal(
    retailItemId({ id: 'uuid-1234' }),
    'uuid-1234'
  )
  assert.equal(
    retailItemId({ inventoryId: 'uuid-5678' }),
    'uuid-5678'
  )
})

test('ecommProdid formats single item as string and multiple as array', () => {
  assert.equal(ecommProdid([sampleProduct]), 'A789012345')
  assert.deepEqual(
    ecommProdid([
      sampleProduct,
      { itemId: 'uuid-2', remarketingId: 'B22222', itemName: 'SP2', value: 100000 },
    ]),
    ['A789012345', 'B22222']
  )
})

test('trackPartnerSiteViewItem sends remarketing id at root to Google Ads and dataLayer', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()

  trackPartnerSiteViewItem(mockConfig, sampleProduct)

  // Kiểm tra Google Ads view_item call
  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'view_item' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call gtag event view_item with AW-18484324626')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.equal(adsPayload.ecomm_prodid, 'A789012345')
  assert.equal(adsPayload.ecomm_pagetype, 'product')
  assert.equal(adsPayload.ecomm_totalvalue, 980000)
  assert.equal(adsPayload.id, 'A789012345')
  assert.equal(adsPayload.item_id, 'A789012345')

  // Kiểm tra Google Ads retail page_view call
  const retailPageCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'page_view' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(retailPageCall, 'Must call retail page_view for view_item')
  const retailPayload = retailPageCall.args[2] as Record<string, unknown>
  assert.equal(retailPayload.ecomm_prodid, 'A789012345')
  assert.equal(retailPayload.ecomm_pagetype, 'product')

  // Kiểm tra GTM dataLayer
  const dlEvent = dataLayer.find((d: any) => d && d.event === 'view_item') as any
  assert.ok(dlEvent, 'Must push view_item to dataLayer')
  assert.equal(dlEvent.ecommerce.ecomm_prodid, 'A789012345')
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'product')
  assert.equal(dlEvent.ecommerce.id, 'A789012345')
  assert.equal(dlEvent.ecommerce.item_id, 'A789012345')
})

test('trackPartnerSiteAddToCart sends full retail parameters to Google Ads and dataLayer', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()

  trackPartnerSiteAddToCart(mockConfig, sampleProduct, 2)

  // Kiểm tra Google Ads add_to_cart call
  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'add_to_cart' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call gtag event add_to_cart for Google Ads')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.equal(adsPayload.ecomm_prodid, 'A789012345')
  assert.equal(adsPayload.ecomm_pagetype, 'cart')
  assert.equal(adsPayload.ecomm_totalvalue, 1960000)
  assert.equal(adsPayload.id, 'A789012345')
  assert.equal(adsPayload.item_id, 'A789012345')

  // Kiểm tra Google Ads retail page_view call (phải có cho add_to_cart)
  const retailPageCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'page_view' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(retailPageCall, 'Must call retail page_view for add_to_cart')
  const retailPayload = retailPageCall.args[2] as Record<string, unknown>
  assert.equal(retailPayload.ecomm_prodid, 'A789012345')
  assert.equal(retailPayload.ecomm_pagetype, 'cart')
  assert.equal(retailPayload.ecomm_totalvalue, 1960000)

  // Kiểm tra GTM dataLayer
  const dlEvent = dataLayer.find((d: any) => d && d.event === 'add_to_cart') as any
  assert.ok(dlEvent, 'Must push add_to_cart to dataLayer')
  assert.equal(dlEvent.ecommerce.ecomm_prodid, 'A789012345')
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'cart')
  assert.equal(dlEvent.ecommerce.ecomm_totalvalue, 1960000)
  assert.equal(dlEvent.ecommerce.id, 'A789012345')
})

test('product page grids do not overwrite Google Ads page_view product id', () => {
  const { gtagCalls } = setupMockWindow()
  const prevDocument = global.document
  global.document = {
    documentElement: { getAttribute: (name: string) => (name === 'data-pw-page' ? 'product' : null) },
    body: { getAttribute: () => null },
  } as unknown as Document

  trackPartnerSiteViewItem(mockConfig, {
    ...sampleProduct,
    remarketingId: 'A1027032024891',
  })
  trackPartnerSiteViewItemList(mockConfig, [
    { itemId: 'uuid-a', itemName: 'Khác 1', remarketingId: 'A746144242664', value: 1 },
    { itemId: 'uuid-b', itemName: 'Khác 2', remarketingId: 'A763167859418', value: 1 },
    { itemId: 'uuid-c', itemName: 'Khác 3', remarketingId: 'A886940722853', value: 1 },
  ])

  const retailViews = gtagCalls.filter(
    (c) =>
      c.args[0] === 'event' &&
      c.args[1] === 'page_view' &&
      (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.equal(retailViews.length, 1)
  const body = retailViews[0].args[2] as Record<string, unknown>
  assert.equal(body.ecomm_pagetype, 'product')
  assert.equal(body.ecomm_prodid, 'A1027032024891')
  assert.equal(
    gtagCalls.some(
      (c) => c.args[1] === 'view_item_list' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
    ),
    false
  )
  global.document = prevDocument
})

test('trackPartnerSiteViewItemList sends category remarketing parameters', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()
  const prevDocument = global.document
  global.document = {
    documentElement: { getAttribute: (name: string) => (name === 'data-pw-page' ? 'listing' : null) },
    body: { getAttribute: () => null },
  } as unknown as Document

  trackPartnerSiteViewItemList(mockConfig, [
    sampleProduct,
    { itemId: 'uuid-2', itemName: 'Sản phẩm 2', remarketingId: 'A999999', value: 500000 },
  ])

  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'view_item_list' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call gtag event view_item_list for Google Ads')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.deepEqual(adsPayload.ecomm_prodid, ['A789012345', 'A999999'])
  assert.equal(adsPayload.ecomm_pagetype, 'category')

  const dlEvent = dataLayer.find((d: any) => d && d.event === 'view_item_list') as any
  assert.ok(dlEvent, 'Must push view_item_list to dataLayer')
  assert.deepEqual(dlEvent.ecommerce.ecomm_prodid, ['A789012345', 'A999999'])
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'category')
  const retailPage = gtagCalls.find(
    (c) =>
      c.args[0] === 'event' &&
      c.args[1] === 'page_view' &&
      (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.equal((retailPage?.args[2] as Record<string, unknown>)?.ecomm_pagetype, 'category')
  global.document = prevDocument
})

test('trackPartnerSiteBeginCheckout sends cart remarketing parameters', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()

  const lines: PartnerSiteShopTrackingLine[] = [
    {
      itemId: sampleProduct.itemId,
      itemName: sampleProduct.itemName,
      value: 980000,
      quantity: 1,
      remarketingId: sampleProduct.remarketingId,
    },
  ]
  trackPartnerSiteBeginCheckout(mockConfig, lines)

  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'begin_checkout' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call begin_checkout for Google Ads')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.equal(adsPayload.ecomm_prodid, 'A789012345')
  assert.equal(adsPayload.ecomm_pagetype, 'cart')
  assert.equal(adsPayload.ecomm_totalvalue, 980000)

  const dlEvent = dataLayer.find((d: any) => d && d.event === 'begin_checkout') as any
  assert.ok(dlEvent, 'Must push begin_checkout to dataLayer')
  assert.equal(dlEvent.ecommerce.ecomm_prodid, 'A789012345')
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'cart')
})

test('trackPartnerSitePlaceOrder sends add_payment_info with remarketing IDs', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()

  const lines: PartnerSiteShopTrackingLine[] = [
    {
      itemId: sampleProduct.itemId,
      itemName: sampleProduct.itemName,
      value: 980000,
      quantity: 1,
      remarketingId: sampleProduct.remarketingId,
    },
  ]
  trackPartnerSitePlaceOrder(mockConfig, { value: 980000, lines, transactionId: 'ORDER-123' })

  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'add_payment_info' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call add_payment_info for Google Ads')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.equal(adsPayload.ecomm_prodid, 'A789012345')
  assert.equal(adsPayload.ecomm_pagetype, 'cart')
  assert.equal(adsPayload.ecomm_totalvalue, 980000)

  const dlEvent = dataLayer.find((d: any) => d && d.event === 'add_payment_info') as any
  assert.ok(dlEvent, 'Must push add_payment_info to dataLayer')
  assert.equal(dlEvent.ecommerce.ecomm_prodid, 'A789012345')
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'cart')
})

test('trackPartnerSitePurchase sends purchase remarketing parameters', () => {
  const { gtagCalls, dataLayer } = setupMockWindow()

  const lines: PartnerSiteShopTrackingLine[] = [
    {
      itemId: sampleProduct.itemId,
      itemName: sampleProduct.itemName,
      value: 980000,
      quantity: 1,
      remarketingId: sampleProduct.remarketingId,
    },
  ]
  trackPartnerSitePurchase(mockConfig, { transactionId: 'ORDER-999', value: 980000, lines })

  const adsCall = gtagCalls.find(
    (c) => c.args[0] === 'event' && c.args[1] === 'purchase' && (c.args[2] as Record<string, unknown>)?.send_to === 'AW-18484324626'
  )
  assert.ok(adsCall, 'Must call purchase for Google Ads')
  const adsPayload = adsCall.args[2] as Record<string, unknown>
  assert.equal(adsPayload.ecomm_prodid, 'A789012345')
  assert.equal(adsPayload.ecomm_pagetype, 'purchase')
  assert.equal(adsPayload.ecomm_totalvalue, 980000)

  const dlEvent = dataLayer.find((d: any) => d && d.event === 'purchase') as any
  assert.ok(dlEvent, 'Must push purchase to dataLayer')
  assert.equal(dlEvent.ecommerce.ecomm_prodid, 'A789012345')
  assert.equal(dlEvent.ecommerce.ecomm_pagetype, 'purchase')
})

test('TikTok Pixel sends product ID (Feed ID) and order/product value across all ecommerce events', () => {
  const { ttqCalls } = setupMockWindow()

  // 1. ViewContent (single product)
  trackPartnerSiteViewItem(mockConfig, sampleProduct)
  const ttqViewItem = ttqCalls.find((c) => c.event === 'ViewContent' && c.params.content_type === 'product')
  assert.ok(ttqViewItem, 'TikTok must track ViewContent for product')
  assert.equal(ttqViewItem.params.content_id, 'A789012345')
  assert.equal(ttqViewItem.params.value, 980000)
  assert.equal(ttqViewItem.params.price, 980000)
  assert.equal(ttqViewItem.params.currency, 'VND')
  const viewContents = ttqViewItem.params.contents as Array<{ content_id: string; price: number }>
  assert.equal(viewContents[0]?.content_id, 'A789012345')
  assert.equal(viewContents[0]?.price, 980000)

  // 2. ViewContent (product list/category)
  trackPartnerSiteViewItemList(mockConfig, [
    sampleProduct,
    { itemId: 'uuid-2', itemName: 'SP2', remarketingId: 'B999', value: 200000 },
  ])
  const ttqViewList = ttqCalls.find((c) => c.event === 'ViewContent' && c.params.content_type === 'product_group')
  assert.ok(ttqViewList, 'TikTok must track ViewContent for product list')
  const listContents = ttqViewList.params.contents as Array<{ content_id: string }>
  assert.equal(listContents[0]?.content_id, 'A789012345')
  assert.equal(listContents[1]?.content_id, 'B999')

  // 3. AddToCart
  trackPartnerSiteAddToCart(mockConfig, sampleProduct, 2)
  const ttqAddToCart = ttqCalls.find((c) => c.event === 'AddToCart')
  assert.ok(ttqAddToCart, 'TikTok must track AddToCart')
  assert.equal(ttqAddToCart.params.content_id, 'A789012345')
  assert.equal(ttqAddToCart.params.value, 1960000) // 980000 * 2
  assert.equal(ttqAddToCart.params.price, 980000)
  assert.equal(ttqAddToCart.params.quantity, 2)
  assert.equal(ttqAddToCart.params.currency, 'VND')
  const cartContents = ttqAddToCart.params.contents as Array<{ content_id: string; quantity: number; price: number }>
  assert.equal(cartContents[0]?.content_id, 'A789012345')
  assert.equal(cartContents[0]?.quantity, 2)
  assert.equal(cartContents[0]?.price, 980000)

  // 4. InitiateCheckout
  const lines: PartnerSiteShopTrackingLine[] = [
    {
      itemId: sampleProduct.itemId,
      itemName: sampleProduct.itemName,
      value: 980000,
      quantity: 2,
      remarketingId: sampleProduct.remarketingId,
    },
  ]
  trackPartnerSiteBeginCheckout(mockConfig, lines)
  const ttqCheckout = ttqCalls.find((c) => c.event === 'InitiateCheckout')
  assert.ok(ttqCheckout, 'TikTok must track InitiateCheckout')
  assert.equal(ttqCheckout.params.content_id, 'A789012345')
  assert.equal(ttqCheckout.params.value, 1960000)
  assert.equal(ttqCheckout.params.num_items, 2)
  assert.equal(ttqCheckout.params.currency, 'VND')
  const checkoutContents = ttqCheckout.params.contents as Array<{ content_id: string; price: number }>
  assert.equal(checkoutContents[0]?.content_id, 'A789012345')
  assert.equal(checkoutContents[0]?.price, 980000)

  // 5. PlaceAnOrder
  trackPartnerSitePlaceOrder(mockConfig, { value: 1960000, lines, transactionId: 'ORDER-TT-01' })
  const ttqPlace = ttqCalls.find((c) => c.event === 'PlaceAnOrder')
  assert.ok(ttqPlace, 'TikTok must track PlaceAnOrder')
  assert.equal(ttqPlace.params.content_id, 'A789012345')
  assert.equal(ttqPlace.params.order_id, 'ORDER-TT-01')
  assert.equal(ttqPlace.params.value, 1960000)
  assert.equal(ttqPlace.params.num_items, 2)

  // 6. DepositPage (AddPaymentInfo)
  trackPartnerSiteDepositPage(mockConfig, { value: 600000, lines, transactionId: 'ORDER-TT-01' })
  const ttqDeposit = ttqCalls.find((c) => c.event === 'AddPaymentInfo')
  assert.ok(ttqDeposit, 'TikTok must track AddPaymentInfo on deposit page')
  assert.equal(ttqDeposit.params.content_id, 'A789012345')
  assert.equal(ttqDeposit.params.order_id, 'ORDER-TT-01')
  assert.equal(ttqDeposit.params.value, 600000)

  // 7. CompletePayment (Purchase)
  trackPartnerSitePurchase(mockConfig, { transactionId: 'ORDER-TT-PAID', value: 1960000, lines })
  const ttqPurchase = ttqCalls.find((c) => c.event === 'CompletePayment')
  assert.ok(ttqPurchase, 'TikTok must track CompletePayment')
  assert.equal(ttqPurchase.params.content_id, 'A789012345')
  assert.equal(ttqPurchase.params.order_id, 'ORDER-TT-PAID')
  assert.equal(ttqPurchase.params.value, 1960000)
  assert.equal(ttqPurchase.params.currency, 'VND')
  const purchaseContents = ttqPurchase.params.contents as Array<{ content_id: string; quantity: number }>
  assert.equal(purchaseContents[0]?.content_id, 'A789012345')
  assert.equal(purchaseContents[0]?.quantity, 2)
})

test('add to cart value is the price after sale, not the list price', () => {
  assert.equal(
    partnerShopTrackingChargedUnit({
      priceAmount: 1_130_000,
      salePriceAmount: 1_062_200,
      priceHint: '1.130.000₫',
    }),
    1_062_200
  )
  assert.equal(
    partnerShopTrackingChargedUnit({
      priceAmount: 1_130_000,
      salePriceAmount: null,
      priceHint: '1.130.000₫',
    }),
    1_130_000
  )
  assert.match(PW_SHOP_NATIVE_TRACK_JS, /sale<list/)
  const trackProduct = new Function(`${PW_SHOP_NATIVE_TRACK_JS}; return pwShopTrackProduct`)() as (
    product: Record<string, unknown>
  ) => { value: number }
  assert.equal(
    trackProduct({
      id: 'inv',
      name: 'Đầm',
      priceAmount: 1_130_000,
      salePriceAmount: 1_062_200,
      priceHint: '1.130.000₫',
      siteSalePhase: 'active',
    }).value,
    1_062_200
  )
  assert.equal(
    trackProduct({
      id: 'inv',
      name: 'Đầm',
      priceAmount: 1_130_000,
      salePriceAmount: 1_062_200,
      priceHint: '1.130.000₫',
      siteSalePhase: 'off',
    }).value,
    1_062_200
  )
  assert.equal(
    trackProduct({
      id: 'inv',
      name: 'Đầm',
      priceAmount: 1_130_000,
      salePriceAmount: null,
      priceHint: '1.130.000₫',
      siteSalePhase: 'teaser',
    }).value,
    1_130_000
  )

  const tracked = shopProductToTrackingProduct({
    id: 'inv',
    name: 'Đầm',
    priceHint: '1.130.000₫',
    priceAmount: 1_130_000,
    salePriceAmount: 1_062_200,
  } as never)
  assert.equal(tracked.value, 1_062_200)

  const { gtagCalls, dataLayer, ttqCalls } = setupMockWindow()
  trackPartnerSiteAddToCart(mockConfig, { ...sampleProduct, value: tracked.value }, 1)
  const ads = gtagCalls.find((c) => c.args[1] === 'add_to_cart')
  assert.equal((ads?.args[2] as { value?: number })?.value, 1_062_200)
  const dl = dataLayer.find((d) => (d as { event?: string }).event === 'add_to_cart') as {
    ecommerce?: { value?: number }
  }
  assert.equal(dl.ecommerce?.value, 1_062_200)
  assert.equal(ttqCalls.find((c) => c.event === 'AddToCart')?.params.value, 1_062_200)
})

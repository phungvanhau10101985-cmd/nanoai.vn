import assert from 'node:assert/strict'
import test from 'node:test'
import {
  firePartnerSiteGoogleAdsConversion,
  googleAdsRetailItem,
  retailItemId,
} from '@/lib/partner-website/shop/partner-site-shop-google-ads'
import type { PartnerSiteShopTrackingConfig } from '@/lib/partner-website/shop/partner-site-shop-tracking-types'

test('retailItemId prefers remarketing_id then inventory id', () => {
  assert.equal(retailItemId({ itemId: 'inv-1', itemName: 'Bag', value: 1, remarketingId: 'A123' }), 'A123')
  assert.equal(retailItemId({ itemId: 'inv-1', itemName: 'Bag', value: 1 }), 'inv-1')
})

test('googleAdsRetailItem stamps retail vertical', () => {
  const item = googleAdsRetailItem({ itemId: 'inv-1', itemName: 'Bag', value: 99000, remarketingId: 'A123' }, 2)
  assert.equal(item.google_business_vertical, 'retail')
  assert.equal(item.id, 'A123')
  assert.equal(item.quantity, 2)
  assert.equal(item.price, 99000)
})

test('firePartnerSiteGoogleAdsConversion uses send_to label and CwCD merchant id on purchase', () => {
  const calls: unknown[][] = []
  const gtag = (...args: unknown[]) => {
    calls.push(args)
  }
  ;(globalThis as { window?: { gtag?: typeof gtag } }).window = { gtag }
  const config: PartnerSiteShopTrackingConfig = {
    ga4MeasurementId: null,
    facebookPixelId: null,
    googleAdsId: 'AW-111',
    tiktokPixelId: null,
    adsConversionPurchase: 'AW-111/buyLabel',
    googleMerchantId: 4242,
    currency: 'VND',
  }
  firePartnerSiteGoogleAdsConversion(config, 'purchase', {
    value: 150000,
    transactionId: 'ord-1',
    items: [googleAdsRetailItem({ itemId: 'p1', itemName: 'Shoe', value: 150000, remarketingId: 'T9' })],
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0][0], 'event')
  assert.equal(calls[0][1], 'purchase')
  const body = calls[0][2] as Record<string, unknown>
  assert.equal(body.send_to, 'AW-111/buyLabel')
  assert.equal(body.transaction_id, 'ord-1')
  assert.equal(body.aw_merchant_id, 4242)
  assert.equal(body.ecomm_prodid, 'T9')
  delete (globalThis as { window?: unknown }).window
})

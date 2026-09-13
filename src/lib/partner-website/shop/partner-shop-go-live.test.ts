import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPartnerGoLiveChecklist,
  partnerGoLiveProgress,
  partnerPaymentReady,
  type PartnerGoLiveFacts,
} from '@/lib/partner-website/shop/partner-shop-go-live'

const empty: PartnerGoLiveFacts = {
  displayName: '',
  brandName: '',
  logoUrl: '',
  contactPhone: '',
  contactZaloUrl: '',
  facebookPixelId: '',
  ga4MeasurementId: '',
  tiktokPixelId: '',
  gtmContainerId: '',
  websitePublished: false,
  websiteExists: false,
  slogan: '',
  websiteLogoUrl: '',
  inventoryCount: 0,
  hasPaymentSettings: false,
  paymentReady: false,
  sepayEnabled: false,
  sepayHmacConfigured: false,
  hasCustomDomain: false,
  returnAddress: '',
}

test('payment ready: COD or bank or SePay', () => {
  assert.equal(partnerPaymentReady({ depositMode: 'none' }), true)
  assert.equal(partnerPaymentReady({ depositMode: 'percent', accountNumber: '123', accountHolder: 'A' }), true)
  assert.equal(
    partnerPaymentReady({
      depositMode: 'percent',
      sepayEnabled: true,
      sepayBankCode: 'VCB',
      sepayAccountNumber: '001',
    }),
    true
  )
  assert.equal(partnerPaymentReady({ depositMode: 'percent' }), false)
})

test('required items block go-live until website, products, payment, shipping are done', () => {
  const incomplete = buildPartnerGoLiveChecklist(empty)
  const progress = partnerGoLiveProgress(incomplete)
  assert.equal(progress.ready, false)
  assert.equal(progress.requiredDone, 0)
  assert.equal(incomplete.some((item) => item.id === 'sepay_hmac'), false)

  const ready = buildPartnerGoLiveChecklist({
    ...empty,
    displayName: 'Shop A',
    websiteExists: true,
    websitePublished: true,
    inventoryCount: 3,
    hasPaymentSettings: true,
    paymentReady: true,
    sepayEnabled: true,
    sepayHmacConfigured: false,
  })
  const next = partnerGoLiveProgress(ready)
  assert.equal(next.ready, true)
  assert.equal(ready.find((item) => item.id === 'sepay_hmac')?.done, false)
})

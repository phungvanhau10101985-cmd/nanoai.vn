import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultPartnerSaleCalendarSettings,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  applyPartnerSiteSaleToShopProduct,
  buildPartnerSiteSalePricing,
  partnerSiteSaleBannerShowsOnPage,
  partnerSiteSaleBannerText,
  partnerSiteSaleDateBadgeLabel,
  partnerSiteSalePillText,
  resolvePartnerProductSaleFace,
} from '@/lib/partner-website/promotions/partner-site-sale-display'

test('teaser keeps list price and shows expected sale without charging it', () => {
  const state = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-06T05:00:00.000Z'),
  })
  assert.equal(state.phase, 'teaser')
  const pricing = buildPartnerSiteSalePricing(1_000_000, state)
  assert.ok(pricing)
  assert.equal(pricing.phase, 'teaser')
  assert.equal(pricing.displayPrice, 1_000_000)
  assert.equal(pricing.expectedSalePrice, 940_000)
  const product = applyPartnerSiteSaleToShopProduct(
    { priceAmount: 1_000_000, salePriceAmount: null },
    state
  )
  assert.equal(product.salePriceAmount, null)
  const face = resolvePartnerProductSaleFace(product)
  assert.equal(face.kind, 'teaser')
  assert.equal(face.displayPrice, 1_000_000)
  assert.equal(face.expectedPrice, 940_000)
  assert.equal(face.badge, '9/9 - 6%')
})

test('active sale charges discounted price and uses date badge', () => {
  const state = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-09T05:00:00.000Z'),
  })
  assert.equal(state.phase, 'active')
  const product = applyPartnerSiteSaleToShopProduct(
    { priceAmount: 1_000_000, salePriceAmount: null },
    state
  )
  assert.equal(product.salePriceAmount, 940_000)
  const face = resolvePartnerProductSaleFace(product)
  assert.equal(face.kind, 'active')
  assert.equal(face.displayPrice, 940_000)
  assert.equal(face.comparePrice, 1_000_000)
  assert.equal(face.badge, '9/9 - 6%')
})

test('salePriceAmount 0 is not a discount', () => {
  const face = resolvePartnerProductSaleFace({
    priceAmount: 200_000,
    salePriceAmount: 0,
  })
  assert.equal(face.kind, null)
  assert.equal(face.displayPrice, 200_000)
  assert.equal(partnerSiteSaleDateBadgeLabel({ percent: 0 }), null)
  assert.equal(partnerSiteSaleDateBadgeLabel({ percent: 100 }), null)
})

test('clearance does not stack site sale', () => {
  const state = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-09T05:00:00.000Z'),
  })
  const product = applyPartnerSiteSaleToShopProduct(
    { priceAmount: 1_000_000, salePriceAmount: null, isClearance: true },
    state,
    { clearanceEnabled: true, clearancePercent: 60 }
  )
  assert.equal(product.siteSale, null)
  assert.equal(product.salePriceAmount, 400_000)
})

test('banner copy follows 188 teaser and active wording', () => {
  const teaser = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-06T05:00:00.000Z'),
  })
  const active = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-09T05:00:00.000Z'),
  })
  assert.match(String(partnerSiteSaleBannerText(teaser, 'vi')), /sắp diễn ra/)
  assert.match(String(partnerSiteSaleBannerText(active, 'vi')), /đang diễn ra/)
  assert.equal(partnerSiteSaleBannerShowsOnPage('home'), false)
  assert.equal(partnerSiteSaleBannerShowsOnPage('landing'), false)
  assert.equal(partnerSiteSaleBannerShowsOnPage('listing'), true)
  assert.equal(partnerSiteSaleBannerShowsOnPage('product'), true)
  assert.equal(partnerSiteSaleBannerShowsOnPage('cart'), true)
  const face = resolvePartnerProductSaleFace(
    applyPartnerSiteSaleToShopProduct({ priceAmount: 1_000_000, salePriceAmount: null }, teaser)
  )
  assert.match(String(partnerSiteSalePillText(face, 'vi')), /giảm 6%/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  defaultPartnerSaleCalendarSettings,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  applyPartnerSiteSaleToShopProduct,
  attachPartnerBirthdayOffer,
  buildPartnerSiteSalePricing,
  partnerSiteBirthdayCheckoutHint,
  partnerSiteBirthdayBadgeText,
  partnerSiteSaleBannerShowsOnPage,
  partnerSiteSaleBannerText,
  partnerSiteSaleDateBadgeLabel,
  partnerSiteSalePillText,
  PW_SITE_SALE_CARD_CSS,
  PW_SITE_SALE_MO_SKIP_JS,
  PW_SITE_SALE_TICK_CHIPS_JS,
  resolvePartnerProductSaleFace,
  writePartnerSaleCountdownNode,
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
  assert.equal(face.badge, 'Sale 9/9 - 6%')
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
  assert.equal(face.badge, 'Sale 9/9 - 6%')
})

test('flash sale uses Flash sale -N% badge', () => {
  assert.equal(partnerSiteSaleDateBadgeLabel({ percent: 5, kind: 'flash' }), 'Flash sale -5%')
  assert.equal(partnerSiteSaleDateBadgeLabel({ percent: 6, eventLabel: 'Flash sale' }), 'Flash sale -6%')
  const face = resolvePartnerProductSaleFace({
    priceAmount: 1_000_000,
    salePriceAmount: 950_000,
    siteSale: {
      kind: 'flash',
      listPrice: 1_000_000,
      displayPrice: 950_000,
      savingsAmount: 50_000,
      percent: 5,
      phase: 'active',
      expectedSalePrice: null,
      eventLabel: 'Flash sale',
      eventDate: null,
      countdownTo: '2099-09-07T04:10:00.000Z',
    },
  })
  assert.equal(face.kind, 'active')
  assert.equal(face.badge, 'Flash sale -5%')
  const expired = resolvePartnerProductSaleFace({
    priceAmount: 1_000_000,
    salePriceAmount: 950_000,
    siteSale: {
      kind: 'flash',
      listPrice: 1_000_000,
      displayPrice: 950_000,
      savingsAmount: 50_000,
      percent: 5,
      phase: 'active',
      expectedSalePrice: null,
      eventLabel: 'Flash sale',
      eventDate: null,
      countdownTo: '2020-09-07T04:10:00.000Z',
    },
  })
  assert.equal(expired.kind, null)
  assert.equal(expired.displayPrice, 1_000_000)
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
  assert.equal(product.siteSale?.kind, 'clearance')
  assert.equal(product.salePriceAmount, 400_000)
  const face = resolvePartnerProductSaleFace(product)
  assert.equal(face.badge, 'Sale thanh lý kho -60%')
  assert.equal(face.promoKind, 'clearance')
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
  assert.equal(partnerSiteSaleBannerShowsOnPage('home'), true)
  assert.equal(partnerSiteSaleBannerShowsOnPage('landing'), false)
  assert.equal(partnerSiteSaleBannerShowsOnPage('listing'), true)
  assert.equal(partnerSiteSaleBannerShowsOnPage('product'), true)
  assert.equal(partnerSiteSaleBannerShowsOnPage('cart'), true)
  const face = resolvePartnerProductSaleFace(
    applyPartnerSiteSaleToShopProduct({ priceAmount: 1_000_000, salePriceAmount: null }, teaser)
  )
  assert.match(String(partnerSiteSalePillText(face, 'vi')), /giảm 6%/)
})

test('birthday offer is a checkout hint and does not change unit price', () => {
  const state = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-09T05:00:00.000Z'),
  })
  const product = applyPartnerSiteSaleToShopProduct(
    { priceAmount: 1_000_000, salePriceAmount: null },
    state
  )
  const withBirthday = attachPartnerBirthdayOffer(product, 10)
  assert.equal(withBirthday.salePriceAmount, 940_000)
  assert.equal(withBirthday.birthdayOfferPercent, 10)
  const face = resolvePartnerProductSaleFace(withBirthday)
  assert.equal(face.displayPrice, 940_000)
  assert.match(String(partnerSiteBirthdayCheckoutHint(10, 'vi')), /CMSN/)
  assert.match(String(partnerSiteBirthdayCheckoutHint(10, 'vi')), /thanh toán/)
  assert.equal(partnerSiteBirthdayBadgeText(10, 'vi'), 'CMSN -10%')
  const clearance = attachPartnerBirthdayOffer(
    { priceAmount: 1_000_000, isClearance: true, salePriceAmount: 400_000 },
    10
  )
  assert.equal(clearance.birthdayOfferPercent, 0)
})

test('sale countdown tick updates text nodes and skips banner hosts', () => {
  assert.match(PW_SITE_SALE_TICK_CHIPS_JS, /\.pw-sale-chip\[data-pw-sale-countdown\]/)
  assert.match(PW_SITE_SALE_TICK_CHIPS_JS, /data-pw-sale-calendar-banner/)
  assert.match(PW_SITE_SALE_TICK_CHIPS_JS, /nodeValue/)
  assert.match(PW_SITE_SALE_TICK_CHIPS_JS, /pwSaleInView/)
  assert.match(PW_SITE_SALE_MO_SKIP_JS, /\[data-pw-sale-hms\]/)
  assert.match(PW_SITE_SALE_CARD_CSS, /tabular-nums/)
  assert.match(PW_SITE_SALE_CARD_CSS, /contain:layout style paint/)
  assert.match(PW_SITE_SALE_CARD_CSS, /min-width:11ch/)
  const text = { nodeType: 3, nodeValue: '01:00:00', nextSibling: null }
  const el = { firstChild: text, textContent: '01:00:00' }
  writePartnerSaleCountdownNode(el as unknown as Element, '00:59:59')
  assert.equal(text.nodeValue, '00:59:59')
})

test('expired inventory sale window returns the list price on storefront and cart overlay', () => {
  const off = resolvePartnerSaleCalendarState({
    settings: defaultPartnerSaleCalendarSettings(),
    at: new Date('2026-09-20T05:00:00.000Z'),
  })
  assert.equal(off.phase, 'off')
  const expired = applyPartnerSiteSaleToShopProduct(
    {
      priceAmount: 1_000_000,
      salePriceAmount: 800_000,
      saleStartsAt: '2020-01-01T00:00:00.000Z',
      saleEndsAt: '2020-01-02T00:00:00.000Z',
    },
    off
  )
  assert.equal(expired.salePriceAmount, null)
  const expiredFace = resolvePartnerProductSaleFace(expired)
  assert.equal(expiredFace.kind, null)
  assert.equal(expiredFace.displayPrice, 1_000_000)

  const live = applyPartnerSiteSaleToShopProduct(
    {
      priceAmount: 1_000_000,
      salePriceAmount: 800_000,
      saleStartsAt: '2020-01-01T00:00:00.000Z',
      saleEndsAt: '2099-01-01T00:00:00.000Z',
    },
    off
  )
  assert.equal(live.salePriceAmount, 800_000)
  const liveFace = resolvePartnerProductSaleFace(live)
  assert.equal(liveFace.kind, 'active')
  assert.equal(liveFace.displayPrice, 800_000)
})

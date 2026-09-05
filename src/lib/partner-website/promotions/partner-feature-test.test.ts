import assert from 'node:assert/strict'
import test from 'node:test'
import {
  birthdayPercentForFeatureTest,
  findMatchingFeatureTestRow,
  isBirthdayPromoTestActive,
  isPartnerFeatureTestUnexpired,
  isSiteSaleTestActive,
  matchesFeatureTestTarget,
  PARTNER_FEATURE_TEST_DEFAULT_BIRTHDAY_PERCENT,
  partnerFeatureTestExpiresAt,
} from '@/lib/partner-website/promotions/partner-feature-test'
import {
  applyPartnerFeatureTestToSaleCalendar,
  applyPartnerSiteSalePrice,
  buildPartnerSiteSaleTestState,
  defaultPartnerSaleCalendarSettings,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'

test('feature test matches only the configured shop login email', () => {
  assert.equal(
    matchesFeatureTestTarget({ configuredTestEmail: 'Test@Shop.com', visitorEmail: 'test@shop.com' }),
    true
  )
  assert.equal(
    matchesFeatureTestTarget({ configuredTestEmail: 'a@shop.com', visitorEmail: 'b@shop.com' }),
    false
  )
  assert.equal(
    matchesFeatureTestTarget({ configuredTestEmail: '', visitorEmail: 'a@shop.com' }),
    false
  )
})

test('feature test expiry uses UTC timestamps and treats past as off', () => {
  const now = new Date('2026-09-05T10:00:00.000Z')
  assert.equal(isPartnerFeatureTestUnexpired(new Date(now.getTime() + 60_000).toISOString(), now), true)
  assert.equal(isPartnerFeatureTestUnexpired(new Date(now.getTime() - 1000).toISOString(), now), false)
  assert.equal(isPartnerFeatureTestUnexpired(null, now), false)
  const expires = partnerFeatureTestExpiresAt(true, now)
  assert.ok(expires)
  assert.equal(new Date(expires).getTime(), now.getTime() + 10 * 60_000)
  assert.equal(partnerFeatureTestExpiresAt(false, now), null)
})

test('active site-sale test uses today and current-month percent', () => {
  const settings = defaultPartnerSaleCalendarSettings()
  const state = buildPartnerSiteSaleTestState({
    settings,
    phase: 'active',
    at: new Date('2026-09-05T05:00:00.000Z'),
  })
  assert.equal(state.isTest, true)
  assert.equal(state.phase, 'active')
  assert.equal(state.localDate, '2026-09-05')
  assert.equal(state.saleDate, '2026-09-05')
  assert.equal(state.daysUntilSale, 0)
  assert.equal(state.discountPercent, 6)
  assert.match(state.eventLabel, /^\[Test\] Sale 5\/9$/)
  assert.equal(applyPartnerSiteSalePrice(100_000, state), 94_000)
})

test('teaser site-sale test is T-N with no price drop', () => {
  const settings = defaultPartnerSaleCalendarSettings()
  const state = buildPartnerSiteSaleTestState({
    settings,
    phase: 'teaser',
    at: new Date('2026-09-05T05:00:00.000Z'),
  })
  assert.equal(state.phase, 'teaser')
  assert.equal(state.saleDate, '2026-09-08')
  assert.equal(state.daysUntilSale, 3)
  assert.equal(applyPartnerSiteSalePrice(100_000, state), 100_000)
})

test('visitor-matched test overrides the real calendar; feed helper stays real', () => {
  const settings = defaultPartnerSaleCalendarSettings()
  const real = resolvePartnerSaleCalendarState({
    settings,
    at: new Date('2026-09-05T05:00:00.000Z'),
  })
  assert.equal(real.phase, 'off')
  assert.equal(real.isTest, false)

  const tested = applyPartnerFeatureTestToSaleCalendar({
    settings,
    testPhase: 'active',
    at: new Date('2026-09-05T05:00:00.000Z'),
  })
  assert.equal(tested.phase, 'active')
  assert.equal(tested.isTest, true)

  const unmatched = applyPartnerFeatureTestToSaleCalendar({
    settings,
    testPhase: null,
    at: new Date('2026-09-05T05:00:00.000Z'),
  })
  assert.equal(unmatched.phase, real.phase)
  assert.equal(unmatched.isTest, false)
})

test('birthday test percent uses shop setting or the 188 default 10', () => {
  assert.equal(birthdayPercentForFeatureTest(15), 15)
  assert.equal(birthdayPercentForFeatureTest(0), PARTNER_FEATURE_TEST_DEFAULT_BIRTHDAY_PERCENT)
  assert.equal(birthdayPercentForFeatureTest(null), PARTNER_FEATURE_TEST_DEFAULT_BIRTHDAY_PERCENT)
})

test('active test rows match visitor email and ignore expired flags', () => {
  const now = new Date('2026-09-05T10:00:00.000Z')
  const row = {
    testEmail: 'guest@shop.com',
    birthdayPromoEnabled: true,
    birthdayPromoExpiresAt: new Date(now.getTime() + 60_000).toISOString(),
    siteSaleTestEnabled: true,
    siteSaleTestExpiresAt: new Date(now.getTime() - 1000).toISOString(),
  }
  assert.equal(isBirthdayPromoTestActive(row, now), true)
  assert.equal(isSiteSaleTestActive(row, now), false)
  assert.equal(findMatchingFeatureTestRow([row], 'guest@shop.com')?.testEmail, 'guest@shop.com')
  assert.equal(findMatchingFeatureTestRow([row], 'other@shop.com'), null)
})

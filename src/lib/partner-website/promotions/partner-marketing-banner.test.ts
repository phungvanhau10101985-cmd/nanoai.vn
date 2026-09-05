import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerMarketingBannerPrompt,
  fallbackPartnerMarketingBannerCopy,
  isPartnerMarketingBannerKind,
  isValidPartnerMarketingBannerDayMonth,
  parsePartnerMarketingBannerDateKey,
  partnerMarketingBannerCampaignKey,
  partnerMarketingBannerDateKey,
  partnerMarketingBannerGreeting,
  personalizeBannerToApiKind,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import {
  listUpcomingPartnerSaleEvents,
  partnerSalePercentForSameDayMonth,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'

test('campaign key is stable per kind/date/percent', () => {
  assert.equal(partnerMarketingBannerCampaignKey('sale', 9, 9, 8), 'sale-09-09-p8')
  assert.equal(partnerMarketingBannerCampaignKey('birthday', 5, 9, 10), 'birthday-09-05-p10')
  assert.equal(partnerMarketingBannerDateKey(5, 9), '09-05')
  assert.deepEqual(parsePartnerMarketingBannerDateKey('09-05'), { day: 5, month: 9 })
  assert.deepEqual(parsePartnerMarketingBannerDateKey('02-29'), { day: 29, month: 2 })
  assert.equal(parsePartnerMarketingBannerDateKey('9/5'), null)
  assert.equal(parsePartnerMarketingBannerDateKey('02-31'), null)
  assert.equal(isValidPartnerMarketingBannerDayMonth(31, 1), true)
  assert.equal(isValidPartnerMarketingBannerDayMonth(31, 2), false)
  assert.equal(isPartnerMarketingBannerKind('sale'), true)
  assert.equal(isPartnerMarketingBannerKind('hero'), false)
  assert.equal(personalizeBannerToApiKind('sale-calendar'), 'sale')
  assert.equal(personalizeBannerToApiKind('birthday'), 'birthday')
  assert.equal(personalizeBannerToApiKind('hero'), null)
})

test('sale AI banner only accepts same-day-same-month', () => {
  const settings = {
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    teaserDays: 3,
    oddMonthDiscountPercent: 6,
    evenMonthDiscountPercent: 8,
    manualSaleDate: null,
    manualDiscountPercent: null,
    monthRules: {},
  }
  assert.equal(partnerSalePercentForSameDayMonth(settings, 9, 9), 6)
  assert.equal(partnerSalePercentForSameDayMonth(settings, 8, 8), 8)
  assert.equal(partnerSalePercentForSameDayMonth(settings, 15, 3), null)
})

test('upcoming sale events skip past days in the current month', () => {
  const settings = {
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    teaserDays: 3,
    oddMonthDiscountPercent: 6,
    evenMonthDiscountPercent: 8,
    manualSaleDate: null,
    manualDiscountPercent: null,
    monthRules: {},
  }
  const events = listUpcomingPartnerSaleEvents({
    settings,
    at: new Date('2026-09-10T03:00:00+07:00'),
    limit: 3,
  })
  assert.equal(events[0]?.eventDate, '2026-10-10')
  assert.equal(events[0]?.sameDayMonth, true)
  assert.equal(events[0]?.discountPercent, 8)
})

test('sale calendar teaser/active still resolve independently of banners', () => {
  const state = resolvePartnerSaleCalendarState({
    settings: {
      enabled: true,
      timezone: 'Asia/Ho_Chi_Minh',
      teaserDays: 3,
      oddMonthDiscountPercent: 6,
      evenMonthDiscountPercent: 8,
      manualSaleDate: null,
      manualDiscountPercent: null,
      monthRules: {},
    },
    at: new Date('2026-09-09T10:00:00+07:00'),
  })
  assert.equal(state.phase, 'active')
  assert.equal(state.discountPercent, 6)
})

test('image prompt locks date and percent and uses shop theme colors', () => {
  const copy = fallbackPartnerMarketingBannerCopy({ kind: 'sale', day: 9, month: 9, version: 2 })
  const prompt = buildPartnerMarketingBannerPrompt({
    kind: 'sale',
    day: 9,
    month: 9,
    discountPercent: 6,
    brand: {
      shopName: 'Demo Shop',
      industryKey: 'fashion',
      primaryColor: '#0f766e',
      accentColor: '#115e59',
      buyButtonColor: '#0f766e',
      logoUrl: null,
    },
    copy,
  })
  assert.match(prompt, /21:9/)
  assert.match(prompt, /SALE 9\.9 - GIẢM 6%/)
  assert.match(prompt, /#0f766e/)
  assert.match(prompt, /Demo Shop/)
  assert.doesNotMatch(prompt, /188\.com\.vn/)
  assert.doesNotMatch(prompt, /#f97316/)
})

test('birthday greeting is locale-aware', () => {
  assert.match(partnerMarketingBannerGreeting('vi', 'Lan'), /Lan/)
  assert.match(partnerMarketingBannerGreeting('en', 'Lan'), /Lan/)
})

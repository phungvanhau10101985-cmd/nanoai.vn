import assert from 'node:assert/strict'
import test from 'node:test'
import {
  holidayYmdFromDate,
  isPartnerHolidayThemeId,
  PARTNER_HOLIDAY_BANNER_HEADLINES,
  PARTNER_HOLIDAY_CATALOG,
  partnerHolidayBannerHeadline,
  partnerHolidaySaleSpan,
  resolvePartnerHolidaySale,
  resolveVisiblePartnerHoliday,
  type PartnerHolidayRule,
  type PartnerHolidayYmd,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'
import { lunarToSolar } from '@/lib/partner-website/promotions/partner-lunar-calendar'
import {
  issuePartnerHolidayPreviewToken,
  parsePartnerHolidayPreviewToken,
} from '@/lib/partner-website/promotions/partner-holiday-preview'

function ymd(year: number, month: number, day: number): PartnerHolidayYmd {
  return { year, month, day }
}

function withSale(rule: PartnerHolidayRule, patch: Partial<PartnerHolidayRule>): PartnerHolidayRule {
  return { ...rule, ...patch }
}

test('lunar 1/1/2027 is 6 Feb 2027', () => {
  const solar = lunarToSolar(1, 1, 2027, 0)
  assert.deepEqual(solar, { year: 2027, month: 2, day: 6 })
})

test('lunar 12/23/2026 is 30 Jan 2027', () => {
  const solar = lunarToSolar(23, 12, 2026, 0)
  assert.deepEqual(solar, { year: 2027, month: 1, day: 30 })
})

test('inner festival day interrupts outer then returns', () => {
  const rules = Object.values(PARTNER_HOLIDAY_CATALOG)
  const tao = resolveVisiblePartnerHoliday(rules, ymd(2027, 1, 30))
  assert.equal(tao?.code, 'tao-quan')
  assert.equal(tao?.mode, 'active')
  const back = resolveVisiblePartnerHoliday(rules, ymd(2027, 1, 31))
  assert.equal(back?.code, 'tet')
  assert.equal(back?.mode, 'teaser')
  const tetDay = resolveVisiblePartnerHoliday(rules, ymd(2027, 2, 6))
  assert.equal(tetDay?.code, 'tet')
  assert.equal(tetDay?.mode, 'active')
})

test('sale span empty means holiday dates only', () => {
  const rule = PARTNER_HOLIDAY_CATALOG['giang-sinh']
  const [start, end] = partnerHolidaySaleSpan(rule, ymd(2026, 12, 24), ymd(2026, 12, 25))
  assert.deepEqual(start, ymd(2026, 12, 24))
  assert.deepEqual(end, ymd(2026, 12, 25))

  const before = withSale(rule, { saleLeadDays: 3, saleDays: null })
  const [bStart, bEnd] = partnerHolidaySaleSpan(before, ymd(2026, 12, 24), ymd(2026, 12, 25))
  assert.deepEqual(bStart, ymd(2026, 12, 21))
  assert.deepEqual(bEnd, ymd(2026, 12, 25))

  const duration = withSale(rule, { saleLeadDays: 0, saleDays: 5 })
  const [dStart, dEnd] = partnerHolidaySaleSpan(duration, ymd(2026, 12, 24), ymd(2026, 12, 25))
  assert.deepEqual(dStart, ymd(2026, 12, 24))
  assert.deepEqual(dEnd, ymd(2026, 12, 28))

  const both = withSale(rule, { saleLeadDays: 3, saleDays: 5 })
  const [bothStart, bothEnd] = partnerHolidaySaleSpan(both, ymd(2026, 12, 24), ymd(2026, 12, 25))
  assert.deepEqual(bothStart, ymd(2026, 12, 21))
  assert.deepEqual(bothEnd, ymd(2026, 12, 25))
})

test('sale before holiday is active while theme is teaser', () => {
  const rule = withSale(PARTNER_HOLIDAY_CATALOG['giang-sinh'], { saleLeadDays: 3, salePercent: 10 })
  const vis = resolveVisiblePartnerHoliday([rule], ymd(2026, 12, 21))
  assert.equal(vis?.mode, 'teaser')
  assert.equal(vis?.salePhase, 'active')
  assert.deepEqual(vis?.saleStart, ymd(2026, 12, 21))
  assert.deepEqual(vis?.saleEnd, ymd(2026, 12, 25))

  const teaser = resolveVisiblePartnerHoliday([rule], ymd(2026, 12, 20))
  assert.equal(teaser?.salePhase, 'teaser')
})

test('sale continues after theme window', () => {
  const rule = withSale(PARTNER_HOLIDAY_CATALOG.valentine, {
    leadDays: 0,
    afterDays: 0,
    saleDays: 3,
    salePercent: 8,
  })
  assert.equal(resolveVisiblePartnerHoliday([rule], ymd(2027, 2, 15)), null)
  const sale = resolvePartnerHolidaySale([rule], ymd(2027, 2, 15))
  assert.equal(sale?.salePhase, 'active')
  assert.deepEqual(sale?.saleStart, ymd(2027, 2, 14))
  assert.deepEqual(sale?.saleEnd, ymd(2027, 2, 16))
})

test('holiday without percent keeps theme but not sale', () => {
  const rule = withSale(PARTNER_HOLIDAY_CATALOG.valentine, { salePercent: 0 })
  const vis = resolveVisiblePartnerHoliday([rule], ymd(2027, 2, 14))
  assert.equal(vis?.code, 'valentine')
  assert.equal(vis?.salePhase, null)
})

test('banner headlines cover catalog without dates', () => {
  assert.deepEqual(Object.keys(PARTNER_HOLIDAY_BANNER_HEADLINES).sort(), Object.keys(PARTNER_HOLIDAY_CATALOG).sort())
  for (const [code, headline] of Object.entries(PARTNER_HOLIDAY_BANNER_HEADLINES)) {
    assert.equal(partnerHolidayBannerHeadline(code), headline)
    assert.equal(/\d/.test(headline), false)
    assert.equal(headline.startsWith('SALE '), true)
  }
})

test('holiday preview token roundtrip and rejects tamper', () => {
  const { token, expiresAt } = issuePartnerHolidayPreviewToken('duong-lich', 1_700_000_000)
  assert.deepEqual(parsePartnerHolidayPreviewToken(token, 1_700_000_000), {
    code: 'duong-lich',
    expiresAt,
  })
  assert.equal(parsePartnerHolidayPreviewToken(token, expiresAt), null)
  const flipped = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
  assert.equal(parsePartnerHolidayPreviewToken(flipped, 1_700_000_000), null)
  assert.equal(isPartnerHolidayThemeId('christmas'), false)
})

test('holidayYmdFromDate keeps UTC calendar day', () => {
  assert.deepEqual(holidayYmdFromDate(new Date(Date.UTC(2026, 11, 24))), ymd(2026, 12, 24))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPartnerMarketingBannerPrompt,
  composePartnerMarketingBannerSlides,
  fallbackPartnerMarketingBannerCopy,
  isPartnerMarketingBannerKind,
  isValidPartnerMarketingBannerDayMonth,
  newPartnerMarketingBannerRegularCampaignKey,
  parsePartnerMarketingBannerDateKey,
  partnerMarketingBannerCampaignKey,
  partnerMarketingBannerDateKey,
  partnerMarketingBannerDateKeyForKind,
  partnerMarketingBannerGreeting,
  partnerMarketingBannerPublicHref,
  partnerMarketingBannerVisitorCanSeeBirthday,
  personalizeBannerToApiKind,
  PARTNER_MARKETING_BANNER_CAROUSEL_MS,
  PARTNER_MARKETING_BANNER_REGULAR_DATE_KEY,
  PARTNER_MARKETING_BANNER_SLIDE_ORDER,
  PARTNER_MARKETING_BANNER_WAREHOUSE_DATE_KEY,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import {
  listUpcomingPartnerSaleEvents,
  partnerSalePercentForSameDayMonth,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'

test('campaign key is stable per kind/date/percent', () => {
  assert.equal(partnerMarketingBannerCampaignKey('sale', 9, 9, 8), 'sale-09-09-p8')
  assert.equal(partnerMarketingBannerCampaignKey('birthday', 5, 9, 10), 'birthday-09-05-p10')
  assert.equal(partnerMarketingBannerCampaignKey('warehouse', 0, 0, 12), 'warehouse-p12')
  assert.equal(partnerMarketingBannerCampaignKey('warehouse', 0, 0, 12.5), 'warehouse-p12_5')
  assert.equal(partnerMarketingBannerDateKey(5, 9), '09-05')
  assert.equal(partnerMarketingBannerDateKeyForKind('warehouse', 9, 9), PARTNER_MARKETING_BANNER_WAREHOUSE_DATE_KEY)
  assert.equal(partnerMarketingBannerDateKeyForKind('regular', 9, 9), PARTNER_MARKETING_BANNER_REGULAR_DATE_KEY)
  assert.match(newPartnerMarketingBannerRegularCampaignKey(), /^regular-[0-9a-f-]{36}$/i)
  assert.equal(partnerMarketingBannerPublicHref('warehouse', 'demo-shop'), '/site/demo-shop/kho-sale')
  assert.equal(partnerMarketingBannerPublicHref('sale', 'demo-shop'), '/site/demo-shop/products')
  assert.equal(partnerMarketingBannerPublicHref('regular', 'demo-shop'), '/site/demo-shop/products')
  assert.deepEqual(parsePartnerMarketingBannerDateKey('09-05'), { day: 5, month: 9 })
  assert.deepEqual(parsePartnerMarketingBannerDateKey('02-29'), { day: 29, month: 2 })
  assert.equal(parsePartnerMarketingBannerDateKey('9/5'), null)
  assert.equal(parsePartnerMarketingBannerDateKey('02-31'), null)
  assert.equal(isValidPartnerMarketingBannerDayMonth(31, 1), true)
  assert.equal(isValidPartnerMarketingBannerDayMonth(31, 2), false)
  assert.equal(isPartnerMarketingBannerKind('sale'), true)
  assert.equal(isPartnerMarketingBannerKind('warehouse'), true)
  assert.equal(isPartnerMarketingBannerKind('regular'), true)
  assert.equal(isPartnerMarketingBannerKind('hero'), false)
  assert.equal(personalizeBannerToApiKind('sale-calendar'), 'sale')
  assert.equal(personalizeBannerToApiKind('birthday'), 'birthday')
  assert.equal(personalizeBannerToApiKind('promo'), null)
  assert.equal(personalizeBannerToApiKind('hero'), null)
  assert.equal(PARTNER_MARKETING_BANNER_CAROUSEL_MS, 6500)
  assert.deepEqual([...PARTNER_MARKETING_BANNER_SLIDE_ORDER], ['birthday', 'sale', 'warehouse', 'regular'])
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

test('guest visitors do not get a CMSN slide; login or test email can', () => {
  assert.equal(partnerMarketingBannerVisitorCanSeeBirthday({}), false)
  assert.equal(partnerMarketingBannerVisitorCanSeeBirthday({ linkedUserId: '', guestAccountId: '  ' }), false)
  assert.equal(partnerMarketingBannerVisitorCanSeeBirthday({ guestAccountId: 'guest-1' }), true)
  assert.equal(partnerMarketingBannerVisitorCanSeeBirthday({ linkedUserId: 'user-1' }), true)
})

test('resolveCurrent appends slides in 188 order then regular last', () => {
  const slide = (kind: 'birthday' | 'sale' | 'warehouse' | 'regular', id: string) => ({
    id,
    kind,
    campaign_key: `${kind}-x`,
    date_key: kind === 'warehouse' ? 'kho' : kind === 'regular' ? 'always' : '09-09',
    discount_percent: kind === 'regular' ? 0 : 10,
    image_url: `https://cdn.example/${id}.png`,
    aspect_ratio: '21:9',
    event_date: null,
    greeting: kind === 'birthday' ? 'Hi' : null,
    version: 1,
    href: partnerMarketingBannerPublicHref(kind, 'demo-shop'),
  })
  const items = composePartnerMarketingBannerSlides({
    birthday: slide('birthday', 'b'),
    sale: slide('sale', 's'),
    warehouse: slide('warehouse', 'w'),
    regulars: [slide('regular', 'r1'), slide('regular', 'r2')],
  })
  assert.deepEqual(
    items.map((item) => item.kind),
    ['birthday', 'sale', 'warehouse', 'regular', 'regular']
  )
  assert.equal(items[2]?.href, '/site/demo-shop/kho-sale')
  assert.equal(items[3]?.href, '/site/demo-shop/products')
  assert.deepEqual(
    composePartnerMarketingBannerSlides({ warehouse: slide('warehouse', 'w') }).map((item) => item.kind),
    ['warehouse']
  )
})

test('warehouse and regular image prompts skip locked sale dates', () => {
  const brand = {
    shopName: 'Demo Shop',
    industryKey: 'fashion' as const,
    primaryColor: '#0f766e',
    accentColor: '#115e59',
    buyButtonColor: '#0f766e',
    logoUrl: null,
  }
  const warehouse = buildPartnerMarketingBannerPrompt({
    kind: 'warehouse',
    day: 0,
    month: 0,
    discountPercent: 15,
    brand,
    copy: fallbackPartnerMarketingBannerCopy({ kind: 'warehouse', day: 1, month: 1, version: 1 }),
  })
  assert.match(warehouse, /SALE KHO - GIẢM 15%/)
  assert.match(warehouse, /Không ghi ngày tháng/)
  assert.doesNotMatch(warehouse, /SALE 0\.0/)
  const regular = buildPartnerMarketingBannerPrompt({
    kind: 'regular',
    day: 0,
    month: 0,
    discountPercent: 0,
    brand,
    copy: fallbackPartnerMarketingBannerCopy({ kind: 'regular', day: 1, month: 1, version: 1 }),
  })
  assert.match(regular, /không ghi ngày sale/)
  assert.match(regular, /không ghi SALE KHO hay MỪNG SINH NHẬT/)
  assert.doesNotMatch(regular, /Bắt buộc ghi nguyên văn: "SALE KHO/)
  assert.doesNotMatch(regular, /Bắt buộc ghi nguyên văn: "MỪNG SINH NHẬT/)
})

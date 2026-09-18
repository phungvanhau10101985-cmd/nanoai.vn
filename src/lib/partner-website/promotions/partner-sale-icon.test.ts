import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPartnerSaleIconToTheme,
  buildPartnerSaleIconPrompt,
  isPartnerSaleIconSameDayMonth,
  parsePartnerSaleIconYmd,
  partnerSaleIconCacheToken,
  partnerSaleIconDateKey,
  partnerShopSaleIconSourceUrls,
  shouldUsePartnerSaleIcon,
} from '@/lib/partner-website/promotions/partner-sale-icon'
import { DEFAULT_PARTNER_WEBSITE_THEME } from '@/lib/partner-website/template/partner-website-template-types'

test('sale icon only for same-day-same-month teaser/active', () => {
  assert.equal(isPartnerSaleIconSameDayMonth(9, 9), true)
  assert.equal(isPartnerSaleIconSameDayMonth(8, 8), true)
  assert.equal(isPartnerSaleIconSameDayMonth(28, 2), false)
  assert.equal(isPartnerSaleIconSameDayMonth(15, 3), false)
  assert.deepEqual(parsePartnerSaleIconYmd('2026-09-09'), { day: 9, month: 9 })
  assert.equal(partnerSaleIconDateKey(9, 9), '09-09')
  assert.equal(
    shouldUsePartnerSaleIcon({ auto: true, phase: 'teaser', saleDate: '2026-09-09' }),
    true
  )
  assert.equal(
    shouldUsePartnerSaleIcon({ auto: true, phase: 'active', saleDate: '2026-09-09' }),
    true
  )
  assert.equal(
    shouldUsePartnerSaleIcon({ auto: false, phase: 'active', saleDate: '2026-09-09' }),
    false
  )
  assert.equal(
    shouldUsePartnerSaleIcon({ auto: true, phase: 'off', saleDate: '2026-09-09' }),
    false
  )
  assert.equal(
    shouldUsePartnerSaleIcon({ auto: true, phase: 'active', saleDate: '2026-09-18' }),
    false
  )
})

test('sale icon overlay writes both favicon and PWA avatar', () => {
  const next = applyPartnerSaleIconToTheme(
    { ...DEFAULT_PARTNER_WEBSITE_THEME, faviconUrl: 'https://cdn.example/fav.png' },
    'https://cdn.example/sale-9-9.png'
  )
  assert.equal(next.faviconUrl, 'https://cdn.example/sale-9-9.png')
  assert.equal(next.pwaIconUrl, 'https://cdn.example/sale-9-9.png')
  assert.equal(applyPartnerSaleIconToTheme(DEFAULT_PARTNER_WEBSITE_THEME, 'not-a-url').faviconUrl, null)
  assert.equal(partnerSaleIconCacheToken(null), 'off')
  assert.match(partnerSaleIconCacheToken('https://cdn.example/sale-9-9.png'), /^on-/)
})

test('sale icon prompt keeps shop mark and asks for a square badge', () => {
  const prompt = buildPartnerSaleIconPrompt({
    shopName: '188',
    day: 9,
    month: 9,
    discountPercent: 6,
    primaryColor: '#0f766e',
    hasReference: true,
  })
  assert.match(prompt, /Square 1:1/)
  assert.match(prompt, /9\/9/)
  assert.match(prompt, /favicon/)
  assert.match(prompt, /web-app avatar/)
  assert.match(prompt, /Not a 21:9 banner/)
  assert.deepEqual(
    partnerShopSaleIconSourceUrls({
      faviconUrl: 'https://cdn.example/fav.png',
      pwaIconUrl: 'https://cdn.example/pwa.png',
      logoUrl: 'https://cdn.example/fav.png',
    }),
    ['https://cdn.example/fav.png', 'https://cdn.example/pwa.png']
  )
})

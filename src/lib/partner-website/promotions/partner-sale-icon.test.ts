import assert from 'node:assert/strict'
import test from 'node:test'
import {
  applyPartnerSaleIconToTheme,
  isPartnerSaleIconSameDayMonth,
  parsePartnerSaleIconYmd,
  partnerSaleIconCacheToken,
  partnerSaleIconDateKey,
  partnerSaleIconDateLabel,
  partnerSaleIconLayoutIsCurrent,
  PARTNER_SALE_ICON_LAYOUT_ID,
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

test('sale icon date label is day/month and layout id rejects the old AI prompt', () => {
  assert.equal(partnerSaleIconDateLabel(10, 10), '10/10')
  assert.equal(partnerSaleIconLayoutIsCurrent(PARTNER_SALE_ICON_LAYOUT_ID), true)
  assert.equal(
    partnerSaleIconLayoutIsCurrent('Square 1:1 app icon and favicon. Add one compact SALE badge.'),
    false
  )
  assert.deepEqual(
    partnerShopSaleIconSourceUrls({
      faviconUrl: 'https://cdn.example/fav.png',
      pwaIconUrl: 'https://cdn.example/pwa.png',
      logoUrl: 'https://cdn.example/fav.png',
    }),
    ['https://cdn.example/fav.png', 'https://cdn.example/pwa.png']
  )
})

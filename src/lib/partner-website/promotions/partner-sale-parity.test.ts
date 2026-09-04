import assert from 'node:assert/strict'
import test from 'node:test'
import { generateKeyPairSync, sign } from 'node:crypto'
import {
  applyPartnerSiteSalePrice,
  defaultPartnerSaleCalendarSettings,
  resolvePartnerSaleCalendarState,
} from '@/lib/partner-website/promotions/partner-sale-calendar'
import {
  PARTNER_ORDER_MAX_DISCOUNT_PERCENT,
  resolvePartnerSaleDiscountBreakdown,
} from '@/lib/partner-website/promotions/partner-sale-pricing'
import {
  googleDiscountLockExpiresAt,
  verifyGoogleAutomatedDiscountToken,
} from '@/lib/partner-website/promotions/google-automated-discount'
import {
  birthdayCampaignKey,
  daysUntilNextBirthday,
  isInBirthdayOfferWindow,
} from '@/lib/messaging/birthday-promo-interest-inventory-ids'

test('same-day sale uses odd/even month percentage and T-3 teaser', () => {
  const settings = defaultPartnerSaleCalendarSettings()
  const teaser = resolvePartnerSaleCalendarState({
    settings,
    at: new Date('2026-09-06T05:00:00.000Z'),
  })
  assert.equal(teaser.localDate, '2026-09-06')
  assert.equal(teaser.saleDate, '2026-09-09')
  assert.equal(teaser.phase, 'teaser')
  assert.equal(teaser.discountPercent, 6)

  const active = resolvePartnerSaleCalendarState({
    settings,
    at: new Date('2026-08-08T05:00:00.000Z'),
  })
  assert.equal(active.phase, 'active')
  assert.equal(active.discountPercent, 8)
  assert.equal(applyPartnerSiteSalePrice(100_000, active), 92_000)
})

test('sale day is clamped to last day for defensive month handling', () => {
  const settings = defaultPartnerSaleCalendarSettings()
  const active = resolvePartnerSaleCalendarState({
    settings: { ...settings, manualSaleDate: '2028-02-29', manualDiscountPercent: 7 },
    at: new Date('2028-02-29T05:00:00.000Z'),
  })
  assert.equal(active.phase, 'active')
  assert.equal(active.discountPercent, 7)
})

test('voucher excludes birthday, loyalty uses remainder and total is capped at 15 percent', () => {
  const result = resolvePartnerSaleDiscountBreakdown({
    lines: [
      {
        inventoryId: 'regular',
        quantity: 1,
        listUnitPrice: 1_000_000,
        effectiveUnitPrice: 920_000,
      },
    ],
    voucherDiscountAmount: 100_000,
    birthdayDiscountPercent: 10,
    loyaltyDiscountPercent: 10,
  })
  assert.equal(PARTNER_ORDER_MAX_DISCOUNT_PERCENT, 15)
  assert.equal(result.primaryDiscount, 'voucher')
  assert.equal(result.birthdayDiscountAmount, 0)
  assert.equal(result.siteSaleDiscountAmount, 80_000)
  assert.equal(result.voucherDiscountAmount, 70_000)
  assert.equal(result.loyaltyDiscountAmount, 0)
  assert.equal(result.totalDiscountAmount, 150_000)
  assert.equal(result.amountAfterDiscount, 850_000)
})

test('clearance subtotal receives no voucher birthday or loyalty discount', () => {
  const result = resolvePartnerSaleDiscountBreakdown({
    lines: [
      {
        inventoryId: 'clearance',
        quantity: 1,
        listUnitPrice: 500_000,
        effectiveUnitPrice: 400_000,
        isClearance: true,
      },
    ],
    voucherDiscountAmount: 80_000,
    birthdayDiscountPercent: 10,
    loyaltyDiscountPercent: 10,
  })
  assert.equal(result.clearanceSubtotal, 400_000)
  assert.equal(result.voucherDiscountAmount, 0)
  assert.equal(result.birthdayDiscountAmount, 0)
  assert.equal(result.loyaltyDiscountAmount, 0)
  assert.equal(result.amountAfterDiscount, 400_000)
})

test('Google pv2 ES256 is tenant-offer checked and lock is capped at 48 hours', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    p: 850_000,
    pp: 1_000_000,
    c: 'VND',
    o: 'SKU-1',
    m: 'MERCHANT-1',
    exp: 2_000_000_000,
  })).toString('base64url')
  const body = `${header}.${payload}`
  const signature = sign('sha256', Buffer.from(body), {
    key: privateKey,
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url')
  const token = `${body}.${signature}`
  const verified = verifyGoogleAutomatedDiscountToken({
    token,
    expectedOfferId: 'SKU-1',
    expectedMerchantId: 'MERCHANT-1',
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    nowMs: 1_900_000_000_000,
  })
  assert.equal(verified.price, 850_000)
  assert.throws(() =>
    verifyGoogleAutomatedDiscountToken({
      token,
      expectedOfferId: 'OTHER',
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      nowMs: 1_900_000_000_000,
    })
  )
  const now = 1_900_000_000_000
  assert.equal(
    googleDiscountLockExpiresAt(2_000_000_000, 48, now).getTime(),
    now + 48 * 3_600_000
  )
})

test('birthday window includes T-7 through T0 and campaign key changes by birthday year', () => {
  assert.equal(isInBirthdayOfferWindow(7, 7, 1), true)
  assert.equal(isInBirthdayOfferWindow(0, 7, 1), true)
  assert.equal(isInBirthdayOfferWindow(8, 7, 1), false)
  assert.equal(birthdayCampaignKey('2026-01-02'), 'bday_20260102')
  assert.equal(birthdayCampaignKey('2027-01-02'), 'bday_20270102')
  assert.equal(
    daysUntilNextBirthday('2000-02-29', new Date('2027-02-28T05:00:00.000Z')),
    1
  )
})

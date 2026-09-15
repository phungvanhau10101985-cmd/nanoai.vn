import assert from 'node:assert/strict'
import test from 'node:test'
import {
  affiliateApiErrorMessage,
  affiliateCommissionAmount,
  affiliateCommissionBase,
  affiliateHasLoggedInIdentity,
  affiliateProductSummary,
  appendReferralToUrl,
  applyAffiliateWalletToPayable,
  applyAffiliateWalletToSplitPlans,
  captureReferralCookieMaxAgeSeconds,
  cleanAffiliateSocialLinks,
  mapAffiliateCommissionUiStatus,
  maskAffiliateBuyerLabel,
  normalizeAffiliateReferralCode,
  normalizePartnerSiteAffiliateTab,
  partnerAffiliateCookieName,
  pickAffiliateReferrerProfileId,
  readReferralCodeFromSearch,
  shouldGrantAffiliateCommissionOnCheckout,
} from '@/lib/partner-website/shop/partner-site-affiliate'

test('normalizes referral codes and reads ?ref= from the URL', () => {
  assert.equal(normalizeAffiliateReferralCode(' ab-12 '), 'AB12')
  assert.equal(readReferralCodeFromSearch('?q=ao&ref=ctv88'), 'CTV88')
  assert.equal(readReferralCodeFromSearch('affiliate=hello1'), 'HELLO1')
})

test('appends ?ref= without dropping other query params', () => {
  assert.equal(
    appendReferralToUrl('https://shop.example/products/tui?color=red', 'ctv01'),
    'https://shop.example/products/tui?color=red&ref=CTV01'
  )
  assert.equal(appendReferralToUrl('/c/vay', 'aa11', 'https://shop.example'), 'https://shop.example/c/vay?ref=AA11')
})

test('commission base excludes wallet spend, like 188 subtotal - discount - wallet', () => {
  assert.equal(affiliateCommissionBase({ amountAfterDiscount: 1_000_000, walletAmountUsed: 200_000 }), 800_000)
  assert.equal(affiliateCommissionAmount(800_000, 10), 80_000)
  assert.equal(affiliateCommissionAmount(0, 10), 0)
})

test('wallet at checkout scales deposit and never exceeds payable', () => {
  const applied = applyAffiliateWalletToPayable({
    amountAfterDiscount: 1_000_000,
    shippingFeeAmount: 30_000,
    requiredAmount: 309_000,
    walletBalance: 500_000,
    requestedAmount: 400_000,
  })
  assert.equal(applied.walletUsed, 400_000)
  assert.equal(applied.payableTotal, 630_000)
  assert.equal(applied.requiredAmount, 189_000)
})

test('split checkout spends remaining wallet per order, not only plan[0]', () => {
  const applied = applyAffiliateWalletToSplitPlans({
    walletBalance: 800_000,
    requestedAmount: 800_000,
    plans: [
      { amountAfterDiscount: 500_000, shippingFeeAmount: 30_000, requiredAmount: 159_000 },
      { amountAfterDiscount: 400_000, shippingFeeAmount: 0, requiredAmount: 120_000 },
    ],
  })
  assert.equal(applied.walletUsed, 800_000)
  assert.equal(applied.plans[0]?.walletUsed, 530_000)
  assert.equal(applied.plans[0]?.requiredAmount, 0)
  assert.equal(applied.plans[1]?.walletUsed, 270_000)
  assert.equal(applied.plans[1]?.requiredAmount, 39_000)
  assert.equal(applied.requiredAmount, 39_000)
})

test('deposit orders wait for payment before granting commission', () => {
  assert.equal(shouldGrantAffiliateCommissionOnCheckout({ requiredAmount: 0 }), true)
  assert.equal(shouldGrantAffiliateCommissionOnCheckout({ requiredAmount: 100_000, paidAmount: 0 }), false)
  assert.equal(shouldGrantAffiliateCommissionOnCheckout({ requiredAmount: 100_000, paidAmount: 100_000 }), true)
})

test('account aliases match 188 /vi-dien-tu and /tai-khoan-ngan-hang', () => {
  assert.equal(normalizePartnerSiteAffiliateTab('vi-dien-tu'), 'affiliate')
  assert.equal(normalizePartnerSiteAffiliateTab('tai-khoan-ngan-hang'), 'affiliate-bank')
  assert.equal(normalizePartnerSiteAffiliateTab('loyalty'), null)
})

test('commission UI maps reversed/returned to cancelled', () => {
  assert.equal(
    mapAffiliateCommissionUiStatus({ commissionStatus: 'reversed', shippingStatus: 'returned' }),
    'cancelled'
  )
  assert.equal(
    mapAffiliateCommissionUiStatus({
      commissionStatus: null,
      orderStatus: 'awaiting_payment',
      requiredAmount: 50_000,
      paidAmount: 0,
    }),
    'awaiting_deposit'
  )
})

test('social links require http(s) like 188', () => {
  assert.deepEqual(cleanAffiliateSocialLinks('https://facebook.com/a\nhttps://tiktok.com/@b'), [
    'https://facebook.com/a',
    'https://tiktok.com/@b',
  ])
  assert.throws(() => cleanAffiliateSocialLinks('facebook.com/a'), /SOCIAL_LINK_INVALID/)
  assert.throws(() => cleanAffiliateSocialLinks(''), /SOCIAL_LINK_REQUIRED/)
})

test('cookie name is scoped per shop slug', () => {
  assert.equal(partnerAffiliateCookieName('188-shop'), 'pw_affiliate_ref:188-shop')
  assert.equal(captureReferralCookieMaxAgeSeconds(30), 30 * 86400)
})

test('referrer pick matches 188: first-touch unless checkout code last-touch wins', () => {
  assert.equal(
    pickAffiliateReferrerProfileId({
      buyerProfileId: 'buyer',
      firstTouchProfileId: 'ctv-a',
      lastTouchFromVisit: 'ctv-b',
    }),
    'ctv-a'
  )
  assert.equal(
    pickAffiliateReferrerProfileId({
      buyerProfileId: 'buyer',
      firstTouchProfileId: 'ctv-a',
      lastTouchFromCode: 'ctv-c',
      lastTouchFromVisit: 'ctv-b',
    }),
    'ctv-c'
  )
  assert.equal(
    pickAffiliateReferrerProfileId({
      buyerProfileId: 'buyer',
      lastTouchFromVisit: 'ctv-b',
    }),
    'ctv-b'
  )
  assert.equal(
    pickAffiliateReferrerProfileId({
      buyerProfileId: 'self',
      firstTouchProfileId: 'self',
    }),
    null
  )
})

test('referred-order labels match 188 masking and product summary', () => {
  assert.equal(maskAffiliateBuyerLabel({ phone: '0901234567' }), 'Khách ***4567')
  assert.equal(affiliateProductSummary(['Túi mini', 'Giày', 'Váy']), 'Túi mini (+2 SP)')
})

test('storefront API errors are mapped for all 5 locales', () => {
  assert.equal(affiliateApiErrorMessage('vi', 'AUTH_REQUIRED'), 'Vui lòng đăng nhập.')
  assert.equal(affiliateApiErrorMessage('en', 'NOT_APPROVED'), 'Affiliate application is not approved yet.')
  assert.match(affiliateApiErrorMessage('zh', 'SOCIAL_LINK_TOO_LONG'), /社交/)
  assert.match(affiliateApiErrorMessage('ja', 'OTP_INVALID'), /OTP/)
  assert.match(affiliateApiErrorMessage('ko', 'BANK_REQUIRED'), /은행/)
})

test('first-touch capture requires email or Google login, not a minted guest UUID', () => {
  assert.equal(affiliateHasLoggedInIdentity({}), false)
  assert.equal(affiliateHasLoggedInIdentity({ linkedUserId: null, emailNormalized: '' }), false)
  assert.equal(affiliateHasLoggedInIdentity({ linkedUserId: '', emailNormalized: '   ' }), false)
  assert.equal(affiliateHasLoggedInIdentity({ linkedUserId: 'user-1' }), true)
  assert.equal(affiliateHasLoggedInIdentity({ emailNormalized: 'a@b.c' }), true)
})

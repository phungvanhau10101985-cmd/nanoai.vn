import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessPromotionCustomerEligibility,
  isPermanentlyUnusablePromoError,
} from '@/lib/partner-website/promotions/partner-promotion-eligibility'

const base = {
  isActive: true,
  validFrom: null as string | null,
  validTo: null as string | null,
  minSubtotal: 0,
  usageLimit: null as number | null,
  usedCount: 0,
  firstOrderOnly: true,
  perUserLimit: 1,
  hasPriorOrder: false,
  usedByCustomerCount: 0,
}

test('first_order_only blocks customers who already have an order', () => {
  assert.equal(assessPromotionCustomerEligibility(base), null)
  assert.equal(
    assessPromotionCustomerEligibility({ ...base, hasPriorOrder: true }),
    'first_order_only'
  )
})

test('first_order_only is skipped when the voucher is not first-order-only', () => {
  assert.equal(
    assessPromotionCustomerEligibility({ ...base, firstOrderOnly: false, hasPriorOrder: true }),
    null
  )
})

test('min subtotal only applies when a positive cart subtotal is supplied', () => {
  const promo = { ...base, firstOrderOnly: false, minSubtotal: 500_000 }
  assert.equal(assessPromotionCustomerEligibility(promo), null)
  assert.equal(assessPromotionCustomerEligibility({ ...promo, subtotal: 0 }), null)
  assert.equal(assessPromotionCustomerEligibility({ ...promo, subtotal: 100_000 }), 'below_min_subtotal')
  assert.equal(assessPromotionCustomerEligibility({ ...promo, subtotal: 500_000 }), null)
})

test('per-user limit is skipped when usage count is unknown', () => {
  assert.equal(
    assessPromotionCustomerEligibility({ ...base, firstOrderOnly: false, usedByCustomerCount: null, perUserLimit: 1 }),
    null
  )
  assert.equal(
    assessPromotionCustomerEligibility({ ...base, firstOrderOnly: false, usedByCustomerCount: 1, perUserLimit: 1 }),
    'per_user_limit_reached'
  )
})

test('permanently unusable errors exclude temporary cart conditions', () => {
  assert.equal(isPermanentlyUnusablePromoError('first_order_only'), true)
  assert.equal(isPermanentlyUnusablePromoError('per_user_limit_reached'), true)
  assert.equal(isPermanentlyUnusablePromoError('below_min_subtotal'), false)
  assert.equal(isPermanentlyUnusablePromoError('no_eligible_items'), false)
  assert.equal(isPermanentlyUnusablePromoError(null), false)
})

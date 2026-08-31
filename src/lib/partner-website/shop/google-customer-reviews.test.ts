import assert from 'node:assert/strict'
import test from 'node:test'
import {
  estimatedDeliveryDateForGoogleReviews,
  isOrderEligibleForGoogleReviewsOptIn,
  parseGoogleCustomerReviewsMerchantId,
} from '@/lib/partner-website/shop/google-customer-reviews'

test('COD orders are eligible for GCR immediately', () => {
  assert.equal(isOrderEligibleForGoogleReviewsOptIn({ required_amount: 0, status: 'awaiting_payment' }), true)
})

test('deposit orders are eligible only after paid', () => {
  assert.equal(
    isOrderEligibleForGoogleReviewsOptIn({
      required_amount: 100000,
      status: 'awaiting_payment',
      paid_amount: 0,
    }),
    false
  )
  assert.equal(
    isOrderEligibleForGoogleReviewsOptIn({
      required_amount: 100000,
      status: 'paid_verified',
      paid_amount: 100000,
    }),
    true
  )
})

test('cancelled orders never get GCR', () => {
  assert.equal(isOrderEligibleForGoogleReviewsOptIn({ required_amount: 0, status: 'cancelled' }), false)
})

test('parses merchant id as positive integer', () => {
  assert.equal(parseGoogleCustomerReviewsMerchantId(123456789), 123456789)
  assert.equal(parseGoogleCustomerReviewsMerchantId('123456789'), 123456789)
  assert.equal(parseGoogleCustomerReviewsMerchantId(''), null)
  assert.equal(parseGoogleCustomerReviewsMerchantId(0), null)
  assert.equal(parseGoogleCustomerReviewsMerchantId(12.5), null)
})

test('estimated delivery defaults to +7 days from created_at', () => {
  assert.equal(
    estimatedDeliveryDateForGoogleReviews({ created_at: '2026-08-01T00:00:00.000Z' }),
    '2026-08-08'
  )
})

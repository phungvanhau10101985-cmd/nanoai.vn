import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isPartnerShopDepositWaiting,
  partnerOrderPayableTotal,
  partnerOrderRemainingAfterDeposit,
  shouldRedirectToDepositAfterCreate,
  shouldShowDepositSuccessPage,
} from '@/lib/partner-website/shop/order-deposit'

test('redirects to deposit when awaiting payment with required amount', () => {
  assert.equal(
    shouldRedirectToDepositAfterCreate({ status: 'awaiting_payment', required_amount: 150000 }),
    true
  )
  assert.equal(
    shouldRedirectToDepositAfterCreate({ status: 'awaiting_payment', required_amount: 0 }),
    false
  )
  assert.equal(
    shouldRedirectToDepositAfterCreate({ status: 'paid_verified', required_amount: 150000 }),
    false
  )
})

test('shows success after paid amount or verified status', () => {
  assert.equal(
    shouldShowDepositSuccessPage({
      status: 'awaiting_payment',
      required_amount: 100000,
      paid_amount: 0,
    }),
    false
  )
  assert.equal(
    shouldShowDepositSuccessPage({
      status: 'paid_verified',
      required_amount: 100000,
      paid_amount: 100000,
    }),
    true
  )
  assert.equal(
    shouldShowDepositSuccessPage({
      status: 'awaiting_payment',
      required_amount: 100000,
      paid_amount: 100000,
    }),
    true
  )
})

test('COD orders are not waiting deposit', () => {
  assert.equal(isPartnerShopDepositWaiting({ status: 'awaiting_payment', required_amount: 0 }), false)
  assert.equal(
    isPartnerShopDepositWaiting({ status: 'awaiting_payment', required_amount: 50000, paid_amount: 0 }),
    true
  )
})

test('remaining after deposit includes shipping', () => {
  assert.equal(
    partnerOrderPayableTotal({ amount_after_discount: 1_000_000, shipping_fee_amount: 30000 }),
    1_030_000
  )
  assert.equal(
    partnerOrderRemainingAfterDeposit({
      amount_after_discount: 1_000_000,
      shipping_fee_amount: 30000,
      required_amount: 300000,
    }),
    730000
  )
})

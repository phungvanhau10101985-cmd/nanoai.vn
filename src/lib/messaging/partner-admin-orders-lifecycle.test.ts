import assert from 'node:assert/strict'
import test from 'node:test'
import {
  monthInputToDateRange,
  partnerAdminAmountDueOnDelivery,
  partnerAdminAmountDueOnDeliverySql,
  partnerAdminLifecycleSql,
  partnerAdminMatchesLifecycleTab,
  partnerAdminMatchesPaymentFilter,
  partnerAdminNeedsDepositStage,
  partnerAdminOrderIsCancelled,
  partnerAdminOrderIsReturned,
  partnerAdminPayBadgeKey,
  partnerAdminPaymentFilterSql,
  partnerAdminStageBadgeKey,
  type PartnerAdminOrderLifecycleInput,
} from './partner-admin-orders-lifecycle'

function row(partial: Partial<PartnerAdminOrderLifecycleInput>): PartnerAdminOrderLifecycleInput {
  return {
    status: 'paid_verified',
    shipping_status: 'pending',
    required_amount: 0,
    paid_amount: 0,
    subtotal_amount: 100000,
    amount_after_discount: 100000,
    ...partial,
  }
}

test('returned is not cancelled — own 188 tab', () => {
  const r = row({ shipping_status: 'returned' })
  assert.equal(partnerAdminOrderIsReturned(r), true)
  assert.equal(partnerAdminOrderIsCancelled(r), false)
  assert.equal(partnerAdminMatchesLifecycleTab(r, 'returned'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(r, 'cancelled'), false)
  assert.equal(partnerAdminStageBadgeKey(r), 'returned')
})

test('cancelled shipping is cancelled tab, not returned', () => {
  const r = row({ status: 'cancelled', shipping_status: 'cancelled' })
  assert.equal(partnerAdminMatchesLifecycleTab(r, 'cancelled'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(r, 'returned'), false)
})

test('waiting deposit vs waiting ship matches 188 stages', () => {
  const awaitDeposit = row({
    status: 'awaiting_payment',
    required_amount: 30000,
    paid_amount: 0,
  })
  assert.equal(partnerAdminNeedsDepositStage(awaitDeposit), true)
  assert.equal(partnerAdminMatchesLifecycleTab(awaitDeposit, 'waiting_deposit'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(awaitDeposit, 'waiting_ship'), false)

  const awaitShip = row({
    status: 'paid_verified',
    required_amount: 30000,
    paid_amount: 30000,
    shipping_status: 'packing',
  })
  assert.equal(partnerAdminNeedsDepositStage(awaitShip), false)
  assert.equal(partnerAdminMatchesLifecycleTab(awaitShip, 'waiting_ship'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(awaitShip, 'waiting_deposit'), false)
})

test('shipping / delivered / completed split like 188', () => {
  const shipping = row({ shipping_status: 'shipping' })
  assert.equal(partnerAdminMatchesLifecycleTab(shipping, 'shipping'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(shipping, 'delivered'), false)

  const delivered = row({ shipping_status: 'delivered' })
  assert.equal(partnerAdminMatchesLifecycleTab(delivered, 'delivered'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(delivered, 'completed'), false)

  const reviewed = row({ shipping_status: 'delivered', has_customer_review: true })
  assert.equal(partnerAdminMatchesLifecycleTab(reviewed, 'completed'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(reviewed, 'delivered'), false)
})

test('COD after deposit uses amount after discount', () => {
  assert.equal(
    partnerAdminAmountDueOnDelivery(
      row({ subtotal_amount: 200000, amount_after_discount: 180000, paid_amount: 54000 })
    ),
    126000
  )
})

test('payment filter: pending / deposit_paid / paid', () => {
  const pending = row({ status: 'awaiting_payment', required_amount: 30000, paid_amount: 0 })
  assert.equal(partnerAdminMatchesPaymentFilter(pending, 'pending'), true)
  assert.equal(partnerAdminPayBadgeKey(pending), 'pending')

  const partial = row({ status: 'payment_checking', required_amount: 30000, paid_amount: 10000 })
  assert.equal(partnerAdminMatchesPaymentFilter(partial, 'deposit_paid'), true)
  assert.equal(partnerAdminPayBadgeKey(partial), 'deposit_paid')

  const depositPaid = row({
    status: 'paid_verified',
    required_amount: 255000,
    paid_amount: 255000,
    amount_after_discount: 850000,
    subtotal_amount: 850000,
  })
  assert.equal(partnerAdminAmountDueOnDelivery(depositPaid), 595000)
  assert.equal(partnerAdminNeedsDepositStage(depositPaid), false)
  assert.equal(partnerAdminMatchesLifecycleTab(depositPaid, 'waiting_ship'), true)
  assert.equal(partnerAdminMatchesLifecycleTab(depositPaid, 'waiting_deposit'), false)
  assert.equal(partnerAdminPayBadgeKey(depositPaid), 'deposit_paid')
  assert.equal(partnerAdminMatchesPaymentFilter(depositPaid, 'deposit_paid'), true)
  assert.equal(partnerAdminMatchesPaymentFilter(depositPaid, 'paid'), false)

  const paid = row({
    status: 'paid_verified',
    required_amount: 100000,
    paid_amount: 100000,
    amount_after_discount: 100000,
    subtotal_amount: 100000,
  })
  assert.equal(partnerAdminMatchesPaymentFilter(paid, 'paid'), true)
  assert.equal(partnerAdminPayBadgeKey(paid), 'paid')

  const codUnpaid = row({
    status: 'paid_verified',
    required_amount: 0,
    paid_amount: 0,
    amount_after_discount: 100000,
    subtotal_amount: 100000,
  })
  assert.equal(partnerAdminPayBadgeKey(codUnpaid), 'pending')
  assert.equal(partnerAdminMatchesPaymentFilter(codUnpaid, 'paid'), false)
})

test('payment SQL treats remaining COD as deposit_paid, not fully paid', () => {
  const paidSql = partnerAdminPaymentFilterSql('paid')
  const depositSql = partnerAdminPaymentFilterSql('deposit_paid')
  assert.match(paidSql, /paid_amount/)
  assert.match(paidSql, /amount_after_discount/)
  assert.match(depositSql, /paid_amount/)
  assert.equal(partnerAdminAmountDueOnDeliverySql().includes('amount_after_discount'), true)
})

test('month range and lifecycle SQL are safe fragments', () => {
  assert.deepEqual(monthInputToDateRange('2026-09'), { from: '2026-09-01', to: '2026-09-30' })
  assert.equal(monthInputToDateRange('nope'), null)
  assert.match(partnerAdminLifecycleSql('waiting_ship'), /not in \('shipping', 'delivered'\)/)
  assert.equal(partnerAdminLifecycleSql('all'), 'true')
})

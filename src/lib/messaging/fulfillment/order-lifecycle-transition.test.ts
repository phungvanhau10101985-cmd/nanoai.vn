import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canTransitionPartnerOrderPayment,
  canTransitionPartnerOrderShipping,
  partnerOrderCancellationAxis,
  partnerOrderPaymentTransitionSql,
  partnerOrderShippingTransitionSql,
} from './order-lifecycle-transition'

describe('order lifecycle transition matrix', () => {
  it('keeps payment cancellation separate from shipping cancellation', () => {
    const active = { status: 'paid_verified', shippingStatus: 'shipping' } as const
    assert.equal(canTransitionPartnerOrderShipping(active, 'cancelled'), true)
    assert.equal(canTransitionPartnerOrderPayment(active, 'cancelled'), false)
    assert.equal(partnerOrderCancellationAxis(active), 'shipping')

    const shippingCancelled = { status: 'paid_verified', shippingStatus: 'cancelled' } as const
    assert.equal(canTransitionPartnerOrderPayment(shippingCancelled, 'cancelled'), false)
    assert.equal(canTransitionPartnerOrderShipping(shippingCancelled, 'delivered'), false)
    assert.equal(partnerOrderCancellationAxis(shippingCancelled), null)
  })

  it('never erases a verified payment when the order is operationally cancelled', () => {
    for (const shippingStatus of ['pending', 'confirmed', 'packing', 'shipping', 'delivered', 'returned'] as const) {
      const state = { status: 'paid_verified', shippingStatus } as const
      assert.equal(canTransitionPartnerOrderPayment(state, 'cancelled'), false)
      assert.equal(
        partnerOrderCancellationAxis(state),
        ['pending', 'confirmed', 'packing', 'shipping'].includes(shippingStatus) ? 'shipping' : null
      )
    }
  })

  it('allows return only from shipping or delivered and keeps terminal states terminal', () => {
    assert.equal(
      canTransitionPartnerOrderShipping({ status: 'paid_verified', shippingStatus: 'shipping' }, 'returned'),
      true
    )
    assert.equal(
      canTransitionPartnerOrderShipping({ status: 'paid_verified', shippingStatus: 'delivered' }, 'returned'),
      true
    )
    assert.equal(
      canTransitionPartnerOrderShipping({ status: 'paid_verified', shippingStatus: 'pending' }, 'returned'),
      false
    )
    assert.equal(
      canTransitionPartnerOrderShipping({ status: 'paid_verified', shippingStatus: 'returned' }, 'shipping'),
      false
    )
  })

  it('keeps SQL guards aligned with the pure payment and shipping matrices', () => {
    const paymentSql = partnerOrderPaymentTransitionSql('$8')
    assert.match(paymentSql, /\$8::text = o\.status/)
    assert.match(paymentSql, /in \('pending', 'confirmed', 'packing'\)/)
    assert.doesNotMatch(paymentSql, /o\.status = 'paid_verified'[\s\S]*'cancelled'/)
    assert.match(partnerOrderShippingTransitionSql(), /shipping_status.*delivered.*returned/s)
    assert.match(partnerOrderShippingTransitionSql(), /o\.status <> 'cancelled'/)
    assert.match(partnerOrderShippingTransitionSql('$9'), /\$9::text = coalesce\(o\.shipping_status/)
    assert.doesNotMatch(partnerOrderShippingTransitionSql('$9'), /\$3::text/)
  })
})

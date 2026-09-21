import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { partnerOrderLifecycleEffectPlan } from './order-lifecycle-hook'

describe('order lifecycle effect plan', () => {
  it('grants then confirms affiliate commission on delivery', () => {
    assert.deepEqual(partnerOrderLifecycleEffectPlan('delivered'), [
      'affiliate_grant',
      'affiliate_confirm',
    ])
  })

  it('reconciles terminal stock from persisted line markers on cancellation', () => {
    assert.deepEqual(partnerOrderLifecycleEffectPlan('cancelled'), [
      'timeline_skip',
      'stock_reconcile_terminal',
      'affiliate_clawback_with_wallet',
    ])
  })

  it('reconciles returned stock but does not refund spent affiliate wallet', () => {
    assert.deepEqual(partnerOrderLifecycleEffectPlan('returned'), [
      'timeline_skip',
      'stock_reconcile_terminal',
      'affiliate_clawback_commission_only',
    ])
  })

  it('refund clawback does not imply a physical stock return', () => {
    assert.deepEqual(partnerOrderLifecycleEffectPlan('refunded'), [
      'affiliate_clawback_with_wallet',
    ])
  })
})

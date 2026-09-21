import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  optimizedFulfillmentDecision,
  parseOptimizedFulfillmentTenantModes,
} from './optimized-contract-feature'

describe('optimized fulfillment tenant feature gate', () => {
  it('is off by default and fails safe on malformed configuration', () => {
    assert.equal(optimizedFulfillmentDecision('tenant-a', {}).effectiveMode, 'off')
    assert.deepEqual(parseOptimizedFulfillmentTenantModes('{bad json'), {})
  })

  it('allows shadow comparison per tenant without enabling writes', () => {
    const env = {
      ORDER_FULFILLMENT_OPTIMIZED_TENANTS: JSON.stringify({
        'tenant-a': 'shadow',
        'tenant-b': 'off',
      }),
    }
    assert.equal(optimizedFulfillmentDecision('tenant-a', env).effectiveMode, 'shadow')
    assert.equal(optimizedFulfillmentDecision('tenant-b', env).effectiveMode, 'off')
  })

  it('keeps enforce off until the parity gate passed', () => {
    const blocked = optimizedFulfillmentDecision('tenant-a', {
      ORDER_FULFILLMENT_OPTIMIZED_TENANTS: '{"tenant-a":"enforce"}',
    })
    assert.equal(blocked.effectiveMode, 'off')
    assert.equal(blocked.reason, 'enforce_gate_missing')

    const enabled = optimizedFulfillmentDecision('tenant-a', {
      ORDER_FULFILLMENT_OPTIMIZED_TENANTS: '{"tenant-a":"enforce"}',
      ORDER_FULFILLMENT_PARITY_GATE_PASSED: '1',
    })
    assert.equal(enabled.effectiveMode, 'enforce')
    assert.equal(enabled.reason, 'enforce_enabled')
  })
})

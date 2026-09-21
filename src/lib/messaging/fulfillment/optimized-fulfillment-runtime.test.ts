import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { selectOptimizedFulfillmentOutcome } from './optimized-fulfillment-runtime'

describe('optimized fulfillment runtime selector', () => {
  it('off runs only the legacy path', () => {
    let optimizedCalls = 0
    const selected = selectOptimizedFulfillmentOutcome({
      tenantId: 'tenant-a',
      operation: 'checkout',
      env: {},
      legacy: () => 'legacy',
      optimized: () => {
        optimizedCalls += 1
        return 'optimized'
      },
    })
    assert.equal(selected.value, 'legacy')
    assert.equal(selected.decision.effectiveMode, 'off')
    assert.equal(optimizedCalls, 0)
  })

  it('shadow returns legacy and logs a sanitized mismatch', () => {
    const entries: unknown[] = []
    const selected = selectOptimizedFulfillmentOutcome({
      tenantId: 'private-tenant-id',
      operation: 'payment',
      env: { ORDER_FULFILLMENT_OPTIMIZED_MODE: 'shadow' },
      legacy: () => ({ allowed: true, secret: 'legacy-secret' }),
      optimized: () => ({ allowed: false, secret: 'optimized-secret' }),
      log: (entry) => entries.push(entry),
    })
    assert.equal(selected.value.allowed, true)
    assert.equal(entries.length, 1)
    const serialized = JSON.stringify(entries[0])
    assert.match(serialized, /optimized_fulfillment_shadow_mismatch/)
    assert.doesNotMatch(serialized, /private-tenant-id|legacy-secret|optimized-secret/)
  })

  it('enforce stays legacy until gated, then selects optimized', () => {
    const blocked = selectOptimizedFulfillmentOutcome({
      tenantId: 'tenant-a',
      operation: 'shipping',
      env: { ORDER_FULFILLMENT_OPTIMIZED_MODE: 'enforce' },
      legacy: () => 'legacy',
      optimized: () => 'optimized',
    })
    assert.equal(blocked.value, 'legacy')
    assert.equal(blocked.decision.reason, 'enforce_gate_missing')

    const enabled = selectOptimizedFulfillmentOutcome({
      tenantId: 'tenant-a',
      operation: 'shipping',
      env: {
        ORDER_FULFILLMENT_OPTIMIZED_MODE: 'enforce',
        ORDER_FULFILLMENT_PARITY_GATE_PASSED: '1',
      },
      legacy: () => 'legacy',
      optimized: () => 'optimized',
    })
    assert.equal(enabled.value, 'optimized')
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  partnerWarehouseStockLinePredicate,
  partnerWarehouseStockMutationForTerminal,
  validatePartnerWarehouseStockAvailability,
} from '@/lib/db/messaging-partner-order-shipment-pg'
import {
  partnerPaymentWebhookClaimSql,
  partnerPaymentWebhookEffectClaimSql,
  partnerPaymentWebhookEventId,
} from '@/lib/db/messaging-partner-payment-webhook-events-pg'

describe('warehouse_reserved availability', () => {
  it('uses physical stock minus additive reservations', () => {
    const shortages = validatePartnerWarehouseStockAvailability(
      [
        { inventoryId: 'a', quantity: 3 },
        { inventoryId: 'b', quantity: 1 },
      ],
      [
        { id: 'a', stockQty: 5, warehouseReserved: 3 },
        { id: 'b', stockQty: 1, warehouseReserved: 0 },
      ],
      'reserve'
    )
    assert.deepEqual(shortages, [{ inventoryId: 'a', requested: 3, available: 2 }])
  })

  it('validates deduction against physical stock and reports missing inventory', () => {
    const shortages = validatePartnerWarehouseStockAvailability(
      [
        { inventoryId: 'a', quantity: 2 },
        { inventoryId: 'missing', quantity: 1 },
      ],
      [{ id: 'a', stockQty: 1, warehouseReserved: 1 }],
      'deduct'
    )
    assert.deepEqual(shortages, [
      { inventoryId: 'a', requested: 2, available: 1 },
      { inventoryId: 'missing', requested: 1, available: 0 },
    ])
  })

  it('releases a live reserve but never invents physical stock', () => {
    assert.equal(
      partnerWarehouseStockMutationForTerminal({
        reservedAt: '2026-09-21T00:00:00.000Z',
        deductedAt: null,
        restoredAt: null,
      }),
      'release'
    )
    assert.match(partnerWarehouseStockLinePredicate('release'), /reserved_at is not null/)
    assert.match(partnerWarehouseStockLinePredicate('release'), /deducted_at is null/)
    assert.doesNotMatch(partnerWarehouseStockLinePredicate('release'), /restored_at is null/)
  })

  it('restores only stock that was physically deducted and only once', () => {
    assert.equal(
      partnerWarehouseStockMutationForTerminal({
        reservedAt: '2026-09-21T00:00:00.000Z',
        deductedAt: '2026-09-21T01:00:00.000Z',
        restoredAt: null,
      }),
      'restore'
    )
    assert.equal(
      partnerWarehouseStockMutationForTerminal({
        reservedAt: null,
        deductedAt: null,
        restoredAt: null,
      }),
      'none'
    )
    assert.equal(
      partnerWarehouseStockMutationForTerminal({
        reservedAt: '2026-09-21T00:00:00.000Z',
        deductedAt: '2026-09-21T01:00:00.000Z',
        restoredAt: '2026-09-21T02:00:00.000Z',
      }),
      'none'
    )
    assert.match(partnerWarehouseStockLinePredicate('restore'), /deducted_at is not null/)
    assert.match(partnerWarehouseStockLinePredicate('restore'), /restored_at is null/)
  })
})

describe('partner SePay event identity', () => {
  it('prefers provider transaction id', () => {
    assert.equal(
      partnerPaymentWebhookEventId({ transactionId: ' SEPAY-123 ', rawBody: '{"id":1}' }),
      'SEPAY-123'
    )
  })

  it('uses a deterministic payload hash when transaction id is absent', () => {
    const first = partnerPaymentWebhookEventId({ rawBody: '{"id":1}' })
    const second = partnerPaymentWebhookEventId({ transactionId: '', rawBody: '{"id":1}' })
    assert.equal(first, second)
    assert.match(first, /^sha256:[a-f0-9]{64}$/)
  })

  it('reclaims abandoned deliveries and checkpoints each retryable effect', () => {
    const eventSql = partnerPaymentWebhookClaimSql()
    const effectSql = partnerPaymentWebhookEffectClaimSql()
    assert.match(eventSql, /status = 'failed'/)
    assert.match(eventSql, /status = 'processing'[\s\S]*interval '15 minutes'/)
    assert.match(eventSql, /claim_token = excluded\.claim_token/)
    assert.match(effectSql, /on conflict \(event_id, effect_key\)/)
    assert.match(effectSql, /status = 'failed'/)
    assert.match(effectSql, /claim_token = excluded\.claim_token/)
  })
})

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { partnerWarehouseStockMutationForTerminal } from '@/lib/db/messaging-partner-order-shipment-pg'

type Scenario = {
  id: string
  topic: string
  input: Record<string, unknown>
  expected: Record<string, unknown>
}

type ContractFixture = {
  contract_id: string
  contract_version: string
  fixture_schema_version: number
  currency: string
  timezone: string
  scenarios: Scenario[]
}

const fixture = JSON.parse(
  readFileSync(join(process.cwd(), 'contracts', 'shared-order-fulfillment-v1.json'), 'utf8'),
) as ContractFixture

function scenario(id: string): Scenario {
  const found = fixture.scenarios.find((row) => row.id === id)
  assert.ok(found, `missing golden scenario: ${id}`)
  assert.ok(found.topic)
  assert.equal(typeof found.input, 'object')
  assert.equal(typeof found.expected, 'object')
  return found
}

describe('shared order fulfillment contract fixture', () => {
  it('has the supported version and complete scenario set', () => {
    assert.equal(fixture.contract_id, 'shared-order-fulfillment')
    assert.match(fixture.contract_version, /^1\.\d+\.\d+$/)
    assert.equal(fixture.fixture_schema_version, 1)
    assert.equal(fixture.currency, 'VND')
    assert.equal(fixture.timezone, 'Asia/Ho_Chi_Minh')
    assert.deepEqual(
      fixture.scenarios.map((row) => row.id),
      [
        'checkout_vn_cn_split',
        'concurrent_sku_reservation',
        'mixed_checkout_rollback',
        'cod_stock_reserve',
        'deposit_sla',
        'late_deposit_after_release',
        'sepay_replay',
        'ems_event_replay',
        'ems_at_customs_stop',
        'ems_delivered_side_effects',
        'cancel_before_deduct_stock',
        'return_before_deduct_stock',
        'return_after_delivered_stock',
        'ems_returned_side_effects',
        'affiliate_lifecycle',
      ],
    )
  })

  it('locks checkout allocation and deposit SLA invariants', () => {
    const checkout = scenario('checkout_vn_cn_split').expected
    const groups = checkout.groups as Array<Record<string, unknown>>
    assert.deepEqual(groups.map((row) => row.source), ['vietnam', 'china'])
    assert.equal(groups.reduce((sum, row) => sum + Number(row.discount), 0), 100000)
    assert.equal(groups.reduce((sum, row) => sum + Number(row.shipping_fee), 0), 30000)
    assert.deepEqual(groups.map((row) => row.required_deposit), [108000, 162000])
    assert.equal(checkout.atomic, true)
    assert.equal(checkout.deposit_base_excludes_shipping, true)

    const deposit = scenario('deposit_sla').expected
    assert.deepEqual(deposit.reminder_hours, [2, 20])
    assert.equal(deposit.vietnam_stock_release_hour, 24)
    assert.equal(deposit.china_stock_release, false)
    assert.equal(deposit.auto_cancel_china, false)
  })

  it('locks replay, customs, delivered, and returned effects', () => {
    const replay = scenario('sepay_replay').expected
    assert.equal(replay.same_transaction_replay, 'acknowledged_duplicate')
    for (const key of [
      'payment_mutations',
      'paid_amount_increments',
      'payment_events',
      'customer_notifications',
      'owner_notifications',
      'affiliate_grants',
    ]) {
      assert.equal(replay[key], 1, `${key} must happen once`)
    }

    const customs = scenario('ems_at_customs_stop').expected
    assert.equal(customs.active_step, 'at_customs')
    assert.equal(customs.cron_advances, false)
    assert.equal(customs.customer_can_confirm_received, false)

    const delivered = scenario('ems_delivered_side_effects').expected
    assert.equal(delivered.warehouse_stock, 'deduct_once')
    assert.equal(delivered.affiliate_commission, 'confirm_once')
    assert.equal(delivered.replay_is_noop, true)

    const returned = scenario('ems_returned_side_effects').expected
    assert.equal(returned.shop_confirmation_required, true)
    assert.equal(returned.warehouse_stock, 'restore_once')
    assert.equal(returned.affiliate_commission, 'cancel_once')
    assert.equal(returned.affiliate_wallet_refund, false)
    assert.equal(returned.replay_is_noop, true)
  })

  it('executes terminal stock fixtures through the stock-marker decision function', () => {
    const cancel = scenario('cancel_before_deduct_stock').expected
    const returnedBefore = scenario('return_before_deduct_stock').expected
    const returnedAfter = scenario('return_after_delivered_stock').expected
    const reserved = {
      reservedAt: '2026-09-21T00:00:00.000Z',
      deductedAt: null,
      restoredAt: null,
    }
    const deducted = {
      reservedAt: '2026-09-21T00:00:00.000Z',
      deductedAt: '2026-09-21T01:00:00.000Z',
      restoredAt: null,
    }

    assert.equal(partnerWarehouseStockMutationForTerminal(reserved), 'release')
    assert.equal(cancel.reservation_release_count, 1)
    assert.equal(cancel.stock_restore_count, 0)
    assert.equal(partnerWarehouseStockMutationForTerminal(reserved), 'release')
    assert.equal(returnedBefore.stock_restore_count, 0)
    assert.equal(partnerWarehouseStockMutationForTerminal(deducted), 'restore')
    assert.equal(returnedAfter.stock_restore_count, 1)
  })
})

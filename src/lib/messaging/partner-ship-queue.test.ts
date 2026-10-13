import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  assembleShipQueueOrder,
  depositWaitDays,
  shipQueueFilterSql,
  shipQueueListRange,
  shipQueueNoEmsSql,
  shipQueuePeriodBounds,
} from './partner-ship-queue'

describe('ship queue', () => {
  it('counts calendar days from the deposit start date', () => {
    assert.equal(depositWaitDays('2026-10-13', '2026-10-13'), 0)
    assert.equal(depositWaitDays('2026-10-12', '2026-10-13'), 1)
    assert.equal(depositWaitDays('2026-09-01', '2026-10-13'), 42)
    assert.equal(depositWaitDays('2026-10-20', '2026-10-13'), 0)
    assert.equal(depositWaitDays('bad', '2026-10-13'), 0)
  })

  it('keeps deposited orders that have not shipped and have no EMS code', () => {
    const sql = shipQueueFilterSql()
    assert.match(sql, /paid_amount/)
    assert.match(sql, /refund_status/)
    assert.match(sql, /shipping_status/)
    assert.match(shipQueueNoEmsSql(), /tracking_number/)
    assert.match(shipQueueNoEmsSql(), /ems_tracking_code/)
  })

  it('groups waiting orders by day, week, and month', () => {
    const bounds = shipQueuePeriodBounds('2026-10-13')
    assert.deepEqual(bounds.day, { from: '2026-10-13', to: '2026-10-13' })
    assert.deepEqual(bounds.week, { from: '2026-10-12', to: '2026-10-13' })
    assert.deepEqual(bounds.month, { from: '2026-10-01', to: '2026-10-13' })
    assert.deepEqual(shipQueuePeriodBounds('2026-10-18').week, { from: '2026-10-12', to: '2026-10-18' })
    assert.equal(shipQueueListRange('all', bounds), null)
    assert.deepEqual(shipQueueListRange('week', bounds), bounds.week)
  })

  it('shows the order total and the wait in days', () => {
    const row = assembleShipQueueOrder(
      {
        orderId: 'ord-1',
        orderCode: 'CK123',
        customerName: ' Lan ',
        customerPhone: '0901',
        subtotalAmount: 1_200_000,
        amountAfterDiscount: 1_000_000,
        depositedOn: '2026-10-01',
      },
      '2026-10-13',
    )
    assert.equal(row.customerName, 'Lan')
    assert.equal(row.totalVnd, 1_000_000)
    assert.equal(row.waitDays, 12)
  })
})

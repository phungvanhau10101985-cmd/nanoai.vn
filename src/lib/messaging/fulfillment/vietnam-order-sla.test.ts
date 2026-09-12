import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { vietnamBusinessHoursBetween, vietnamSlaBadge } from './vietnam-order-sla'

describe('vietnamSlaBadge', () => {
  it('flags 4 business hours before packing starts', () => {
    const started = new Date('2026-09-01T01:00:00.000Z')
    const now = new Date('2026-09-01T08:00:00.000Z')
    assert.ok(vietnamBusinessHoursBetween(started, now) >= 4)
    assert.equal(
      vietnamSlaBadge({
        fulfillmentSource: 'vietnam',
        activeStep: 'vn_picking',
        startedAt: started,
        now,
      }),
      'overdue_4h'
    )
  })

  it('flags 24 wall-clock hours before handover even after packing started', () => {
    assert.equal(
      vietnamSlaBadge({
        fulfillmentSource: 'vietnam',
        activeStep: 'vn_packed',
        startedAt: '2026-09-01T00:00:00.000Z',
        now: new Date('2026-09-02T01:00:00.000Z'),
      }),
      'overdue_24h'
    )
  })

  it('does not badge China or completed packing', () => {
    assert.equal(
      vietnamSlaBadge({
        fulfillmentSource: 'china',
        activeStep: 'vn_picking',
        startedAt: '2026-09-01T00:00:00.000Z',
        now: new Date('2026-09-03T00:00:00.000Z'),
      }),
      null
    )
    assert.equal(
      vietnamSlaBadge({
        fulfillmentSource: 'vietnam',
        activeStep: 'awaiting_confirm',
        startedAt: '2026-09-01T00:00:00.000Z',
        now: new Date('2026-09-03T00:00:00.000Z'),
      }),
      null
    )
  })
})

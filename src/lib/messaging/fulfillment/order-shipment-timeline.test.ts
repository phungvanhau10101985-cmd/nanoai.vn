import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  advanceAutoShipmentMilestones,
  applyEmsImportToShipmentEvents,
  buildInitialShipmentEvents,
  canConfirmReceivedFromShipment,
  clearCustomsShipment,
  markOutForConfirmShipment,
  startVietnamPackingShipment,
  confirmReceivedShipment,
} from './order-shipment-timeline'

describe('China shipment timeline', () => {
  it('auto-advances 24h steps but never clears customs', () => {
    const start = new Date('2026-09-01T00:00:00.000Z')
    let events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop Test', now: start })
    assert.equal(events.find((e) => e.stepKey === 'tq_preparing')?.status, 'active')

    const afterPrep = new Date(start.getTime() + 25 * 3600_000)
    events = advanceAutoShipmentMilestones(events, afterPrep).events
    assert.equal(events.find((e) => e.stepKey === 'tq_preparing')?.status, 'completed')
    assert.equal(events.find((e) => e.stepKey === 'tq_warehouse')?.status, 'active')

    const afterIntl = new Date(start.getTime() + 80 * 3600_000)
    events = advanceAutoShipmentMilestones(events, afterIntl).events
    assert.equal(events.find((e) => e.stepKey === 'international_shipping')?.status, 'completed')
    assert.equal(events.find((e) => e.stepKey === 'at_customs')?.status, 'active')

    const stillCustoms = advanceAutoShipmentMilestones(events, new Date(afterIntl.getTime() + 48 * 3600_000))
    assert.equal(stillCustoms.changed, false)
    assert.equal(stillCustoms.events.find((e) => e.stepKey === 'at_customs')?.status, 'active')
    assert.equal(canConfirmReceivedFromShipment(stillCustoms.events), false)
  })

  it('admin clear-customs then mark-out opens confirm received', () => {
    const now = new Date('2026-09-02T00:00:00.000Z')
    let events = buildInitialShipmentEvents({ source: 'china', shopName: 'My Shop', now })
    events = events.map((e) => {
      if (['confirmed', 'tq_preparing', 'tq_warehouse', 'international_shipping'].includes(e.stepKey)) {
        return { ...e, status: 'completed' as const, completedAt: now.toISOString() }
      }
      if (e.stepKey === 'at_customs') return { ...e, status: 'active' as const }
      return e
    })
    const cleared = clearCustomsShipment(events, { now })
    assert.equal(cleared.ok, true)
    const packed = markOutForConfirmShipment(cleared.events, 'china', { now })
    assert.equal(packed.ok, true)
    assert.equal(canConfirmReceivedFromShipment(packed.events), true)
  })
})

describe('Vietnam shipment timeline', () => {
  it('requires packing then mark-out before confirm', () => {
    const now = new Date('2026-09-03T00:00:00.000Z')
    let events = buildInitialShipmentEvents({ source: 'vietnam', shopName: 'Shop VN', now })
    assert.equal(events.find((e) => e.stepKey === 'vn_picking')?.status, 'active')
    const started = startVietnamPackingShipment(events, { now })
    assert.equal(started.ok, true)
    assert.equal(canConfirmReceivedFromShipment(started.events), false)
    const out = markOutForConfirmShipment(started.events, 'vietnam', { now })
    assert.equal(out.ok, true)
    assert.equal(canConfirmReceivedFromShipment(out.events), true)
    const confirmed = confirmReceivedShipment(out.events, { now })
    assert.equal(confirmed.ok, true)
    assert.equal(confirmed.events.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'completed')
  })
})

describe('EMS import timeline sync', () => {
  it('activates awaiting_confirm when EMS marks shipping', () => {
    const now = new Date()
    const events = buildInitialShipmentEvents({ source: 'vietnam', shopName: 'Shop', now })
    const synced = applyEmsImportToShipmentEvents(events, 'shipping', now)
    assert.equal(synced.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'active')
    assert.equal(canConfirmReceivedFromShipment(synced), true)
  })

  it('opens awaiting_confirm on a freshly seeded China timeline', () => {
    const now = new Date()
    const events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop', now })
    const synced = applyEmsImportToShipmentEvents(events, 'shipping', now)
    assert.equal(synced.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'active')
    assert.equal(synced.find((e) => e.stepKey === 'at_customs')?.status, 'completed')
    assert.equal(canConfirmReceivedFromShipment(synced), true)
  })
})

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
  SHIPMENT_TRANSITION_CONTRACT_VERSION,
  transitionShipmentState,
  transitionShipmentStateForTenant,
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
    const events = buildInitialShipmentEvents({ source: 'vietnam', shopName: 'Shop VN', now })
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
    assert.equal(synced.ok, true)
    assert.equal(synced.events.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'active')
    assert.equal(canConfirmReceivedFromShipment(synced.events), true)
  })

  it('cannot skip China customs on a freshly seeded timeline', () => {
    const now = new Date()
    const events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop', now })
    const synced = applyEmsImportToShipmentEvents(events, 'shipping', now)
    assert.equal(synced.ok, false)
    assert.equal(synced.blockedAt, 'at_customs')
    assert.equal(synced.events.find((e) => e.stepKey === 'at_customs')?.status, 'active')
    assert.equal(synced.events.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'pending')
    assert.equal(canConfirmReceivedFromShipment(synced.events), false)
  })

  it('cannot mark a China order delivered through EMS before customs clearance', () => {
    const events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop' })
    const synced = applyEmsImportToShipmentEvents(events, 'delivered')
    assert.equal(synced.ok, false)
    assert.equal(synced.blockedAt, 'at_customs')
    assert.equal(synced.events.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'pending')
  })

  it('advances after an admin has explicitly cleared China customs', () => {
    const now = new Date()
    let events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop', now })
    events = applyEmsImportToShipmentEvents(events, 'shipping', now).events
    const cleared = transitionShipmentState({
      events,
      source: 'china',
      actor: 'admin',
      trigger: 'admin_clear_customs',
      now,
    })
    assert.equal(cleared.ok, true)
    const synced = applyEmsImportToShipmentEvents(cleared.events, 'shipping', now)
    assert.equal(synced.ok, true)
    assert.equal(synced.events.find((e) => e.stepKey === 'awaiting_confirm')?.status, 'active')
  })

  it('treats EMS return as a report, not shop receipt or inventory authority', () => {
    const events = buildInitialShipmentEvents({ source: 'vietnam', shopName: 'Shop' })
    const ems = transitionShipmentState({
      events,
      source: 'vietnam',
      actor: 'ems',
      trigger: 'ems_returned',
    })
    assert.equal(ems.ok, false)
    assert.equal(ems.changed, false)
    assert.match(ems.error || '', /shop confirmation/i)
    assert.deepEqual(ems.events, events)

    const admin = transitionShipmentState({
      events,
      source: 'vietnam',
      actor: 'admin',
      trigger: 'admin_confirm_return',
    })
    assert.equal(admin.ok, true)
    assert.equal(admin.changed, true)
    assert.equal(admin.events.every((event) => event.status === 'completed' || event.status === 'skipped'), true)
  })
})

describe('versioned shipment transition contract', () => {
  it('rejects actors that do not own a trigger without mutating events', () => {
    const events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop' })
    const result = transitionShipmentState({
      events,
      source: 'china',
      actor: 'ems',
      trigger: 'admin_clear_customs',
    })
    assert.equal(result.contractVersion, SHIPMENT_TRANSITION_CONTRACT_VERSION)
    assert.equal(result.ok, false)
    assert.equal(result.changed, false)
    assert.deepEqual(result.events, events)
  })

  it('keeps legacy EMS behavior off and enforces customs only after parity passes', () => {
    const previousMode = process.env.ORDER_FULFILLMENT_OPTIMIZED_MODE
    const previousGate = process.env.ORDER_FULFILLMENT_PARITY_GATE_PASSED
    try {
      const events = buildInitialShipmentEvents({ source: 'china', shopName: 'Shop' })
      process.env.ORDER_FULFILLMENT_OPTIMIZED_MODE = 'off'
      delete process.env.ORDER_FULFILLMENT_PARITY_GATE_PASSED
      const legacy = transitionShipmentStateForTenant('tenant-rollout-test', {
        events,
        source: 'china',
        actor: 'ems',
        trigger: 'ems_shipping',
      })
      assert.equal(legacy.ok, true)
      assert.equal(legacy.events.find((event) => event.stepKey === 'awaiting_confirm')?.status, 'active')

      process.env.ORDER_FULFILLMENT_OPTIMIZED_MODE = 'enforce'
      process.env.ORDER_FULFILLMENT_PARITY_GATE_PASSED = '1'
      const enforced = transitionShipmentStateForTenant('tenant-rollout-test', {
        events,
        source: 'china',
        actor: 'ems',
        trigger: 'ems_shipping',
      })
      assert.equal(enforced.ok, false)
      assert.equal(enforced.blockedAt, 'at_customs')
    } finally {
      if (previousMode == null) delete process.env.ORDER_FULFILLMENT_OPTIMIZED_MODE
      else process.env.ORDER_FULFILLMENT_OPTIMIZED_MODE = previousMode
      if (previousGate == null) delete process.env.ORDER_FULFILLMENT_PARITY_GATE_PASSED
      else process.env.ORDER_FULFILLMENT_PARITY_GATE_PASSED = previousGate
    }
  })
})

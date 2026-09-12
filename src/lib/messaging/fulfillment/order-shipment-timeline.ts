import type { PartnerFulfillmentSource } from '@/lib/messaging/fulfillment/fulfillment-routing'
import { FULFILLMENT_CHINA } from '@/lib/messaging/fulfillment/fulfillment-routing'

export type ShipmentEventStatus = 'pending' | 'active' | 'completed' | 'skipped'

export type ShipmentStepKey =
  | 'confirmed'
  | 'tq_preparing'
  | 'tq_warehouse'
  | 'international_shipping'
  | 'at_customs'
  | 'domestic_shipping'
  | 'vn_picking'
  | 'vn_packed'
  | 'awaiting_confirm'

export type PartnerOrderShipmentEvent = {
  stepKey: ShipmentStepKey
  title: string
  sortOrder: number
  status: ShipmentEventStatus
  scheduledAt: string | null
  completedAt: string | null
  note: string
  updatedBy: string
}

export const CHINA_SHIPMENT_STEPS: ShipmentStepKey[] = [
  'confirmed',
  'tq_preparing',
  'tq_warehouse',
  'international_shipping',
  'at_customs',
  'domestic_shipping',
  'awaiting_confirm',
]

export const VIETNAM_SHIPMENT_STEPS: ShipmentStepKey[] = ['confirmed', 'vn_picking', 'vn_packed', 'awaiting_confirm']

export const AUTO_ADVANCE_CHINA_STEPS: ShipmentStepKey[] = ['tq_preparing', 'tq_warehouse', 'international_shipping']

const MANUAL_CHINA_STEPS: ShipmentStepKey[] = ['at_customs', 'domestic_shipping', 'awaiting_confirm']
const MANUAL_VN_STEPS: ShipmentStepKey[] = ['vn_picking', 'vn_packed', 'awaiting_confirm']

export function shipmentStepsForSource(source: PartnerFulfillmentSource): ShipmentStepKey[] {
  return source === FULFILLMENT_CHINA ? CHINA_SHIPMENT_STEPS : VIETNAM_SHIPMENT_STEPS
}

export function shipmentStepCopy(shopName: string, step: ShipmentStepKey): string {
  const shop = shopName.trim() || 'Shop'
  const titles: Record<ShipmentStepKey, string> = {
    confirmed: 'Đơn hàng đã được xác nhận',
    tq_preparing: 'Đang chuẩn bị hàng tại Trung Quốc',
    tq_warehouse: 'Hàng đã về kho Trung Quốc',
    international_shipping: 'Đang vận chuyển quốc tế về Việt Nam',
    at_customs: 'Hàng đang ở cửa khẩu',
    domestic_shipping: `Hàng đang được vận chuyển về ${shop}`,
    vn_picking: 'Đang lấy hàng / kiểm kho',
    vn_packed: 'Đã đóng gói, chờ gửi shipper',
    awaiting_confirm: 'Đã gửi shipper, chờ khách xác nhận đã nhận hàng',
  }
  return titles[step]
}

function hoursFromNow(hours: number, from = new Date()): string {
  return new Date(from.getTime() + hours * 3600_000).toISOString()
}

export function buildInitialShipmentEvents(input: {
  source: PartnerFulfillmentSource
  shopName: string
  now?: Date
}): PartnerOrderShipmentEvent[] {
  const now = input.now || new Date()
  const steps = shipmentStepsForSource(input.source)
  return steps.map((step, index) => {
    const auto = AUTO_ADVANCE_CHINA_STEPS.includes(step)
    return {
      stepKey: step,
      title: shipmentStepCopy(input.shopName, step),
      sortOrder: index,
      status: step === 'confirmed' ? 'completed' : index === 1 ? 'active' : 'pending',
      scheduledAt: auto ? hoursFromNow(24, now) : null,
      completedAt: step === 'confirmed' ? now.toISOString() : null,
      note: '',
      updatedBy: 'system',
    }
  })
}

export function skipRemainingShipmentEvents(
  events: PartnerOrderShipmentEvent[],
  now = new Date()
): PartnerOrderShipmentEvent[] {
  return events.map((event) =>
    event.status === 'completed'
      ? event
      : {
          ...event,
          status: 'skipped',
          completedAt: now.toISOString(),
          updatedBy: 'system',
        }
  )
}

function completeStep(
  events: PartnerOrderShipmentEvent[],
  step: ShipmentStepKey,
  next: ShipmentStepKey | null,
  input: { now: Date; note?: string; updatedBy?: string; scheduleNextHours?: number | null; scheduleNextAt?: Date | null }
): PartnerOrderShipmentEvent[] {
  return events.map((event) => {
    if (event.stepKey === step) {
      return {
        ...event,
        status: 'completed' as const,
        completedAt: input.now.toISOString(),
        note: input.note || event.note,
        updatedBy: input.updatedBy || event.updatedBy,
      }
    }
    if (next && event.stepKey === next) {
      const scheduledAt =
        input.scheduleNextAt != null
          ? input.scheduleNextAt.toISOString()
          : input.scheduleNextHours != null
            ? hoursFromNow(input.scheduleNextHours, input.now)
            : event.scheduledAt
      return {
        ...event,
        status: 'active' as const,
        scheduledAt,
        updatedBy: input.updatedBy || event.updatedBy,
      }
    }
    return event
  })
}

export function canAutoAdvanceShipmentEvent(event: PartnerOrderShipmentEvent, now = new Date()): boolean {
  if (event.status !== 'active') return false
  if (!AUTO_ADVANCE_CHINA_STEPS.includes(event.stepKey)) return false
  if (!event.scheduledAt) return false
  return new Date(event.scheduledAt).getTime() <= now.getTime()
}

export function advanceAutoShipmentMilestones(
  events: PartnerOrderShipmentEvent[],
  now = new Date()
): { events: PartnerOrderShipmentEvent[]; changed: boolean } {
  let nextEvents = events.map((row) => ({ ...row }))
  let changed = false
  for (let guard = 0; guard < 8; guard += 1) {
    const active = nextEvents.find((row) => row.status === 'active')
    if (!active || !canAutoAdvanceShipmentEvent(active, now)) break
    const steps = nextEvents.map((row) => row.stepKey)
    const idx = steps.indexOf(active.stepKey)
    const nextKey = steps[idx + 1] || null
    const nextIsAuto = nextKey ? AUTO_ADVANCE_CHINA_STEPS.includes(nextKey) : false
    const currentDue = active.scheduledAt ? new Date(active.scheduledAt) : now
    nextEvents = completeStep(nextEvents, active.stepKey, nextKey, {
      now,
      updatedBy: 'cron',
      scheduleNextAt: nextIsAuto ? new Date(currentDue.getTime() + 24 * 3600_000) : null,
    })
    changed = true
  }
  return { events: nextEvents, changed }
}

export function clearCustomsShipment(
  events: PartnerOrderShipmentEvent[],
  input: { now?: Date; updatedBy?: string; note?: string }
): { events: PartnerOrderShipmentEvent[]; ok: boolean; error?: string } {
  const active = events.find((row) => row.status === 'active')
  if (!active || active.stepKey !== 'at_customs') {
    return { events, ok: false, error: 'Order is not waiting at customs.' }
  }
  return {
    ok: true,
    events: completeStep(events, 'at_customs', 'domestic_shipping', {
      now: input.now || new Date(),
      updatedBy: input.updatedBy || 'staff',
      note: input.note,
    }),
  }
}

export function startVietnamPackingShipment(
  events: PartnerOrderShipmentEvent[],
  input: { now?: Date; updatedBy?: string; note?: string }
): { events: PartnerOrderShipmentEvent[]; ok: boolean; error?: string } {
  const active = events.find((row) => row.status === 'active')
  if (!active || active.stepKey !== 'vn_picking') {
    return { events, ok: false, error: 'Order is not waiting for warehouse picking.' }
  }
  return {
    ok: true,
    events: completeStep(events, 'vn_picking', 'vn_packed', {
      now: input.now || new Date(),
      updatedBy: input.updatedBy || 'staff',
      note: input.note,
    }),
  }
}

export function markOutForConfirmShipment(
  events: PartnerOrderShipmentEvent[],
  source: PartnerFulfillmentSource,
  input: { now?: Date; updatedBy?: string; note?: string }
): { events: PartnerOrderShipmentEvent[]; ok: boolean; error?: string } {
  const active = events.find((row) => row.status === 'active')
  const expected: ShipmentStepKey = source === FULFILLMENT_CHINA ? 'domestic_shipping' : 'vn_packed'
  if (!active || active.stepKey !== expected) {
    return { events, ok: false, error: 'Order is not ready to send to shipper.' }
  }
  return {
    ok: true,
    events: completeStep(events, expected, 'awaiting_confirm', {
      now: input.now || new Date(),
      updatedBy: input.updatedBy || 'staff',
      note: input.note,
    }),
  }
}

export function applyEmsImportToShipmentEvents(
  events: PartnerOrderShipmentEvent[],
  shippingStatus: 'shipping' | 'delivered' | 'returned',
  now = new Date()
): PartnerOrderShipmentEvent[] {
  if (shippingStatus === 'returned') {
    return skipRemainingShipmentEvents(events, now)
  }
  const completeThrough: ShipmentStepKey = shippingStatus === 'delivered' ? 'awaiting_confirm' : 'awaiting_confirm'
  const throughIndex = events.findIndex((row) => row.stepKey === completeThrough)
  return events.map((event, index) => {
    if (shippingStatus === 'shipping' && event.stepKey === 'awaiting_confirm') {
      return {
        ...event,
        status: 'active',
        updatedBy: 'ems',
      }
    }
    if (throughIndex >= 0 && index < throughIndex) {
      return {
        ...event,
        status: 'completed',
        completedAt: event.completedAt || now.toISOString(),
        updatedBy: 'ems',
      }
    }
    if (shippingStatus === 'delivered' && event.stepKey === 'awaiting_confirm') {
      return {
        ...event,
        status: 'completed',
        completedAt: now.toISOString(),
        updatedBy: 'ems',
      }
    }
    return event
  })
}

export function confirmReceivedShipment(
  events: PartnerOrderShipmentEvent[],
  input: { now?: Date; updatedBy?: string; note?: string } = {}
): { events: PartnerOrderShipmentEvent[]; ok: boolean; error?: string } {
  const active = events.find((row) => row.status === 'active')
  if (!active || active.stepKey !== 'awaiting_confirm') {
    return { events, ok: false, error: 'Order is not waiting for customer confirmation.' }
  }
  return {
    ok: true,
    events: completeStep(events, 'awaiting_confirm', null, {
      now: input.now || new Date(),
      updatedBy: input.updatedBy || 'customer',
      note: input.note,
    }),
  }
}

export function canConfirmReceivedFromShipment(events: PartnerOrderShipmentEvent[]): boolean {
  const awaiting = events.find((row) => row.stepKey === 'awaiting_confirm')
  return awaiting?.status === 'active'
}

export function isManualShipmentStep(step: ShipmentStepKey): boolean {
  return MANUAL_CHINA_STEPS.includes(step) || MANUAL_VN_STEPS.includes(step)
}

import {
  fetchPartnerOrderLinesFromPg,
  insertPartnerOrderEventFromPg,
  patchPartnerOrderDepositExceptionFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { depositReminderCopy, depositReminderHoursDue } from '@/lib/messaging/fulfillment/deposit-sla'
import { emailCustomerDepositReminder } from '@/lib/messaging/partner-order-customer-email'
import {
  adjustPartnerInventoryStockQtyFromPg,
  applyEmsImportToPartnerOrderShipmentFromPg,
  fetchDueAutoAdvanceShipmentOrderIdsFromPg,
  fetchPartnerDepositReminderDueFromPg,
  fetchPartnerOrderFulfillmentContextFromPg,
  fetchPartnerOrderShipmentEventsFromPg,
  fetchVietnamDepositHoldDueFromPg,
  markPartnerOrderDepositRemindedFromPg,
  markPartnerOrderLineStockDeductedFromPg,
  markPartnerOrderLineStockReservedFromPg,
  markPartnerOrderStockHoldReleasedFromPg,
  replacePartnerOrderShipmentEventsFromPg,
  seedPartnerOrderShipmentTimelineFromPg,
  skipPartnerOrderShipmentTimelineFromPg,
} from '@/lib/db/messaging-partner-order-shipment-pg'
import { FULFILLMENT_VIETNAM, type PartnerFulfillmentSource } from '@/lib/messaging/fulfillment/fulfillment-routing'
import {
  advanceAutoShipmentMilestones,
  canConfirmReceivedFromShipment,
  clearCustomsShipment,
  confirmReceivedShipment,
  markOutForConfirmShipment,
  startVietnamPackingShipment,
} from '@/lib/messaging/fulfillment/order-shipment-timeline'

export async function seedPartnerOrderTimelineIfReady(input: {
  orderId: string
  status: string
  requiredAmount: number
  paidAmount: number
  fulfillmentSource: PartnerFulfillmentSource
  shopName: string
}): Promise<void> {
  const noDeposit = Math.max(0, Math.round(input.requiredAmount || 0)) <= 0
  const paidEnough = Math.max(0, Math.round(input.paidAmount || 0)) >= Math.max(0, Math.round(input.requiredAmount || 0))
  if (input.status === 'cancelled') return
  if (!(input.status === 'paid_verified' || noDeposit || paidEnough)) return
  await seedPartnerOrderShipmentTimelineFromPg({
    orderId: input.orderId,
    source: input.fulfillmentSource,
    shopName: input.shopName,
  })
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set shipping_status = case
             when shipping_status in ('pending', 'confirmed') then 'confirmed'
             else shipping_status
           end,
           updated_at = now()
       where id = $1::uuid
         and shipping_status in ('pending')`,
      [input.orderId]
    )
  } catch (e) {
    console.warn('[seedPartnerOrderTimelineIfReady]', e)
  }
}

export async function holdVietnamWarehouseStockForDeposit(input: {
  partnerId: string
  orderId: string
  fulfillmentSource: PartnerFulfillmentSource
  requiredAmount: number
}): Promise<void> {
  if (input.fulfillmentSource !== FULFILLMENT_VIETNAM) return
  if (Math.max(0, input.requiredAmount) <= 0) return
  const lines = await fetchPartnerOrderLinesFromPg(input.orderId)
  for (const line of lines) {
    if (line.fulfillment_source && line.fulfillment_source !== 'vietnam') continue
    if (!line.product_inventory_id) continue
    await adjustPartnerInventoryStockQtyFromPg({
      partnerId: input.partnerId,
      inventoryId: line.product_inventory_id,
      delta: -Math.max(1, line.quantity),
    })
  }
  await markPartnerOrderLineStockReservedFromPg({ orderId: input.orderId, reserved: true })
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set stock_hold_expires_at = now() + interval '24 hours',
           updated_at = now()
       where id = $1::uuid and stock_hold_expires_at is null`,
      [input.orderId]
    )
  } catch (e) {
    console.warn('[holdVietnamWarehouseStockForDeposit]', e)
  }
}

export async function releaseVietnamWarehouseStockHold(input: {
  partnerId: string
  orderId: string
}): Promise<void> {
  const lines = await fetchPartnerOrderLinesFromPg(input.orderId)
  for (const line of lines) {
    if (!line.warehouse_stock_reserved_at || line.warehouse_stock_deducted_at) continue
    if (!line.product_inventory_id) continue
    await adjustPartnerInventoryStockQtyFromPg({
      partnerId: input.partnerId,
      inventoryId: line.product_inventory_id,
      delta: Math.max(1, line.quantity),
    })
  }
  await markPartnerOrderLineStockReservedFromPg({ orderId: input.orderId, reserved: false })
  await markPartnerOrderStockHoldReleasedFromPg(input.orderId)
}

export async function onPartnerOrderCancelledFulfillment(orderId: string): Promise<void> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!ctx) return
  await skipPartnerOrderShipmentTimelineFromPg(orderId)
  await releaseVietnamWarehouseStockHold({ partnerId: ctx.partnerId, orderId })
}

export async function onPartnerOrderPaidVerifiedFulfillment(orderId: string): Promise<void> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!ctx) return
  await markPartnerOrderLineStockDeductedFromPg(orderId)
  await patchPartnerOrderDepositExceptionFromPg({ orderId, depositException: false })
  await seedPartnerOrderTimelineIfReady({
    orderId,
    status: 'paid_verified',
    requiredAmount: 0,
    paidAmount: 1,
    fulfillmentSource: ctx.fulfillmentSource,
    shopName: ctx.shopName,
  })
}

export async function advanceDuePartnerOrderShipmentTimelines(): Promise<{ advanced: number }> {
  const ids = await fetchDueAutoAdvanceShipmentOrderIdsFromPg(80)
  let advanced = 0
  for (const orderId of ids) {
    const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
    const next = advanceAutoShipmentMilestones(events)
    if (!next.changed) continue
    await replacePartnerOrderShipmentEventsFromPg(orderId, next.events)
    advanced += 1
  }
  return { advanced }
}

export async function releaseOverdueVietnamDepositHolds(): Promise<{ released: number }> {
  const due = await fetchVietnamDepositHoldDueFromPg(80)
  for (const row of due) {
    await releaseVietnamWarehouseStockHold({ partnerId: row.partnerId, orderId: row.id })
    await insertPartnerOrderEventFromPg({
      orderId: row.id,
      eventType: 'deposit_hold',
      title: 'Hết hạn giữ tồn kho Việt Nam',
      detail: 'Đã nhả tồn VN vì quá hạn cọc. Đơn Trung Quốc không tự hủy.',
      source: 'system',
    })
  }
  return { released: due.length }
}

export async function sendDuePartnerDepositReminders(): Promise<{ reminded: number }> {
  const due = await fetchPartnerDepositReminderDueFromPg(80)
  let reminded = 0
  for (const row of due) {
    const hours = depositReminderHoursDue({
      createdAt: row.createdAt,
      remindedAt2h: row.remindedAt2h,
      remindedAt20h: row.remindedAt20h,
    })
    for (const hour of hours) {
      const copy = depositReminderCopy({
        shopName: row.shopName,
        orderCode: row.paymentReference || row.id.slice(0, 8),
        hours: hour,
      })
      await insertPartnerOrderEventFromPg({
        orderId: row.id,
        eventType: 'deposit_remind',
        title: copy.title,
        detail: copy.detail,
        source: 'system',
      })
      const email = row.customerEmail.trim().toLowerCase()
      if (email) {
        try {
          await emailCustomerDepositReminder({
            partnerId: row.partnerId,
            orderId: row.id,
            customerEmail: email,
            shopName: row.shopName,
            paymentReference: row.paymentReference,
            paymentQrUrl: row.paymentQrUrl,
            requiredAmount: Number(row.requiredAmount) || 0,
            paidAmount: Number(row.paidAmount) || 0,
            hours: hour,
          })
        } catch (e) {
          console.warn('[sendDuePartnerDepositReminders] mail', e)
        }
      }
      await markPartnerOrderDepositRemindedFromPg(row.id, hour)
      reminded += 1
    }
  }
  return { reminded }
}

export async function runPartnerOrderFulfillmentCron(): Promise<{
  advanced: number
  released: number
  reminded: number
}> {
  const advanced = await advanceDuePartnerOrderShipmentTimelines()
  const released = await releaseOverdueVietnamDepositHolds()
  const reminded = await sendDuePartnerDepositReminders()
  return { advanced: advanced.advanced, released: released.released, reminded: reminded.reminded }
}

export async function runAdminShipmentAction(input: {
  orderId: string
  action: 'clear_customs' | 'start_vn_packing' | 'mark_out_for_confirm'
  updatedBy: string
  note?: string
  shippingProvider?: string
  trackingNumber?: string
}): Promise<{ ok: true } | { error: string }> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(input.orderId)
  if (!ctx) return { error: 'Order not found.' }
  if (ctx.status === 'cancelled') return { error: 'Order cancelled.' }
  let events = await fetchPartnerOrderShipmentEventsFromPg(input.orderId)
  if (events.length === 0) {
    events = await seedPartnerOrderShipmentTimelineFromPg({
      orderId: input.orderId,
      source: ctx.fulfillmentSource,
      shopName: ctx.shopName,
    })
  }
  const now = new Date()
  if (input.action === 'clear_customs') {
    const out = clearCustomsShipment(events, { now, updatedBy: input.updatedBy, note: input.note })
    if (!out.ok) return { error: out.error || 'Cannot clear customs.' }
    await replacePartnerOrderShipmentEventsFromPg(input.orderId, out.events)
    await insertPartnerOrderEventFromPg({
      orderId: input.orderId,
      eventType: 'shipment',
      title: 'Đã thông quan',
      detail: input.note || '',
      source: 'shop',
      createdBy: input.updatedBy,
    })
    return { ok: true }
  }
  if (input.action === 'start_vn_packing') {
    const out = startVietnamPackingShipment(events, { now, updatedBy: input.updatedBy, note: input.note })
    if (!out.ok) return { error: out.error || 'Cannot start packing.' }
    await replacePartnerOrderShipmentEventsFromPg(input.orderId, out.events)
    if (isPgConfigured()) {
      await pgQuery(
        `update public.messaging_partner_orders set shipping_status = 'packing', updated_at = now() where id = $1::uuid`,
        [input.orderId]
      )
    }
    await insertPartnerOrderEventFromPg({
      orderId: input.orderId,
      eventType: 'shipment',
      title: 'Bắt đầu soạn hàng kho Việt Nam',
      detail: input.note || '',
      source: 'shop',
      createdBy: input.updatedBy,
    })
    return { ok: true }
  }
  const out = markOutForConfirmShipment(events, ctx.fulfillmentSource, {
    now,
    updatedBy: input.updatedBy,
    note: input.note,
  })
  if (!out.ok) return { error: out.error || 'Cannot mark out for delivery.' }
  await replacePartnerOrderShipmentEventsFromPg(input.orderId, out.events)
  const tracking = String(input.trackingNumber || '').trim()
  const provider = String(input.shippingProvider || 'EMS').trim() || 'EMS'
  if (isPgConfigured()) {
    await pgQuery(
      `update public.messaging_partner_orders
       set shipping_status = 'shipping',
           shipping_provider = case when $2 <> '' then $2 else shipping_provider end,
           tracking_number = case when $3 <> '' then $3 else tracking_number end,
           updated_at = now()
       where id = $1::uuid`,
      [input.orderId, provider, tracking]
    )
  }
  await insertPartnerOrderEventFromPg({
    orderId: input.orderId,
    eventType: 'shipment',
    title: 'Đã gửi shipper, chờ khách xác nhận',
    detail: tracking ? `${provider} ${tracking}` : provider,
    source: 'shop',
    createdBy: input.updatedBy,
  })
  return { ok: true }
}

export async function partnerOrderCanConfirmReceived(orderId: string, shippingStatus: string): Promise<boolean> {
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  if (events.length > 0) return canConfirmReceivedFromShipment(events)
  return shippingStatus === 'shipping'
}

export async function onPartnerOrderCustomerConfirmedReceived(orderId: string): Promise<void> {
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  if (events.length === 0) return
  const result = confirmReceivedShipment(events, { updatedBy: 'customer' })
  if (!result.ok) return
  await replacePartnerOrderShipmentEventsFromPg(orderId, result.events)
}

export { applyEmsImportToPartnerOrderShipmentFromPg }

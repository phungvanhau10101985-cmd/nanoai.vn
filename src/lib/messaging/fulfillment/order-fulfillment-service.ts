import {
  fetchPartnerOrderByIdForPartnerFromPg,
  insertPartnerOrderEventFromPg,
  patchPartnerOrderDepositExceptionFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { pgQuery } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import { listDuePartnerEmsRecordsForRecurringSyncFromPg } from '@/lib/db/messaging-partner-ems-shipping-pg'
import { depositReminderCopy, depositReminderHoursDue } from '@/lib/messaging/fulfillment/deposit-sla'
import {
  emailCustomerDepositReminder,
  emailCustomerShippingStatusChanged,
} from '@/lib/messaging/partner-order-customer-email'
import {
  applyEmsImportToPartnerOrderShipmentFromPg as applyEmsTimelineFromPg,
  deductPartnerOrderWarehouseStockFromPg,
  fetchDueAutoAdvanceShipmentOrderIdsFromPg,
  fetchPartnerDepositReminderDueFromPg,
  fetchPartnerOrderFulfillmentContextFromPg,
  fetchPartnerOrderShipmentEventsFromPg,
  fetchVietnamDepositHoldDueFromPg,
  markPartnerOrderDepositRemindedFromPg,
  markPartnerOrderStockHoldReleasedFromPg,
  releasePartnerOrderWarehouseStockFromPg,
  reservePartnerOrderWarehouseStockFromPg,
  replacePartnerOrderShipmentEventsFromPg,
  seedPartnerOrderShipmentTimelineFromPg,
  type PartnerWarehouseStockMutationResult,
} from '@/lib/db/messaging-partner-order-shipment-pg'
import { FULFILLMENT_VIETNAM, type PartnerFulfillmentSource } from '@/lib/messaging/fulfillment/fulfillment-routing'
import {
  canConfirmReceivedFromShipment,
  transitionShipmentStateForTenant,
  type ShipmentStepKey,
} from '@/lib/messaging/fulfillment/order-shipment-timeline'
import { refreshEmsRecordTracking } from '@/lib/messaging/shipping/ems-shipment-import'
import { runPartnerOrderLifecycleHook } from '@/lib/messaging/fulfillment/order-lifecycle-hook'
import { partnerOrderShippingTransitionSql } from '@/lib/messaging/fulfillment/order-lifecycle-transition'

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
      `update public.messaging_partner_orders o
       set shipping_status = case
             when shipping_status in ('pending', 'confirmed') then 'confirmed'
             else shipping_status
           end,
           updated_at = now()
       where o.id = $1::uuid
         and ${partnerOrderShippingTransitionSql("'confirmed'")}`,
      [input.orderId]
    )
  } catch (e) {
    console.warn('[seedPartnerOrderTimelineIfReady]', e)
  }
}

export async function reserveVietnamWarehouseStockForOrder(input: {
  partnerId: string
  orderId: string
  fulfillmentSource: PartnerFulfillmentSource
  requiredAmount: number
}): Promise<PartnerWarehouseStockMutationResult> {
  if (input.fulfillmentSource !== FULFILLMENT_VIETNAM) return { ok: true, changed: false }
  const reserved = await reservePartnerOrderWarehouseStockFromPg(input)
  if (!reserved.ok) return reserved
  if (!isPgConfigured()) return reserved
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set stock_hold_expires_at = case
             when $2::numeric > 0 then now() + interval '24 hours'
             else null
           end,
           stock_hold_released_at = null,
           deposit_hold_overdue = false,
           updated_at = now()
       where id = $1::uuid`,
      [input.orderId, Math.max(0, input.requiredAmount)]
    )
  } catch (e) {
    console.warn('[reserveVietnamWarehouseStockForOrder]', e)
  }
  return reserved
}

/** Backward-compatible export for callers outside checkout. COD is reserved too. */
export const holdVietnamWarehouseStockForDeposit = reserveVietnamWarehouseStockForOrder

export async function cancelPartnerOrderAfterStockFailure(input: {
  partnerId: string
  orderId: string
}): Promise<void> {
  if (!isPgConfigured()) return
  const cancelled = await pgQuery<{ id: string }>(
    `update public.messaging_partner_orders o
     set status = 'cancelled',
         verified_note = 'Checkout cancelled: warehouse stock unavailable.',
         updated_at = now()
     where o.id = $1::uuid and o.partner_id = $2::uuid
       and o.status in ('awaiting_payment', 'payment_checking')
       and coalesce(o.shipping_status, 'pending') in ('pending', 'confirmed', 'packing')
     returning o.id::text`,
    [input.orderId, input.partnerId]
  )
  if (cancelled.length > 0) {
    await runPartnerOrderLifecycleHook({ ...input, event: 'cancelled' })
  }
}

export async function releaseVietnamWarehouseStockHold(input: {
  partnerId: string
  orderId: string
}): Promise<void> {
  const released = await releasePartnerOrderWarehouseStockFromPg(input)
  if (released.ok && released.changed) await markPartnerOrderStockHoldReleasedFromPg(input.orderId)
}

export async function onPartnerOrderCancelledFulfillment(orderId: string): Promise<void> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!ctx) return
  await runPartnerOrderLifecycleHook({
    partnerId: ctx.partnerId,
    orderId,
    event: 'cancelled',
  })
}

export async function onPartnerOrderPaidVerifiedFulfillment(
  orderId: string
): Promise<PartnerWarehouseStockMutationResult> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!ctx) return { ok: false, reason: 'database_error', shortages: [] }
  const reserved = await reserveVietnamWarehouseStockForOrder({
    partnerId: ctx.partnerId,
    orderId,
    fulfillmentSource: ctx.fulfillmentSource,
    requiredAmount: 0,
  })
  if (!reserved.ok) {
    await patchPartnerOrderDepositExceptionFromPg({
      orderId,
      depositException: true,
      note:
        reserved.reason === 'shortage'
          ? `Thanh toán đến sau khi hết hạn giữ kho; không thể giữ lại ${reserved.shortages
              .map((row) => `${row.inventoryId}:${row.requested}/${row.available}`)
              .join(', ')}.`
          : 'Không thể giữ lại tồn kho khi xác nhận thanh toán.',
    })
    return reserved
  }
  const deducted = await deductPartnerOrderWarehouseStockFromPg({
    partnerId: ctx.partnerId,
    orderId,
  })
  if (!deducted.ok) {
    await patchPartnerOrderDepositExceptionFromPg({
      orderId,
      depositException: true,
      note: 'Đã nhận thanh toán nhưng không thể khấu trừ tồn kho; cần xử lý thủ công.',
    })
    return deducted
  }
  await patchPartnerOrderDepositExceptionFromPg({ orderId, depositException: false })
  await seedPartnerOrderTimelineIfReady({
    orderId,
    status: 'paid_verified',
    requiredAmount: 0,
    paidAmount: 1,
    fulfillmentSource: ctx.fulfillmentSource,
    shopName: ctx.shopName,
  })
  return deducted
}

export async function advanceDuePartnerOrderShipmentTimelines(): Promise<{ advanced: number }> {
  const ids = await fetchDueAutoAdvanceShipmentOrderIdsFromPg(80)
  let advanced = 0
  for (const orderId of ids) {
    const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
    const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
    if (!ctx) continue
    const next = transitionShipmentStateForTenant(ctx.partnerId, {
      events,
      source: ctx.fulfillmentSource,
      actor: 'cron',
      trigger: 'auto_due',
    })
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
            conversationId: row.conversationId,
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
  emsRefreshed: number
}> {
  const advanced = await advanceDuePartnerOrderShipmentTimelines()
  const released = await releaseOverdueVietnamDepositHolds()
  const reminded = await sendDuePartnerDepositReminders()
  const dueEms = await listDuePartnerEmsRecordsForRecurringSyncFromPg()
  let emsRefreshed = 0
  for (const record of dueEms) {
    try {
      await refreshEmsRecordTracking({ partnerId: record.partner_id, record })
      emsRefreshed += 1
    } catch (error) {
      console.warn('[runPartnerOrderFulfillmentCron] EMS refresh', record.id, error)
    }
  }
  return { advanced: advanced.advanced, released: released.released, reminded: reminded.reminded, emsRefreshed }
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
    const out = transitionShipmentStateForTenant(ctx.partnerId, {
      events,
      source: ctx.fulfillmentSource,
      actor: 'admin',
      trigger: 'admin_clear_customs',
      now,
      updatedBy: input.updatedBy,
      note: input.note,
    })
    if (!out.ok) return { error: out.error || 'Cannot clear customs.' }
    await replacePartnerOrderShipmentEventsFromPg(input.orderId, out.events)
    if (isPgConfigured()) {
      await pgQuery(
        `update public.messaging_partner_orders o
         set shipping_status = 'shipping', updated_at = now()
         where o.id = $1::uuid
           and ${partnerOrderShippingTransitionSql("'shipping'")}`,
        [input.orderId]
      )
    }
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
    const out = transitionShipmentStateForTenant(ctx.partnerId, {
      events,
      source: ctx.fulfillmentSource,
      actor: 'admin',
      trigger: 'admin_start_vn_packing',
      now,
      updatedBy: input.updatedBy,
      note: input.note,
    })
    if (!out.ok) return { error: out.error || 'Cannot start packing.' }
    const deducted = await deductPartnerOrderWarehouseStockFromPg({
      partnerId: ctx.partnerId,
      orderId: input.orderId,
    })
    if (!deducted.ok) return { error: 'Cannot deduct reserved warehouse stock.' }
    await replacePartnerOrderShipmentEventsFromPg(input.orderId, out.events)
    if (isPgConfigured()) {
      await pgQuery(
        `update public.messaging_partner_orders o
         set shipping_status = 'packing', updated_at = now()
         where o.id = $1::uuid
           and ${partnerOrderShippingTransitionSql("'packing'")}`,
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
  const out = transitionShipmentStateForTenant(ctx.partnerId, {
    events,
    source: ctx.fulfillmentSource,
    actor: 'admin',
    trigger: 'admin_mark_out_for_confirm',
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
      `update public.messaging_partner_orders o
       set shipping_status = 'shipping',
           shipping_provider = case when $2 <> '' then $2 else shipping_provider end,
           tracking_number = case when $3 <> '' then $3 else tracking_number end,
           updated_at = now()
       where o.id = $1::uuid
         and ${partnerOrderShippingTransitionSql("'shipping'")}`,
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
  const shipped = await fetchPartnerOrderByIdForPartnerFromPg(ctx.partnerId, input.orderId)
  if (shipped) {
    try {
      await emailCustomerShippingStatusChanged({ order: shipped })
    } catch (e) {
      console.warn('[runAdminShipmentAction] shipper customer notify', e)
    }
  }
  return { ok: true }
}

export async function partnerOrderCanConfirmReceived(orderId: string, shippingStatus: string): Promise<boolean> {
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  if (events.length === 0) return false
  return shippingStatus === 'shipping' && canConfirmReceivedFromShipment(events)
}

export async function onPartnerOrderCustomerConfirmedReceived(orderId: string): Promise<void> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!ctx) return
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  if (events.length === 0) return
  const result = transitionShipmentStateForTenant(ctx.partnerId, {
    events,
    source: ctx.fulfillmentSource,
    actor: 'customer',
    trigger: 'customer_confirm_received',
    updatedBy: 'customer',
  })
  if (!result.ok) return
  await replacePartnerOrderShipmentEventsFromPg(orderId, result.events)
}

export async function applyEmsImportToPartnerOrderShipmentFromPg(input: {
  orderId: string
  shippingStatus: 'shipping' | 'delivered' | 'returned'
}): Promise<{ ok: boolean; blockedAt?: ShipmentStepKey; error?: string }> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(input.orderId)
  if (!ctx) return { ok: false }
  if (input.shippingStatus === 'shipping' || input.shippingStatus === 'delivered') {
    const deducted = await deductPartnerOrderWarehouseStockFromPg({
      partnerId: ctx.partnerId,
      orderId: input.orderId,
    })
    if (!deducted.ok) return { ok: false }
  }
  return applyEmsTimelineFromPg(input)
}

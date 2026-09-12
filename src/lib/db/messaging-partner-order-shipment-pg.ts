import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { isPgConfigured } from '@/lib/db/pool'
import type { PartnerFulfillmentSource, PartnerSourcePlatform } from '@/lib/messaging/fulfillment/fulfillment-routing'
import {
  applyEmsImportToShipmentEvents,
  buildInitialShipmentEvents,
  skipRemainingShipmentEvents,
  type PartnerOrderShipmentEvent,
  type ShipmentEventStatus,
  type ShipmentStepKey,
} from '@/lib/messaging/fulfillment/order-shipment-timeline'

export type PartnerOrderShipmentEventRow = PartnerOrderShipmentEvent & {
  id: string
  orderId: string
}

function mapEvent(r: Record<string, unknown>): PartnerOrderShipmentEventRow {
  return {
    id: String(r.id),
    orderId: String(r.order_id),
    stepKey: String(r.step_key) as ShipmentStepKey,
    title: String(r.title ?? ''),
    sortOrder: Number(r.sort_order) || 0,
    status: String(r.status) as ShipmentEventStatus,
    scheduledAt: r.scheduled_at ? String(r.scheduled_at) : null,
    completedAt: r.completed_at ? String(r.completed_at) : null,
    note: String(r.note ?? ''),
    updatedBy: String(r.updated_by ?? ''),
  }
}

export async function fetchPartnerOrderShipmentEventsForOrdersFromPg(
  orderIds: string[]
): Promise<Record<string, PartnerOrderShipmentEventRow[]>> {
  const out: Record<string, PartnerOrderShipmentEventRow[]> = {}
  const ids = [...new Set(orderIds.map((id) => id.trim()).filter(Boolean))]
  if (!isPgConfigured() || ids.length === 0) return out
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, order_id::text, step_key, title, sort_order, status, scheduled_at, completed_at, note, updated_by
       from public.messaging_partner_order_shipment_events
       where order_id = any($1::uuid[])
       order by sort_order asc, created_at asc`,
      [ids]
    )
    for (const row of rows) {
      const mapped = mapEvent(row)
      const list = out[mapped.orderId] || []
      list.push(mapped)
      out[mapped.orderId] = list
    }
  } catch (e) {
    const err = e as { code?: string }
    if (err.code !== '42P01' && err.code !== '42703') console.warn('[fetchPartnerOrderShipmentEventsForOrdersFromPg]', e)
  }
  return out
}

export async function fetchPartnerOrderShipmentEventsFromPg(orderId: string): Promise<PartnerOrderShipmentEventRow[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<Record<string, unknown>>(
      `select id::text, order_id::text, step_key, title, sort_order, status, scheduled_at, completed_at, note, updated_by
       from public.messaging_partner_order_shipment_events
       where order_id = $1::uuid
       order by sort_order asc, created_at asc`,
      [orderId]
    )
    return rows.map(mapEvent)
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01' || err.code === '42703') return []
    console.warn('[fetchPartnerOrderShipmentEventsFromPg]', e)
    return []
  }
}

export async function replacePartnerOrderShipmentEventsFromPg(
  orderId: string,
  events: PartnerOrderShipmentEvent[]
): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    await pgQuery(`delete from public.messaging_partner_order_shipment_events where order_id = $1::uuid`, [orderId])
    for (const event of events) {
      await pgQuery(
        `insert into public.messaging_partner_order_shipment_events (
           order_id, step_key, title, sort_order, status, scheduled_at, completed_at, note, updated_by, created_at, updated_at
         ) values ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, now(), now())`,
        [
          orderId,
          event.stepKey,
          event.title,
          event.sortOrder,
          event.status,
          event.scheduledAt,
          event.completedAt,
          event.note,
          event.updatedBy,
        ]
      )
    }
    return true
  } catch (e) {
    console.warn('[replacePartnerOrderShipmentEventsFromPg]', e)
    return false
  }
}

export async function seedPartnerOrderShipmentTimelineFromPg(input: {
  orderId: string
  source: PartnerFulfillmentSource
  shopName: string
}): Promise<PartnerOrderShipmentEventRow[]> {
  const existing = await fetchPartnerOrderShipmentEventsFromPg(input.orderId)
  if (existing.length > 0) return existing
  const seeded = buildInitialShipmentEvents({ source: input.source, shopName: input.shopName })
  await replacePartnerOrderShipmentEventsFromPg(input.orderId, seeded)
  return fetchPartnerOrderShipmentEventsFromPg(input.orderId)
}

export async function skipPartnerOrderShipmentTimelineFromPg(orderId: string): Promise<void> {
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  if (events.length === 0) return
  await replacePartnerOrderShipmentEventsFromPg(orderId, skipRemainingShipmentEvents(events))
}

export async function applyEmsImportToPartnerOrderShipmentFromPg(input: {
  orderId: string
  shippingStatus: 'shipping' | 'delivered' | 'returned'
}): Promise<void> {
  let events = await fetchPartnerOrderShipmentEventsFromPg(input.orderId)
  if (events.length === 0) {
    const ctx = await fetchPartnerOrderFulfillmentContextFromPg(input.orderId)
    if (!ctx) return
    events = await seedPartnerOrderShipmentTimelineFromPg({
      orderId: input.orderId,
      source: ctx.fulfillmentSource,
      shopName: ctx.shopName,
    })
  }
  if (events.length === 0) return
  await replacePartnerOrderShipmentEventsFromPg(
    input.orderId,
    applyEmsImportToShipmentEvents(events, input.shippingStatus)
  )
}

export async function fetchDueAutoAdvanceShipmentOrderIdsFromPg(limit = 80): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ order_id: string }>(
      `select distinct e.order_id::text as order_id
       from public.messaging_partner_order_shipment_events e
       join public.messaging_partner_orders o on o.id = e.order_id
       where e.status = 'active'
         and e.step_key in ('tq_preparing', 'tq_warehouse', 'international_shipping')
         and e.scheduled_at is not null
         and e.scheduled_at <= now()
         and o.status <> 'cancelled'
         and coalesce(o.shipping_status, 'pending') <> 'cancelled'
       order by e.order_id
       limit $1`,
      [Math.max(1, Math.min(200, Math.floor(limit)))]
    )
    return rows.map((row) => row.order_id)
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01' || err.code === '42703') return []
    console.warn('[fetchDueAutoAdvanceShipmentOrderIdsFromPg]', e)
    return []
  }
}

export async function patchPartnerOrderFulfillmentFromPg(input: {
  orderId: string
  fulfillmentSource: PartnerFulfillmentSource
  sourcePlatform: PartnerSourcePlatform | null
  checkoutGroupId: string | null
  splitIndex: number
  needsReview: boolean
  stockHoldExpiresAt?: string | null
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set fulfillment_source = $2,
           source_platform = $3,
           checkout_group_id = $4::uuid,
           split_index = $5,
           fulfillment_needs_review = $6,
           stock_hold_expires_at = coalesce($7::timestamptz, stock_hold_expires_at),
           updated_at = now()
       where id = $1::uuid`,
      [
        input.orderId,
        input.fulfillmentSource,
        input.sourcePlatform,
        input.checkoutGroupId,
        input.splitIndex,
        input.needsReview,
        input.stockHoldExpiresAt ?? null,
      ]
    )
  } catch (e) {
    console.warn('[patchPartnerOrderFulfillmentFromPg]', e)
  }
}

export async function setPartnerOrderStaffConsultedFromPg(input: {
  ownerUserId: string
  orderId: string
  contacted: boolean
}): Promise<boolean> {
  if (!isPgConfigured()) return false
  try {
    const row = await pgQueryOne<{ id: string }>(
      `update public.messaging_partner_orders o
       set staff_consultation_contacted = $3,
           updated_at = now()
       from public.messaging_partners mp
       where o.id = $1::uuid
         and mp.id = o.partner_id
         and ${sqlPartnerMpActorHasPerm(2, 'orders')}
       returning o.id::text`,
      [input.orderId, input.ownerUserId, input.contacted]
    )
    return Boolean(row?.id)
  } catch (e) {
    console.warn('[setPartnerOrderStaffConsultedFromPg]', e)
    return false
  }
}

export async function fetchPartnerOrderFulfillmentContextFromPg(orderId: string): Promise<{
  id: string
  partnerId: string
  fulfillmentSource: PartnerFulfillmentSource
  shopName: string
  status: string
  shippingStatus: string
  trackingNumber: string
  shippingProvider: string
} | null> {
  if (!isPgConfigured()) return null
  try {
    const row = await pgQueryOne<Record<string, unknown>>(
      `select o.id::text, o.partner_id::text, coalesce(o.fulfillment_source, 'vietnam') as fulfillment_source,
              coalesce(mp.display_name, '') as shop_name, o.status, coalesce(o.shipping_status, 'pending') as shipping_status,
              coalesce(o.tracking_number, '') as tracking_number, coalesce(o.shipping_provider, '') as shipping_provider
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id
       where o.id = $1::uuid
       limit 1`,
      [orderId]
    )
    if (!row) return null
    return {
      id: String(row.id),
      partnerId: String(row.partner_id),
      fulfillmentSource: String(row.fulfillment_source) === 'china' ? 'china' : 'vietnam',
      shopName: String(row.shop_name || ''),
      status: String(row.status || ''),
      shippingStatus: String(row.shipping_status || 'pending'),
      trackingNumber: String(row.tracking_number || ''),
      shippingProvider: String(row.shipping_provider || ''),
    }
  } catch (e) {
    console.warn('[fetchPartnerOrderFulfillmentContextFromPg]', e)
    return null
  }
}

export async function adjustPartnerInventoryStockQtyFromPg(input: {
  partnerId: string
  inventoryId: string
  delta: number
}): Promise<void> {
  if (!isPgConfigured() || !input.inventoryId) return
  try {
    await pgQuery(
      `update public.messaging_partner_inventory
       set stock_qty = greatest(0, coalesce(stock_qty, 0) + $3::int),
           updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid`,
      [input.inventoryId, input.partnerId, Math.trunc(input.delta)]
    )
  } catch (e) {
    console.warn('[adjustPartnerInventoryStockQtyFromPg]', e)
  }
}

export async function markPartnerOrderLineStockDeductedFromPg(orderId: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_order_lines
       set warehouse_stock_deducted_at = now(), updated_at = now()
       where order_id = $1::uuid
         and warehouse_stock_reserved_at is not null
         and warehouse_stock_deducted_at is null`,
      [orderId]
    )
  } catch (e) {
    const err = e as { code?: string }
    if (err.code !== '42P01' && err.code !== '42703') console.warn('[markPartnerOrderLineStockDeductedFromPg]', e)
  }
}

export async function markPartnerOrderLineStockReservedFromPg(input: {
  orderId: string
  reserved: boolean
}): Promise<void> {
  if (!isPgConfigured()) return
  try {
    if (input.reserved) {
      await pgQuery(
        `update public.messaging_partner_order_lines
         set warehouse_stock_reserved_at = now(), updated_at = now()
         where order_id = $1::uuid
           and fulfillment_source = 'vietnam'
           and product_inventory_id is not null
           and warehouse_stock_reserved_at is null`,
        [input.orderId]
      )
    } else {
      await pgQuery(
        `update public.messaging_partner_order_lines
         set warehouse_stock_reserved_at = null, updated_at = now()
         where order_id = $1::uuid and warehouse_stock_reserved_at is not null and warehouse_stock_deducted_at is null`,
        [input.orderId]
      )
    }
  } catch (e) {
    console.warn('[markPartnerOrderLineStockReservedFromPg]', e)
  }
}

export async function fetchVietnamDepositHoldDueFromPg(limit = 80): Promise<
  Array<{ id: string; partnerId: string }>
> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<{ id: string; partnerId: string }>(
      `select o.id::text as id, o.partner_id::text as "partnerId"
       from public.messaging_partner_orders o
       where coalesce(o.fulfillment_source, 'vietnam') = 'vietnam'
         and o.stock_hold_expires_at is not null
         and o.stock_hold_expires_at <= now()
         and o.stock_hold_released_at is null
         and o.status in ('awaiting_payment', 'payment_checking')
         and coalesce(o.required_amount, 0) > coalesce(o.paid_amount, 0)
       order by o.stock_hold_expires_at asc
       limit $1`,
      [Math.max(1, Math.min(200, Math.floor(limit)))]
    )
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01' || err.code === '42703') return []
    console.warn('[fetchVietnamDepositHoldDueFromPg]', e)
    return []
  }
}

export async function markPartnerOrderStockHoldReleasedFromPg(orderId: string): Promise<void> {
  if (!isPgConfigured()) return
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set stock_hold_released_at = now(), deposit_hold_overdue = true, updated_at = now()
       where id = $1::uuid and stock_hold_released_at is null`,
      [orderId]
    )
  } catch (e) {
    console.warn('[markPartnerOrderStockHoldReleasedFromPg]', e)
  }
}

export type PartnerDepositReminderDueRow = {
  id: string
  partnerId: string
  shopName: string
  paymentReference: string
  customerEmail: string
  createdAt: string
  remindedAt2h: string | null
  remindedAt20h: string | null
}

export async function fetchPartnerDepositReminderDueFromPg(limit = 80): Promise<PartnerDepositReminderDueRow[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<PartnerDepositReminderDueRow>(
      `select o.id::text as id,
              o.partner_id::text as "partnerId",
              coalesce(mp.display_name, '') as "shopName",
              coalesce(o.payment_reference, '') as "paymentReference",
              coalesce(o.customer_email, '') as "customerEmail",
              o.created_at::text as "createdAt",
              o.deposit_reminded_at_2h::text as "remindedAt2h",
              o.deposit_reminded_at_20h::text as "remindedAt20h"
       from public.messaging_partner_orders o
       join public.messaging_partners mp on mp.id = o.partner_id
       where o.status in ('awaiting_payment', 'payment_checking')
         and coalesce(o.required_amount, 0) > coalesce(o.paid_amount, 0)
         and (
           (o.deposit_reminded_at_2h is null and o.created_at <= now() - interval '2 hours')
           or (o.deposit_reminded_at_20h is null and o.created_at <= now() - interval '20 hours')
         )
       order by o.created_at asc
       limit $1`,
      [Math.max(1, Math.min(200, Math.floor(limit)))]
    )
  } catch (e) {
    const err = e as { code?: string }
    if (err.code === '42P01' || err.code === '42703') return []
    console.warn('[fetchPartnerDepositReminderDueFromPg]', e)
    return []
  }
}

export async function markPartnerOrderDepositRemindedFromPg(
  orderId: string,
  hours: 2 | 20
): Promise<void> {
  if (!isPgConfigured()) return
  const column = hours === 2 ? 'deposit_reminded_at_2h' : 'deposit_reminded_at_20h'
  try {
    await pgQuery(
      `update public.messaging_partner_orders
       set ${column} = coalesce(${column}, now()), updated_at = now()
       where id = $1::uuid`,
      [orderId]
    )
  } catch (e) {
    const err = e as { code?: string }
    if (err.code !== '42P01' && err.code !== '42703') console.warn('[markPartnerOrderDepositRemindedFromPg]', e)
  }
}

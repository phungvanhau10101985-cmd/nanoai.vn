import { sqlPartnerMpActorHasPerm } from '@/lib/db/messaging-partner-access-sql'
import { toPgTimestamptz } from '@/lib/db/pg-timestamptz'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import type { PartnerFulfillmentSource, PartnerSourcePlatform } from '@/lib/messaging/fulfillment/fulfillment-routing'
import {
  buildInitialShipmentEvents,
  skipRemainingShipmentEvents,
  transitionShipmentStateForTenant,
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
    scheduledAt: toPgTimestamptz(r.scheduled_at),
    completedAt: toPgTimestamptz(r.completed_at),
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
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    await client.query(
      `select id from public.messaging_partner_orders where id = $1::uuid for update`,
      [orderId]
    )
    await client.query(`delete from public.messaging_partner_order_shipment_events where order_id = $1::uuid`, [orderId])
    for (const event of events) {
      await client.query(
        `insert into public.messaging_partner_order_shipment_events (
           order_id, step_key, title, sort_order, status, scheduled_at, completed_at, note, updated_by, created_at, updated_at
         ) values ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, now(), now())`,
        [
          orderId,
          event.stepKey,
          event.title,
          event.sortOrder,
          event.status,
          toPgTimestamptz(event.scheduledAt),
          toPgTimestamptz(event.completedAt),
          event.note,
          event.updatedBy,
        ]
      )
    }
    await client.query('commit')
    return true
  } catch (e) {
    await client.query('rollback').catch(() => undefined)
    console.warn('[replacePartnerOrderShipmentEventsFromPg]', e)
    return false
  } finally {
    client.release()
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
}): Promise<{ ok: boolean; blockedAt?: ShipmentStepKey; error?: string }> {
  const ctx = await fetchPartnerOrderFulfillmentContextFromPg(input.orderId)
  if (!ctx) return { ok: false, error: 'Order not found.' }
  let events = await fetchPartnerOrderShipmentEventsFromPg(input.orderId)
  if (events.length === 0) {
    events = await seedPartnerOrderShipmentTimelineFromPg({
      orderId: input.orderId,
      source: ctx.fulfillmentSource,
      shopName: ctx.shopName,
    })
  }
  if (events.length === 0) return { ok: false, error: 'Shipment timeline unavailable.' }
  const result = transitionShipmentStateForTenant(ctx.partnerId, {
    events,
    source: ctx.fulfillmentSource,
    actor: 'ems',
    trigger:
      input.shippingStatus === 'returned'
        ? 'ems_returned'
        : input.shippingStatus === 'delivered'
          ? 'ems_delivered'
          : 'ems_shipping',
  })
  if (result.changed) await replacePartnerOrderShipmentEventsFromPg(input.orderId, result.events)
  return { ok: result.ok, blockedAt: result.blockedAt, error: result.error }
}

export async function fetchDueAutoAdvanceShipmentOrderIdsFromPg(limit = 80): Promise<string[]> {
  if (!isPgConfigured()) return []
  try {
    const rows = await pgQuery<{ order_id: string }>(
      `select e.order_id::text as order_id
       from public.messaging_partner_order_shipment_events e
       join public.messaging_partner_orders o on o.id = e.order_id
       where e.status = 'active'
         and e.step_key in ('tq_preparing', 'tq_warehouse', 'international_shipping')
         and e.scheduled_at is not null
         and e.scheduled_at <= now()
         and o.status <> 'cancelled'
         and coalesce(o.shipping_status, 'pending') <> 'cancelled'
       group by e.order_id
       order by order_id
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

export type PartnerWarehouseStockShortage = {
  inventoryId: string
  requested: number
  available: number
}

export type PartnerWarehouseStockMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; reason: 'not_configured' | 'shortage' | 'database_error'; shortages: PartnerWarehouseStockShortage[] }

type StockMutation = 'reserve' | 'release' | 'deduct' | 'restore'

export type PartnerWarehouseStockMarkers = {
  reservedAt: string | null
  deductedAt: string | null
  restoredAt: string | null
}

export function partnerWarehouseStockMutationForTerminal(
  markers: PartnerWarehouseStockMarkers
): 'release' | 'restore' | 'none' {
  if (markers.deductedAt && !markers.restoredAt) return 'restore'
  if (markers.reservedAt && !markers.deductedAt) return 'release'
  return 'none'
}

export function partnerWarehouseStockLinePredicate(mutation: StockMutation): string {
  if (mutation === 'reserve') {
    return `l.warehouse_stock_reserved_at is null
           and l.warehouse_stock_deducted_at is null
           and l.warehouse_stock_restored_at is null`
  }
  if (mutation === 'release') {
    return `l.warehouse_stock_reserved_at is not null
             and l.warehouse_stock_deducted_at is null`
  }
  if (mutation === 'deduct') {
    return `l.warehouse_stock_reserved_at is not null
               and l.warehouse_stock_deducted_at is null`
  }
  return `l.warehouse_stock_deducted_at is not null
               and l.warehouse_stock_restored_at is null`
}

export function validatePartnerWarehouseStockAvailability(
  requested: Array<{ inventoryId: string; quantity: number }>,
  inventory: Array<{ id: string; stockQty: number; warehouseReserved: number }>,
  mode: 'reserve' | 'deduct'
): PartnerWarehouseStockShortage[] {
  const byId = new Map(inventory.map((row) => [row.id, row]))
  return requested.flatMap((line) => {
    const row = byId.get(line.inventoryId)
    const available = row
      ? mode === 'reserve'
        ? Math.max(0, row.stockQty - row.warehouseReserved)
        : Math.max(0, row.stockQty)
      : 0
    return available < line.quantity
      ? [{ inventoryId: line.inventoryId, requested: line.quantity, available }]
      : []
  })
}

/**
 * Locks all affected inventory rows and mutates inventory + line markers in one
 * transaction. stock_qty is physical stock; warehouse_reserved is additive.
 */
async function mutatePartnerOrderWarehouseStockFromPg(input: {
  partnerId: string
  orderId: string
  mutation: StockMutation
}): Promise<PartnerWarehouseStockMutationResult> {
  if (!isPgConfigured()) return { ok: false, reason: 'not_configured', shortages: [] }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    const orderLock = await client.query(
      `select id
       from public.messaging_partner_orders
       where id = $1::uuid and partner_id = $2::uuid
       for update`,
      [input.orderId, input.partnerId]
    )
    if (orderLock.rowCount !== 1) {
      await client.query('rollback')
      return { ok: false, reason: 'database_error', shortages: [] }
    }
    const linePredicate = partnerWarehouseStockLinePredicate(input.mutation)
    const lines = await client.query<{ inventory_id: string; quantity: number }>(
      `select l.product_inventory_id::text as inventory_id,
              sum(greatest(1, coalesce(l.quantity, 1)))::int as quantity
       from public.messaging_partner_order_lines l
       join public.messaging_partner_orders o on o.id = l.order_id
       where l.order_id = $1::uuid
         and o.partner_id = $2::uuid
         and l.fulfillment_source = 'vietnam'
         and l.product_inventory_id is not null
         and ${linePredicate}
       group by l.product_inventory_id
       order by l.product_inventory_id`,
      [input.orderId, input.partnerId]
    )
    if (lines.rows.length === 0) {
      await client.query('commit')
      return { ok: true, changed: false }
    }
    const ids = lines.rows.map((row) => row.inventory_id)
    const inventory = await client.query<{ id: string; stock_qty: number; warehouse_reserved: number }>(
      `select id::text, coalesce(stock_qty, 0)::int as stock_qty,
              coalesce(warehouse_reserved, 0)::int as warehouse_reserved
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])
       order by id
       for update`,
      [input.partnerId, ids]
    )
    const shortages =
      input.mutation === 'reserve' || input.mutation === 'deduct'
        ? validatePartnerWarehouseStockAvailability(
            lines.rows.map((line) => ({ inventoryId: line.inventory_id, quantity: line.quantity })),
            inventory.rows.map((row) => ({
              id: row.id,
              stockQty: Number(row.stock_qty),
              warehouseReserved: Number(row.warehouse_reserved),
            })),
            input.mutation
          )
        : []
    if (shortages.length > 0) {
      await client.query('rollback')
      return { ok: false, reason: 'shortage', shortages }
    }
    for (const line of lines.rows) {
      if (input.mutation === 'reserve') {
        await client.query(
          `update public.messaging_partner_inventory
           set warehouse_reserved = warehouse_reserved + $3::int, updated_at = now()
           where id = $1::uuid and partner_id = $2::uuid`,
          [line.inventory_id, input.partnerId, line.quantity]
        )
      } else if (input.mutation === 'release') {
        await client.query(
          `update public.messaging_partner_inventory
           set warehouse_reserved = greatest(0, warehouse_reserved - $3::int), updated_at = now()
           where id = $1::uuid and partner_id = $2::uuid`,
          [line.inventory_id, input.partnerId, line.quantity]
        )
      } else if (input.mutation === 'deduct') {
        await client.query(
          `update public.messaging_partner_inventory
           set stock_qty = stock_qty - $3::int,
               warehouse_reserved = greatest(0, warehouse_reserved - $3::int),
               updated_at = now()
           where id = $1::uuid and partner_id = $2::uuid`,
          [line.inventory_id, input.partnerId, line.quantity]
        )
      } else {
        await client.query(
          `update public.messaging_partner_inventory
           set stock_qty = stock_qty + $3::int, updated_at = now()
           where id = $1::uuid and partner_id = $2::uuid`,
          [line.inventory_id, input.partnerId, line.quantity]
        )
      }
    }
    if (input.mutation === 'reserve') {
      await client.query(
        `update public.messaging_partner_order_lines
         set warehouse_stock_reserved_at = now(),
             warehouse_stock_additive = true,
             updated_at = now()
         where order_id = $1::uuid and fulfillment_source = 'vietnam'
           and product_inventory_id is not null
           and warehouse_stock_reserved_at is null
           and warehouse_stock_deducted_at is null
           and warehouse_stock_restored_at is null`,
        [input.orderId]
      )
    } else if (input.mutation === 'release') {
      await client.query(
        `update public.messaging_partner_order_lines
         set warehouse_stock_reserved_at = null, updated_at = now()
         where order_id = $1::uuid
           and warehouse_stock_reserved_at is not null
           and warehouse_stock_deducted_at is null`,
        [input.orderId]
      )
    } else if (input.mutation === 'deduct') {
      await client.query(
        `update public.messaging_partner_order_lines
         set warehouse_stock_deducted_at = now(), updated_at = now()
         where order_id = $1::uuid
           and warehouse_stock_reserved_at is not null
           and warehouse_stock_deducted_at is null`,
        [input.orderId]
      )
    } else {
      await client.query(
        `update public.messaging_partner_order_lines
         set warehouse_stock_restored_at = now(), updated_at = now()
         where order_id = $1::uuid
           and warehouse_stock_deducted_at is not null
           and warehouse_stock_restored_at is null`,
        [input.orderId]
      )
    }
    await client.query('commit')
    return { ok: true, changed: true }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    console.warn(`[mutatePartnerOrderWarehouseStockFromPg:${input.mutation}]`, error)
    return { ok: false, reason: 'database_error', shortages: [] }
  } finally {
    client.release()
  }
}

export const reservePartnerOrderWarehouseStockFromPg = (input: { partnerId: string; orderId: string }) =>
  mutatePartnerOrderWarehouseStockFromPg({ ...input, mutation: 'reserve' })

export const releasePartnerOrderWarehouseStockFromPg = (input: { partnerId: string; orderId: string }) =>
  mutatePartnerOrderWarehouseStockFromPg({ ...input, mutation: 'release' })

export const deductPartnerOrderWarehouseStockFromPg = (input: { partnerId: string; orderId: string }) =>
  mutatePartnerOrderWarehouseStockFromPg({ ...input, mutation: 'deduct' })

export const restorePartnerOrderWarehouseStockFromPg = (input: { partnerId: string; orderId: string }) =>
  mutatePartnerOrderWarehouseStockFromPg({ ...input, mutation: 'restore' })

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
  paymentQrUrl: string
  requiredAmount: number
  paidAmount: number
  createdAt: string
  remindedAt2h: string | null
  remindedAt20h: string | null
  conversationId: string | null
}

export async function fetchPartnerDepositReminderDueFromPg(limit = 80): Promise<PartnerDepositReminderDueRow[]> {
  if (!isPgConfigured()) return []
  try {
    return await pgQuery<PartnerDepositReminderDueRow>(
      `select o.id::text as id,
              o.partner_id::text as "partnerId",
              coalesce(nullif(trim(mp.brand_name), ''), mp.display_name, '') as "shopName",
              coalesce(o.payment_reference, '') as "paymentReference",
              coalesce(o.customer_email, '') as "customerEmail",
              coalesce(o.payment_qr_url, '') as "paymentQrUrl",
              coalesce(o.required_amount, 0)::float8 as "requiredAmount",
              coalesce(o.paid_amount, 0)::float8 as "paidAmount",
              o.created_at::text as "createdAt",
              o.deposit_reminded_at_2h::text as "remindedAt2h",
              o.deposit_reminded_at_20h::text as "remindedAt20h",
              o.conversation_id::text as "conversationId"
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

import { randomUUID } from 'crypto'
import type { PoolClient } from 'pg'
import { getPgPool, isPgConfigured } from '@/lib/db/pool'
import {
  mapPartnerOrderRowFromPg,
  type PartnerOrderLineUpsertInput,
  type PartnerOrderRow,
} from '@/lib/db/messaging-partner-orders-pg'
import type { PartnerStackedDiscountSnapshot } from '@/lib/db/messaging-partner-loyalty-pg'
import type { PartnerSaleDiscountBreakdown } from '@/lib/partner-website/promotions/partner-sale-pricing'
import {
  buildSepayOrderPaymentReference,
  buildStablePaymentReference,
  formatShopSequentialOrderCode,
} from '@/lib/messaging/shop-payment-reference'

export type AtomicPartnerCheckoutGroup = {
  orderId?: string
  fulfillmentSource: 'vietnam' | 'china'
  sourcePlatform: '1688' | 'taobao' | 'tmall' | null
  checkoutGroupId: string | null
  splitIndex: number
  needsReview: boolean
  lines: PartnerOrderLineUpsertInput[]
  customerName: string
  customerEmail: string
  customerPhone: string
  shippingAddress: string
  note: string
  subtotalAmount: number
  depositPercent: number
  requiredAmount: number
  discountSnapshot: PartnerStackedDiscountSnapshot
  saleBreakdown?: PartnerSaleDiscountBreakdown
  promo?: { id: string; code: string; discountAmount: number } | null
  paymentMethod: 'cod' | 'bank_transfer' | 'ewallet'
  shippingFeeAmount: number
}

export type AtomicPartnerCheckoutInput = {
  partnerId: string
  conversationId: string
  externalThreadId: string
  shopDisplayName: string
  useSepayQr: boolean
  groups: AtomicPartnerCheckoutGroup[]
  paymentQrUrl: (input: {
    orderId: string
    paymentReference: string
    requiredAmount: number
    paymentMethod: 'cod' | 'bank_transfer' | 'ewallet'
  }) => string
}

export type AtomicPartnerCheckoutResult =
  | { ok: true; orders: PartnerOrderRow[] }
  | {
      ok: false
      reason: 'not_configured' | 'shortage' | 'database_error'
      shortages: Array<{ inventoryId: string; requested: number; available: number }>
    }

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

function percent(value: unknown): number {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
}

async function allocateReferences(
  client: PoolClient,
  input: AtomicPartnerCheckoutInput,
  orderIds: string[]
): Promise<string[]> {
  await client.query('savepoint checkout_order_code')
  try {
    const seq = await client.query<{ shop_order_seq: number }>(
      `/* atomic-checkout:allocate-codes */
       update public.messaging_partners
       set shop_order_seq = coalesce(shop_order_seq, 0) + $2::int,
           updated_at = now()
       where id = $1::uuid
       returning shop_order_seq`,
      [input.partnerId, orderIds.length]
    )
    await client.query('release savepoint checkout_order_code')
    const finalSeq = Number(seq.rows[0]?.shop_order_seq)
    if (Number.isFinite(finalSeq) && finalSeq >= orderIds.length) {
      const firstSeq = finalSeq - orderIds.length + 1
      return orderIds.map((_, index) =>
        formatShopSequentialOrderCode(input.shopDisplayName, firstSeq + index)
      )
    }
  } catch (error) {
    await client.query('rollback to savepoint checkout_order_code')
    await client.query('release savepoint checkout_order_code')
    if ((error as { code?: string })?.code !== '42703') throw error
  }
  return orderIds.map((orderId) =>
    input.useSepayQr
      ? buildSepayOrderPaymentReference(orderId, input.shopDisplayName)
      : buildStablePaymentReference(orderId, input.shopDisplayName)
  )
}

/**
 * Transaction kernel kept public for integration-style tests. The caller owns
 * BEGIN/COMMIT/ROLLBACK; every query must use this exact PoolClient.
 */
export async function createPartnerCheckoutOrdersInTransaction(
  client: PoolClient,
  input: AtomicPartnerCheckoutInput
): Promise<PartnerOrderRow[]> {
  if (input.groups.length === 0) throw new Error('atomic_checkout_empty')

  const requestedByInventory = new Map<string, number>()
  for (const group of input.groups) {
    if (group.fulfillmentSource !== 'vietnam') continue
    for (const line of group.lines) {
      const inventoryId = String(line.productInventoryId ?? '').trim()
      if (!inventoryId) continue
      requestedByInventory.set(
        inventoryId,
        (requestedByInventory.get(inventoryId) ?? 0) + Math.max(1, Math.min(99, Math.floor(line.quantity || 1)))
      )
    }
  }

  const inventoryIds = [...requestedByInventory.keys()].sort()
  if (inventoryIds.length > 0) {
    const locked = await client.query<{
      id: string
      stock_qty: number
      warehouse_reserved: number
    }>(
      `/* atomic-checkout:lock-inventory */
       select id::text, coalesce(stock_qty, 0)::int as stock_qty,
              coalesce(warehouse_reserved, 0)::int as warehouse_reserved
       from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = any($2::uuid[])
       order by id
       for update`,
      [input.partnerId, inventoryIds]
    )
    const availableById = new Map(
      locked.rows.map((row) => [
        String(row.id),
        Math.max(0, Number(row.stock_qty) - Number(row.warehouse_reserved)),
      ])
    )
    const shortages = inventoryIds.flatMap((inventoryId) => {
      const requested = requestedByInventory.get(inventoryId) ?? 0
      const available = availableById.get(inventoryId) ?? 0
      return available < requested ? [{ inventoryId, requested, available }] : []
    })
    if (shortages.length > 0) {
      const error = new Error('atomic_checkout_stock_shortage') as Error & {
        shortages?: typeof shortages
      }
      error.shortages = shortages
      throw error
    }
  }

  const orderIds = input.groups.map((group) => group.orderId || randomUUID())
  const paymentReferences = await allocateReferences(client, input, orderIds)
  const orders: PartnerOrderRow[] = []

  for (let index = 0; index < input.groups.length; index += 1) {
    const group = input.groups[index]
    const first = group.lines[0]
    if (!first) throw new Error(`atomic_checkout_group_${index + 1}_empty`)
    const orderId = orderIds[index]
    const paymentReference = paymentReferences[index]
    const paymentQrUrl = input.paymentQrUrl({
      orderId,
      paymentReference,
      requiredAmount: group.requiredAmount,
      paymentMethod: group.paymentMethod,
    })
    const snapshot = group.discountSnapshot
    const sale = group.saleBreakdown
    const inserted = await client.query<Record<string, unknown>>(
      `/* atomic-checkout:insert-order */
       insert into public.messaging_partner_orders (
         id, partner_id, conversation_id, external_thread_id, status,
         customer_name, customer_email, customer_phone, shipping_address, note,
         product_inventory_id, product_name, product_image_url, product_url,
         quantity, unit_price, subtotal_amount, deposit_percent, required_amount,
         payment_reference, payment_qr_url,
         loyalty_tier_code, loyalty_tier_name, loyalty_discount_percent, loyalty_discount_amount,
         birthday_discount_percent, birthday_discount_amount, total_discount_percent,
         total_discount_amount, amount_after_discount,
         promo_id, promo_code, promo_discount_amount,
         discount_breakdown_json, list_subtotal_amount, site_sale_discount_amount,
         google_discount_amount, discount_cap_adjustment_amount, clearance_subtotal_amount,
         payment_method, shipping_fee_amount,
         fulfillment_source, source_platform, fulfillment_needs_review,
         checkout_group_id, split_index, stock_hold_expires_at,
         stock_hold_released_at, deposit_hold_overdue, created_at, updated_at
       ) values (
         $1::uuid, $2::uuid, $3::uuid, $4, 'awaiting_payment',
         $5, $6, $7, $8, $9,
         $10::uuid, $11, $12, $13,
         $14::int, $15::numeric, $16::numeric, $17::int, $18::numeric,
         $19, $20,
         $21, $22, $23::numeric, $24::numeric,
         $25::numeric, $26::numeric, $27::numeric,
         $28::numeric, $29::numeric,
         $30::uuid, $31, $32::numeric,
         $33::jsonb, $34::numeric, $35::numeric,
         $36::numeric, $37::numeric, $38::numeric,
         $39, $40::numeric,
         $41, $42, $43,
         $44::uuid, $45::int,
         case when $41 = 'vietnam' and $18::numeric > 0 then now() + interval '24 hours' else null end,
         null, false, now(), now()
       )
       returning *`,
      [
        orderId, input.partnerId, input.conversationId, input.externalThreadId,
        group.customerName, group.customerEmail, group.customerPhone, group.shippingAddress, group.note,
        first.productInventoryId, first.productName, first.productImageUrl, first.productUrl,
        Math.max(1, Math.min(99, Math.floor(first.quantity || 1))), money(first.unitPrice),
        money(group.subtotalAmount), percent(group.depositPercent), money(group.requiredAmount),
        paymentReference, paymentQrUrl,
        snapshot.loyaltyTierCode ?? '', snapshot.loyaltyTierName ?? '',
        Number(snapshot.loyaltyDiscountPercent) || 0, money(snapshot.loyaltyDiscountAmount),
        Number(snapshot.birthdayDiscountPercent) || 0, money(snapshot.birthdayDiscountAmount),
        Number(snapshot.totalDiscountPercent) || 0, money(snapshot.totalDiscountAmount),
        money(snapshot.amountAfterDiscount),
        group.promo?.id ?? null, group.promo?.code ?? '', money(group.promo?.discountAmount),
        JSON.stringify(sale ?? {}), money(sale?.listSubtotal), money(sale?.siteSaleDiscountAmount),
        money(sale?.googleDiscountAmount), money(sale?.capAdjustmentAmount), money(sale?.clearanceSubtotal),
        group.paymentMethod, money(group.shippingFeeAmount),
        group.fulfillmentSource, group.sourcePlatform, group.needsReview,
        group.checkoutGroupId, Math.max(1, Math.floor(group.splitIndex || 1)),
      ]
    )
    if (inserted.rowCount !== 1 || !inserted.rows[0]) {
      throw new Error(`atomic_checkout_group_${index + 1}_insert_failed`)
    }

    for (const line of group.lines) {
      const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity || 1)))
      const unitPrice = money(line.unitPrice)
      await client.query(
        `/* atomic-checkout:insert-line */
         insert into public.messaging_partner_order_lines (
           order_id, product_inventory_id, product_name, product_image_url, product_url,
           unit_price, quantity, line_subtotal, variant_color, variant_size, variant_image_urls,
           note, sort_order, fulfillment_source, source_platform, source_url, product_sku_snapshot,
           is_warehouse_item, warehouse_stock_reserved_at, warehouse_stock_additive,
           created_at, updated_at
         ) values (
           $1::uuid, $2::uuid, $3, $4, $5,
           $6::numeric, $7::int, $8::numeric, $9, $10, $11,
           $12, $13::int, $14, $15, $16, $17,
           $18, case when $14 = 'vietnam' and $2::uuid is not null then now() else null end,
           case when $14 = 'vietnam' and $2::uuid is not null then true else false end,
           now(), now()
         )`,
        [
          orderId, line.productInventoryId, line.productName, line.productImageUrl, line.productUrl,
          unitPrice, quantity, unitPrice * quantity, line.variantColor, line.variantSize,
          line.variantImageUrlsJson.trim().slice(0, 8000), line.note,
          Math.max(0, Math.floor(line.sortOrder || 0)), group.fulfillmentSource,
          line.sourcePlatform || null, String(line.sourceUrl || line.productUrl || '').slice(0, 800),
          String(line.productSkuSnapshot || '').slice(0, 180), line.isWarehouseItem === true,
        ]
      )
    }
    orders.push(mapPartnerOrderRowFromPg(inserted.rows[0]))
  }

  for (const [inventoryId, quantity] of requestedByInventory) {
    const updated = await client.query(
      `/* atomic-checkout:reserve-inventory */
       update public.messaging_partner_inventory
       set warehouse_reserved = warehouse_reserved + $3::int, updated_at = now()
       where id = $1::uuid and partner_id = $2::uuid`,
      [inventoryId, input.partnerId, quantity]
    )
    if (updated.rowCount !== 1) throw new Error('atomic_checkout_inventory_disappeared')
  }
  return orders
}

export async function createPartnerCheckoutOrdersAtomicallyFromPg(
  input: AtomicPartnerCheckoutInput
): Promise<AtomicPartnerCheckoutResult> {
  if (!isPgConfigured()) return { ok: false, reason: 'not_configured', shortages: [] }
  const client = await getPgPool().connect()
  try {
    await client.query('begin')
    const orders = await createPartnerCheckoutOrdersInTransaction(client, input)
    await client.query('commit')
    return { ok: true, orders }
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    const shortages =
      error && typeof error === 'object' && Array.isArray((error as { shortages?: unknown }).shortages)
        ? (error as { shortages: Array<{ inventoryId: string; requested: number; available: number }> }).shortages
        : []
    if (shortages.length > 0) return { ok: false, reason: 'shortage', shortages }
    console.warn('[createPartnerCheckoutOrdersAtomicallyFromPg]', error)
    return { ok: false, reason: 'database_error', shortages: [] }
  } finally {
    client.release()
  }
}

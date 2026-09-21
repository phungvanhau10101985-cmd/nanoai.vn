import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { PoolClient, QueryResult } from 'pg'
import {
  createPartnerCheckoutOrdersInTransaction,
  type AtomicPartnerCheckoutInput,
} from '@/lib/db/messaging-partner-checkout-transaction-pg'

type InventoryState = { stock: number; reserved: number }

class Mutex {
  private tail = Promise.resolve()

  async acquire(): Promise<() => void> {
    let release: () => void = () => undefined
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    const previous = this.tail
    this.tail = previous.then(() => next)
    await previous
    return release
  }
}

class FakePgDatabase {
  inventory = new Map<string, InventoryState>()
  orders = new Set<string>()
  sequence = 0
  inventoryLock = new Mutex()
}

class FakePoolClient {
  private releaseInventoryLock: (() => void) | null = null
  private pendingOrders = new Set<string>()
  private pendingReservations = new Map<string, number>()
  private insertCount = 0

  constructor(
    private readonly db: FakePgDatabase,
    private readonly failAtOrderInsert = 0
  ) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<T>> {
    const result = (rows: Record<string, unknown>[], rowCount = rows.length) =>
      ({ rows, rowCount, command: '', oid: 0, fields: [] }) as QueryResult<T>
    const sql = String(text).toLowerCase()
    if (sql === 'begin' || sql.startsWith('savepoint') || sql.startsWith('release savepoint')) {
      return result([])
    }
    if (sql === 'commit') {
      for (const id of this.pendingOrders) this.db.orders.add(id)
      for (const [id, quantity] of this.pendingReservations) {
        const row = this.db.inventory.get(id)
        if (row) row.reserved += quantity
      }
      this.releaseInventoryLock?.()
      this.releaseInventoryLock = null
      return result([])
    }
    if (sql === 'rollback' || sql.startsWith('rollback to savepoint')) {
      this.pendingOrders.clear()
      this.pendingReservations.clear()
      if (sql === 'rollback') {
        this.releaseInventoryLock?.()
        this.releaseInventoryLock = null
      }
      return result([])
    }
    if (sql.includes('atomic-checkout:lock-inventory')) {
      this.releaseInventoryLock = await this.db.inventoryLock.acquire()
      const ids = values[1] as string[]
      return result(
        ids.flatMap((id) => {
          const row = this.db.inventory.get(id)
          return row
            ? [{ id, stock_qty: row.stock, warehouse_reserved: row.reserved }]
            : []
        })
      )
    }
    if (sql.includes('atomic-checkout:allocate-codes')) {
      this.db.sequence += Number(values[1])
      return result([{ shop_order_seq: this.db.sequence }])
    }
    if (sql.includes('atomic-checkout:insert-order')) {
      this.insertCount += 1
      if (this.failAtOrderInsert === this.insertCount) throw new Error('injected group failure')
      const id = String(values[0])
      this.pendingOrders.add(id)
      return result([{
        id,
        partner_id: values[1],
        conversation_id: values[2],
        external_thread_id: values[3],
        status: 'awaiting_payment',
        customer_name: values[4],
        customer_email: values[5],
        customer_phone: values[6],
        shipping_address: values[7],
        note: values[8],
        product_inventory_id: values[9],
        product_name: values[10],
        product_image_url: values[11],
        product_url: values[12],
        quantity: values[13],
        unit_price: values[14],
        subtotal_amount: values[15],
        deposit_percent: values[16],
        required_amount: values[17],
        payment_reference: values[18],
        payment_qr_url: values[19],
        fulfillment_source: values[40],
        source_platform: values[41],
        fulfillment_needs_review: values[42],
        checkout_group_id: values[43],
        split_index: values[44],
      }])
    }
    if (sql.includes('atomic-checkout:insert-line')) return result([], 1)
    if (sql.includes('atomic-checkout:reserve-inventory')) {
      const id = String(values[0])
      this.pendingReservations.set(id, (this.pendingReservations.get(id) ?? 0) + Number(values[2]))
      return result([], this.db.inventory.has(id) ? 1 : 0)
    }
    throw new Error(`Unexpected fake SQL: ${text}`)
  }
}

function line(inventoryId: string, source: 'vietnam' | 'china') {
  return {
    productInventoryId: inventoryId,
    productName: `Product ${inventoryId}`,
    productImageUrl: 'https://shop.test/image.jpg',
    productUrl: 'https://shop.test/product',
    unitPrice: 100_000,
    quantity: 1,
    variantColor: '',
    variantSize: '',
    variantImageUrlsJson: '[]',
    note: '',
    sortOrder: 0,
    fulfillmentSource: source,
    sourcePlatform: null,
    sourceUrl: 'https://shop.test/product',
    productSkuSnapshot: inventoryId,
    isWarehouseItem: false,
    depositRequired: false,
  } as const
}

function checkout(groups: Array<{ source: 'vietnam' | 'china'; inventoryId: string }>): AtomicPartnerCheckoutInput {
  return {
    partnerId: '00000000-0000-4000-8000-000000000001',
    conversationId: '00000000-0000-4000-8000-000000000002',
    externalThreadId: 'thread',
    shopDisplayName: 'Shop',
    useSepayQr: false,
    paymentQrUrl: () => '',
    groups: groups.map((group, index) => ({
      orderId: `00000000-0000-4000-8000-00000000001${index}`,
      fulfillmentSource: group.source,
      sourcePlatform: null,
      checkoutGroupId: '00000000-0000-4000-8000-000000000099',
      splitIndex: index + 1,
      needsReview: false,
      lines: [line(group.inventoryId, group.source)],
      customerName: 'Customer',
      customerEmail: 'customer@example.com',
      customerPhone: '0900000000',
      shippingAddress: 'Address',
      note: '',
      subtotalAmount: 100_000,
      depositPercent: 0,
      requiredAmount: 0,
      discountSnapshot: {
        loyaltyTierCode: '',
        loyaltyTierName: '',
        loyaltyDiscountPercent: 0,
        loyaltyDiscountAmount: 0,
        birthdayDiscountPercent: 0,
        birthdayDiscountAmount: 0,
        totalDiscountPercent: 0,
        totalDiscountAmount: 0,
        amountAfterDiscount: 100_000,
      },
      paymentMethod: 'cod',
      shippingFeeAmount: 0,
    })),
  }
}

async function runTransaction(client: FakePoolClient, input: AtomicPartnerCheckoutInput) {
  await client.query('begin')
  try {
    const orders = await createPartnerCheckoutOrdersInTransaction(
      client as unknown as PoolClient,
      input
    )
    await client.query('commit')
    return { ok: true as const, orders }
  } catch (error) {
    await client.query('rollback')
    return { ok: false as const, error }
  }
}

describe('atomic mixed checkout transaction', () => {
  it('rolls back the first group when the second group fails', async () => {
    const db = new FakePgDatabase()
    db.inventory.set('00000000-0000-4000-8000-000000000010', { stock: 1, reserved: 0 })
    const client = new FakePoolClient(db, 2)
    const result = await runTransaction(client, checkout([
      { source: 'vietnam', inventoryId: '00000000-0000-4000-8000-000000000010' },
      { source: 'china', inventoryId: '00000000-0000-4000-8000-000000000011' },
    ]))

    assert.equal(result.ok, false)
    assert.equal(db.orders.size, 0)
    assert.equal(db.inventory.get('00000000-0000-4000-8000-000000000010')?.reserved, 0)
  })

  it('admits only one of two concurrent requests for one available item', async () => {
    const db = new FakePgDatabase()
    const inventoryId = '00000000-0000-4000-8000-000000000010'
    db.inventory.set(inventoryId, { stock: 1, reserved: 0 })

    const [first, second] = await Promise.all([
      runTransaction(new FakePoolClient(db), checkout([{ source: 'vietnam', inventoryId }])),
      runTransaction(new FakePoolClient(db), checkout([{ source: 'vietnam', inventoryId }])),
    ])

    assert.equal([first.ok, second.ok].filter(Boolean).length, 1)
    assert.equal(db.orders.size, 1)
    assert.equal(db.inventory.get(inventoryId)?.reserved, 1)
  })
})

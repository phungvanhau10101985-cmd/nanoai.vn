import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogContentId } from '@/lib/messaging/catalog-content-id'
import { catalogFeedItemId } from '@/lib/messaging/catalog-feed-shared'
import { retailItemId } from '@/lib/partner-website/shop/partner-site-shop-google-ads'
import { buildMetaCommerceCustomDataFromInventoryRow } from '@/lib/tracking/meta-view-content'
import { buildMetaPurchaseCustomDataFromOrder } from '@/lib/tracking/meta-purchase-events'
import type { MessagingPartnerInventoryRow } from '@/lib/db/messaging-partner-inventory-pg'
import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'

const INVENTORY_ID = '2b7797ad-dedb-455c-b1b3-fa6500137beb'
const ORDER_ID = 'ffa4064d-ec26-4c21-ab27-50b8df931538'
const FEED_ID = 'A860777007993'

test('catalogContentId matches the catalog feed id', () => {
  assert.equal(catalogContentId({ remarketingId: '  A860777007993 \n', inventoryId: INVENTORY_ID }), FEED_ID)
  assert.equal(catalogContentId({ remarketingId: '', inventoryId: INVENTORY_ID }), INVENTORY_ID)
  assert.equal(catalogContentId({ remarketingId: 'x'.repeat(120), inventoryId: INVENTORY_ID }), 'x'.repeat(100))
  assert.equal(
    catalogFeedItemId({ id: INVENTORY_ID, remarketing_id: FEED_ID }),
    catalogContentId({ remarketingId: FEED_ID, inventoryId: INVENTORY_ID })
  )
})

test('retail item id ignores sku and order id', () => {
  assert.equal(
    retailItemId({ itemId: INVENTORY_ID, itemName: 'Dress', value: 1, sku: 'K0842', remarketingId: FEED_ID }),
    FEED_ID
  )
  assert.equal(retailItemId({ itemId: INVENTORY_ID, itemName: 'Dress', value: 1, sku: 'K0842' }), INVENTORY_ID)
  assert.equal(retailItemId({ itemId: '', itemName: 'Dress', value: 1, sku: 'K0842' }), '')
})

test('Meta ViewContent and Purchase content ids are the feed id', () => {
  const row = {
    id: INVENTORY_ID,
    remarketing_id: FEED_ID,
    sku: 'K0842',
    name: 'Dress',
    price_hint: '1.311.000đ',
  } as MessagingPartnerInventoryRow
  const view = buildMetaCommerceCustomDataFromInventoryRow(row)
  assert.deepEqual(view.content_ids, [FEED_ID])

  const order = {
    id: ORDER_ID,
    product_inventory_id: INVENTORY_ID,
    product_name: 'Dress',
    quantity: 1,
    unit_price: 1311000,
    subtotal_amount: 1311000,
  } as PartnerOrderRow
  const purchase = buildMetaPurchaseCustomDataFromOrder({
    order,
    inventory: row,
    lineItems: [
      {
        inventoryId: INVENTORY_ID,
        remarketingId: FEED_ID,
        name: 'Dress',
        quantity: 1,
        unitPrice: 1311000,
      },
    ],
  })
  assert.deepEqual(purchase.content_ids, [FEED_ID])
  assert.equal(purchase.contents[0]?.id, FEED_ID)
  assert.equal(purchase.order_id, ORDER_ID)
  assert.notEqual(purchase.content_ids[0], ORDER_ID)
  assert.notEqual(purchase.content_ids[0], INVENTORY_ID)
})

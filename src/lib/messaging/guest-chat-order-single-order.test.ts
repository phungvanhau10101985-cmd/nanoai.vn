import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const clientSource = readFileSync(
  new URL('../../app/messaging/p/[slug]/partner-guest-chat-client.tsx', import.meta.url),
  'utf8'
)
const ordersPgSource = readFileSync(
  new URL('../db/messaging-partner-orders-pg.ts', import.meta.url),
  'utf8'
)

test('opening the in-chat purchase form does not persist an order draft', () => {
  const openForm = clientSource.slice(
    clientSource.indexOf('const openOrderFormByOption'),
    clientSource.indexOf('const maybeOpenBuyOptionsFromInbound')
  )
  assert.ok(openForm.includes("action: 'product_options'"))
  assert.ok(!openForm.includes('JSON.stringify({ productCard: card })'))
})

test('direct in-chat purchase and chat cart use the same final checkout path', () => {
  const directCheckout = clientSource.slice(
    clientSource.indexOf('const submitOrderCheckout'),
    clientSource.indexOf('/** Upload ảnh lên storage guest')
  )
  assert.ok(directCheckout.includes("action: 'cart_checkout'"))
  assert.ok(directCheckout.includes('items: picked.cartLines.map'))
  assert.ok(!directCheckout.includes('orderId:'))
})

test('legacy rows without a shop order code are excluded from customer order lists', () => {
  const customerList = ordersPgSource.slice(
    ordersPgSource.indexOf('export async function fetchPartnerOrdersForConversationFromPg'),
    ordersPgSource.indexOf('export async function fetchPartnerCheckoutGroupOrdersFromPg')
  )
  assert.ok(customerList.includes("nullif(trim(payment_reference), '') is not null"))
})

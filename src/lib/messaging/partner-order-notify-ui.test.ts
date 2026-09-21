import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PARTNER_ORDER_NOTIFY_EVENT_MATRIX,
  buyerOrderActions,
  orderWaitingState,
  partnerOrderNotifyIdempotencyKey,
  publicOrderShipmentEvents,
  stripInternalOrderSource,
} from './partner-order-notify-ui'

test('event matrix keeps customer and owner channels explicit', () => {
  assert.deepEqual(PARTNER_ORDER_NOTIFY_EVENT_MATRIX.order_placed.customer, [
    'email',
    'in_app',
    'push',
    'chat',
  ])
  assert.deepEqual(PARTNER_ORDER_NOTIFY_EVENT_MATRIX.customer_received.owner, [
    'email',
    'in_app',
    'push',
  ])
  assert.deepEqual(PARTNER_ORDER_NOTIFY_EVENT_MATRIX.chat_needs_reply.customer, [])
})

test('notification idempotency key is stable and identity-scoped', () => {
  const input = {
    partnerId: 'partner-a',
    orderId: 'order-a',
    event: 'payment_confirmed' as const,
    channel: 'owner' as const,
  }
  assert.equal(partnerOrderNotifyIdempotencyKey(input), partnerOrderNotifyIdempotencyKey(input))
  assert.notEqual(
    partnerOrderNotifyIdempotencyKey(input),
    partnerOrderNotifyIdempotencyKey({ ...input, orderId: 'order-b' })
  )
})

test('buyer actions are emitted only for valid state-machine states', () => {
  assert.deepEqual(
    buyerOrderActions({
      status: 'awaiting_payment',
      shippingStatus: 'pending',
      requiredAmount: 300,
      paidAmount: 0,
      hasReview: false,
      shipmentEvents: [],
    }),
    ['pay_deposit', 'cancel']
  )
  const awaiting = [
    {
      stepKey: 'awaiting_confirm' as const,
      title: 'internal title',
      sortOrder: 3,
      status: 'active' as const,
      scheduledAt: null,
      completedAt: null,
      note: '',
      updatedBy: 'staff',
    },
  ]
  assert.deepEqual(
    buyerOrderActions({
      status: 'paid_verified',
      shippingStatus: 'shipping',
      hasReview: false,
      shipmentEvents: awaiting,
    }),
    ['track', 'confirm_received']
  )
  assert.deepEqual(
    buyerOrderActions({ status: 'cancelled', shippingStatus: 'cancelled', shipmentEvents: awaiting }),
    []
  )
  assert.deepEqual(
    buyerOrderActions({
      status: 'awaiting_payment',
      shippingStatus: 'shipping',
      requiredAmount: 300,
      paidAmount: 0,
      shipmentEvents: awaiting,
    }),
    ['pay_deposit', 'track', 'confirm_received']
  )
})

test('waiting actor is derived for seller and buyer views', () => {
  const seller = orderWaitingState([
    {
      stepKey: 'at_customs',
      title: 'internal',
      sortOrder: 4,
      status: 'active',
      scheduledAt: '2026-09-21T10:00:00.000Z',
      completedAt: null,
      note: '',
      updatedBy: 'ems',
    },
  ])
  assert.equal(seller.actor, 'seller')
  assert.equal(seller.source, 'ems')
  const buyer = orderWaitingState([
    {
      stepKey: 'awaiting_confirm',
      title: 'internal',
      sortOrder: 6,
      status: 'active',
      scheduledAt: null,
      completedAt: null,
      note: '',
      updatedBy: 'staff',
    },
  ])
  assert.equal(buyer.actor, 'buyer')
  const carrier = orderWaitingState([
    {
      stepKey: 'international_shipping',
      title: 'internal',
      sortOrder: 3,
      status: 'active',
      scheduledAt: '2026-09-21T10:00:00.000Z',
      completedAt: null,
      note: '',
      updatedBy: 'ems',
    },
  ])
  assert.equal(carrier.actor, 'carrier')
  assert.equal(carrier.timestamp, '2026-09-21T10:00:00.000Z')
})

test('storefront projection removes source, actor and internal notes', () => {
  const order = stripInternalOrderSource({
    id: 'order-a',
    fulfillment_source: 'china',
    fulfillment_needs_review: true,
    source_platform: '1688',
    source_url: 'https://detail.1688.com/offer/1.html',
  })
  assert.deepEqual(order, { id: 'order-a' })
  const events = publicOrderShipmentEvents([
    {
      stepKey: 'international_shipping',
      title: 'Đang vận chuyển quốc tế về Việt Nam',
      sortOrder: 2,
      status: 'active',
      scheduledAt: '2026-09-22T00:00:00.000Z',
      completedAt: null,
      note: 'carrier raw status',
      updatedBy: 'ems',
    },
  ])
  assert.deepEqual(events, [
    {
      stepKey: 'international_shipping',
      status: 'active',
      scheduledAt: '2026-09-22T00:00:00.000Z',
      completedAt: null,
    },
  ])
})

test('guest order GET stays read-only and projects internal source fields out', () => {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')
  const detailRoute = readFileSync(
    join(root, 'src/app/api/messaging/guest/[slug]/order/[orderId]/route.ts'),
    'utf8'
  )
  const getBody = detailRoute.slice(detailRoute.indexOf('export async function GET'), detailRoute.indexOf('export async function PATCH'))
  assert.match(getBody, /stripInternalOrderSource/)
  assert.doesNotMatch(getBody, /completeGuestEmailAuth|notifyPartner|insertPartnerOrderEvent|update[A-Z]/)
  const patchBody = detailRoute.slice(detailRoute.indexOf('export async function PATCH'))
  assert.match(patchBody, /stripInternalOrderSource\(updated/)
  assert.doesNotMatch(patchBody, /void notifyPartnerOwnerOrderCustomerAction/)

  const listRoute = readFileSync(
    join(root, 'src/app/api/messaging/guest/[slug]/orders/route.ts'),
    'utf8'
  )
  assert.match(listRoute, /publicOrderShipmentEvents/)
  assert.match(listRoute, /stripInternalOrderSource/)

  const checkoutRoute = readFileSync(
    join(root, 'src/app/api/messaging/guest/[slug]/order/route.ts'),
    'utf8'
  )
  assert.match(checkoutRoute, /orders: done\.orders\.map/)
  assert.equal(
    checkoutRoute.match(/order: stripInternalOrderSource\(/g)?.length,
    3
  )
})

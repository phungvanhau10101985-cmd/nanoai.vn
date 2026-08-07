/**
 * W5.3 — shortcut trạng thái đơn có badge (client-side classify + count).
 * Chạy: npx tsx scripts/test-w5_3-order-status-shortcuts.ts
 */
import assert from 'node:assert/strict'
import {
  classifyPartnerSiteOrderStatusBucket,
  countPartnerSiteOrdersByStatusFilter,
  orderMatchesPartnerSiteStatusFilter,
  parsePartnerSiteOrderStatusFilter,
} from '../src/lib/partner-website/shop/partner-site-order-status-filters'

function main() {
  assert.equal(classifyPartnerSiteOrderStatusBucket({ status: 'awaiting_payment' }), 'waiting_payment')
  assert.equal(classifyPartnerSiteOrderStatusBucket({ status: 'payment_checking' }), 'waiting_payment')
  assert.equal(
    classifyPartnerSiteOrderStatusBucket({ status: 'paid_verified', shipping_status: 'packing' }),
    'processing'
  )
  assert.equal(
    classifyPartnerSiteOrderStatusBucket({ status: 'paid_verified', shipping_status: 'delivered' }),
    'delivered'
  )
  assert.equal(
    classifyPartnerSiteOrderStatusBucket({
      status: 'paid_verified',
      shipping_status: 'delivered',
      has_review: true,
    }),
    'reviewed'
  )
  assert.equal(classifyPartnerSiteOrderStatusBucket({ status: 'cancelled' }), 'cancelled')
  assert.equal(
    classifyPartnerSiteOrderStatusBucket({ status: 'paid_verified', shipping_status: 'cancelled' }),
    'cancelled'
  )
  assert.equal(
    classifyPartnerSiteOrderStatusBucket({ status: 'paid_verified', shipping_status: 'returned' }),
    'other'
  )

  const orders = [
    { status: 'awaiting_payment', shipping_status: 'pending' },
    { status: 'awaiting_payment', shipping_status: 'pending' },
    { status: 'paid_verified', shipping_status: 'shipping' },
    { status: 'paid_verified', shipping_status: 'delivered' },
    { status: 'paid_verified', shipping_status: 'delivered', has_review: true },
    { status: 'cancelled', shipping_status: 'cancelled' },
    { status: 'paid_verified', shipping_status: 'returned' },
  ]
  const counts = countPartnerSiteOrdersByStatusFilter(orders)
  assert.equal(counts.all, 7)
  assert.equal(counts.waiting_payment, 2)
  assert.equal(counts.processing, 1)
  assert.equal(counts.delivered, 1)
  assert.equal(counts.reviewed, 1)
  assert.equal(counts.cancelled, 1)
  // returned không vào shortcut riêng
  assert.equal(
    counts.waiting_payment + counts.processing + counts.delivered + counts.reviewed + counts.cancelled,
    6
  )

  assert.equal(orderMatchesPartnerSiteStatusFilter(orders[0], 'waiting_payment'), true)
  assert.equal(orderMatchesPartnerSiteStatusFilter(orders[0], 'processing'), false)
  assert.equal(orderMatchesPartnerSiteStatusFilter(orders[6], 'all'), true)
  assert.equal(orderMatchesPartnerSiteStatusFilter(orders[6], 'processing'), false)

  assert.equal(parsePartnerSiteOrderStatusFilter('delivered'), 'delivered')
  assert.equal(parsePartnerSiteOrderStatusFilter('nope'), 'all')
  assert.equal(parsePartnerSiteOrderStatusFilter(null), 'all')

  console.log('OK — W5.3 order status shortcuts')
}

main()

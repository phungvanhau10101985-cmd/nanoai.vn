import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

function source(relativeUrl: string): string {
  return readFileSync(new URL(relativeUrl, import.meta.url), 'utf8')
}

describe('order lifecycle mutation wiring', () => {
  it('uses the shared shipping transition SQL for owner and fulfillment mutations', () => {
    const ordersDb = source('../../db/messaging-partner-orders-pg.ts')
    const fulfillment = source('./order-fulfillment-service.ts')

    assert.match(ordersDb, /updatePartnerOrderShippingStatusForOwnerFromPg[\s\S]*partnerOrderShippingTransitionSql\(\)/)
    assert.match(ordersDb, /confirmPartnerOrderReceivedForConversationFromPg[\s\S]*partnerOrderShippingTransitionSql\("'delivered'"\)/)
    assert.match(fulfillment, /partnerOrderShippingTransitionSql\("'confirmed'"\)/)
    assert.match(fulfillment, /partnerOrderShippingTransitionSql\("'shipping'"\)/)
    assert.match(fulfillment, /partnerOrderShippingTransitionSql\("'packing'"\)/)
    assert.doesNotMatch(fulfillment, /shipping_status <> 'cancelled'/)
  })

  it('does not run delivered effects when EMS preserves another terminal state', () => {
    const emsImport = source('../shipping/ems-shipment-import.ts')
    const emsDb = source('../../db/messaging-partner-ems-shipping-pg.ts')

    assert.match(emsImport, /if \(afterOrder\.shipping_status === 'delivered'\)/)
    assert.doesNotMatch(emsImport, /if \(shippingStatus === 'delivered'\)/)
    assert.match(
      emsDb,
      /syncPartnerOrderShippingFromEmsFromPg[\s\S]*and status <> 'cancelled'/
    )
    assert.match(emsDb, /confirmPartnerShopReturnFromPg[\s\S]*partnerOrderShippingTransitionSql\("'returned'"\)/)
  })

  it('routes every terminal admin/customer/return path through common hooks', () => {
    const dashboard = source('../../../app/dashboard/messaging/actions.ts')
    const guestOrder = source('../../../app/api/messaging/guest/[slug]/order/[orderId]/route.ts')
    const shopReturn = source('../shipping/shop-return.ts')

    assert.match(dashboard, /event: 'cancelled'/)
    assert.match(dashboard, /event: input\.shippingStatus/)
    assert.match(dashboard, /event: 'refunded'/)
    assert.match(dashboard, /runPartnerOrderDeliveredHook/)
    assert.match(guestOrder, /onPartnerOrderCancelledFulfillment/)
    assert.match(guestOrder, /runPartnerOrderDeliveredHook/)
    assert.match(shopReturn, /event: 'returned'/)
  })
})

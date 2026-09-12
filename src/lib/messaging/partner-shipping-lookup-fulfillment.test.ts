import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatShippingLookupCustomerReply, type PartnerShippingLookupHit } from './partner-shipping-lookup'

function hit(partial: Partial<PartnerShippingLookupHit> = {}): PartnerShippingLookupHit {
  return {
    query: 'DH01',
    queryType: 'order_code',
    isLatestOrder: false,
    trackingNumber: 'EE123456789VN',
    shippingProvider: 'EMS',
    orderCode: 'DH01',
    status: 'shipping',
    statusLabel: 'Đang giao',
    paymentStatusLabel: 'paid_verified',
    shippingMethod: 'EMS',
    items: [],
    emsStatus: '',
    emsEvents: [],
    httpStatus: 200,
    ...partial,
  }
}

describe('formatShippingLookupCustomerReply fulfillment', () => {
  it('includes China source and active shipment step', () => {
    const text = formatShippingLookupCustomerReply(
      hit({
        fulfillmentSource: 'china',
        sourcePlatform: '1688',
        shipmentEvents: [
          { stepKey: 'at_customs', title: 'Hàng đang ở cửa khẩu', status: 'active', scheduledAt: null, completedAt: null },
        ],
      }),
      'vi'
    )
    assert.match(text, /Trung Quốc/)
    assert.match(text, /1688/)
    assert.match(text, /cửa khẩu/)
    assert.equal(text.includes('188.com.vn'), false)
  })
})

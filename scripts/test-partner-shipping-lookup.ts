/**
 * Phân loại đầu vào cổng tra cứu vận chuyển (DH / SĐT / EMS).
 * Chạy: npx tsx scripts/test-partner-shipping-lookup.ts
 */
import assert from 'node:assert/strict'
import {
  classifyShippingLookupQuery,
  extractShippingLookupQuery,
  formatShippingLookupCustomerReply,
  type PartnerShippingLookupHit,
} from '../src/lib/messaging/partner-shipping-lookup'

function main() {
  assert.deepEqual(classifyShippingLookupQuery('DH042'), { type: 'order_code', value: 'DH042' })
  assert.deepEqual(classifyShippingLookupQuery('DC009'), { type: 'order_code', value: 'DC009' })
  assert.deepEqual(classifyShippingLookupQuery('EH042737692VN'), {
    type: 'ems_code',
    value: 'EH042737692VN',
  })
  assert.deepEqual(classifyShippingLookupQuery('CL703515636VN'), {
    type: 'ems_code',
    value: 'CL703515636VN',
  })
  assert.deepEqual(classifyShippingLookupQuery('0901234567'), { type: 'phone', value: '0901234567' })
  assert.deepEqual(classifyShippingLookupQuery('+84 901 234 567'), {
    type: 'phone',
    value: '0901234567',
  })

  const fromChat = extractShippingLookupQuery('Shop ơi đơn DH349 tôi chưa nhận hàng')
  assert.equal(fromChat?.type, 'order_code')
  assert.equal(fromChat?.value, 'DH349')

  const fromEms = extractShippingLookupQuery('mã vận EH042737692VN')
  assert.equal(fromEms?.type, 'ems_code')

  const phoneOnly = extractShippingLookupQuery('0912345678', { allowPhone: true })
  assert.equal(phoneOnly?.type, 'phone')
  assert.equal(extractShippingLookupQuery('xin chào shop', { allowPhone: true }), null)

  const hit: PartnerShippingLookupHit = {
    query: 'DH042',
    queryType: 'order_code',
    isLatestOrder: false,
    trackingNumber: 'EH042737692VN',
    shippingProvider: 'EMS',
    orderCode: 'DH042',
    status: 'shipping',
    statusLabel: 'Đang giao hàng',
    paymentStatusLabel: 'Chờ thanh toán',
    shippingMethod: 'EMS',
    items: [{ product_name: 'Áo thun', selected_size: 'XL', selected_color_name: 'Đen', quantity: 2 }],
    emsStatus: 'Giao bưu tá phát hàng',
    emsEvents: [
      { description: 'Giao bưu tá phát hàng', address: 'Hà Nội', tracedAt: '2026-08-12T08:10:00' },
    ],
    httpStatus: 200,
  }
  const vi = formatShippingLookupCustomerReply(hit, 'vi')
  assert.match(vi, /DH042/)
  assert.match(vi, /Đang giao hàng/)
  assert.match(vi, /EH042737692VN/)
  assert.doesNotMatch(vi, /0901234567/)
  assert.doesNotMatch(vi, /bấm \*\*Mua/i)

  console.log('OK partner-shipping-lookup')
}

main()

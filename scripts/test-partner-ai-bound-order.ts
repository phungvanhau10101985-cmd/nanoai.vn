/**
 * Neo đơn từ ảnh CK / tra cứu — giữ đến khi đổi chủ đề hoặc đơn khác.
 * Chạy: npx tsx scripts/test-partner-ai-bound-order.ts
 */
import assert from 'node:assert/strict'
import {
  extractOrderCodesFromText,
  findLatestBoundOrderSnapshot,
  formatBoundOrderDepositConfirmReply,
  formatBoundOrderRecapReply,
  inboundTextFollowsBoundOrder,
  inboundTextLooksLikeBoundOrderVariantFollowUp,
  inboundTextLooksLikeDepositConfirmAsk,
  inboundTextSwitchesOffBoundOrder,
  looksLikeBankTransferReceipt,
  parseBoundOrderSnapshot,
  type PartnerBoundOrderSnapshot,
} from '../src/lib/messaging/partner-ai-bound-order'
import type { PartnerShippingLookupHit } from '../src/lib/messaging/partner-shipping-lookup'

function boundDh453(): PartnerBoundOrderSnapshot {
  return {
    order_code: 'DH453',
    status: 'processing',
    status_label: 'Đang xử lý',
    payment_status_label: 'Đã cọc',
    items: [
      {
        product_name: 'Giày cao gót nữ mũi nhọn',
        selected_size: '39',
        selected_color_name: 'Đen',
        quantity: 1,
        product_sku: 'R3462',
      },
    ],
    source: 'bank_transfer_receipt',
    bound_at: '2026-08-18T03:23:00+07:00',
  }
}

function main() {
  assert.deepEqual(extractOrderCodesFromText('SEVQR DH453'), ['DH453'])
  assert.equal(looksLikeBankTransferReceipt('Giao dịch thành công!\nSEVQR DH453\nVCB Digibank'), true)
  assert.equal(looksLikeBankTransferReceipt('Hàng đang được giao\nĐơn hàng DH349\nHO3082606'), false)

  const b = boundDh453()
  assert.equal(inboundTextLooksLikeDepositConfirmAsk('Xác nhận đã nhận cọc giúp em ạ'), true)
  assert.equal(inboundTextLooksLikeBoundOrderVariantFollowUp('Dạ em đặt màu đen ạ'), true)
  assert.equal(inboundTextLooksLikeBoundOrderVariantFollowUp('có màu gì shop'), false)
  assert.equal(inboundTextFollowsBoundOrder('Em đã cọc rồi đây ạ', b), true)
  assert.equal(inboundTextFollowsBoundOrder('Xác nhận đã nhận cọc giúp em ạ', b), true)
  assert.equal(inboundTextSwitchesOffBoundOrder('đơn DH464 check giúp', b), true)
  assert.equal(inboundTextSwitchesOffBoundOrder('Mình quan tâm mẫu này "B9583"', b), true)
  assert.equal(inboundTextSwitchesOffBoundOrder('Em đặt màu đen ạ', b), false)

  const hit: PartnerShippingLookupHit = {
    query: 'DH453',
    queryType: 'order_code',
    isLatestOrder: false,
    trackingNumber: '',
    shippingProvider: '',
    orderCode: 'DH453',
    status: 'processing',
    statusLabel: 'Đang xử lý',
    paymentStatusLabel: 'Chờ đặt cọc',
    shippingMethod: '',
    items: b.items,
    emsStatus: '',
    emsEvents: [],
    httpStatus: 200,
  }
  const confirm = formatBoundOrderDepositConfirmReply(hit, { uiLocale: 'vi', amountText: '573.000đ' })
  assert.match(confirm, /DH453/)
  assert.match(confirm, /đã nhận cọc/)
  assert.match(confirm, /573/)
  assert.match(confirm, /R3462/)
  assert.doesNotMatch(confirm, /Chờ đặt cọc/)
  assert.doesNotMatch(confirm, /Mua ngay/)

  const recap = formatBoundOrderRecapReply(hit, { uiLocale: 'vi' })
  assert.match(recap, /DH453/)
  assert.match(recap, /không cần đặt lại/i)
  assert.doesNotMatch(recap, /Mua ngay/)

  const parsed = parseBoundOrderSnapshot({ bound_order: b })
  assert.equal(parsed?.order_code, 'DH453')
  assert.equal(findLatestBoundOrderSnapshot([{ raw_payload: null }, { raw_payload: { bound_order: b } }])?.order_code, 'DH453')

  console.log('OK partner-ai-bound-order')
}

main()

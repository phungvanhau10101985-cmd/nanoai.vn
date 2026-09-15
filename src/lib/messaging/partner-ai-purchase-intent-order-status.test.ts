import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inboundTextLooksLikeAfterSalesNotCheckout,
  inboundTextLooksLikeDepositPolicyAsk,
  inboundTextLooksLikeLeadTimePolicyAsk,
  inboundTextLooksLikeOrderStatusAsk,
  inboundTextLooksLikePolicyRefundOrCancelAsk,
  inboundTextLooksLikePurchasePickListIntent,
  inboundTextLooksLikeShopPolicyAsk,
} from './partner-ai-purchase-intent'

test('refund/cancel policy is not order-status lookup', () => {
  const refund = 'Đặt cọc rồi khi nhận hàng ko ưng mà hủy có đc hoàn lại tiền ko'
  assert.equal(inboundTextLooksLikePolicyRefundOrCancelAsk(refund), true)
  assert.equal(inboundTextLooksLikeOrderStatusAsk(refund), false)
  assert.equal(inboundTextLooksLikeAfterSalesNotCheckout(refund), true)
  assert.equal(inboundTextLooksLikePurchasePickListIntent(refund), false)
})

test('order tracking phrases still open shipping lookup', () => {
  assert.equal(inboundTextLooksLikeOrderStatusAsk('Đơn DH393 gửi chưa shop'), true)
  assert.equal(
    inboundTextLooksLikeOrderStatusAsk(
      'Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gưit đến đâu rồi'
    ),
    true
  )
  assert.equal(inboundTextLooksLikeOrderStatusAsk('DH493'), true)
})

test('purchase pick list unchanged', () => {
  assert.equal(inboundTextLooksLikePurchasePickListIntent('cho mình đặt hàng'), true)
  assert.equal(inboundTextLooksLikePurchasePickListIntent('Đơn DH393 gửi chưa shop'), false)
})

test('deposit / lead-time policy is not order-status lookup', () => {
  assert.equal(inboundTextLooksLikeDepositPolicyAsk('Mua phải cọc tiền à?'), true)
  assert.equal(inboundTextLooksLikeOrderStatusAsk('Mua phải cọc tiền à?'), false)
  assert.equal(inboundTextLooksLikeShopPolicyAsk('đang hỏi là có phải đặt cọc trước không'), true)
  assert.equal(inboundTextLooksLikeOrderStatusAsk('đang hỏi là có phải đặt cọc trước không'), false)
  assert.equal(
    inboundTextLooksLikeLeadTimePolicyAsk('Nếu như theo shop gửi cỡ bao lâu e mới nhận đc hàng'),
    true
  )
  assert.equal(
    inboundTextLooksLikeOrderStatusAsk('Nếu như theo shop gửi cỡ bao lâu e mới nhận đc hàng'),
    false
  )
  assert.equal(inboundTextLooksLikeLeadTimePolicyAsk('Đơn DH356 khi nào nhận được ạ'), false)
  assert.equal(inboundTextLooksLikeOrderStatusAsk('Đơn DH356 khi nào nhận được ạ'), true)
  assert.equal(inboundTextLooksLikeDepositPolicyAsk('em đã cọc rồi shop xác nhận giúp'), false)
})

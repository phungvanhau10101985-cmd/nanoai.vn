import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyAfterSalesImage,
  inboundCustomerContextForAfterSales,
} from './partner-ai-after-sales-image'
import { inboundTextLooksLikeAskSkuOfThisPhotoItem } from './partner-ai-photo-item-consult'
import {
  inboundBodyHasCustomerUploadedImage,
  previousInboundHasCustomerUploadedImage,
} from './guest-chat-image'
import { inboundTextSwitchesOffBoundOrder } from './partner-ai-bound-order'

const shopPolicyCtx = [
  'outbound: Dạ anh, về chính sách của shop: hàng sai hình thì được trả lại cọc. Trường hợp không vừa size thì shop hỗ trợ đổi size 1 lần.',
  'inbound: alo',
  'inbound: Đặt cọc rồi khi nhận hàng ko ưng mà hủy có dc hoàn lại tiền ko',
].join('\n')

test('empty product photo is not fit-issue when only shop mentioned đổi size', () => {
  assert.equal(
    classifyAfterSalesImage({
      caption: '',
      ocrText: '',
      conversationContext: shopPolicyCtx,
    }),
    'product_consult'
  )
  assert.equal(
    inboundCustomerContextForAfterSales(shopPolicyCtx),
    'alo\nĐặt cọc rồi khi nhận hàng ko ưng mà hủy có dc hoàn lại tiền ko'
  )
})

test('customer inbound fit-issue still classifies size-exchange photo', () => {
  assert.equal(
    classifyAfterSalesImage({
      caption: 'Size L',
      ocrText: '',
      conversationContext: 'inbound: áo bị rộng muốn đổi size',
    }),
    'fit_issue_product_photo'
  )
})

test('ask sku of this photo after guest image', () => {
  assert.equal(inboundTextLooksLikeAskSkuOfThisPhotoItem('Mã sp mẫu này'), true)
  assert.equal(inboundBodyHasCustomerUploadedImage('📷\n[Customer image: https://cdn.example/a.jpg]'), true)
  assert.equal(
    previousInboundHasCustomerUploadedImage([
      { direction: 'inbound', body: '📷', raw_payload: { guest_media: { kind: 'image' } } },
      { direction: 'inbound', body: 'Mã sp mẫu này', raw_payload: {} },
    ]),
    true
  )
  const bound = {
    order_code: 'DH493',
    status: '',
    status_label: '',
    payment_status_label: '',
    items: [],
    source: 'shipping_lookup' as const,
    bound_at: '2026-08-23T00:00:00.000Z',
  }
  assert.equal(
    inboundTextSwitchesOffBoundOrder('[Customer image: https://cdn.example/a.jpg]', bound),
    true
  )
})

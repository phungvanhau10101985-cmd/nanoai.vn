import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildAfterSalesImageReply,
  captionShouldSkipProductVision,
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

test('dimension question without a size-exchange ask stays product consult', () => {
  assert.equal(
    classifyAfterSalesImage({
      caption: 'Cao và rộng và dài nhiều shop',
      ocrText: '',
      conversationContext: '',
    }),
    'product_consult'
  )
})

test('policy and form captions skip product vision search', () => {
  assert.equal(captionShouldSkipProductVision('không thêm được số điện thoại'), true)
  assert.equal(captionShouldSkipProductVision('khi nào nhận hàng'), true)
  assert.equal(captionShouldSkipProductVision('Mình quan tâm mẫu này'), false)
  assert.equal(captionShouldSkipProductVision(''), false)
})

test('deposit payment screen with an order code is an order lookup, not a product photo', () => {
  const ocr = 'Thanh toán cọc đơn hàng\nMã đơn: #DH1339'
  assert.equal(
    classifyAfterSalesImage({ caption: '', ocrText: ocr, conversationContext: '' }),
    'order_code_screen'
  )
  assert.equal(
    classifyAfterSalesImage({
      caption: '',
      ocrText: 'Đã nhận đặt cọc DH1339',
      conversationContext: '',
    }),
    'deposit_notice'
  )
  assert.equal(
    classifyAfterSalesImage({
      caption: '',
      ocrText: 'Hàng đang được giao DH1339',
      conversationContext: '',
    }),
    'shipping_status_notice'
  )
  const miss = buildAfterSalesImageReply({
    kind: 'order_code_screen',
    caption: '',
    ocrText: ocr,
    conversationContext: '',
    uiLocale: 'vi',
  })
  assert.match(miss, /DH1339/)
  assert.equal(/đang được gửi|đã chuyển đơn/.test(miss), false)
  assert.equal(
    classifyAfterSalesImage({
      caption: '',
      ocrText: 'Thanh toán cọc đơn hàng\nMã đơn: 188COMVN01',
      conversationContext: '',
    }),
    'order_code_screen'
  )
  const saasMiss = buildAfterSalesImageReply({
    kind: 'order_code_screen',
    caption: '',
    ocrText: 'Thanh toán cọc đơn hàng\nMã đơn: 188COMVN01',
    conversationContext: '',
    uiLocale: 'vi',
  })
  assert.match(saasMiss, /188COMVN01/)
  assert.equal(
    classifyAfterSalesImage({
      caption: '',
      ocrText: 'Set áo khoác Size XL ID A851540015167',
      conversationContext: '',
    }),
    'product_consult'
  )
})

test('order-status caption without OCR is not vision product consult', () => {
  assert.equal(
    classifyAfterSalesImage({
      caption: 'kiểm tra xem đơn hàng này thế nào rồi',
      ocrText: '',
      conversationContext: '',
    }),
    'shipping_status_notice'
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

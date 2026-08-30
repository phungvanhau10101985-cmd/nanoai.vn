/**
 * Bước 2 — phân loại ảnh hậu mãi (OCR/text + caption + ngữ cảnh) và chọn đúng mẫu trả lời.
 * Chạy: npx tsx scripts/test-partner-ai-after-sales-image.ts
 */
import assert from 'node:assert/strict'
import {
  afterSalesKindAllowsOrderProductConsult,
  buildAfterSalesImageReply,
  captionLooksLikeConsultProductInOrder,
  captionLooksLikeSkuProductConsult,
  classifyAfterSalesImage,
  conversationHasSizeExchangeIntent,
  extractAfterSalesCodes,
  inboundCustomerContextForAfterSales,
  shouldOcrGuestImageForAfterSales,
  skuCandidatesFromOrderProductSku,
} from '../src/lib/messaging/partner-ai-after-sales-image'

function expectKind(
  input: { caption: string; ocrText: string; conversationContext: string },
  want: ReturnType<typeof classifyAfterSalesImage>
) {
  const got = classifyAfterSalesImage(input)
  assert.equal(got, want, `kind=${got} want=${want} :: caption=${input.caption.slice(0, 80)}`)
}

function main() {
  // Ảnh 1 — mã đơn đầy đủ, hàng đang giao
  expectKind(
    {
      caption: '',
      ocrText: 'Hàng đang được giao\nĐơn hàng DH349\nMã vận đơn HO3082606',
      conversationContext: '',
    },
    'shipping_status_notice'
  )

  // Ảnh 2 — screenshot chat cũ nhắc size M
  expectKind(
    {
      caption: '',
      ocrText: 'Bạn đang chat với 188\nCHỊ ĐẶT ÁO TRÊN SIZE M\nMua ngay\nTư vấn\nSize M',
      conversationContext: 'inbound: áo rộng quá muốn đổi size',
    },
    'order_chat_screenshot'
  )
  assert.equal(
    conversationHasSizeExchangeIntent('áo rộng quá muốn đổi size'),
    true
  )

  // Ảnh 3 — vận đơn gửi hàng hoàn
  expectKind(
    {
      caption: '',
      ocrText: 'Bưu điện Việt Nam VNPost\nNgười gửi\nNgười nhận\nCL703515636VN\nĐã gửi',
      conversationContext: 'inbound: em gửi hàng hoàn ạ',
    },
    'return_waybill'
  )

  // Ảnh CK Vietcombank — SEVQR DH… (không dump vận chuyển vì chữ «giao dịch»)
  expectKind(
    {
      caption: 'Em đã cọc rồi đây ạ',
      ocrText: 'Giao dịch thành công!\n573.000 VND\nNội dung SEVQR DH453\nVCB Digibank',
      conversationContext: '',
    },
    'deposit_notice'
  )
  expectKind(
    {
      caption: '',
      ocrText: 'Giao dịch thành công!\n573,000 VND\nSEVQR DH453\nVietcombank',
      conversationContext: '',
    },
    'deposit_notice'
  )
  expectKind(
    {
      caption: '',
      ocrText: 'Đã nhận đặt cọc\nĐơn hàng DH373\n237.600đ',
      conversationContext: '',
    },
    'deposit_notice'
  )

  // Ảnh 6 — ảnh áo nhận được, rộng/chật đổi size
  expectKind(
    {
      caption: 'Size L',
      ocrText: '',
      conversationContext: 'inbound: áo bị rộng muốn đổi size',
    },
    'fit_issue_product_photo'
  )

  // Ảnh sản phẩm không caption — tin shop cũ nhắc «đổi size» không được coi là khách muốn đổi size
  const shopPolicyCtx = [
    'outbound: Dạ anh, về chính sách của shop: hàng sai hình thì được trả lại cọc. Trường hợp không vừa size thì shop hỗ trợ đổi size 1 lần.',
    'inbound: alo',
    'inbound: Đặt cọc rồi khi nhận hàng ko ưng mà hủy có dc hoàn lại tiền ko',
  ].join('\n')
  expectKind(
    {
      caption: '',
      ocrText: '',
      conversationContext: shopPolicyCtx,
    },
    'product_consult'
  )
  expectKind(
    {
      caption: '',
      ocrText: 'Giày tây nam size 42',
      conversationContext: shopPolicyCtx,
    },
    'product_consult'
  )
  assert.equal(
    inboundCustomerContextForAfterSales(shopPolicyCtx),
    'alo\nĐặt cọc rồi khi nhận hàng ko ưng mà hủy có dc hoàn lại tiền ko'
  )
  assert.equal(shouldOcrGuestImageForAfterSales('', shopPolicyCtx), true)

  // Tư vấn SP — không đi nhánh hậu mãi
  expectKind(
    {
      caption: 'Mình quan tâm mẫu này "B9583"',
      ocrText: 'B9583 raglan',
      conversationContext: '',
    },
    'product_consult'
  )
  assert.equal(captionLooksLikeSkuProductConsult('📷 Mình quan tâm mẫu này "B9583"'), true)
  assert.equal(shouldOcrGuestImageForAfterSales('📷 Mình quan tâm mẫu này "B9583"', ''), false)

  assert.equal(captionLooksLikeConsultProductInOrder('áo này'), true)
  assert.equal(captionLooksLikeConsultProductInOrder('📷 em muốn mua áo này'), true)
  assert.equal(captionLooksLikeConsultProductInOrder('mẫu này'), true)
  assert.equal(captionLooksLikeConsultProductInOrder('hàng gửi chưa shop'), false)
  assert.equal(captionLooksLikeConsultProductInOrder(''), false)
  assert.equal(afterSalesKindAllowsOrderProductConsult('shipping_status_notice'), true)
  assert.equal(afterSalesKindAllowsOrderProductConsult('deposit_notice'), false)
  assert.deepEqual(skuCandidatesFromOrderProductSku('C0156/XL'), ['C0156/XL', 'C0156'])

  // Ảnh đơn + caption tư vấn SP: vẫn xếp loại chứng từ (divert tư vấn SKU sau lookup, không đổi classify)
  expectKind(
    {
      caption: 'áo này',
      ocrText: 'Hàng đang được giao\nĐơn hàng DH446\nMã vận đơn HO3082606',
      conversationContext: '',
    },
    'shipping_status_notice'
  )

  const codes = extractAfterSalesCodes('Đơn hàng DH349\nMã vận đơn HO3082606')
  assert.equal(codes.orderCode, 'DH349')
  assert.equal(codes.trackingCode, 'HO3082606')

  const addr = '188 Fashion, Hà Nội'
  const r1 = buildAfterSalesImageReply({
    kind: 'shipping_status_notice',
    caption: '',
    ocrText: 'Hàng đang được giao\nDH349\nHO3082606',
    conversationContext: '',
    uiLocale: 'vi',
  })
  assert.match(r1, /đang được gửi/i)
  assert.match(r1, /DH349/)
  assert.doesNotMatch(r1, /bấm \*\*Mua/i)

  const r2 = buildAfterSalesImageReply({
    kind: 'order_chat_screenshot',
    caption: '',
    ocrText: 'CHỊ ĐẶT ÁO TRÊN SIZE M\nMua ngay',
    conversationContext: 'inbound: gửi nhầm size muốn đổi',
    uiLocale: 'vi',
    returnAddress: addr,
  })
  assert.match(r2, /size M/i)
  assert.match(r2, /đối chiếu/)
  assert.match(r2, /188 Fashion/)

  const r3 = buildAfterSalesImageReply({
    kind: 'return_waybill',
    caption: '',
    ocrText: 'VNPost CL703515636VN Đã gửi',
    conversationContext: '',
    uiLocale: 'vi',
  })
  assert.match(r3, /vận đơn/i)
  assert.match(r3, /nhận được hàng/)

  const r4 = buildAfterSalesImageReply({
    kind: 'deposit_notice',
    caption: '',
    ocrText: 'Đã nhận đặt cọc DH373 237.600đ',
    conversationContext: '',
    uiLocale: 'vi',
  })
  assert.match(r4, /cảm ơn/i)
  assert.match(r4, /đóng hàng xuất kho/)
  assert.match(r4, /8–12 ngày/)

  const r6 = buildAfterSalesImageReply({
    kind: 'fit_issue_product_photo',
    caption: 'Size L',
    ocrText: '',
    conversationContext: 'inbound: bị rộng',
    uiLocale: 'vi',
    returnAddress: addr,
  })
  assert.match(r6, /đổi size 1 lần/)
  assert.match(r6, /188 Fashion/)
  assert.doesNotMatch(r6, /chọn 1 mẫu/i)

  const r6empty = buildAfterSalesImageReply({
    kind: 'fit_issue_product_photo',
    caption: 'Size L',
    ocrText: '',
    conversationContext: 'inbound: bị chật',
    uiLocale: 'vi',
    returnAddress: '',
  })
  assert.match(r6empty, /sẽ gửi địa chỉ/)
  assert.doesNotMatch(r6empty, /Hà Nội/)

  console.log('OK partner-ai-after-sales-image')
}

main()

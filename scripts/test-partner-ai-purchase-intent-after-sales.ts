/**
 * Bước 1 — không gửi «bấm Mua» khi khách đang hậu mãi / tra đơn.
 * Chạy: npx tsx scripts/test-partner-ai-purchase-intent-after-sales.ts
 */
import assert from 'node:assert/strict'
import { inboundTextLooksLikeOrderStatusAsk, inboundTextLooksLikePurchasePickListIntent } from '../src/lib/messaging/partner-ai-purchase-intent'
import {
  extractShippingLookupQuery,
  extractShippingLookupQueryFromThread,
  formatShippingLookupNeedIdReply,
} from '../src/lib/messaging/partner-shipping-lookup'

function expectPick(text: string, want: boolean) {
  const got = inboundTextLooksLikePurchasePickListIntent(text)
  assert.equal(got, want, `pick_list=${got} want=${want} :: ${text}`)
}

function expectAfterSales(text: string, want: boolean) {
  const got = inboundTextLooksLikeOrderStatusAsk(text)
  assert.equal(got, want, `after_sales=${got} want=${want} :: ${text}`)
}

function main() {
  // Production 15 ngày — không được dump thẻ Mua
  expectPick('nếu nhận hàng ko đúng ý thì sao em?', false)
  expectPick('ĐƠN HÀNG DH309 TÔI CHƯA NHẬN, SOA KHÔNG GIAO CHO TÔI??', false)
  expectPick('Shop ơi, cho mình hỏi đơn hàng #DH356 của mình khi nào nhận được ạ', false)
  expectPick('Hi shop, làm sao để theo dỗi đơn hàng mh đã đặtvậy?', false)
  expectPick('Mình đặt hàng rồi mà ko biết cách theo dỗi đơn ntn', false)
  expectPick('mua hàng bên em bây giờ có cần phải đặt cọc như lần trước không nhỉ', false)
  expectPick('đang hỏi là có phải đặt cọc trước không', false)
  expectPick('Vay đoi cho tui size nho ngat cua mẫu tui đa mua', false)
  expectPick('Da thanh toan đu', false)
  expectPick('Sđt của mình', false)
  expectPick('0912345678', false)
  expectPick('ĐT CỦA TÔI 0912345678', false)
  expectPick('Check giúp c', false)
  expectPick('Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gửi đến đâu rồi', false)
  expectPick('Đơn DH393 gửi chưa shop', false)
  expectPick('hàng của mình đến đâu rồi, hàng của mình gửi chưa, sao chưa nhận được hàng', false)

  expectAfterSales('Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gửi đến đâu rồi', true)
  expectAfterSales('Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gửit đến đâu rồi', true)
  expectAfterSales('Đơn DH393 gửi chưa shop', true)
  expectAfterSales('sdt của mình 0369597965 kiểm tra đơn', true)
  expectAfterSales('hàng của mình đến đâu rồi, hàng của mình gửi chưa, sao chưa nhận được hàng', true)

  // Chính sách hoàn/hủy — không coi là tra đơn (AI policy_or_order_support)
  expectAfterSales('Đặt cọc rồi khi nhận hàng ko ưng mà hủy có đc hoàn lại tiền ko', false)
  expectAfterSales('nếu nhận hàng ko đúng ý thì sao em?', false)
  expectAfterSales('hủy đơn DH493 có hoàn cọc không', false)
  expectAfterSales('DH493', true)
  expectAfterSales('0912345678', false)
  expectAfterSales('Sđt của mình là 0912345678', true)

  const phoneTrack = extractShippingLookupQuery(
    'Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gửi đến đâu rồi',
    { allowPhone: true }
  )
  assert.equal(phoneTrack?.type, 'phone')
  assert.equal(phoneTrack?.value, '0369597965')

  const fromThread = extractShippingLookupQueryFromThread(
    [
      'hàng của mình đến đâu rồi, hàng của mình gửi chưa, sao chưa nhận được hàng',
      'Kiểm tra hộ mình sdt của mình là 0369597965 kiểm tra đơn của mình gửi đến đâu rồi',
    ],
    { allowPhone: true }
  )
  assert.equal(fromThread?.type, 'phone')
  assert.equal(fromThread?.value, '0369597965')

  const needId = formatShippingLookupNeedIdReply('vi')
  assert.match(needId, /số điện thoại/i)
  assert.doesNotMatch(needId, /tên/)
  assert.doesNotMatch(needId, /bấm \*\*Mua/i)

  // Vẫn là chốt mua
  expectPick('vậy cho chị order size L màu be nhé', true)
  expectPick('mình muốn mua mẫu này', true)
  expectPick('cho mình đặt hàng', true)
  expectPick('chốt đơn giúp em', true)
  expectPick('buy now', true)
  expectPick('lấy 2 cái size M', true)
  expectPick('mình đặt mẫu này', true)

  console.log('OK partner-ai-purchase-intent after-sales gate')
}

main()

/**
 * Bước 1 — không gửi «bấm Mua» khi khách đang hậu mãi / tra đơn.
 * Chạy: npx tsx scripts/test-partner-ai-purchase-intent-after-sales.ts
 */
import assert from 'node:assert/strict'
import { inboundTextLooksLikePurchasePickListIntent } from '../src/lib/messaging/partner-ai-purchase-intent'

function expectPick(text: string, want: boolean) {
  const got = inboundTextLooksLikePurchasePickListIntent(text)
  assert.equal(got, want, `pick_list=${got} want=${want} :: ${text}`)
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

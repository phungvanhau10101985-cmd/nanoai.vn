/**
 * Đơn thanh toán qua **SePay** (qr.sepay.vn + nội dung `SEVQR …`): webhook đối soát — **không** cần khách gửi ảnh biên lai.
 */
export function isSepayStyleOrderPayment(input: {
  payment_qr_url?: string | null | undefined
  payment_reference?: string | null | undefined
}): boolean {
  const qr = String(input.payment_qr_url ?? '')
    .trim()
    .toLowerCase()
  if (qr.includes('qr.sepay.vn')) return true
  const ref = String(input.payment_reference ?? '').trim()
  if (/^sevqr\s/i.test(ref)) return true
  return false
}

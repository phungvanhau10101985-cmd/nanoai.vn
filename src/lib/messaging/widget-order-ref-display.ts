import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import {
  bankTransferMemoFromPaymentReference,
  displayShopOrderCode,
} from '@/lib/messaging/shop-payment-reference'

/**
 * Mã đơn hiển thị: `188COMVN01` (bỏ SEVQR). Đơn nháp chưa có mã — 8 ký tự hex cuối UUID.
 */
export function guestFacingOrderRef(row: Pick<PartnerOrderRow, 'id' | 'payment_reference'>): string {
  const pr = String(row.payment_reference ?? '').trim()
  if (pr.length > 0) return displayShopOrderCode(pr)
  return compactUuidTail(row.id, 8)
}

/** Nội dung CK trên app ngân hàng — SePay thêm `SEVQR ` để khớp QR / webhook. */
export function guestFacingTransferMemo(
  row: Pick<PartnerOrderRow, 'payment_reference' | 'payment_qr_url'>
): string {
  const pr = String(row.payment_reference ?? '').trim()
  if (!pr) return ''
  return bankTransferMemoFromPaymentReference(
    pr,
    isSepayStyleOrderPayment({
      payment_qr_url: row.payment_qr_url,
      payment_reference: pr,
    })
  )
}

/** Rút gọn UUID: chỉ lấy `len` ký tự hex cuối (in hoa). */
export function compactUuidTail(uuid: string, len = 8): string {
  const h = String(uuid ?? '')
    .replace(/-/g, '')
    .toUpperCase()
  if (h.length <= len) return h || '—'
  return h.slice(-len)
}

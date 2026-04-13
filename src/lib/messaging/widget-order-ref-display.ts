import type { PartnerOrderRow } from '@/lib/db/messaging-partner-orders-pg'

/**
 * Mã đơn hiển thị cho khách: ưu tiên nội dung CK (`payment_reference`).
 * VietQR: dạng SHOP-HEX; SePay: dạng `SEVQR …`. Nếu chưa có (đơn nháp) — 8 ký tự hex cuối.
 */
export function guestFacingOrderRef(row: Pick<PartnerOrderRow, 'id' | 'payment_reference'>): string {
  const pr = String(row.payment_reference ?? '').trim()
  if (pr.length > 0) return pr
  return compactUuidTail(row.id, 8)
}

/** Rút gọn UUID: chỉ lấy `len` ký tự hex cuối (in hoa). */
export function compactUuidTail(uuid: string, len = 8): string {
  const h = String(uuid ?? '')
    .replace(/-/g, '')
    .toUpperCase()
  if (h.length <= len) return h || '—'
  return h.slice(-len)
}

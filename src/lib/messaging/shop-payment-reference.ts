/**
 * Mã nội dung CK / QR: tiền tố từ tên shop (không dùng NANOAI) + đoạn cố định từ UUID đơn.
 * Chỉ ký tự A–Z, 0–9 để tương thích app ngân hàng.
 */
export function sanitizeShopPrefixForPaymentRef(shopDisplayName: string): string {
  const raw = String(shopDisplayName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 14)
  if (raw.length >= 3) return raw
  return 'SHOP'
}

export function buildStablePaymentReference(orderId: string, shopDisplayName: string): string {
  const clean = orderId.replace(/-/g, '').slice(0, 10).toUpperCase()
  const prefix = sanitizeShopPrefixForPaymentRef(shopDisplayName)
  return `${prefix}-${clean}`
}

/**
 * Nội dung CK khi tạo QR qua SePay (`qr.sepay.vn`): bắt buộc dạng «SEVQR » + chuỗi A–Z0–9 (không gạch ngang),
 * khớp cấu hình / đối soát SePay và webhook (`SEVQR …`).
 */
export function buildSepayOrderPaymentReference(orderId: string, shopDisplayName: string): string {
  const clean = orderId.replace(/-/g, '').slice(0, 10).toUpperCase()
  const prefix = sanitizeShopPrefixForPaymentRef(shopDisplayName)
  const core = `${prefix}${clean}`.replace(/[^A-Z0-9]/g, '').slice(0, 32)
  return `SEVQR ${core}`
}

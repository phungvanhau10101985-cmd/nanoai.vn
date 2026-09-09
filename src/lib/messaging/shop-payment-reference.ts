/**
 * Mã đơn shop: tên shop (A–Z0–9) + số tăng dần — vd. 188.com.vn → 188COMVN01.
 * Không nhúng UUID. Nội dung CK SePay thêm tiền tố «SEVQR » lúc tạo QR / webhook.
 */

const SEVQR_PREFIX_RE = /^SEVQR\s*/i

/** Tiền tố mã đơn từ tên shop. Chỉ A–Z0–9 để app ngân hàng nhận được. */
export function sanitizeShopPrefixForPaymentRef(shopDisplayName: string): string {
  const raw = String(shopDisplayName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
  if (raw.length >= 3) return raw
  return 'SHOP'
}

export function formatShopSequentialOrderCode(shopDisplayName: string, seq: number): string {
  const prefix = sanitizeShopPrefixForPaymentRef(shopDisplayName)
  const n = Math.max(1, Math.floor(Number(seq) || 1))
  return `${prefix}${String(n).padStart(2, '0')}`
}

/** Bỏ SEVQR / khoảng trắng / gạch — còn A–Z0–9. */
export function coreShopOrderCode(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(SEVQR_PREFIX_RE, '')
    .replace(/[^A-Z0-9]/g, '')
}

/** Mã đơn hiện bảng quản trị / đơn khách (không SEVQR). */
export function displayShopOrderCode(raw: string): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (SEVQR_PREFIX_RE.test(t)) {
    const core = t.replace(SEVQR_PREFIX_RE, '').replace(/\s+/g, '').toUpperCase()
    return core || t.toUpperCase()
  }
  return t.toUpperCase()
}

/** Nội dung CK SePay: «SEVQR » + mã đơn (A–Z0–9, không gạch). */
export function sepayTransferContentFromOrderCode(raw: string): string {
  const core = coreShopOrderCode(raw)
  if (!core) return ''
  return `SEVQR ${core}`
}

/** Memo khách gõ trên app ngân hàng: SePay = SEVQR + mã; VietQR = mã đã lưu. */
export function bankTransferMemoFromPaymentReference(raw: string, useSepay: boolean): string {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (!useSepay) return t
  return sepayTransferContentFromOrderCode(t)
}

/**
 * Khóa tra DB: mã lưu (`188COMVN01`) và bản SePay (`SEVQR 188COMVN01`).
 * Đơn cũ UUID vẫn khớp chuỗi đầy đủ.
 */
export function paymentReferenceLookupKeys(raw: string): string[] {
  const t = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
  if (!t) return []
  const keys = new Set<string>()
  keys.add(t)
  const stripped = t.replace(SEVQR_PREFIX_RE, '').replace(/\s+/g, '')
  if (stripped) {
    keys.add(stripped)
    if (!SEVQR_PREFIX_RE.test(t)) keys.add(`SEVQR ${stripped}`)
    else keys.add(`SEVQR ${stripped}`)
  }
  return [...keys]
}

/**
 * Mã ngắn shop+số (188COMVN01, SHOP01) hoặc DH/DC. Không nhận SKU 1 chữ (H9441).
 */
export function isSequentialShopOrderCode(raw: string): boolean {
  const c = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, '')
    .replace(SEVQR_PREFIX_RE, '')
    .replace(/[^A-Z0-9]/g, '')
  if (c.length < 5 || c.length > 22) return false
  if (/^D[HC]\d{2,}$/.test(c)) return true
  if (/^\d{1,6}[A-Z]{2,14}\d{2,6}$/.test(c)) return true
  if (/^[A-Z]{3,14}\d{2,6}$/.test(c)) return true
  return false
}

/** Fallback khi chưa chạy migration bộ đếm: UUID rút gọn (đơn cũ / lỗi allocate). */
export function buildStablePaymentReference(orderId: string, shopDisplayName: string): string {
  const clean = orderId.replace(/-/g, '').slice(0, 10).toUpperCase()
  const prefix = sanitizeShopPrefixForPaymentRef(shopDisplayName)
  return `${prefix}-${clean}`
}

export function buildSepayOrderPaymentReference(orderId: string, shopDisplayName: string): string {
  const clean = orderId.replace(/-/g, '').slice(0, 10).toUpperCase()
  const prefix = sanitizeShopPrefixForPaymentRef(shopDisplayName)
  const core = `${prefix}${clean}`.replace(/[^A-Z0-9]/g, '').slice(0, 32)
  return `SEVQR ${core}`
}

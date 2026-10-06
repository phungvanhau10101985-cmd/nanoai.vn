/** Trần cọc theo % — không phải ô cài đặt riêng. Số % vẫn lấy từ Cài đặt thanh toán. */
export const PARTNER_MIN_DEPOSIT_VND = 100_000

export function clampPartnerDepositPercent(value: unknown, fallback = 0): number {
  const n = Math.round(Number(value))
  const raw = Number.isFinite(n) ? n : Math.round(Number(fallback))
  if (!Number.isFinite(raw)) return 0
  return Math.max(0, Math.min(100, raw))
}

/**
 * Cọc theo % đã lưu. Dưới 100.000đ thì nâng lên 100.000đ, nhưng không vượt tiền hàng.
 * 100% = cả tiền hàng. 0% hoặc đơn trống = 0.
 */
export function resolvePercentDepositAmount(payable: number, percent: number): number {
  const base = Math.max(0, Math.round(Number(payable) || 0))
  const p = clampPartnerDepositPercent(percent, 0)
  if (base <= 0 || p <= 0) return 0
  if (p >= 100) return base
  const raw = Math.ceil((base * p) / 100)
  return Math.min(base, Math.max(raw, PARTNER_MIN_DEPOSIT_VND))
}

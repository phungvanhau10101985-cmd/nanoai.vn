/** Trần cọc theo % — không phải ô cài đặt riêng. Số % vẫn lấy từ Cài đặt thanh toán. */
export const PARTNER_MIN_DEPOSIT_VND = 100_000

/** Đơn giá từ mức này trở lên thì khách cọc ít nhất % bên dưới. Shop sửa trong Cài đặt thanh toán. */
export const DEFAULT_HIGH_UNIT_PRICE_DEPOSIT_THRESHOLD_VND = 3_000_000
export const DEFAULT_HIGH_UNIT_PRICE_MIN_DEPOSIT_PERCENT = 30

export type HighUnitPriceDepositSettings = {
  thresholdVnd: number
  minPercent: number
}

/** `null` / bỏ trống = mặc định 3.000.000đ và 30%. `0` = tắt luật đó. */
export function readHighUnitPriceDepositSettings(input?: {
  thresholdVnd?: number | null
  minPercent?: number | null
} | null): HighUnitPriceDepositSettings {
  const thresholdRaw = input?.thresholdVnd
  const percentRaw = input?.minPercent
  const threshold =
    thresholdRaw == null || !Number.isFinite(Number(thresholdRaw))
      ? DEFAULT_HIGH_UNIT_PRICE_DEPOSIT_THRESHOLD_VND
      : Math.max(0, Math.round(Number(thresholdRaw)))
  const minPercent =
    percentRaw == null || !Number.isFinite(Number(percentRaw))
      ? DEFAULT_HIGH_UNIT_PRICE_MIN_DEPOSIT_PERCENT
      : clampPartnerDepositPercent(percentRaw, 0)
  return { thresholdVnd: threshold, minPercent }
}

export function unitPriceMeetsDepositFloor(unitPrice: number, settings: HighUnitPriceDepositSettings): boolean {
  if (settings.thresholdVnd <= 0 || settings.minPercent <= 0) return false
  return Math.round(Number(unitPrice) || 0) >= settings.thresholdVnd
}

/** % cọc một phần khách được chọn: shop % , hoặc cao hơn nếu đơn có đơn giá chạm trần. */
export function partialDepositPercentForPrices(input: {
  shopPercent: number
  unitPrices: number[]
  thresholdVnd?: number | null
  minPercent?: number | null
}): number {
  const rule = readHighUnitPriceDepositSettings({
    thresholdVnd: input.thresholdVnd,
    minPercent: input.minPercent,
  })
  const shop = clampPartnerDepositPercent(input.shopPercent, 0)
  const hit = input.unitPrices.some((price) => unitPriceMeetsDepositFloor(price, rule))
  if (!hit) return shop
  return Math.max(shop, rule.minPercent)
}

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

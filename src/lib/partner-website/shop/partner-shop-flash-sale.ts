/** W1.4 — lightweight flash sale window helpers (no bundle). */

export type FlashSaleFields = {
  priceAmount: number | null
  salePriceAmount: number | null
  saleStartsAt: string | null
  saleEndsAt: string | null
}

export function isPartnerFlashSaleActive(fields: FlashSaleFields, nowMs = Date.now()): boolean {
  const sale = fields.salePriceAmount
  if (sale == null || !Number.isFinite(sale) || sale < 0) return false
  const base = fields.priceAmount
  if (base != null && Number.isFinite(base) && sale >= base) return false
  const start = fields.saleStartsAt ? Date.parse(fields.saleStartsAt) : NaN
  const end = fields.saleEndsAt ? Date.parse(fields.saleEndsAt) : NaN
  if (Number.isFinite(start) && nowMs < start) return false
  if (Number.isFinite(end) && nowMs >= end) return false
  return true
}

export function resolvePartnerEffectiveUnitPrice(fields: FlashSaleFields, nowMs = Date.now()): number | null {
  if (isPartnerFlashSaleActive(fields, nowMs)) return fields.salePriceAmount
  return fields.priceAmount != null && Number.isFinite(fields.priceAmount) ? fields.priceAmount : null
}

export function formatPartnerShopMoneyVnd(amount: number): string {
  return `${Math.round(amount).toLocaleString('vi-VN')}₫`
}

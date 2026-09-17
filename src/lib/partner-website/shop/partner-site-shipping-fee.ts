import { matchVietnamProvince, type VietnamProvince } from '@/lib/partner-website/shop/vietnam-provinces'

export type PartnerShippingFeeSource = 'province' | 'default' | 'free'

export type PartnerShippingFeeQuote = {
  feeAmount: number
  /** Phí trước khi áp ngưỡng miễn phí (đồng giá hoặc override tỉnh). */
  configuredFeeAmount: number
  source: PartnerShippingFeeSource
  matchedProvince: VietnamProvince | null
}

function money(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

function provinceOverrideFee(
  fees: ReadonlyMap<string, number> | Record<string, number> | null | undefined,
  province: VietnamProvince | null
): number | undefined {
  if (!province || !fees) return undefined
  if (fees instanceof Map) {
    if (fees.has(province)) return money(fees.get(province))
    return undefined
  }
  if (Object.prototype.hasOwnProperty.call(fees, province)) {
    return money((fees as Record<string, number>)[province])
  }
  return undefined
}

/**
 * Phí ship checkout: tỉnh có dòng riêng dùng phí đó (kể cả 0);
 * tỉnh chưa cài thì nhận phí đồng giá. Ngưỡng miễn phí áp sau khi đã chọn mức phí.
 */
export function resolvePartnerShippingFeeQuote(input: {
  defaultFeeAmount: number
  provinceFees?: ReadonlyMap<string, number> | Record<string, number> | null
  province?: string | null
  shippingAddress?: string | null
  payableSubtotal: number
  freeThresholdAmount?: number | null
}): PartnerShippingFeeQuote {
  const matchedProvince =
    matchVietnamProvince(input.province) || matchVietnamProvince(input.shippingAddress)
  const override = provinceOverrideFee(input.provinceFees, matchedProvince)
  const configuredFeeAmount = override != null ? override : money(input.defaultFeeAmount)
  const payable = money(input.payableSubtotal)
  const threshold =
    input.freeThresholdAmount == null ? null : money(input.freeThresholdAmount)
  if (configuredFeeAmount <= 0) {
    return {
      feeAmount: 0,
      configuredFeeAmount,
      source: override != null ? 'province' : 'default',
      matchedProvince,
    }
  }
  if (threshold != null && payable >= threshold) {
    return {
      feeAmount: 0,
      configuredFeeAmount,
      source: 'free',
      matchedProvince,
    }
  }
  return {
    feeAmount: configuredFeeAmount,
    configuredFeeAmount,
    source: override != null ? 'province' : 'default',
    matchedProvince,
  }
}

export function partnerShippingFeeAmount(input: Parameters<typeof resolvePartnerShippingFeeQuote>[0]): number {
  return resolvePartnerShippingFeeQuote(input).feeAmount
}

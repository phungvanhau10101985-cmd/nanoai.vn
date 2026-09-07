import type { PartnerPromotionRow, PromotionValidateError } from '@/lib/partner-website/promotions/partner-promotion-types'

export type PromotionCustomerEligibilityInput = {
  isActive: boolean
  validFrom: string | null
  validTo: string | null
  minSubtotal: number
  usageLimit: number | null
  usedCount: number
  firstOrderOnly: boolean
  perUserLimit: number
  now?: number
  /** Omit or 0 = skip min-subtotal (ví quà chưa có giỏ). */
  subtotal?: number | null
  hasPriorOrder: boolean
  /** `null` = chưa đăng nhập / bỏ qua hạn mức theo khách. */
  usedByCustomerCount?: number | null
}

/** Điều kiện theo khách + hiệu lực mã — không gồm khớp dòng giỏ / grant. */
export function assessPromotionCustomerEligibility(
  input: PromotionCustomerEligibilityInput
): PromotionValidateError | null {
  const now = input.now ?? Date.now()
  if (!input.isActive) return 'inactive'
  if (input.validFrom && new Date(input.validFrom).getTime() > now) return 'not_started'
  if (input.validTo && new Date(input.validTo).getTime() < now) return 'expired'
  const subtotal = input.subtotal ?? 0
  if (subtotal > 0 && subtotal < input.minSubtotal) return 'below_min_subtotal'
  if (input.usageLimit != null && input.usedCount >= input.usageLimit) return 'usage_limit_reached'
  if (input.usedByCustomerCount != null && input.usedByCustomerCount >= input.perUserLimit) {
    return 'per_user_limit_reached'
  }
  if (input.firstOrderOnly && input.hasPriorOrder) return 'first_order_only'
  return null
}

export function promotionToCustomerEligibilityFields(
  promotion: PartnerPromotionRow
): Pick<
  PromotionCustomerEligibilityInput,
  'isActive' | 'validFrom' | 'validTo' | 'minSubtotal' | 'usageLimit' | 'usedCount' | 'firstOrderOnly' | 'perUserLimit'
> {
  return {
    isActive: promotion.isActive,
    validFrom: promotion.validFrom,
    validTo: promotion.validTo,
    minSubtotal: promotion.minSubtotal,
    usageLimit: promotion.usageLimit,
    usedCount: promotion.usedCount,
    firstOrderOnly: promotion.firstOrderOnly,
    perUserLimit: promotion.perUserLimit,
  }
}

/** Lỗi vĩnh viễn — mã không còn giá trị dùng, nên gỡ khỏi ví (không phải dưới min đơn tạm thời). */
export function isPermanentlyUnusablePromoError(error: PromotionValidateError | null): boolean {
  return (
    error === 'first_order_only' ||
    error === 'per_user_limit_reached' ||
    error === 'usage_limit_reached' ||
    error === 'inactive' ||
    error === 'expired'
  )
}

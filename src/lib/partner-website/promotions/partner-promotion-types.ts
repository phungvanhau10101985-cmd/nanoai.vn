/**
 * W1.4 (docs/PARTNER_WEBSITE_AND_LANDING_UPGRADE_188.md) — Khuyến mãi / Voucher / Ví quà.
 * Xem docs/188_BEHAVIOR_SPEC.md mục D cho hành vi chi tiết + lỗ hổng 188 KHÔNG nên copy.
 */

export const PROMOTION_CODE_MAX_LEN = 40
export const PROMOTION_NAME_MAX_LEN = 200

export type PromotionDiscountType = 'percent' | 'fixed_amount'
export type PromotionGrantSource =
  | 'signup'
  | 'first_order_delivered'
  | 'comeback'
  | 'cart_abandon'
  | 'admin_gift'
  | 'public_redeem'
export type PromotionGrantStatus = 'active' | 'used' | 'expired'
export type PromotionAutoGrantTrigger = 'signup' | 'first_order_delivered' | 'comeback' | 'cart_abandon'

export type PartnerPromotionRow = {
  id: string
  partnerId: string
  code: string
  name: string
  description: string
  discountType: PromotionDiscountType
  discountPercent: number | null
  discountAmount: number | null
  maxDiscountAmount: number | null
  minSubtotal: number
  firstOrderOnly: boolean
  categoryId: string | null
  inventoryId: string | null
  usageLimit: number | null
  perUserLimit: number
  usedCount: number
  validFrom: string | null
  validTo: string | null
  isActive: boolean
  isPublicRedeemable: boolean
  autoGrantTrigger: PromotionAutoGrantTrigger | null
  autoGrantValidDays: number | null
  createdAt: string
  updatedAt: string
}

export type PromotionGrantRow = {
  id: string
  partnerId: string
  promotionId: string
  guestAccountId: string | null
  linkedUserId: string | null
  source: PromotionGrantSource
  status: PromotionGrantStatus
  grantedAt: string
  expiresAt: string | null
  usedAt: string | null
  usedOrderId: string | null
}

export type PromotionValidateError =
  | 'not_found'
  | 'inactive'
  | 'not_started'
  | 'expired'
  | 'below_min_subtotal'
  | 'usage_limit_reached'
  | 'per_user_limit_reached'
  | 'first_order_only'
  | 'no_eligible_items'
  | 'grant_required'
  | 'already_used'
  | 'invalid_code'

export type PromotionValidateSuccess = {
  ok: true
  promotion: PartnerPromotionRow
  discountAmount: number
  eligibleSubtotal: number
}

export type PromotionValidateResult = PromotionValidateSuccess | { ok: false; error: PromotionValidateError }

export function normalizePromotionCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, PROMOTION_CODE_MAX_LEN)
}

export function isValidPromotionCode(code: string): boolean {
  return /^[A-Z0-9_-]{3,40}$/.test(code)
}

/** Tính số tiền giảm từ 1 voucher trên phần subtotal đủ điều kiện — cap theo max_discount_amount và không vượt eligibleSubtotal. */
export function computePromotionDiscountAmount(
  promotion: Pick<PartnerPromotionRow, 'discountType' | 'discountPercent' | 'discountAmount' | 'maxDiscountAmount'>,
  eligibleSubtotal: number
): number {
  if (eligibleSubtotal <= 0) return 0
  let amount = 0
  if (promotion.discountType === 'percent') {
    amount = Math.round((eligibleSubtotal * (promotion.discountPercent ?? 0)) / 100)
    if (promotion.maxDiscountAmount != null) amount = Math.min(amount, promotion.maxDiscountAmount)
  } else {
    amount = promotion.discountAmount ?? 0
  }
  return Math.max(0, Math.min(amount, eligibleSubtotal))
}

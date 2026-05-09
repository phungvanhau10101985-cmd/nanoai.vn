export type ByokPlanId = 'basic' | 'pro' | 'business'

export type ByokPlan = {
  id: ByokPlanId
  monthlyPriceVnd: number
}

export const BYOK_FIRST_MONTH_DISCOUNT_PERCENT = 30

export const BYOK_PLANS: Record<ByokPlanId, ByokPlan> = {
  basic: { id: 'basic', monthlyPriceVnd: 199_000 },
  pro: { id: 'pro', monthlyPriceVnd: 299_000 },
  business: { id: 'business', monthlyPriceVnd: 699_000 },
}

export function isByokPlanId(input: string): input is ByokPlanId {
  return input === 'basic' || input === 'pro' || input === 'business'
}

export function getByokFirstMonthAmount(planId: ByokPlanId): number {
  const regular = BYOK_PLANS[planId].monthlyPriceVnd
  return Math.round(regular * (100 - BYOK_FIRST_MONTH_DISCOUNT_PERCENT) / 100)
}

export function getByokRenewalAmount(planId: ByokPlanId): number {
  return BYOK_PLANS[planId].monthlyPriceVnd
}

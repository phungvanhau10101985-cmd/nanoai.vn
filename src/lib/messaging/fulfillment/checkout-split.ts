import {
  FULFILLMENT_CHINA,
  FULFILLMENT_VIETNAM,
  allocateIntegerTotal,
  type PartnerFulfillmentSource,
  type PartnerSourcePlatform,
} from '@/lib/messaging/fulfillment/fulfillment-routing'
import { selectOptimizedFulfillmentOutcome } from '@/lib/messaging/fulfillment/optimized-fulfillment-runtime'
import { clampPartnerDepositPercent, resolvePercentDepositAmount } from '@/lib/messaging/partner-deposit-amount'

export type CheckoutSplitLine = {
  fulfillmentSource: PartnerFulfillmentSource
  sourcePlatform: PartnerSourcePlatform | null
  sourceUrl: string
  lineSubtotal: number
  isWarehouseItem: boolean
  depositRequired: boolean
}

export type CheckoutSplitGroupPlan = {
  source: PartnerFulfillmentSource
  splitIndex: number
  lines: CheckoutSplitLine[]
  subtotal: number
  discount: number
  shippingFee: number
  amountAfterDiscount: number
  depositPayable: number
  requiresDeposit: boolean
  depositPercent: number
  requiredAmount: number
}

export type CheckoutSplitPlanInput = {
  lines: CheckoutSplitLine[]
  totalDiscount: number
  shippingFee: number
  shopDepositMode: 'none' | 'percent' | 'fixed_amount'
  shopDepositPercent: number
  shopDepositFixed: number
}

export function groupCheckoutLines<T extends CheckoutSplitLine>(lines: T[]): Record<PartnerFulfillmentSource, T[]> {
  const grouped = {
    [FULFILLMENT_VIETNAM]: [] as T[],
    [FULFILLMENT_CHINA]: [] as T[],
  }
  for (const line of lines) {
    grouped[line.fulfillmentSource === FULFILLMENT_CHINA ? FULFILLMENT_CHINA : FULFILLMENT_VIETNAM].push(line)
  }
  return grouped
}

export function orderedFulfillmentSources(grouped: Record<PartnerFulfillmentSource, unknown[]>): PartnerFulfillmentSource[] {
  return ([FULFILLMENT_VIETNAM, FULFILLMENT_CHINA] as const).filter((source) => grouped[source].length > 0)
}

export function buildCheckoutSplitPlans(input: CheckoutSplitPlanInput): CheckoutSplitGroupPlan[] {
  const grouped = groupCheckoutLines(input.lines)
  const sources = orderedFulfillmentSources(grouped)
  const regularWeights: Record<string, number> = {}
  for (const source of sources) {
    regularWeights[source] = grouped[source]
      .filter((row) => !row.isWarehouseItem)
      .reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
  }
  const discounts = allocateIntegerTotal(Math.max(0, Math.round(input.totalDiscount)), regularWeights, sources)
  const shippingSource = sources.includes(FULFILLMENT_VIETNAM) ? FULFILLMENT_VIETNAM : FULFILLMENT_CHINA

  const plans = sources.map((source, index) => {
    const lines = grouped[source]
    const subtotal = lines.reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
    const discount = Math.min(subtotal, discounts[source] || 0)
    const amountAfterDiscount = Math.max(0, subtotal - discount)
    const shippingFee = source === shippingSource ? Math.max(0, Math.round(input.shippingFee)) : 0
    const regularGoods = lines
      .filter((row) => !row.isWarehouseItem)
      .reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
    const depositGoods = lines
      .filter((row) => row.depositRequired && !row.isWarehouseItem)
      .reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
    const depositDiscount =
      regularGoods > 0 ? Math.round((discount * depositGoods) / regularGoods) : 0
    const depositPayable = Math.max(0, depositGoods - Math.min(depositGoods, depositDiscount))
    // Cọc hay không = cờ từng sản phẩm. % / số tiền cố định chỉ là mức tiền. Kho thanh lý không cọc.
    let requiresDeposit = depositPayable > 0
    let depositPercent = 0
    let requiredAmount = 0
    if (requiresDeposit && input.shopDepositMode !== 'fixed_amount') {
      depositPercent = clampPartnerDepositPercent(input.shopDepositPercent, 0)
      requiredAmount = resolvePercentDepositAmount(depositPayable, depositPercent)
      if (requiredAmount <= 0) {
        requiresDeposit = false
        depositPercent = 0
      }
    }
    return {
      source,
      splitIndex: index + 1,
      lines,
      subtotal,
      discount,
      shippingFee,
      amountAfterDiscount,
      depositPayable,
      requiresDeposit,
      depositPercent,
      requiredAmount,
    }
  })
  if (input.shopDepositMode === 'fixed_amount') {
    const fixed = Math.max(0, Math.round(input.shopDepositFixed))
    const target = plans.find((plan) => plan.requiresDeposit)
    if (target) {
      target.requiredAmount = Math.min(target.depositPayable, fixed)
      target.depositPercent =
        target.depositPayable > 0 ? Math.round((target.requiredAmount * 100) / target.depositPayable) : 0
    }
    for (const plan of plans) {
      if (plan !== target) {
        plan.requiredAmount = 0
        plan.depositPercent = 0
        plan.requiresDeposit = false
      }
    }
  }
  return plans
}

/**
 * Runtime rollout boundary. The current optimized planner is contract-equivalent
 * to the established planner, so off/shadow preserve the existing checkout result.
 */
export function buildCheckoutSplitPlansForTenant(
  tenantId: string,
  input: CheckoutSplitPlanInput
): CheckoutSplitGroupPlan[] {
  return selectOptimizedFulfillmentOutcome({
    tenantId,
    operation: 'checkout',
    legacy: () => buildCheckoutSplitPlans(input),
    optimized: () => buildCheckoutSplitPlans(input),
  }).value
}

export function pickPrimaryCheckoutOrderIndex(plans: CheckoutSplitGroupPlan[]): number {
  const withDiscount = plans.findIndex((plan) => plan.discount > 0)
  if (withDiscount >= 0) return withDiscount
  const withShip = plans.findIndex((plan) => plan.shippingFee > 0)
  if (withShip >= 0) return withShip
  return 0
}

import {
  FULFILLMENT_CHINA,
  FULFILLMENT_VIETNAM,
  allocateIntegerTotal,
  type PartnerFulfillmentSource,
  type PartnerSourcePlatform,
} from '@/lib/messaging/fulfillment/fulfillment-routing'
import { selectOptimizedFulfillmentOutcome } from '@/lib/messaging/fulfillment/optimized-fulfillment-runtime'
import {
  clampPartnerDepositPercent,
  clampPartnerMinDepositAmount,
  readHighUnitPriceDepositSettings,
  resolvePercentDepositAmount,
  orderValueMeetsDepositFloor,
  type HighUnitPriceDepositSettings,
} from '@/lib/messaging/partner-deposit-amount'

export type CheckoutSplitLine = {
  fulfillmentSource: PartnerFulfillmentSource
  sourcePlatform: PartnerSourcePlatform | null
  sourceUrl: string
  lineSubtotal: number
  isWarehouseItem: boolean
  depositRequired: boolean
  /** Đơn giá bán (sau giá sale). Trần cọc xét tổng lineSubtotal của đơn, không xét từng đơn giá. */
  unitPrice?: number
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
  /** Mốc giá trị hàng. Bỏ trống = 3.000.000đ và cọc 30% từ mốc đó. 0 = tắt luật đơn lớn. */
  highUnitPriceDepositThresholdVnd?: number | null
  highUnitPriceMinDepositPercent?: number | null
  /** Sàn tiền cọc. Bỏ trống = 100.000đ. Không thấp hơn 100.000đ. */
  minDepositAmountVnd?: number | null
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

  const highUnitPrice = readHighUnitPriceDepositSettings({
    thresholdVnd: input.highUnitPriceDepositThresholdVnd,
    minPercent: input.highUnitPriceMinDepositPercent,
  })
  const minDepositAmount = clampPartnerMinDepositAmount(input.minDepositAmountVnd)
  const plans = sources.map((source, index) => {
    const lines = grouped[source]
    const subtotal = lines.reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
    const discount = Math.min(subtotal, discounts[source] || 0)
    const amountAfterDiscount = Math.max(0, subtotal - discount)
    const shippingFee = source === shippingSource ? Math.max(0, Math.round(input.shippingFee)) : 0
    const deposit = resolveGroupDeposit({
      lines,
      discount,
      shopDepositMode: input.shopDepositMode,
      shopDepositPercent: input.shopDepositPercent,
      highUnitPrice,
      minDepositAmount,
    })
    return {
      source,
      splitIndex: index + 1,
      lines,
      subtotal,
      discount,
      shippingFee,
      amountAfterDiscount,
      depositPayable: deposit.depositPayable,
      requiresDeposit: deposit.requiresDeposit,
      depositPercent: deposit.depositPercent,
      requiredAmount: deposit.requiredAmount,
      flaggedPayable: deposit.flaggedPayable,
    }
  })
  if (input.shopDepositMode === 'fixed_amount') {
    const fixed = Math.max(0, Math.round(input.shopDepositFixed))
    const target = plans.find((plan) => plan.flaggedPayable > 0)
    if (target) {
      const fixedAmount = Math.min(target.flaggedPayable, fixed)
      target.requiredAmount = Math.max(target.requiredAmount, fixedAmount)
      target.depositPercent =
        target.depositPayable > 0 ? Math.round((target.requiredAmount * 100) / target.depositPayable) : 0
      target.requiresDeposit = target.requiredAmount > 0
    }
    for (const plan of plans) {
      if (plan === target || plan.requiredAmount > 0) continue
      plan.requiredAmount = 0
      plan.depositPercent = 0
      plan.requiresDeposit = false
    }
  }
  return plans.map((plan) => ({
    source: plan.source,
    splitIndex: plan.splitIndex,
    lines: plan.lines,
    subtotal: plan.subtotal,
    discount: plan.discount,
    shippingFee: plan.shippingFee,
    amountAfterDiscount: plan.amountAfterDiscount,
    depositPayable: plan.depositPayable,
    requiresDeposit: plan.requiresDeposit,
    depositPercent: plan.depositPercent,
    requiredAmount: plan.requiredAmount,
  }))
}

type GroupDeposit = {
  depositPayable: number
  requiresDeposit: boolean
  depositPercent: number
  requiredAmount: number
  flaggedPayable: number
}

/** Dưới mốc: % shop trên dòng bật cọc. Từ mốc: đúng % đơn lớn trên cả tiền hàng. Kho thanh lý không tính. */
function resolveGroupDeposit(input: {
  lines: CheckoutSplitLine[]
  discount: number
  shopDepositMode: 'none' | 'percent' | 'fixed_amount'
  shopDepositPercent: number
  highUnitPrice: HighUnitPriceDepositSettings
  minDepositAmount: number
}): GroupDeposit {
  const regular = input.lines
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.isWarehouseItem)
  const weights: Record<string, number> = {}
  const keys: string[] = []
  for (const { row, index } of regular) {
    const key = String(index)
    keys.push(key)
    weights[key] = Math.max(0, Math.round(row.lineSubtotal))
  }
  const lineDiscounts = allocateIntegerTotal(Math.max(0, Math.round(input.discount)), weights, keys)
  const orderGoods = regular.reduce((sum, { row }) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
  const discountedGoods = Math.max(0, orderGoods - Math.max(0, Math.round(input.discount)))
  const floorPct = orderValueMeetsDepositFloor(discountedGoods, input.highUnitPrice)
    ? input.highUnitPrice.minPercent
    : 0
  let depositPayable = 0
  let flaggedPayable = 0
  let highPayable = 0
  let raw = 0
  let policyPercent = 0
  const percents = new Set<number>()

  for (const { row, index } of regular) {
    const sub = Math.max(0, Math.round(row.lineSubtotal))
    const lineDiscount = Math.min(sub, lineDiscounts[String(index)] || 0)
    const payable = Math.max(0, sub - lineDiscount)
    if (row.depositRequired) flaggedPayable += payable
    if (floorPct > 0) highPayable += payable
    if (input.shopDepositMode === 'fixed_amount') {
      if (row.depositRequired || floorPct > 0) depositPayable += payable
      continue
    }
    const shopPct = row.depositRequired ? clampPartnerDepositPercent(input.shopDepositPercent, 0) : 0
    const pct = floorPct > 0 ? floorPct : shopPct
    if (pct <= 0 || payable <= 0) continue
    depositPayable += payable
    raw += pct >= 100 ? payable : Math.ceil((payable * pct) / 100)
    policyPercent = Math.max(policyPercent, pct)
    percents.add(pct)
  }

  if (input.shopDepositMode === 'fixed_amount') {
    const floorAmount =
      highPayable > 0
        ? resolvePercentDepositAmount(highPayable, input.highUnitPrice.minPercent, input.minDepositAmount)
        : 0
    return {
      depositPayable,
      flaggedPayable,
      requiresDeposit: flaggedPayable > 0 || floorAmount > 0,
      depositPercent: floorAmount > 0 ? input.highUnitPrice.minPercent : 0,
      requiredAmount: floorAmount,
    }
  }
  if (depositPayable <= 0 || policyPercent <= 0) {
    return { depositPayable: 0, flaggedPayable, requiresDeposit: false, depositPercent: 0, requiredAmount: 0 }
  }
  const requiredAmount =
    percents.size === 1
      ? resolvePercentDepositAmount(depositPayable, policyPercent, input.minDepositAmount)
      : Math.min(
          depositPayable,
          Math.max(raw, Math.min(input.minDepositAmount, depositPayable))
        )
  return {
    depositPayable,
    flaggedPayable,
    requiresDeposit: requiredAmount > 0,
    depositPercent: policyPercent,
    requiredAmount,
  }
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

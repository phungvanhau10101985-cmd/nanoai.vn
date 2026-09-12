import {
  FULFILLMENT_CHINA,
  FULFILLMENT_VIETNAM,
  allocateIntegerTotal,
  type PartnerFulfillmentSource,
  type PartnerSourcePlatform,
} from '@/lib/messaging/fulfillment/fulfillment-routing'

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
  requiresDeposit: boolean
  depositPercent: number
  requiredAmount: number
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

export function buildCheckoutSplitPlans(input: {
  lines: CheckoutSplitLine[]
  totalDiscount: number
  shippingFee: number
  shopDepositMode: 'none' | 'percent' | 'fixed_amount'
  shopDepositPercent: number
  shopDepositFixed: number
}): CheckoutSplitGroupPlan[] {
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
  const skuDepositMode = input.lines.some((row) => row.depositRequired)

  const plans = sources.map((source, index) => {
    const lines = grouped[source]
    const subtotal = lines.reduce((sum, row) => sum + Math.max(0, Math.round(row.lineSubtotal)), 0)
    const discount = Math.min(subtotal, discounts[source] || 0)
    const amountAfterDiscount = Math.max(0, subtotal - discount)
    const shippingFee = source === shippingSource ? Math.max(0, Math.round(input.shippingFee)) : 0
    const warehouseOnly = lines.length > 0 && lines.every((row) => row.isWarehouseItem)
    const lineWantsDeposit = lines.some((row) => row.depositRequired && !row.isWarehouseItem)
    const shopWantsDeposit = input.shopDepositMode === 'percent' || input.shopDepositMode === 'fixed_amount'
    // Có SKU cọc → theo dòng (188). Không có → shop percent/fixed như cũ. Kho thanh lý không cọc.
    const requiresDeposit =
      shopWantsDeposit && !warehouseOnly && (skuDepositMode ? lineWantsDeposit : true)
    let depositPercent = 0
    let requiredAmount = 0
    if (requiresDeposit && input.shopDepositMode !== 'fixed_amount') {
      depositPercent = Math.max(0, Math.min(100, Math.round(input.shopDepositPercent || 30)))
      requiredAmount = Math.round((amountAfterDiscount * depositPercent) / 100)
    }
    return {
      source,
      splitIndex: index + 1,
      lines,
      subtotal,
      discount,
      shippingFee,
      amountAfterDiscount,
      requiresDeposit,
      depositPercent,
      requiredAmount,
    }
  })
  if (input.shopDepositMode === 'fixed_amount') {
    const fixed = Math.max(0, Math.round(input.shopDepositFixed))
    const target = plans.find((plan) => plan.requiresDeposit)
    if (target) {
      target.requiredAmount = Math.min(target.amountAfterDiscount, fixed)
      target.depositPercent =
        target.amountAfterDiscount > 0 ? Math.round((target.requiredAmount * 100) / target.amountAfterDiscount) : 0
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

export function pickPrimaryCheckoutOrderIndex(plans: CheckoutSplitGroupPlan[]): number {
  const withDiscount = plans.findIndex((plan) => plan.discount > 0)
  if (withDiscount >= 0) return withDiscount
  const withShip = plans.findIndex((plan) => plan.shippingFee > 0)
  if (withShip >= 0) return withShip
  return 0
}

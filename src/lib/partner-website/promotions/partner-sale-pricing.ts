export const PARTNER_ORDER_MAX_DISCOUNT_PERCENT = 15

export type PartnerSalePriceKind =
  | 'flash'
  | 'calendar'
  | 'google'
  | 'clearance'
  | 'inventory'
  | 'list'

export type PartnerSalePriceLine = {
  inventoryId: string | null
  quantity: number
  listUnitPrice: number
  effectiveUnitPrice: number
  isClearance?: boolean
  googleDiscountAmount?: number
  /** Source of the charged unit price. Flash vs calendar must not share one cart label. */
  priceKind?: PartnerSalePriceKind
  flashPercent?: number | null
}

export type PartnerSaleDiscountInput = {
  lines: PartnerSalePriceLine[]
  voucherDiscountAmount?: number
  birthdayDiscountPercent?: number
  loyaltyDiscountPercent?: number
}

export type PartnerSaleDiscountBreakdown = {
  listSubtotal: number
  effectiveSubtotal: number
  regularListSubtotal: number
  regularEffectiveSubtotal: number
  clearanceSubtotal: number
  /** Flash + calendar + inventory-window residual (non-Google). Kept for order snapshots. */
  siteSaleDiscountAmount: number
  flashSaleDiscountAmount: number
  calendarSaleDiscountAmount: number
  /** Product sale window leftover — not same-day-same-month, not flash. */
  inventorySaleDiscountAmount: number
  googleDiscountAmount: number
  voucherDiscountAmount: number
  birthdayDiscountAmount: number
  loyaltyDiscountAmount: number
  capAdjustmentAmount: number
  totalDiscountAmount: number
  amountAfterDiscount: number
  primaryDiscount: 'voucher' | 'birthday' | null
  maxDiscountAmount: number
}

function money(value: number): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
}

function percent(value: number | undefined): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? Number(value) : 0))
}

/**
 * Pure Sale Parity calculator. Prices supplied by callers have already been
 * revalidated from inventory, sale calendar and Google pv2 locks.
 */
export function resolvePartnerSaleDiscountBreakdown(
  input: PartnerSaleDiscountInput
): PartnerSaleDiscountBreakdown {
  let listSubtotal = 0
  let effectiveSubtotal = 0
  let regularListSubtotal = 0
  let regularEffectiveSubtotal = 0
  let clearanceSubtotal = 0
  let googleDiscountAmount = 0
  let flashSaleDiscountAmount = 0
  let calendarSaleDiscountAmount = 0
  let inventorySaleDiscountAmount = 0

  for (const line of input.lines) {
    const quantity = Math.max(1, Math.min(99, Math.floor(line.quantity || 1)))
    const list = money(line.listUnitPrice) * quantity
    const effective = Math.min(list, money(line.effectiveUnitPrice) * quantity)
    listSubtotal += list
    effectiveSubtotal += effective
    if (line.isClearance) {
      clearanceSubtotal += effective
      continue
    }
    regularListSubtotal += list
    regularEffectiveSubtotal += effective
    const lineSaving = Math.max(0, list - effective)
    const googleLine = Math.min(
      lineSaving,
      money(line.googleDiscountAmount ?? 0) * quantity
    )
    googleDiscountAmount += googleLine
    const residual = Math.max(0, lineSaving - googleLine)
    if (residual <= 0) continue
    if (line.priceKind === 'flash') flashSaleDiscountAmount += residual
    else if (line.priceKind === 'calendar') calendarSaleDiscountAmount += residual
    else inventorySaleDiscountAmount += residual
  }

  const priceSaving = Math.max(0, regularListSubtotal - regularEffectiveSubtotal)
  googleDiscountAmount = Math.min(priceSaving, googleDiscountAmount)
  const siteSaleDiscountAmount = Math.max(0, priceSaving - googleDiscountAmount)
  flashSaleDiscountAmount = Math.min(siteSaleDiscountAmount, flashSaleDiscountAmount)
  calendarSaleDiscountAmount = Math.min(
    Math.max(0, siteSaleDiscountAmount - flashSaleDiscountAmount),
    calendarSaleDiscountAmount
  )
  inventorySaleDiscountAmount = Math.max(
    0,
    siteSaleDiscountAmount - flashSaleDiscountAmount - calendarSaleDiscountAmount
  )
  const requestedVoucher = Math.min(regularEffectiveSubtotal, money(input.voucherDiscountAmount ?? 0))
  const requestedBirthday =
    requestedVoucher > 0
      ? 0
      : Math.min(
          regularEffectiveSubtotal,
          money((regularEffectiveSubtotal * percent(input.birthdayDiscountPercent)) / 100)
        )
  const primaryDiscount: PartnerSaleDiscountBreakdown['primaryDiscount'] =
    requestedVoucher > 0 ? 'voucher' : requestedBirthday > 0 ? 'birthday' : null
  const afterPrimary = Math.max(0, regularEffectiveSubtotal - requestedVoucher - requestedBirthday)
  const requestedLoyalty = Math.min(
    afterPrimary,
    money((afterPrimary * percent(input.loyaltyDiscountPercent)) / 100)
  )
  const maxDiscountAmount = money(
    (regularListSubtotal * PARTNER_ORDER_MAX_DISCOUNT_PERCENT) / 100
  )
  const nonPriceRequested = requestedVoucher + requestedBirthday + requestedLoyalty
  const nonPriceBudget = Math.max(0, maxDiscountAmount - priceSaving)
  let loyaltyDiscountAmount = requestedLoyalty
  let voucherDiscountAmount = requestedVoucher
  let birthdayDiscountAmount = requestedBirthday
  let overflow = Math.max(0, nonPriceRequested - nonPriceBudget)

  const loyaltyCut = Math.min(loyaltyDiscountAmount, overflow)
  loyaltyDiscountAmount -= loyaltyCut
  overflow -= loyaltyCut
  if (overflow > 0 && birthdayDiscountAmount > 0) {
    const birthdayCut = Math.min(birthdayDiscountAmount, overflow)
    birthdayDiscountAmount -= birthdayCut
    overflow -= birthdayCut
  }
  if (overflow > 0 && voucherDiscountAmount > 0) {
    const voucherCut = Math.min(voucherDiscountAmount, overflow)
    voucherDiscountAmount -= voucherCut
    overflow -= voucherCut
  }

  const appliedNonPrice = voucherDiscountAmount + birthdayDiscountAmount + loyaltyDiscountAmount
  const capAdjustmentAmount = Math.max(0, nonPriceRequested - appliedNonPrice)
  const totalDiscountAmount = priceSaving + appliedNonPrice
  const amountAfterDiscount = Math.max(0, effectiveSubtotal - appliedNonPrice)

  return {
    listSubtotal,
    effectiveSubtotal,
    regularListSubtotal,
    regularEffectiveSubtotal,
    clearanceSubtotal,
    siteSaleDiscountAmount,
    flashSaleDiscountAmount,
    calendarSaleDiscountAmount,
    inventorySaleDiscountAmount,
    googleDiscountAmount,
    voucherDiscountAmount,
    birthdayDiscountAmount,
    loyaltyDiscountAmount,
    capAdjustmentAmount,
    totalDiscountAmount,
    amountAfterDiscount,
    primaryDiscount,
    maxDiscountAmount,
  }
}

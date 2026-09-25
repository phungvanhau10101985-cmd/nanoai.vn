function vnd(amount: number): string {
  const n = Number(amount)
  const safe = Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
  return `${new Intl.NumberFormat('vi-VN').format(safe)}đ`
}

export type PartnerChatCheckoutQuoteInput = {
  breakdown?: {
    listSubtotal?: number
    effectiveSubtotal?: number
    flashSaleDiscountAmount?: number
    calendarSaleDiscountAmount?: number
    birthdayDiscountAmount?: number
    loyaltyDiscountAmount?: number
  } | null
  /** Tên sale lịch trên dòng giá, ví dụ «Sale 9/9». */
  saleProgramName?: string | null
  loyaltyTierName?: string | null
  shippingFee?: number
  orderTotal?: number
}

/** Một dòng tổng cho form chat — cùng số quote giỏ, không ô mã giảm hay ví. */
export function formatPartnerChatCheckoutQuoteLine(input: PartnerChatCheckoutQuoteInput): string {
  const breakdown = input.breakdown ?? {}
  const list = Math.max(0, Math.round(Number(breakdown.listSubtotal) || 0))
  const effective = Math.max(0, Math.round(Number(breakdown.effectiveSubtotal) || 0))
  const goods = list > 0 ? list : effective
  const flash = Math.max(0, Math.round(Number(breakdown.flashSaleDiscountAmount) || 0))
  const calendar = Math.max(0, Math.round(Number(breakdown.calendarSaleDiscountAmount) || 0))
  const birthday = Math.max(0, Math.round(Number(breakdown.birthdayDiscountAmount) || 0))
  const loyalty = Math.max(0, Math.round(Number(breakdown.loyaltyDiscountAmount) || 0))
  const shipping = Math.max(0, Math.round(Number(input.shippingFee) || 0))
  const total = Math.max(0, Math.round(Number(input.orderTotal) || 0))
  if (goods <= 0 && total <= 0) return ''

  const parts = [`Hàng ${vnd(goods)}`]
  if (flash > 0) parts.push(`Flash sale −${vnd(flash)}`)
  if (calendar > 0) {
    const name = String(input.saleProgramName ?? '').trim() || 'Sale'
    parts.push(`${name} −${vnd(calendar)}`)
  }
  if (birthday > 0) parts.push(`CMSN −${vnd(birthday)}`)
  if (loyalty > 0) {
    const tier = String(input.loyaltyTierName ?? '').trim() || 'Hạng thành viên'
    parts.push(`${tier} −${vnd(loyalty)}`)
  }
  parts.push(`Ship ${vnd(shipping)}`)
  parts.push(`Tổng ${vnd(total)}`)
  return parts.join(' · ')
}

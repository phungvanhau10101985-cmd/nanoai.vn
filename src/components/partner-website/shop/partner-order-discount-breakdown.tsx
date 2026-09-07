import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'

export type PartnerOrderDiscountFields = {
  list_subtotal_amount?: number | null
  subtotal_amount?: number | null
  site_sale_discount_amount?: number | null
  google_discount_amount?: number | null
  promo_code?: string | null
  promo_discount_amount?: number | null
  birthday_discount_amount?: number | null
  loyalty_tier_name?: string | null
  loyalty_discount_amount?: number | null
  discount_cap_adjustment_amount?: number | null
  clearance_subtotal_amount?: number | null
  amount_after_discount?: number | null
  discount_breakdown_json?: Record<string, unknown> | null
}

const COPY: Record<WebLocale, {
  list: string
  flash: string
  siteSale: string
  inventorySale: string
  google: string
  voucher: string
  birthday: string
  loyalty: string
  clearance: string
  afterDiscount: string
  capped: string
}> = {
  vi: { list: 'Giá gốc', flash: 'Flash sale', siteSale: 'Sale cùng ngày tháng', inventorySale: 'Giảm giá sản phẩm', google: 'Google Shopping', voucher: 'Voucher', birthday: 'CMSN', loyalty: 'Giảm giá hạng', clearance: 'Sale thanh lý kho', afterDiscount: 'Tạm tính hàng thường', capped: 'Ưu đãi đã áp dụng trần 15% giá gốc.' },
  en: { list: 'List price', flash: 'Flash sale', siteSale: 'Same-day sale', inventorySale: 'Product sale', google: 'Google Shopping', voucher: 'Voucher', birthday: 'CMSN', loyalty: 'Tier discount', clearance: 'Warehouse sale', afterDiscount: 'Regular subtotal', capped: 'Discounts were capped at 15% of list price.' },
  zh: { list: '原价', flash: 'Flash sale', siteSale: '同日促销', inventorySale: '商品促销', google: 'Google Shopping', voucher: '优惠券', birthday: 'CMSN', loyalty: '会员等级减免', clearance: '仓库清仓', afterDiscount: '普通商品小计', capped: '优惠已按原价的 15% 封顶。' },
  ja: { list: '定価', flash: 'Flash sale', siteSale: '同日セール', inventorySale: '商品セール', google: 'Google Shopping', voucher: 'クーポン', birthday: 'CMSN', loyalty: 'ランク割引', clearance: '倉庫セール', afterDiscount: '通常小計', capped: '割引は定価の15%を上限として適用されました。' },
  ko: { list: '정가', flash: 'Flash sale', siteSale: '동일 날짜 세일', inventorySale: '상품 세일', google: 'Google Shopping', voucher: '쿠폰', birthday: 'CMSN', loyalty: '등급 할인', clearance: '창고 세일', afterDiscount: '일반 소계', capped: '할인은 정가의 15% 한도로 적용되었습니다.' },
}

function amount(value: number | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export function PartnerOrderDiscountBreakdown(props: {
  locale: WebLocale
  order: PartnerOrderDiscountFields
}) {
  const t = COPY[props.locale] ?? COPY.en
  const json = props.order.discount_breakdown_json || {}
  const siteSale = amount(props.order.site_sale_discount_amount)
  const hasSplit =
    typeof json.flashSaleDiscountAmount === 'number' ||
    typeof json.calendarSaleDiscountAmount === 'number' ||
    typeof json.inventorySaleDiscountAmount === 'number'
  const flashAmount = amount(typeof json.flashSaleDiscountAmount === 'number' ? json.flashSaleDiscountAmount : 0)
  const calendarAmount = amount(
    typeof json.calendarSaleDiscountAmount === 'number'
      ? json.calendarSaleDiscountAmount
      : hasSplit
        ? 0
        : siteSale
  )
  const inventoryAmount = amount(
    typeof json.inventorySaleDiscountAmount === 'number'
      ? json.inventorySaleDiscountAmount
      : hasSplit
        ? Math.max(0, siteSale - flashAmount - calendarAmount)
        : 0
  )
  const calendarLabel =
    String(json.eventLabel || json.calendarEventLabel || '').trim() || t.siteSale
  const rows = [
    { label: t.flash, value: flashAmount },
    { label: calendarLabel, value: calendarAmount },
    { label: t.inventorySale, value: inventoryAmount },
    { label: t.google, value: amount(props.order.google_discount_amount) },
    {
      label: props.order.promo_code
        ? `${t.voucher} ${props.order.promo_code}`
        : t.voucher,
      value: amount(props.order.promo_discount_amount),
    },
    { label: t.birthday, value: amount(props.order.birthday_discount_amount) },
    {
      label: props.order.loyalty_tier_name
        ? `${t.loyalty} ${props.order.loyalty_tier_name}`
        : t.loyalty,
      value: amount(props.order.loyalty_discount_amount),
    },
  ].filter((row) => row.value > 0)
  const listSubtotal = amount(props.order.list_subtotal_amount)
  const clearanceSubtotal = amount(props.order.clearance_subtotal_amount)
  const afterDiscount = amount(props.order.amount_after_discount ?? props.order.subtotal_amount)
  if (rows.length === 0 && listSubtotal <= 0 && clearanceSubtotal <= 0) return null

  return (
    <div className="pw-shop-cart-discount-breakdown">
      {listSubtotal > 0 ? <p><span>{t.list}</span><strong>{formatVnd(listSubtotal)}</strong></p> : null}
      {rows.map((row) => (
        <p key={row.label}><span>{row.label}</span><strong>−{formatVnd(row.value)}</strong></p>
      ))}
      {clearanceSubtotal > 0 ? (
        <p className="is-clearance"><span>{t.clearance}</span><strong>{formatVnd(clearanceSubtotal)}</strong></p>
      ) : null}
      <p><span>{t.afterDiscount}</span><strong>{formatVnd(afterDiscount)}</strong></p>
      {amount(props.order.discount_cap_adjustment_amount) > 0 ? <p>{t.capped}</p> : null}
    </div>
  )
}

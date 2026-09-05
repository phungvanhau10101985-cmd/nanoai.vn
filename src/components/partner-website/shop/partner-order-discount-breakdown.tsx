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
}

const COPY: Record<WebLocale, {
  list: string
  siteSale: string
  google: string
  voucher: string
  birthday: string
  loyalty: string
  clearance: string
  afterDiscount: string
  capped: string
}> = {
  vi: { list: 'Giá niêm yết', siteSale: 'Sale ngày trùng tháng', google: 'Google Shopping', voucher: 'Voucher', birthday: 'Ưu đãi sinh nhật', loyalty: 'Hạng thành viên', clearance: 'Thanh lý kho', afterDiscount: 'Tiền hàng sau ưu đãi', capped: 'Ưu đãi đã áp dụng trần 15% giá niêm yết.' },
  en: { list: 'List price', siteSale: 'Same-day sale', google: 'Google Shopping', voucher: 'Voucher', birthday: 'Birthday offer', loyalty: 'Membership tier', clearance: 'Clearance', afterDiscount: 'Merchandise after discounts', capped: 'Discounts were capped at 15% of list price.' },
  zh: { list: '标价', siteSale: '同日促销', google: 'Google Shopping', voucher: '优惠券', birthday: '生日优惠', loyalty: '会员等级', clearance: '清仓商品', afterDiscount: '优惠后商品金额', capped: '优惠已按标价的 15% 封顶。' },
  ja: { list: '定価', siteSale: '同日セール', google: 'Google Shopping', voucher: 'クーポン', birthday: '誕生日特典', loyalty: '会員ランク', clearance: '在庫処分', afterDiscount: '割引後の商品金額', capped: '割引は定価の15%を上限として適用されました。' },
  ko: { list: '정가', siteSale: '동일 날짜 세일', google: 'Google Shopping', voucher: '쿠폰', birthday: '생일 혜택', loyalty: '회원 등급', clearance: '창고 정리', afterDiscount: '할인 후 상품 금액', capped: '할인은 정가의 15% 한도로 적용되었습니다.' },
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
  const rows = [
    { label: t.siteSale, value: amount(props.order.site_sale_discount_amount) },
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

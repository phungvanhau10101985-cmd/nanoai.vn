import type { WebLocale } from '@/lib/i18n/config'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { formatPartnerShopMoneyVnd } from '@/lib/partner-website/shop/partner-shop-flash-sale'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

export type PdpLadipageTrustPoint = { title: string; body: string }

type OfferCopy = {
  depositNone: string
  depositPercent: string
  depositFixed: string
  shipFree: string
  shipFee: string
}

type Copy = {
  trust: [PdpLadipageTrustPoint, PdpLadipageTrustPoint, PdpLadipageTrustPoint]
  offer: OfferCopy
}

const COPY: Record<WebLocale, Copy> = {
  vi: {
    trust: [
      { title: 'Chọn lựa kỹ lưỡng', body: 'Thông tin sản phẩm được trình bày rõ ràng.' },
      { title: 'Đặt hàng thuận tiện', body: 'Thao tác nhanh, đúng món đang xem.' },
      { title: 'Hỗ trợ khi cần', body: 'Đội ngũ sẵn sàng giải đáp.' },
    ],
    offer: {
      depositNone: 'Thanh toán khi nhận hàng',
      depositPercent: 'Đặt cọc {percent}%',
      depositFixed: 'Đặt cọc {amount}',
      shipFree: 'Giao hàng miễn phí',
      shipFee: 'Phí giao {amount}',
    },
  },
  en: {
    trust: [
      { title: 'Carefully selected', body: 'Product details are shown clearly.' },
      { title: 'Easy to order', body: 'A few steps for the item you are viewing.' },
      { title: 'Help when you need it', body: 'The shop team is ready to answer.' },
    ],
    offer: {
      depositNone: 'Pay on delivery',
      depositPercent: 'Deposit {percent}%',
      depositFixed: 'Deposit {amount}',
      shipFree: 'Free delivery',
      shipFee: 'Delivery fee {amount}',
    },
  },
  zh: {
    trust: [
      { title: '精心挑选', body: '商品信息展示清楚。' },
      { title: '下单方便', body: '几步即可购买正在看的商品。' },
      { title: '需要时有人帮忙', body: '店铺团队随时解答。' },
    ],
    offer: {
      depositNone: '货到付款',
      depositPercent: '订金 {percent}%',
      depositFixed: '订金 {amount}',
      shipFree: '免运费',
      shipFee: '运费 {amount}',
    },
  },
  ja: {
    trust: [
      { title: 'しっかり選定', body: '商品情報をわかりやすく表示します。' },
      { title: '注文しやすい', body: '見ている商品を少ない手順で注文できます。' },
      { title: '必要なときにサポート', body: 'ショップの担当がお答えします。' },
    ],
    offer: {
      depositNone: '代金引換',
      depositPercent: '内金 {percent}%',
      depositFixed: '内金 {amount}',
      shipFree: '送料無料',
      shipFee: '送料 {amount}',
    },
  },
  ko: {
    trust: [
      { title: '꼼꼼히 고른 상품', body: '상품 정보를 분명하게 보여 줍니다.' },
      { title: '간편 주문', body: '보고 있는 상품을 몇 단계로 주문합니다.' },
      { title: '필요할 때 도움', body: '샵 팀이 답변할 준비가 되어 있습니다.' },
    ],
    offer: {
      depositNone: '착불 결제',
      depositPercent: '예약금 {percent}%',
      depositFixed: '예약금 {amount}',
      shipFree: '무료 배송',
      shipFee: '배송비 {amount}',
    },
  },
}

function copyOf(locale: string | null | undefined): Copy {
  const key = normalizeWebLocale(locale) ?? 'vi'
  return COPY[key]
}

export function pdpLadipageTrustPoints(locale: string | null | undefined): PdpLadipageTrustPoint[] {
  const key = normalizeWebLocale(locale) ?? 'vi'
  const shop = getPartnerSiteShopCopy(key)
  const bodies = COPY[key].trust
  return [
    { title: shop.lpTrust1, body: bodies[0].body },
    { title: shop.lpTrust2, body: bodies[1].body },
    { title: shop.lpTrust3, body: bodies[2].body },
  ]
}

export function formatPdpOfferLine(input: {
  locale: string | null | undefined
  depositMode: 'none' | 'percent' | 'fixed_amount'
  depositPercent: number
  depositAmount: number
  shippingFeeAmount: number
  /** Trang chi tiết: bỏ chip tiền cọc. Landing vẫn hiện. */
  includeDeposit?: boolean
}): string {
  const offer = copyOf(input.locale).offer
  const percent = Math.max(0, Math.round(Number(input.depositPercent) || 0))
  const depositAmount = Math.max(0, Math.round(Number(input.depositAmount) || 0))
  const shipping = Math.max(0, Math.round(Number(input.shippingFeeAmount) || 0))
  const ship = shipping > 0
    ? offer.shipFee.replace('{amount}', formatPartnerShopMoneyVnd(shipping))
    : offer.shipFree
  const showDeposit = input.includeDeposit !== false
  if (!showDeposit) {
    if (input.depositMode === 'percent' && percent > 0) return ship
    if (input.depositMode === 'fixed_amount' && depositAmount > 0) return ship
  }
  let deposit = offer.depositNone
  if (showDeposit && input.depositMode === 'percent' && percent > 0) {
    deposit = offer.depositPercent.replace('{percent}', String(percent))
  } else if (showDeposit && input.depositMode === 'fixed_amount' && depositAmount > 0) {
    deposit = offer.depositFixed.replace('{amount}', formatPartnerShopMoneyVnd(depositAmount))
  }
  return `${deposit} · ${ship}`
}

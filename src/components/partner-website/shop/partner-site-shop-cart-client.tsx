'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatVnd,
  parseSiteCartLines,
  parseVndFromPriceHint,
  cartLinesQuantity,
  cartLinesSignature,
  type SiteCartLine,
} from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy, shopPromoErrorMessage } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteAddressesApiPath,
  partnerSiteAddressesPath,
  partnerSiteHomePath,
  partnerSiteOrderDepositPath,
  partnerSiteOrderDetailPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  partnerOrderPayableTotal,
  pickDepositLandingOrder,
  shouldRedirectToDepositAfterCreate,
} from '@/lib/partner-website/shop/order-deposit'
import { markGoogleCustomerReviewsForOrder } from '@/lib/partner-website/shop/google-customer-reviews'
import {
  emptyPartnerSiteAddressInput,
  formatPartnerSiteAddressLine,
  type PartnerSiteCustomerAddress,
  type PartnerSiteCustomerAddressInput,
} from '@/lib/partner-website/shop/partner-site-customer-address'
import { PartnerSiteAddressFormFields } from '@/components/partner-website/shop/partner-site-address-form'
import { PartnerSiteShopDialog } from '@/components/partner-website/shop/partner-site-shop-dialog'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  trackPartnerSiteBeginCheckout,
  trackPartnerSitePurchase,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import {
  buildPartnerShopLoginHref,
  getPartnerShopBrowserReturnLocation,
} from '@/lib/partner-website/shop/partner-site-shop-auth-redirect'
import { PartnerSiteShopOrderConfirmation } from '@/components/partner-website/shop/partner-site-shop-order-confirmation'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { partnerSiteAppliedPromoStorageKey } from '@/lib/partner-website/shop/partner-site-applied-promo'
import {
  formatPartnerSaleDayMonth,
  partnerSiteBirthdayCheckoutHint,
  partnerSiteBirthdayDisplaySavings,
  partnerSiteBirthdaySaveText,
  partnerSiteSaleCopy,
  partnerSiteSaleFill,
} from '@/lib/partner-website/promotions/partner-site-sale-display'
import { PartnerSiteSaleCountdown } from '@/components/partner-website/shop/partner-site-sale-face'
import { nextPartnerSaleRefreshDelayMs } from '@/lib/partner-website/promotions/partner-sale-pricing'
import { shopCardDisplaySrc } from '@/lib/partner-website/shop/inventory-shop-detail'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
  chatPath: string
  initialItems?: SiteCartLine[] | null
}

type OrderSnapshot = {
  id?: string
  status?: string | null
  payment_qr_url?: string | null
  payment_reference?: string | null
  required_amount?: number | null
  paid_amount?: number | null
  deposit_percent?: number | null
  customer_email?: string | null
  payment_method?: 'cod' | 'bank_transfer' | 'ewallet' | null
  shipping_fee_amount?: number | null
  amount_after_discount?: number | null
  subtotal_amount?: number | null
}

type CartQuote = {
  lines: Array<{
    lineId: string
    inventoryId: string | null
    quantity: number
    listUnitPrice: number
    effectiveUnitPrice: number
    isClearance: boolean
    googleDiscountAmount: number
    expectedSaleUnitPrice?: number | null
    priceKind?: 'flash' | 'calendar' | 'google' | 'clearance' | 'inventory' | 'list'
    flashPercent?: number | null
    saleBadge?: string | null
    programName?: string | null
    countdownTo?: string | null
  }>
  breakdown: {
    listSubtotal: number
    effectiveSubtotal: number
    regularListSubtotal: number
    regularEffectiveSubtotal: number
    clearanceSubtotal: number
    siteSaleDiscountAmount: number
    flashSaleDiscountAmount?: number
    calendarSaleDiscountAmount?: number
    inventorySaleDiscountAmount?: number
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
  promo: { code: string; name: string; discountAmount: number } | null
  promoError: string | null
  birthdayDiscountPercent: number
  loyalty: {
    enabled: boolean
    tierCode: string
    tierName: string
    discountPercent: number
  }
  shipping: {
    feeAmount: number
    configuredFeeAmount: number
    freeThresholdAmount: number | null
    carrierLabel: string
  }
  orderTotal: number
  birthdayOffer?: { percent: number; countdownTo?: string | null } | null
  saleCalendar?: {
    phase: 'off' | 'teaser' | 'active'
    eventLabel: string
    discountPercent: number
    countdownTo?: string | null
    eventDate?: string | null
    saleDate?: string | null
  } | null
  checkoutSplit?: {
    orderCount: number
    shippingOnce: boolean
    sources: Array<'vietnam' | 'china'>
    requiredAmount?: number
    plans?: Array<{
      source: 'vietnam' | 'china'
      requiredAmount: number
      requiresDeposit: boolean
      shippingFee: number
      depositPercent: number
    }>
  } | null
}

type WalletVoucher = {
  code: string
  name: string
  description: string
  eligible: boolean
  ineligibleReason: string | null
  expiresSoon: boolean
  expiresAt: string | null
}

const CART_SALE_COPY: Record<WebLocale, {
  selectAll: string
  selectedCount: string
  voucherWallet: string
  noVoucher: string
  expiresSoon: string
  listSubtotal: string
  listUnit: string
  comingSoon: string
  birthdayAtCheckout: string
  flashDiscount: string
  flashAlreadyDeducted: string
  saleDiscount: string
  inventoryDiscount: string
  googleDiscount: string
  birthdayDiscount: string
  birthdayPaused: string
  loyaltyDiscount: string
  clearanceSubtotal: string
  merchandise: string
  regularGoods: string
  regularSubtotal: string
  warehouseList: string
  warehouseSubtotal: string
  savedOnRegular: string
  grandTotal: string
  expectedLine: string
  capMeter: string
  capNotice: string
  capReachedVoucher: string
  selectProduct: string
  quoteUpdating: string
  runningPrograms: string
}> = {
  vi: {
    selectAll: 'Chọn tất cả',
    selectedCount: 'Đã chọn {selected}/{total} sản phẩm',
    voucherWallet: 'Voucher của bạn',
    noVoucher: 'Chưa có voucher phù hợp.',
    expiresSoon: 'Sắp hết hạn',
    listSubtotal: 'Giá gốc',
    listUnit: 'Giá gốc',
    comingSoon: 'Sắp {program} -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% ở tổng đơn',
    flashDiscount: 'Flash sale',
    flashAlreadyDeducted: '{program} ({amount} đã trừ trên giá SP)',
    saleDiscount: 'Sale {date}',
    inventoryDiscount: 'Giảm giá sản phẩm',
    googleDiscount: 'Google Shopping',
    birthdayDiscount: 'CMSN {pct}%',
    birthdayPaused: 'Đang dùng mã — CMSN tạm tắt (chọn một trong hai).',
    loyaltyDiscount: 'Giảm giá hạng',
    clearanceSubtotal: 'Sale thanh lý kho',
    merchandise: 'Tiền hàng',
    regularGoods: 'Hàng thường',
    regularSubtotal: 'Tạm tính hàng thường',
    warehouseList: 'Giá gốc (thanh lý)',
    warehouseSubtotal: 'Tạm tính thanh lý kho',
    savedOnRegular: 'Đã tiết kiệm {amount} trên hàng thường.',
    grandTotal: 'Tổng thanh toán',
    expectedLine: 'Dự kiến {amount}',
    capMeter: 'Trần ưu đãi 15%: đã dùng {used} / {max}',
    capNotice: 'Tổng ưu đãi đã được giới hạn ở 15% giá niêm yết.',
    capReachedVoucher: 'Không thêm được mã này vì đơn đã đạt trần ưu đãi 15% giá niêm yết.',
    selectProduct: 'Chọn sản phẩm',
    quoteUpdating: 'Đang cập nhật giá…',
    runningPrograms: 'Chương trình đang áp dụng',
  },
  en: {
    selectAll: 'Select all',
    selectedCount: '{selected} of {total} products selected',
    voucherWallet: 'Your vouchers',
    noVoucher: 'No eligible voucher yet.',
    expiresSoon: 'Expiring soon',
    listSubtotal: 'List price',
    listUnit: 'List price',
    comingSoon: 'Coming {program} -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% at checkout',
    flashDiscount: 'Flash sale',
    flashAlreadyDeducted: '{program} ({amount} already off the item price)',
    saleDiscount: 'Sale {date}',
    inventoryDiscount: 'Product sale',
    googleDiscount: 'Google Shopping',
    birthdayDiscount: 'CMSN {pct}%',
    birthdayPaused: 'A voucher is applied — CMSN is paused (choose one).',
    loyaltyDiscount: 'Tier discount',
    clearanceSubtotal: 'Warehouse sale',
    merchandise: 'Merchandise',
    regularGoods: 'Regular items',
    regularSubtotal: 'Regular subtotal',
    warehouseList: 'List price (clearance)',
    warehouseSubtotal: 'Clearance subtotal',
    savedOnRegular: 'Saved {amount} on regular items.',
    grandTotal: 'Amount due',
    expectedLine: 'Expected {amount}',
    capMeter: '15% discount cap: {used} of {max} used',
    capNotice: 'Total discounts have been capped at 15% of list price.',
    capReachedVoucher: 'This code cannot add more savings because the order has already reached the 15% discount cap.',
    selectProduct: 'Select product',
    quoteUpdating: 'Updating prices…',
    runningPrograms: 'Active offers',
  },
  zh: {
    selectAll: '全选',
    selectedCount: '已选择 {selected}/{total} 件商品',
    voucherWallet: '您的优惠券',
    noVoucher: '暂无可用优惠券。',
    expiresSoon: '即将到期',
    listSubtotal: '原价',
    listUnit: '原价',
    comingSoon: '即将 {program} -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% 结账减免',
    flashDiscount: 'Flash sale',
    flashAlreadyDeducted: '{program}（{amount} 已从单价扣除）',
    saleDiscount: 'Sale {date}',
    inventoryDiscount: '商品促销',
    googleDiscount: 'Google Shopping',
    birthdayDiscount: 'CMSN {pct}%',
    birthdayPaused: '已使用优惠券，CMSN 暂停（二者选一）。',
    loyaltyDiscount: '会员等级减免',
    clearanceSubtotal: '仓库清仓',
    merchandise: '商品金额',
    regularGoods: '普通商品',
    regularSubtotal: '普通商品小计',
    warehouseList: '原价（清仓）',
    warehouseSubtotal: '清仓小计',
    savedOnRegular: '普通商品已省 {amount}。',
    grandTotal: '应付总额',
    expectedLine: '预计 {amount}',
    capMeter: '优惠上限 15%：已用 {used} / {max}',
    capNotice: '总优惠已限制为标价的 15%。',
    capReachedVoucher: '订单优惠已达标价 15% 上限，无法再叠加此优惠码。',
    selectProduct: '选择商品',
    quoteUpdating: '正在更新价格…',
    runningPrograms: '进行中的优惠',
  },
  ja: {
    selectAll: 'すべて選択',
    selectedCount: '{total}点中{selected}点を選択',
    voucherWallet: 'お持ちのクーポン',
    noVoucher: '利用可能なクーポンはありません。',
    expiresSoon: 'まもなく期限切れ',
    listSubtotal: '定価',
    listUnit: '定価',
    comingSoon: 'まもなく {program} -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}%（会計時）',
    flashDiscount: 'Flash sale',
    flashAlreadyDeducted: '{program}（{amount} は単価から減額済）',
    saleDiscount: 'Sale {date}',
    inventoryDiscount: '商品セール',
    googleDiscount: 'Google Shopping',
    birthdayDiscount: 'CMSN {pct}%',
    birthdayPaused: 'クーポン利用中のため CMSN は停止（いずれか一方）。',
    loyaltyDiscount: 'ランク割引',
    clearanceSubtotal: '倉庫セール',
    merchandise: '商品代金',
    regularGoods: '通常商品',
    regularSubtotal: '通常小計',
    warehouseList: '定価（倉庫）',
    warehouseSubtotal: '倉庫小計',
    savedOnRegular: '通常商品で {amount} お得。',
    grandTotal: 'お支払い合計',
    expectedLine: '予定 {amount}',
    capMeter: '割引上限15%：{used} / {max} 使用',
    capNotice: '割引合計は定価の15%を上限としています。',
    capReachedVoucher: '注文の割引が定価の15%上限に達しているため、このコードは追加できません。',
    selectProduct: '商品を選択',
    quoteUpdating: '価格を更新中…',
    runningPrograms: '適用中の特典',
  },
  ko: {
    selectAll: '전체 선택',
    selectedCount: '상품 {total}개 중 {selected}개 선택',
    voucherWallet: '내 쿠폰',
    noVoucher: '사용 가능한 쿠폰이 없습니다.',
    expiresSoon: '곧 만료',
    listSubtotal: '정가',
    listUnit: '정가',
    comingSoon: '곧 {program} -{pct}%',
    birthdayAtCheckout: 'CMSN -{pct}% 결제 시',
    flashDiscount: 'Flash sale',
    flashAlreadyDeducted: '{program} ({amount} 단가에서 이미 차감)',
    saleDiscount: 'Sale {date}',
    inventoryDiscount: '상품 세일',
    googleDiscount: 'Google Shopping',
    birthdayDiscount: 'CMSN {pct}%',
    birthdayPaused: '쿠폰 사용 중이라 CMSN이 일시 중지됨 (둘 중 하나).',
    loyaltyDiscount: '등급 할인',
    clearanceSubtotal: '창고 세일',
    merchandise: '상품 금액',
    regularGoods: '일반 상품',
    regularSubtotal: '일반 소계',
    warehouseList: '정가 (청산)',
    warehouseSubtotal: '청산 소계',
    savedOnRegular: '일반 상품에서 {amount} 절약.',
    grandTotal: '결제 금액',
    expectedLine: '예정 {amount}',
    capMeter: '할인 한도 15%: {used} / {max} 사용',
    capNotice: '총 할인은 정가의 15%로 제한되었습니다.',
    capReachedVoucher: '주문이 이미 정가 15% 할인 한도에 도달해 이 코드를 더 적용할 수 없습니다.',
    selectProduct: '상품 선택',
    quoteUpdating: '가격 업데이트 중…',
    runningPrograms: '진행 중인 혜택',
  },
}

function calendarSaleProgramName(
  template: string,
  calendar?: { eventLabel?: string; eventDate?: string | null; saleDate?: string | null } | null
): string {
  const label = String(calendar?.eventLabel || '').trim()
  if (label) return label
  const date = formatPartnerSaleDayMonth(calendar?.eventDate || calendar?.saleDate, null)
  if (date) return template.replace('{date}', date)
  return template.replace('{date}', '').replace(/\s+/g, ' ').trim()
}

function cartLineProgramName(
  line: CartQuote['lines'][number] | undefined,
  calendar: CartQuote['saleCalendar'],
  locale: WebLocale,
  inventoryLabel: string
): string {
  const named = String(line?.programName || '').trim()
  if (named) return named
  const copy = partnerSiteSaleCopy(locale)
  if (line?.priceKind === 'flash') return copy.flashName
  if (line?.isClearance) return copy.clearanceName
  if (line?.priceKind === 'google') return copy.googleName
  if (line?.priceKind === 'calendar') return calendar?.eventLabel || copy.activeFallback
  if (line?.priceKind === 'inventory') return inventoryLabel
  return calendar?.eventLabel || copy.program
}

function voucherBlockedByDiscountCap(quote: CartQuote): boolean {
  return Boolean(
    quote.promo &&
    quote.breakdown.voucherDiscountAmount <= 0 &&
    quote.breakdown.capAdjustmentAmount > 0
  )
}

function cartBirthdayLineSave(
  item: SiteCartLine,
  line: CartQuote['lines'][number] | undefined,
  percent: number
): number {
  if (!(percent > 0) || line?.isClearance) return 0
  const hint = parseVndFromPriceHint(item.card.price_hint)
  const list = line?.listUnitPrice && line.listUnitPrice > 0 ? line.listUnitPrice : hint
  const charged = line?.effectiveUnitPrice && line.effectiveUnitPrice > 0 ? line.effectiveUnitPrice : list
  const teaser = Boolean(line?.expectedSaleUnitPrice) && charged >= list
  return partnerSiteBirthdayDisplaySavings({
    listUnitPrice: list,
    chargedUnitPrice: teaser ? list : charged,
    quantity: Math.max(1, item.quantity),
    percent,
    isClearance: line?.isClearance,
    siteSalePhase: teaser ? 'teaser' : list > charged ? 'active' : 'off',
  })
}

export function PartnerSiteShopCartClient({ siteSlug, partnerSlug, locale, chatPath, initialItems = null }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const saleT = CART_SALE_COPY[locale] ?? CART_SALE_COPY.en
  const siteSaleT = partnerSiteSaleCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount, setCartCount, tracking } = usePartnerSiteShop()
  const [items, setItems] = useState<SiteCartLine[]>(() => initialItems ?? [])
  const [loading, setLoading] = useState(initialItems == null)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [checkoutLoginRequired, setCheckoutLoginRequired] = useState(true)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [status, setStatus] = useState('')
  const [completedOrder, setCompletedOrder] = useState<OrderSnapshot | null>(null)
  const [promoCodeInput, setPromoCodeInput] = useState('')
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoMessage, setPromoMessage] = useState('')
  const [promoMessageKind, setPromoMessageKind] = useState<'error' | 'warn' | ''>('')
  const [selectedWalletCode, setSelectedWalletCode] = useState('')
  const quoteGenRef = useRef(0)
  const skipAutoQuoteRef = useRef(false)
  const lastPastSaleKeyRef = useRef('')
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(
    () => new Set((initialItems ?? []).map((item) => item.id))
  )
  const [quote, setQuote] = useState<CartQuote | null>(null)
  const [saleRefreshAt, setSaleRefreshAt] = useState(0)
  const [walletVouchers, setWalletVouchers] = useState<WalletVoucher[]>([])
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; name: string; discountAmount: number } | null>(
    () => {
      if (typeof window === 'undefined') return null
      try {
        const raw = window.localStorage.getItem(partnerSiteAppliedPromoStorageKey(siteSlug))
        if (!raw) return null
        const parsed = JSON.parse(raw) as { code?: string; name?: string; discountAmount?: number }
        return parsed.code ? { code: parsed.code, name: parsed.name || '', discountAmount: parsed.discountAmount || 0 } : null
      } catch {
        return null
      }
    }
  )
  // W1.7 — phí ship + lựa chọn thanh toán. Phí ship chỉ hiển thị ước tính ở đây; số cuối cùng do
  // backend tính lại lúc checkout (giống mọi số tiền khác trong hệ thống — không tin số FE gửi).
  const [shippingPolicy, setShippingPolicy] = useState<{
    feeAmount: number
    freeThresholdAmount: number | null
    carrierLabel: string | null
  }>({
    feeAmount: 0,
    freeThresholdAmount: null,
    carrierLabel: null,
  })
  const [ewalletAvailable, setEwalletAvailable] = useState(false)
  const [depositPolicy, setDepositPolicy] = useState<{
    mode: 'none' | 'percent' | 'fixed_amount'
    percent: number
    fixedAmount: number
  }>({ mode: 'percent', percent: 30, fixedAmount: 0 })
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'ewallet'>('bank_transfer')
  const [bookAddresses, setBookAddresses] = useState<PartnerSiteCustomerAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [addressForm, setAddressForm] = useState<PartnerSiteCustomerAddressInput>(emptyPartnerSiteAddressInput())
  const [addressSaving, setAddressSaving] = useState(false)

  useEffect(() => {
    try {
      const key = partnerSiteAppliedPromoStorageKey(siteSlug)
      if (appliedPromo) window.localStorage.setItem(key, JSON.stringify(appliedPromo))
      else window.localStorage.removeItem(key)
    } catch {
      // Storage may be disabled; server quote remains authoritative.
    }
  }, [appliedPromo, siteSlug])

  const loadAddressBook = useCallback(async () => {
    if (!isAuthenticated) {
      setBookAddresses([])
      setSelectedAddressId(null)
      return
    }
    const res = await fetch(partnerSiteAddressesApiPath(siteSlug), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      addresses?: PartnerSiteCustomerAddress[]
    }
    const list = Array.isArray(json.addresses) ? json.addresses : []
    setBookAddresses(list)
    setSelectedAddressId((prev) => {
      if (prev && list.some((addr) => addr.id === prev)) return prev
      return list.find((addr) => addr.is_default)?.id ?? list[0]?.id ?? null
    })
  }, [authHeaders, captureFromResponse, isAuthenticated, siteSlug])

  const loadCart = useCallback(async () => {
    const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/cart`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json()) as { items?: SiteCartLine[] }
    const next = parseSiteCartLines(json.items)
    const nextSig = cartLinesSignature(next)
    setItems((prev) => (cartLinesSignature(prev) === nextSig ? prev : next))
    setCartCount(cartLinesQuantity(next))
    setSelectedLineIds((current) => {
      const valid = new Set(next.filter((item) => current.has(item.id)).map((item) => item.id))
      return valid.size > 0 ? valid : new Set(next.map((item) => item.id))
    })
  }, [authHeaders, captureFromResponse, setCartCount, siteSlug])

  useEffect(() => {
    if (!ready) return
    if (!isAuthenticated) {
      window.location.assign(
        buildPartnerShopLoginHref(
          siteSlug,
          getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }),
          { customDomain }
        )
      )
      return
    }
    const blocking = initialItems == null
    if (blocking) setLoading(true)
    void loadCart().finally(() => {
      if (blocking) setLoading(false)
    })
  }, [customDomain, initialItems, isAuthenticated, loadCart, ready, siteSlug])

  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => {
      void loadAddressBook()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadAddressBook, ready])

  const selectedAddress = bookAddresses.find((addr) => addr.id === selectedAddressId) ?? null

  useEffect(() => {
    if (!selectedAddress) return
    setOrderName(selectedAddress.full_name)
    setOrderPhone(selectedAddress.phone)
    setOrderAddress(formatPartnerSiteAddressLine(selectedAddress))
  }, [selectedAddress])

  useEffect(() => {
    if (!siteSlug) return
    const timer = window.setTimeout(() => {
      void fetch(`/api/site/${encodeURIComponent(siteSlug)}/shop-config`, { credentials: 'same-origin' })
        .then((res) => res.json())
        .then(
          (json: {
            checkoutLoginRequired?: boolean
            shippingPolicy?: {
              feeAmount?: number
              freeThresholdAmount?: number | null
              carrierLabel?: string | null
            }
            ewalletAvailable?: boolean
            depositPolicy?: {
              mode?: 'none' | 'percent' | 'fixed_amount'
              percent?: number
              fixedAmount?: number
            }
          }) => {
            setCheckoutLoginRequired(json.checkoutLoginRequired !== false)
            setShippingPolicy({
              feeAmount: Math.max(0, Math.round(json.shippingPolicy?.feeAmount ?? 0)),
              freeThresholdAmount:
                json.shippingPolicy?.freeThresholdAmount == null ? null : Math.max(0, Math.round(json.shippingPolicy.freeThresholdAmount)),
              carrierLabel: String(json.shippingPolicy?.carrierLabel ?? '').trim() || null,
            })
            setEwalletAvailable(json.ewalletAvailable === true)
            const mode = json.depositPolicy?.mode
            setDepositPolicy({
              mode: mode === 'none' || mode === 'fixed_amount' ? mode : 'percent',
              percent: Math.max(1, Math.min(99, Math.round(json.depositPolicy?.percent ?? 30))),
              fixedAmount: Math.max(0, Math.round(json.depositPolicy?.fixedAmount ?? 0)),
            })
          }
        )
        .catch(() => {
          setCheckoutLoginRequired(true)
        })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [siteSlug])

  const promoErrorText = useCallback((code: string): string => shopPromoErrorMessage(t, code), [t])

  const unapplyPromo = useCallback((message: string, kind: 'error' | 'warn' | '' = 'error') => {
    setAppliedPromo(null)
    setSelectedWalletCode('')
    setPromoCodeInput('')
    setPromoMessage(message)
    setPromoMessageKind(kind)
  }, [])

  const selectedItems = useMemo(
    () => items.filter((item) => selectedLineIds.has(item.id)),
    [items, selectedLineIds]
  )
  const fallbackSubtotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const quoted = quote?.lines.find((line) => line.lineId === item.id)
        const unit = quoted?.effectiveUnitPrice ?? parseVndFromPriceHint(item.card.price_hint)
        return sum + unit * item.quantity
      }, 0),
    [quote?.lines, selectedItems]
  )

  const fetchQuote = useCallback(async (
    lines: SiteCartLine[],
    selectedIds: Set<string>,
    promoCode?: string
  ): Promise<CartQuote | null> => {
    if (lines.length === 0) return null
    const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/cart/quote`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        promoCode: promoCode?.trim() || undefined,
        lines: lines.map((item) => ({
          lineId: item.id,
          inventoryId: item.card.inventory_id || '',
          quantity: item.quantity,
          selected: selectedIds.has(item.id),
          fallbackUnitPrice: parseVndFromPriceHint(item.card.price_hint),
        })),
      }),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => null)) as
      | ({ ok?: boolean } & CartQuote)
      | null
    return res.ok && json?.ok ? json : null
  }, [authHeaders, captureFromResponse, siteSlug])

  const requestQuote = useCallback(async (
    lines: SiteCartLine[],
    selectedIds: Set<string>,
    promoCode?: string
  ): Promise<CartQuote | null | undefined> => {
    const gen = ++quoteGenRef.current
    const next = await fetchQuote(lines, selectedIds, promoCode)
    if (gen !== quoteGenRef.current) return undefined
    return next
  }, [fetchQuote])

  const applyQuoteResult = useCallback((next: CartQuote | null, requestedCode: string, fromAuto = false) => {
    if (!requestedCode) {
      setQuote(next)
      return
    }
    if (!next) {
      if (fromAuto) {
        setQuote(null)
        setAppliedPromo(null)
        setSelectedWalletCode('')
        setPromoCodeInput('')
        setPromoMessage('')
        setPromoMessageKind('')
        return
      }
      unapplyPromo(t.promoErrorGeneric)
      return
    }
    setQuote(next)
    if (next.promoError) {
      if (fromAuto) {
        setAppliedPromo(null)
        setSelectedWalletCode('')
        setPromoCodeInput('')
        setPromoMessage('')
        setPromoMessageKind('')
        return
      }
      unapplyPromo(promoErrorText(next.promoError))
      return
    }
    if (voucherBlockedByDiscountCap(next) && next.promo) {
      setAppliedPromo(next.promo)
      setSelectedWalletCode(next.promo.code)
      setPromoMessage(saleT.capReachedVoucher)
      setPromoMessageKind('warn')
      return
    }
    if (next.promo && next.breakdown.voucherDiscountAmount <= 0) {
      unapplyPromo(t.promoErrorNoEligibleItems)
      return
    }
    if (next.promo) {
      setAppliedPromo(next.promo)
      setSelectedWalletCode(next.promo.code)
      if (next.breakdown.capAdjustmentAmount > 0) {
        setPromoMessage(saleT.capNotice)
        setPromoMessageKind('warn')
      } else {
        setPromoMessage('')
        setPromoMessageKind('')
      }
      return
    }
    unapplyPromo(t.promoErrorGeneric)
  }, [promoErrorText, saleT.capNotice, saleT.capReachedVoucher, t.promoErrorGeneric, t.promoErrorNoEligibleItems, unapplyPromo])

  const activePromoCode = appliedPromo?.code ?? ''

  useEffect(() => {
    if (appliedPromo?.code) {
      setSelectedWalletCode(appliedPromo.code)
      setPromoCodeInput((current) => current.trim() ? current : appliedPromo.code)
    }
  }, [appliedPromo?.code])

  useEffect(() => {
    if (!ready || loading || items.length === 0) {
      setQuote(null)
      return
    }
    if (promoBusy) return
    if (skipAutoQuoteRef.current) {
      skipAutoQuoteRef.current = false
      return
    }
    const walletHit = activePromoCode
      ? walletVouchers.find((item) => item.code.toLowerCase() === activePromoCode.toLowerCase())
      : undefined
    const codeToQuote =
      selectedItems.length === 0
        ? ''
        : walletHit && !walletHit.eligible
          ? ''
          : activePromoCode
    if (activePromoCode && selectedItems.length > 0 && !codeToQuote) {
      setAppliedPromo(null)
      setSelectedWalletCode('')
      setPromoCodeInput('')
      setPromoMessage('')
      setPromoMessageKind('')
    }
    let cancelled = false
    const delayMs = quote ? 180 : 0
    const timer = window.setTimeout(() => {
      void requestQuote(items, selectedLineIds, codeToQuote)
        .then((next) => {
          if (cancelled || next === undefined) return
          applyQuoteResult(next, codeToQuote, true)
        })
    }, delayMs)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    activePromoCode,
    applyQuoteResult,
    items,
    loading,
    promoBusy,
    ready,
    requestQuote,
    saleRefreshAt,
    selectedItems.length,
    selectedLineIds,
    walletVouchers,
  ])

  useEffect(() => {
    const stamps = [
      quote?.saleCalendar?.countdownTo,
      quote?.birthdayOffer?.countdownTo,
      ...(quote?.lines ?? []).map((line) => line.countdownTo),
    ]
    const delay = nextPartnerSaleRefreshDelayMs(stamps)
    if (delay == null) return
    const now = Date.now()
    const pastKey = stamps
      .filter((stamp): stamp is string => Boolean(stamp) && Date.parse(String(stamp)) <= now)
      .sort()
      .join('|')
    if (delay <= 250 && pastKey && lastPastSaleKeyRef.current === pastKey) return
    const timer = window.setTimeout(() => {
      if (pastKey) lastPastSaleKeyRef.current = pastKey
      setSaleRefreshAt(Date.now())
    }, delay)
    return () => window.clearTimeout(timer)
  }, [quote])

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') setSaleRefreshAt(Date.now())
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [])

  useEffect(() => {
    if (!ready || selectedItems.length === 0 || !quote) {
      if (selectedItems.length === 0) setWalletVouchers([])
      return
    }
    const subtotal = quote.breakdown.regularEffectiveSubtotal ?? fallbackSubtotal
    void fetch(
      `/api/site/${encodeURIComponent(siteSlug)}/promotions/wallet?subtotal=${encodeURIComponent(subtotal)}`,
      { credentials: 'same-origin', headers: authHeaders() }
    )
      .then(async (res) => {
        captureFromResponse(res)
        const json = (await res.json().catch(() => ({}))) as { vouchers?: WalletVoucher[] }
        setWalletVouchers(Array.isArray(json.vouchers) ? json.vouchers : [])
      })
      .catch(() => setWalletVouchers([]))
  }, [authHeaders, captureFromResponse, fallbackSubtotal, quote?.breakdown.regularEffectiveSubtotal, ready, selectedItems.length, siteSlug])

  useEffect(() => {
    if (!appliedPromo?.code || walletVouchers.length === 0) return
    const wallet = walletVouchers.find((item) => item.code.toLowerCase() === appliedPromo.code.toLowerCase())
    if (wallet && !wallet.eligible) {
      setAppliedPromo(null)
      setSelectedWalletCode('')
      setPromoCodeInput('')
      setPromoMessage('')
      setPromoMessageKind('')
    }
  }, [appliedPromo?.code, walletVouchers])

  async function applyPromoCodeValue(code: string) {
    const trimmed = code.trim()
    if (!trimmed || promoBusy) return
    const wallet = walletVouchers.find((item) => item.code.toLowerCase() === trimmed.toLowerCase())
    if (wallet && !wallet.eligible) {
      unapplyPromo(promoErrorText(wallet.ineligibleReason ?? ''))
      return
    }
    setPromoBusy(true)
    setPromoMessage('')
    setPromoMessageKind('')
    setPromoCodeInput(trimmed)
    setSelectedWalletCode(wallet?.code || trimmed)
    try {
      const next = await requestQuote(items, selectedLineIds, trimmed)
      if (next === undefined) return
      applyQuoteResult(next, trimmed)
      skipAutoQuoteRef.current = true
    } finally {
      setPromoBusy(false)
    }
  }

  function applyPromoCode() {
    void applyPromoCodeValue(promoCodeInput)
  }

  function removePromoCode() {
    setAppliedPromo(null)
    setPromoCodeInput('')
    setSelectedWalletCode('')
    setPromoMessage('')
    setPromoMessageKind('')
  }

  const closeAddressModal = useCallback(() => setShowAddressModal(false), [])

  function openAddAddress() {
    setAddressForm(
      emptyPartnerSiteAddressInput({
        full_name: orderName,
        phone: orderPhone,
        is_default: bookAddresses.length === 0,
      })
    )
    setShowAddressModal(true)
  }

  async function saveCartAddress() {
    if (addressSaving) return
    setAddressSaving(true)
    try {
      const res = await fetch(partnerSiteAddressesApiPath(siteSlug), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(addressForm),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        address?: PartnerSiteCustomerAddress
      }
      if (!res.ok || !json.ok || !json.address) {
        setStatus(t.accountSaveFailed)
        return
      }
      setShowAddressModal(false)
      await loadAddressBook()
      setSelectedAddressId(json.address.id)
    } finally {
      setAddressSaving(false)
    }
  }

  const subtotal = quote?.breakdown.effectiveSubtotal ?? fallbackSubtotal
  const payableSubtotal = quote?.breakdown.amountAfterDiscount ??
    Math.max(0, subtotal - (appliedPromo?.discountAmount ?? 0))
  const shippingFeeEstimate = useMemo(() => {
    if (quote) return quote.shipping.feeAmount
    if (shippingPolicy.feeAmount <= 0) return 0
    if (shippingPolicy.freeThresholdAmount != null && payableSubtotal >= shippingPolicy.freeThresholdAmount) return 0
    return shippingPolicy.feeAmount
  }, [quote, shippingPolicy, payableSubtotal])
  const orderTotal = quote?.orderTotal ?? payableSubtotal + shippingFeeEstimate
  const quotedLineById = useMemo(
    () => new Map((quote?.lines ?? []).map((line) => [line.lineId, line])),
    [quote?.lines]
  )
  const selectedTeaserSavings = useMemo(() => {
    if (quote?.saleCalendar?.phase !== 'teaser') return 0
    return selectedItems.reduce((sum, item) => {
      const line = quotedLineById.get(item.id)
      const expected = line?.expectedSaleUnitPrice
      const list = line?.listUnitPrice ?? 0
      const effective = line?.effectiveUnitPrice ?? list
      if (effective < list) return sum
      if (expected == null || expected <= 0 || expected >= list) return sum
      return sum + (list - expected) * Math.max(1, item.quantity)
    }, 0)
  }, [quote?.saleCalendar?.phase, quotedLineById, selectedItems])
  const flashSaleAmount = Math.max(0, Math.round(quote?.breakdown.flashSaleDiscountAmount ?? 0))
  const siteSaleAmount = Math.max(0, Math.round(quote?.breakdown.siteSaleDiscountAmount ?? 0))
  const calendarKnown = quote?.breakdown.calendarSaleDiscountAmount
  const inventoryKnown = quote?.breakdown.inventorySaleDiscountAmount
  const calendarSaleAmount = Math.max(
    0,
    Math.round(
      calendarKnown ?? (inventoryKnown == null ? Math.max(0, siteSaleAmount - flashSaleAmount) : 0)
    )
  )
  const inventorySaleAmount = Math.max(
    0,
    Math.round(inventoryKnown ?? Math.max(0, siteSaleAmount - flashSaleAmount - calendarSaleAmount))
  )
  const birthdayPercent = Math.max(0, Math.round(quote?.birthdayDiscountPercent || quote?.birthdayOffer?.percent || 0))
  const birthdayAmount = Math.max(0, Math.round(quote?.breakdown.birthdayDiscountAmount ?? 0))
  const birthdayEndsAt = quote?.birthdayOffer?.countdownTo ?? null
  const birthdayDisplayTotal = selectedItems.reduce(
    (sum, item) => sum + cartBirthdayLineSave(item, quotedLineById.get(item.id), birthdayPercent),
    0
  )
  const birthdayPaused = birthdayPercent > 0 && (quote?.breakdown.voucherDiscountAmount ?? 0) > 0
  const calendarProgramName = calendarSaleProgramName(saleT.saleDiscount, quote?.saleCalendar)
  const runningProgramLabels = [
    flashSaleAmount > 0 ? saleT.flashDiscount : '',
    quote?.saleCalendar?.phase === 'active' && (calendarSaleAmount > 0 || quote.saleCalendar.discountPercent > 0)
      ? calendarProgramName
      : '',
    inventorySaleAmount > 0 ? saleT.inventoryDiscount : '',
    birthdayPercent > 0 && !birthdayPaused ? saleT.birthdayDiscount.replace('{pct}', String(birthdayPercent)) : '',
    (quote?.breakdown.clearanceSubtotal ?? 0) > 0 ? saleT.clearanceSubtotal : '',
  ].filter(Boolean)
  const depositPreview = useMemo(() => {
    if (depositPolicy.mode === 'none') return null
    const split = quote?.checkoutSplit
    if (split && typeof split.requiredAmount === 'number') {
      const amount = Math.max(0, Math.round(split.requiredAmount))
      if (amount <= 0) return null
      const percent =
        payableSubtotal > 0
          ? Math.round((amount * 100) / payableSubtotal)
          : Math.max(0, ...(split.plans || []).map((plan) => plan.depositPercent))
      return { percent, amount }
    }
    if (payableSubtotal <= 0) return null
    if (depositPolicy.mode === 'fixed_amount') {
      const fixed = depositPolicy.fixedAmount
      if (fixed > payableSubtotal) {
        const amount = Math.ceil(payableSubtotal * 0.2)
        return { percent: 20, amount }
      }
      const percent = payableSubtotal > 0 ? Math.round((fixed / payableSubtotal) * 100) : 0
      return { percent, amount: fixed }
    }
    const percent = depositPolicy.percent
    return { percent, amount: Math.ceil((payableSubtotal * percent) / 100) }
  }, [depositPolicy, payableSubtotal, quote?.checkoutSplit])

  async function saveItems(next: SiteCartLine[]) {
    setItems(next)
    setSelectedLineIds((current) => new Set(next.filter((item) => current.has(item.id)).map((item) => item.id)))
    const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/cart`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ items: next }),
    })
    captureFromResponse(res)
    await refreshCartCount()
  }

  async function checkout() {
    if (selectedItems.length === 0 || checkoutBusy) return
    if (isAuthenticated && bookAddresses.length === 0) {
      setStatus(t.addressCartEmpty)
      return
    }
    if (!orderName.trim() || !orderPhone.trim() || !orderAddress.trim()) {
      setStatus(`${t.checkoutName}, ${t.checkoutPhone}, ${t.checkoutAddress}`)
      return
    }
    setCheckoutBusy(true)
    setStatus('')
    setNeedsAuth(false)
    const quoteByLineId = new Map((quote?.lines ?? []).map((line) => [line.lineId, line]))
    const checkoutLines = selectedItems.map((item) => ({
      itemId: item.card.inventory_id || item.id,
      itemName: item.card.name,
      value: quoteByLineId.get(item.id)?.effectiveUnitPrice ?? parseVndFromPriceHint(item.card.price_hint),
      quantity: item.quantity,
      sku: item.card.sku,
    }))
    trackPartnerSiteBeginCheckout(tracking, checkoutLines)
    try {
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-Partner-Site-Checkout': '1',
          ...authHeaders(),
        },
        body: JSON.stringify({
          action: 'cart_checkout',
          form: {
            customerName: orderName.trim(),
            customerPhone: orderPhone.trim(),
            shippingAddress: orderAddress.trim(),
            note: orderNote.trim(),
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
            ...(ewalletAvailable ? { paymentMethod } : {}),
          },
          items: selectedItems.map((item) => ({
            card: item.card as PartnerAiProductCard,
            color: item.color,
            size: item.size,
            quantity: item.quantity,
            note: item.note,
            ...(item.variantLineImages ? { variantLineImages: item.variantLineImages } : {}),
          })),
        }),
      })
      captureFromResponse(res)
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        requireAuth?: boolean
        order?: OrderSnapshot
        orders?: OrderSnapshot[]
        checkout_group_id?: string | null
      }
      if (!res.ok || !json.ok) {
        if (json.error === 'AUTH_REQUIRED_PURCHASE_LOGIN' || json.requireAuth) {
          setNeedsAuth(true)
          setStatus(t.checkoutAuthRequired)
          window.location.assign(
            buildPartnerShopLoginHref(
              siteSlug,
              getPartnerShopBrowserReturnLocation(siteSlug, { customDomain }),
              { customDomain }
            )
          )
        } else if (json.error?.startsWith('promo_invalid:')) {
          setAppliedPromo(null)
          setStatus(promoErrorText(json.error.split(':')[1] ?? ''))
        } else {
          setStatus(json.error || t.authFailed)
        }
        return
      }
      setAppliedPromo(null)
      setPromoCodeInput('')
      const createdOrders = (Array.isArray(json.orders) && json.orders.length
        ? json.orders
        : json.order
          ? [json.order]
          : []) as OrderSnapshot[]
      const created = json.order
        ? pickDepositLandingOrder(json.order, createdOrders)
        : createdOrders[0] || null
      const goDeposit = created?.id ? shouldRedirectToDepositAfterCreate(created) : false
      if (created?.id) {
        markGoogleCustomerReviewsForOrder(created.id)
        if (!goDeposit) {
          trackPartnerSitePurchase(tracking, {
            transactionId: created.id,
            value: partnerOrderPayableTotal(created),
            lines: checkoutLines,
            customerPhone: orderPhone.trim() || undefined,
          })
        }
      }
      const checkedOutIds = new Set(selectedItems.map((item) => item.id))
      const remainingItems = items.filter((item) => !checkedOutIds.has(item.id))
      setItems(remainingItems)
      setSelectedLineIds(new Set())
      await fetch(`/api/site/${encodeURIComponent(siteSlug)}/cart`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ items: remainingItems }),
      })
      await refreshCartCount()
      if (created?.id && typeof window !== 'undefined') {
        const next = goDeposit
          ? partnerSiteOrderDepositPath(siteSlug, created.id, { customDomain })
          : partnerSiteOrderDetailPath(siteSlug, created.id, { customDomain })
        window.location.assign(next)
        return
      }
      setCompletedOrder(created)
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (completedOrder) {
    return <PartnerSiteShopOrderConfirmation locale={locale} order={completedOrder} chatPath={chatPath} />
  }

  return (
    <div className="pw-shop-cart">
      <h1 data-pw-el={PW_EL.sectionTitle}>{t.cartTitle}</h1>
      {loading && items.length === 0 ? <p className="pw-shop-muted">…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>
          {t.cartEmpty}{' '}
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })}>{t.cartContinueShopping}</Link>
        </p>
      ) : null}
      {items.length > 0 ? (
        <div className="pw-shop-cart-layout">
      <section className="pw-shop-cart-list" data-pw-region={PW_REGION.cartList}>
      <div className="pw-shop-cart-select-all">
        <label>
          <input
            type="checkbox"
            checked={items.length > 0 && selectedLineIds.size === items.length}
            onChange={(event) =>
              setSelectedLineIds(event.target.checked ? new Set(items.map((item) => item.id)) : new Set())
            }
          />
          {saleT.selectAll}
        </label>
        <span className="pw-shop-muted">
          {saleT.selectedCount
            .replace('{selected}', String(selectedItems.length))
            .replace('{total}', String(items.length))}
        </span>
      </div>
      <div className="pw-shop-cart-lines">
        {items.map((item, index) => {
          const lineQuote = quotedLineById.get(item.id)
          const unitPrice = lineQuote?.effectiveUnitPrice ?? parseVndFromPriceHint(item.card.price_hint)
          const listUnitPrice = lineQuote?.listUnitPrice ?? unitPrice
          const qty = Math.max(1, item.quantity)
          const lineTotal = unitPrice * qty
          const listLineTotal = listUnitPrice * qty
          const expectedUnit =
            lineQuote?.expectedSaleUnitPrice != null &&
            lineQuote.expectedSaleUnitPrice > 0 &&
            lineQuote.expectedSaleUnitPrice < listUnitPrice
              ? lineQuote.expectedSaleUnitPrice
              : null
          const isTeaserLine = expectedUnit != null && !(listUnitPrice > unitPrice)
          const unitSavings = listUnitPrice > unitPrice ? listUnitPrice - unitPrice : 0
          const teaserUnitSavings = isTeaserLine && expectedUnit != null ? listUnitPrice - expectedUnit : 0
          const birthdayLineSave = cartBirthdayLineSave(item, lineQuote, birthdayPercent)
          const birthdayLineSaveText = partnerSiteBirthdaySaveText(birthdayLineSave, locale)
          const programName =
            cartLineProgramName(lineQuote, quote?.saleCalendar, locale, saleT.inventoryDiscount) ||
            calendarProgramName
          const chipKind =
            lineQuote?.priceKind === 'flash'
              ? 'flash'
              : lineQuote?.isClearance
                ? 'clearance'
                : lineQuote?.priceKind === 'google'
                  ? 'google'
                  : isTeaserLine
                    ? 'teaser'
                    : lineQuote?.priceKind === 'calendar'
                      ? 'calendar'
                      : lineQuote?.saleBadge
                        ? 'calendar'
                        : ''
          const chipLabel = lineQuote?.saleBadge
            ? isTeaserLine
              ? partnerSiteSaleFill(saleT.comingSoon, {
                  program: programName,
                  pct: quote?.saleCalendar?.discountPercent ?? 0,
                })
              : lineQuote.saleBadge
            : lineQuote?.isClearance
              ? saleT.clearanceSubtotal
              : ''
          return (
          <div key={item.id} className={`pw-shop-cart-row${selectedLineIds.has(item.id) ? ' is-selected' : ''}`} data-pw-el={PW_EL.line} data-pw-cart-qty={qty}>
            <label className="pw-shop-cart-check" aria-label={saleT.selectProduct}>
              <input
                type="checkbox"
                checked={selectedLineIds.has(item.id)}
                onChange={(event) =>
                  setSelectedLineIds((current) => {
                    const next = new Set(current)
                    if (event.target.checked) next.add(item.id)
                    else next.delete(item.id)
                    return next
                  })
                }
              />
            </label>
            <img
              src={shopCardDisplaySrc(item.card.image_url) || item.card.image_url}
              alt={item.card.name}
              width={72}
              height={72}
              loading={index < 2 ? 'eager' : 'lazy'}
              fetchPriority={index === 0 ? 'high' : undefined}
              decoding="async"
              data-pw-el={PW_EL.cardMedia}
            />
            <div className="pw-shop-cart-row-main">
              <strong data-pw-el={PW_EL.cardName}>{item.card.name}</strong>
              {chipLabel ? (
                <div className="pw-shop-cart-line-chips">
                  <span className={`pw-shop-cart-chip pw-shop-cart-chip-${chipKind}`}>{chipLabel}</span>
                  {birthdayPercent > 0 && !lineQuote?.isClearance ? (
                    <span className="pw-shop-cart-chip pw-shop-cart-chip-birthday">
                      {partnerSiteSaleFill(saleT.birthdayAtCheckout, { pct: birthdayPercent })}
                      {birthdayLineSave > 0 ? ` · ${formatVnd(birthdayLineSave)}` : ''}
                    </span>
                  ) : null}
                </div>
              ) : birthdayPercent > 0 && !lineQuote?.isClearance ? (
                <div className="pw-shop-cart-line-chips">
                  <span className="pw-shop-cart-chip pw-shop-cart-chip-birthday">
                    {partnerSiteSaleFill(saleT.birthdayAtCheckout, { pct: birthdayPercent })}
                    {birthdayLineSave > 0 ? ` · ${formatVnd(birthdayLineSave)}` : ''}
                  </span>
                </div>
              ) : null}
              <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>
                {isTeaserLine ? <span className="pw-shop-cart-kicker">{saleT.listUnit}</span> : null}
                {formatVnd(unitPrice)}
                {listUnitPrice > unitPrice ? <del className="pw-price-compare"> {formatVnd(listUnitPrice)}</del> : null}
              </p>
              {isTeaserLine && expectedUnit != null ? (
                <>
                  <p className="pw-shop-cart-line-expected">
                    {partnerSiteSaleFill(siteSaleT.expectedPrice, { program: programName })} {formatVnd(expectedUnit)}
                  </p>
                  <p className="pw-shop-cart-line-save is-teaser">
                    {partnerSiteSaleFill(siteSaleT.teaserSave, {
                      program: programName,
                      amount: formatVnd(teaserUnitSavings),
                    })}
                  </p>
                  {lineQuote?.countdownTo ? (
                    <p className="pw-shop-cart-line-count">
                      <PartnerSiteSaleCountdown
                        countdownTo={lineQuote.countdownTo}
                        phase="teaser"
                        locale={locale}
                        eventLabel={programName}
                        promoKind={lineQuote.priceKind === 'flash' ? 'flash' : 'calendar'}
                      />
                    </p>
                  ) : null}
                </>
              ) : unitSavings > 0 ? (
                <>
                  <p className="pw-shop-cart-line-save">
                    {partnerSiteSaleFill(siteSaleT.save, { program: programName, amount: formatVnd(unitSavings) })}
                  </p>
                  {lineQuote?.countdownTo && lineQuote.priceKind !== 'clearance' ? (
                    <p className="pw-shop-cart-line-count">
                      <PartnerSiteSaleCountdown
                        countdownTo={lineQuote.countdownTo}
                        phase="active"
                        locale={locale}
                        eventLabel={programName}
                        promoKind={lineQuote.priceKind === 'flash' ? 'flash' : 'calendar'}
                      />
                    </p>
                  ) : null}
                </>
              ) : null}
              {birthdayPercent > 0 && !lineQuote?.isClearance ? (
                <div className="pw-shop-cart-birthday">
                  {birthdayLineSaveText ? (
                    <p className="pw-shop-cart-line-save is-birthday">{birthdayLineSaveText}</p>
                  ) : null}
                  {birthdayEndsAt ? (
                    <p className="pw-shop-cart-line-count pw-shop-cart-birthday-count">
                      ⏱{' '}
                      <PartnerSiteSaleCountdown
                        countdownTo={birthdayEndsAt}
                        phase="active"
                        locale={locale}
                        eventLabel="CMSN"
                        prefix={siteSaleT.birthdayEndsAfter}
                      />
                    </p>
                  ) : null}
                </div>
              ) : null}
              {item.color || item.size ? (
                <p className="pw-shop-muted">
                  {item.color ? `${t.colorLabel}: ${item.color}` : ''}
                  {item.color && item.size ? ' · ' : ''}
                  {item.size ? `${t.sizeLabel}: ${item.size}` : ''}
                </p>
              ) : null}
              <div className="pw-shop-cart-row-tools">
                <div className="pw-shop-qty" data-pw-el={PW_EL.qty}>
                  <button
                    type="button"
                    aria-label="-"
                    disabled={item.quantity <= 1}
                    onClick={() =>
                      void saveItems(items.map((x) => (x.id === item.id ? { ...x, quantity: item.quantity - 1 } : x)))
                    }
                  >
                    −
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    type="button"
                    aria-label="+"
                    disabled={item.quantity >= 99}
                    onClick={() =>
                      void saveItems(items.map((x) => (x.id === item.id ? { ...x, quantity: item.quantity + 1 } : x)))
                    }
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="pw-shop-cart-remove"
                  data-pw-el={PW_EL.remove}
                  onClick={() => void saveItems(items.filter((x) => x.id !== item.id))}
                >
                  {t.cartRemove}
                </button>
              </div>
            </div>
            <div className="pw-shop-cart-line-total-wrap">
              <p className="pw-shop-cart-line-total">{formatVnd(lineTotal)}</p>
              {isTeaserLine && expectedUnit != null ? (
                <>
                  <p className="pw-shop-cart-line-expected">{partnerSiteSaleFill(saleT.expectedLine, { amount: formatVnd(expectedUnit * qty) })}</p>
                  <p className="pw-shop-cart-line-save is-teaser">
                    {partnerSiteSaleFill(siteSaleT.teaserSave, {
                      program: programName,
                      amount: formatVnd(teaserUnitSavings * qty),
                    })}
                  </p>
                </>
              ) : unitSavings > 0 ? (
                <>
                  {listLineTotal > lineTotal ? (
                    <p className="pw-shop-cart-line-compare">{formatVnd(listLineTotal)}</p>
                  ) : null}
                  <p className="pw-shop-cart-line-save">
                    {partnerSiteSaleFill(siteSaleT.save, {
                      program: programName,
                      amount: formatVnd(unitSavings * qty),
                    })}
                  </p>
                </>
              ) : null}
              {birthdayLineSaveText ? (
                <p className="pw-shop-cart-line-save is-birthday">{birthdayLineSaveText}</p>
              ) : null}
            </div>
          </div>
          )
        })}
      </div>
      </section>
        <div className="pw-shop-cart-summary" data-pw-region={PW_REGION.cartSummary}>
          {runningProgramLabels.length > 0 ? (
            <div className="pw-shop-cart-programs" aria-label={saleT.runningPrograms}>
              {runningProgramLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          ) : null}
          {quote?.saleCalendar?.phase === 'teaser' && selectedTeaserSavings > 0 ? (
            <div className="pw-shop-cart-teaser" style={{ marginBottom: 8 }}>
              <p>
                {siteSaleT.teaserCartHint
                  .replace('{label}', quote.saleCalendar.eventLabel)
                  .replace('{pct}', String(quote.saleCalendar.discountPercent))}
                <strong> ~{formatVnd(selectedTeaserSavings)}</strong>
              </p>
              {quote.saleCalendar.countdownTo ? (
                <PartnerSiteSaleCountdown
                  countdownTo={quote.saleCalendar.countdownTo}
                  phase="teaser"
                  locale={locale}
                  eventLabel={quote.saleCalendar.eventLabel}
                  promoKind="calendar"
                />
              ) : null}
            </div>
          ) : null}
          {quote?.saleCalendar?.phase === 'active' && quote.saleCalendar.countdownTo ? (
            <PartnerSiteSaleCountdown
              countdownTo={quote.saleCalendar.countdownTo}
              phase="active"
              locale={locale}
              eventLabel={quote.saleCalendar.eventLabel}
              promoKind="calendar"
            />
          ) : null}
          {quote ? (
            <div className="pw-shop-cart-discount-breakdown">
              {quote.breakdown.regularListSubtotal > 0 ? (
                <p className="pw-shop-cart-section">{saleT.regularGoods}</p>
              ) : null}
              {quote.breakdown.regularListSubtotal > quote.breakdown.regularEffectiveSubtotal ? (
                <p className="is-list"><span>{saleT.listSubtotal}</span><strong>{formatVnd(quote.breakdown.regularListSubtotal)}</strong></p>
              ) : quote.breakdown.regularListSubtotal > 0 ? (
                <p><span>{saleT.listSubtotal}</span><strong>{formatVnd(quote.breakdown.regularListSubtotal)}</strong></p>
              ) : null}
              {flashSaleAmount > 0 ? (
                <p className="is-flash">
                  <span>
                    {partnerSiteSaleFill(saleT.flashAlreadyDeducted, {
                      program: saleT.flashDiscount,
                      amount: formatVnd(flashSaleAmount),
                    })}
                  </span>
                  <strong>−{formatVnd(flashSaleAmount)}</strong>
                </p>
              ) : null}
              {calendarSaleAmount > 0 ? (
                <p className="is-calendar">
                  <span>
                    {calendarProgramName}
                    {quote.saleCalendar?.discountPercent ? ` (-${quote.saleCalendar.discountPercent}%)` : ''}
                  </span>
                  <strong>−{formatVnd(calendarSaleAmount)}</strong>
                </p>
              ) : null}
              {inventorySaleAmount > 0 ? (
                <p><span>{saleT.inventoryDiscount}</span><strong>−{formatVnd(inventorySaleAmount)}</strong></p>
              ) : null}
              {quote.breakdown.googleDiscountAmount > 0 ? (
                <p className="is-google"><span>{saleT.googleDiscount}</span><strong>−{formatVnd(quote.breakdown.googleDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.voucherDiscountAmount > 0 ? (
                <p className="is-voucher"><span>{appliedPromo?.name || appliedPromo?.code || t.cartPromoDiscountLabel}</span><strong>−{formatVnd(quote.breakdown.voucherDiscountAmount)}</strong></p>
              ) : null}
              {birthdayAmount > 0 ? (
                <p className="is-birthday"><span>{saleT.birthdayDiscount.replace('{pct}', String(birthdayPercent || ''))}</span><strong>−{formatVnd(birthdayAmount)}</strong></p>
              ) : birthdayPaused ? (
                <p className="pw-shop-cart-promo-msg is-warn">{saleT.birthdayPaused}</p>
              ) : birthdayPercent > 0 && !birthdayPaused ? (
                <p className="is-birthday">
                  <span>
                    {partnerSiteBirthdaySaveText(birthdayDisplayTotal, locale) ||
                      partnerSiteBirthdayCheckoutHint(birthdayPercent, locale)}
                  </span>
                  {birthdayDisplayTotal > 0 ? <strong>{formatVnd(birthdayDisplayTotal)}</strong> : null}
                </p>
              ) : null}
              {birthdayPercent > 0 && !birthdayPaused && birthdayEndsAt ? (
                <p className="is-birthday pw-shop-cart-birthday-count">
                  ⏱{' '}
                  <PartnerSiteSaleCountdown
                    countdownTo={birthdayEndsAt}
                    phase="active"
                    locale={locale}
                    eventLabel="CMSN"
                    prefix={siteSaleT.birthdayEndsAfter}
                  />
                </p>
              ) : null}
              {quote.breakdown.loyaltyDiscountAmount > 0 ? (
                <p className="is-loyalty"><span>{saleT.loyaltyDiscount}{quote.loyalty.tierName ? ` ${quote.loyalty.tierName}` : ''}</span><strong>−{formatVnd(quote.breakdown.loyaltyDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.regularListSubtotal > 0 ? (
                <p>
                  <span>{saleT.regularSubtotal}</span>
                  <strong>{formatVnd(Math.max(0, quote.breakdown.amountAfterDiscount - quote.breakdown.clearanceSubtotal))}</strong>
                </p>
              ) : null}
              {quote.breakdown.clearanceSubtotal > 0 ? (
                <div className="is-clearance">
                  <p className="pw-shop-cart-section">{saleT.clearanceSubtotal}</p>
                  <p>
                    <span>{saleT.warehouseSubtotal}</span>
                    <strong>{formatVnd(quote.breakdown.clearanceSubtotal)}</strong>
                  </p>
                </div>
              ) : null}
              {quote.breakdown.regularListSubtotal > 0 && quote.breakdown.totalDiscountAmount > 0 ? (
                <p className="pw-shop-cart-saved">
                  {partnerSiteSaleFill(saleT.savedOnRegular, { amount: formatVnd(quote.breakdown.totalDiscountAmount) })}
                </p>
              ) : null}
              {quote.breakdown.maxDiscountAmount > 0 && quote.breakdown.totalDiscountAmount > 0 ? (
                <p className="pw-shop-cart-cap-meter">
                  {saleT.capMeter
                    .replace('{used}', formatVnd(quote.breakdown.totalDiscountAmount))
                    .replace('{max}', formatVnd(quote.breakdown.maxDiscountAmount))}
                </p>
              ) : null}
              {quote.breakdown.capAdjustmentAmount > 0 && promoMessageKind !== 'warn' ? (
                <p className="pw-shop-cart-promo-msg is-warn">{saleT.capNotice}</p>
              ) : null}
            </div>
          ) : (
            <p data-pw-el={PW_EL.price}>
              {t.cartSubtotal}: {formatVnd(subtotal)}
            </p>
          )}
          <div className="pw-shop-cart-promo" data-pw-el={PW_EL.coupon}>
            <label>{t.cartPromoLabel}</label>
            {walletVouchers.length > 0 ? (
              <div className="pw-shop-cart-wallet">
                <strong>{saleT.voucherWallet}</strong>
                {walletVouchers.map((voucher) => {
                  const selectedCode = (appliedPromo?.code || (promoBusy ? selectedWalletCode : '')).trim().toLowerCase()
                  const isChecked = selectedCode === voucher.code.toLowerCase()
                  return (
                  <label
                    key={voucher.code}
                    className={`${voucher.eligible ? '' : 'is-disabled'}${isChecked ? ' is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="wallet-voucher"
                      checked={isChecked}
                      disabled={promoBusy || !voucher.eligible}
                      onChange={() => {}}
                      onClick={() => {
                        if (!voucher.eligible) return
                        if (isChecked) {
                          removePromoCode()
                          return
                        }
                        void applyPromoCodeValue(voucher.code)
                      }}
                    />
                    <span>
                      <b>{voucher.code}</b> — {voucher.name}{voucher.expiresSoon ? ` · ${saleT.expiresSoon}` : ''}
                      {!voucher.eligible && voucher.ineligibleReason ? (
                        <em className="pw-shop-cart-wallet-reason">{promoErrorText(voucher.ineligibleReason)}</em>
                      ) : null}
                    </span>
                  </label>
                  )
                })}
              </div>
            ) : isAuthenticated ? <p className="pw-shop-muted">{saleT.noVoucher}</p> : null}
            {appliedPromo || (promoBusy && selectedWalletCode) ? (
              <div className="pw-shop-cart-promo-row">
                <span className="pw-shop-price">
                  {promoBusy
                    ? `${appliedPromo?.code || selectedWalletCode} — ${t.cartPromoApplying}`
                    : appliedPromo && appliedPromo.discountAmount > 0
                      ? `${appliedPromo.code} — ${t.cartPromoDiscountLabel} ${formatVnd(appliedPromo.discountAmount)}`
                      : appliedPromo?.code || selectedWalletCode}
                </span>
                <button type="button" className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-sm" onClick={removePromoCode}>
                  {t.cartPromoRemove}
                </button>
              </div>
            ) : (
              <div className="pw-shop-cart-promo-row">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  placeholder={t.cartPromoPlaceholder}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyPromoCode()
                    }
                  }}
                />
                <button
                  type="button"
                  className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-sm"
                  disabled={promoBusy || !promoCodeInput.trim()}
                  onClick={() => applyPromoCode()}
                >
                  {promoBusy ? t.cartPromoApplying : t.cartPromoApply}
                </button>
              </div>
            )}
            {promoMessage ? (
              <p className={`pw-shop-cart-promo-msg${promoMessageKind === 'error' ? ' is-error' : promoMessageKind === 'warn' ? ' is-warn' : ''}`}>
                {promoMessage}
              </p>
            ) : null}
          </div>
          <p className="pw-shop-muted">
            {shippingFeeEstimate > 0
              ? `${t.cartShippingFeeLabel}: ${formatVnd(shippingFeeEstimate)}`
              : (quote?.shipping.configuredFeeAmount ?? shippingPolicy.feeAmount) > 0
                ? t.cartShippingFeeFree
                : t.cartShippingFeeIncluded}
            {(quote?.shipping.carrierLabel || shippingPolicy.carrierLabel)
              ? ` — ${t.shippingCarrierLabel}: ${quote?.shipping.carrierLabel || shippingPolicy.carrierLabel}`
              : ''}
            {(quote?.shipping.freeThresholdAmount ?? shippingPolicy.freeThresholdAmount) != null && shippingFeeEstimate > 0
              ? ` — ${t.cartShippingFreeThresholdHint.replace('{amount}', formatVnd((quote?.shipping.freeThresholdAmount ?? shippingPolicy.freeThresholdAmount) as number))}`
              : ''}
          </p>
          {quote?.checkoutSplit && quote.checkoutSplit.orderCount > 1 ? (
            <p className="pw-shop-muted">{t.orderSplitBanner}</p>
          ) : null}
          <p className="pw-shop-cart-grand" data-pw-el={PW_EL.price}>
            {saleT.grandTotal}: {formatVnd(orderTotal)}
          </p>
          {depositPreview && depositPreview.amount > 0 ? (
            <p className="pw-shop-cart-deposit-note">
              {t.cartDepositNote
                .replace('{percent}', String(depositPreview.percent))
                .replace('{amount}', formatVnd(depositPreview.amount))}
            </p>
          ) : null}
          {ewalletAvailable ? (
            <div className="pw-shop-cart-pay-method">
              <p>{t.checkoutPaymentMethodLabel}</p>
              <div className="pw-shop-deposit-opts">
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => setPaymentMethod('bank_transfer')}
                  />
                  {t.checkoutPaymentMethodBank}
                </label>
                <label>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'ewallet'}
                    onChange={() => setPaymentMethod('ewallet')}
                  />
                  {t.checkoutPaymentMethodEwallet}
                </label>
              </div>
              <p className="pw-shop-muted">{t.checkoutPaymentMethodHint}</p>
            </div>
          ) : null}
          <div className="pw-shop-form" data-pw-region={PW_REGION.form}>
            {!checkoutLoginRequired ? (
              <p className="pw-shop-muted">{t.checkoutGuestHint}</p>
            ) : null}
            {isAuthenticated ? (
              <div className="pw-shop-address-pick">
                <p style={{ fontWeight: 700, margin: 0 }}>{t.addressCartTitle}</p>
                {bookAddresses.length === 0 ? (
                  <p className="pw-shop-muted">{t.addressCartEmpty}</p>
                ) : (
                  bookAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`pw-shop-address-pick-item${selectedAddressId === addr.id ? ' is-on' : ''}`}
                    >
                      <input
                        type="radio"
                        name="shipping_address"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                      <span>
                        <strong>{addr.full_name}</strong>
                        <span className="pw-shop-muted"> {addr.phone}</span>
                        {addr.is_default ? (
                          <span className="pw-shop-address-default">{t.addressDefaultBadge}</span>
                        ) : null}
                        <br />
                        {formatPartnerSiteAddressLine(addr)}
                      </span>
                    </label>
                  ))
                )}
                <div className="pw-shop-address-form-actions">
                  <button type="button" className="pw-shop-btn pw-shop-btn-buy pw-shop-btn-sm" onClick={openAddAddress}>
                    {t.addressCartAddHint}
                  </button>
                  <Link
                    href={partnerSiteAddressesPath(siteSlug, { customDomain })}
                    className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-sm"
                  >
                    {t.addressManageBook}
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <label data-pw-el={PW_EL.label}>
                  {t.checkoutName}
                  <input value={orderName} onChange={(e) => setOrderName(e.target.value)} data-pw-el={PW_EL.field} />
                </label>
                <label data-pw-el={PW_EL.label}>
                  {t.checkoutPhone}
                  <input value={orderPhone} onChange={(e) => setOrderPhone(e.target.value)} data-pw-el={PW_EL.field} />
                </label>
                <label data-pw-el={PW_EL.label}>
                  {t.checkoutAddress}
                  <textarea rows={4} value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} data-pw-el={PW_EL.field} />
                </label>
              </>
            )}
            <label data-pw-el={PW_EL.label}>
              {t.checkoutNote}
              <textarea rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} data-pw-el={PW_EL.field} />
            </label>
            <div className="pw-shop-cart-actions">
              <Link
                href={partnerSiteHomePath(siteSlug, { customDomain })}
                className="pw-shop-btn pw-shop-btn-outline"
              >
                {t.cartContinueShopping}
              </Link>
              <button
                type="button"
                className="pw-shop-btn pw-shop-btn-buy"
                disabled={checkoutBusy || selectedItems.length === 0}
                onClick={() => void checkout()}
                data-pw-el={PW_EL.checkout}
              >
                {checkoutBusy ? t.cartCheckingOut : t.cartCheckout}
              </button>
            </div>
            {status && !needsAuth ? <p className="pw-shop-muted">{status}</p> : null}
          </div>
          {needsAuth && checkoutLoginRequired ? <p className="pw-shop-muted">{t.checkoutAuthRequired}</p> : null}
          <PartnerSiteShopDialog
            open={showAddressModal}
            title={t.addressCartModalTitle}
            closeLabel={t.addressCancel}
            onClose={closeAddressModal}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void saveCartAddress()
              }}
              data-pw-region={PW_REGION.form}
            >
              <PartnerSiteAddressFormFields value={addressForm} onChange={setAddressForm} t={t} idPrefix="cart" autoFocus />
              <div className="pw-shop-address-form-actions">
                <button type="submit" className="pw-shop-btn pw-shop-btn-buy" disabled={addressSaving} data-pw-el={PW_EL.submit}>
                  {addressSaving ? '…' : t.addressSaveBook}
                </button>
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={closeAddressModal}>
                  {t.addressCancel}
                </button>
              </div>
            </form>
          </PartnerSiteShopDialog>
        </div>
        </div>
      ) : null}
    </div>
  )
}

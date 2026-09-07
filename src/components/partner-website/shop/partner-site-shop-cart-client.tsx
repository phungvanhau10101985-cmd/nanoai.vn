'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import type { WebLocale } from '@/lib/i18n/config'
import {
  formatVnd,
  parseVndFromPriceHint,
  type SiteCartLine,
} from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
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
import { partnerSiteSaleCopy } from '@/lib/partner-website/promotions/partner-site-sale-display'
import { PartnerSiteSaleCountdown } from '@/components/partner-website/shop/partner-site-sale-face'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
  chatPath: string
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
  }>
  breakdown: {
    listSubtotal: number
    effectiveSubtotal: number
    regularListSubtotal: number
    regularEffectiveSubtotal: number
    clearanceSubtotal: number
    siteSaleDiscountAmount: number
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
  saleCalendar?: {
    phase: 'off' | 'teaser' | 'active'
    eventLabel: string
    discountPercent: number
    countdownTo?: string | null
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
  saleDiscount: string
  googleDiscount: string
  birthdayDiscount: string
  loyaltyDiscount: string
  clearanceSubtotal: string
  regularSubtotal: string
  capNotice: string
  capReachedVoucher: string
  selectProduct: string
  quoteUpdating: string
}> = {
  vi: { selectAll: 'Chọn tất cả', selectedCount: 'Đã chọn {selected}/{total} sản phẩm', voucherWallet: 'Voucher của bạn', noVoucher: 'Chưa có voucher phù hợp.', expiresSoon: 'Sắp hết hạn', saleDiscount: 'Sale ngày trùng tháng', googleDiscount: 'Google Shopping', birthdayDiscount: 'Ưu đãi sinh nhật', loyaltyDiscount: 'Hạng thành viên', clearanceSubtotal: 'Thanh lý kho', regularSubtotal: 'Tạm tính hàng thường', capNotice: 'Tổng ưu đãi đã được giới hạn ở 15% giá niêm yết.', capReachedVoucher: 'Không thêm được mã này vì đơn đã đạt trần ưu đãi 15% giá niêm yết.', selectProduct: 'Chọn sản phẩm', quoteUpdating: 'Đang cập nhật giá…' },
  en: { selectAll: 'Select all', selectedCount: '{selected} of {total} products selected', voucherWallet: 'Your vouchers', noVoucher: 'No eligible voucher yet.', expiresSoon: 'Expiring soon', saleDiscount: 'Same-day sale', googleDiscount: 'Google Shopping', birthdayDiscount: 'Birthday offer', loyaltyDiscount: 'Membership tier', clearanceSubtotal: 'Clearance', regularSubtotal: 'Regular items subtotal', capNotice: 'Total discounts have been capped at 15% of list price.', capReachedVoucher: 'This code cannot add more savings because the order has already reached the 15% discount cap.', selectProduct: 'Select product', quoteUpdating: 'Updating prices…' },
  zh: { selectAll: '全选', selectedCount: '已选择 {selected}/{total} 件商品', voucherWallet: '您的优惠券', noVoucher: '暂无可用优惠券。', expiresSoon: '即将到期', saleDiscount: '同日促销', googleDiscount: 'Google Shopping', birthdayDiscount: '生日优惠', loyaltyDiscount: '会员等级', clearanceSubtotal: '清仓商品', regularSubtotal: '普通商品小计', capNotice: '总优惠已限制为标价的 15%。', capReachedVoucher: '订单优惠已达标价 15% 上限，无法再叠加此优惠码。', selectProduct: '选择商品', quoteUpdating: '正在更新价格…' },
  ja: { selectAll: 'すべて選択', selectedCount: '{total}点中{selected}点を選択', voucherWallet: 'お持ちのクーポン', noVoucher: '利用可能なクーポンはありません。', expiresSoon: 'まもなく期限切れ', saleDiscount: '同日セール', googleDiscount: 'Google Shopping', birthdayDiscount: '誕生日特典', loyaltyDiscount: '会員ランク', clearanceSubtotal: '在庫処分', regularSubtotal: '通常商品の小計', capNotice: '割引合計は定価の15%を上限としています。', capReachedVoucher: '注文の割引が定価の15%上限に達しているため、このコードは追加できません。', selectProduct: '商品を選択', quoteUpdating: '価格を更新中…' },
  ko: { selectAll: '전체 선택', selectedCount: '상품 {total}개 중 {selected}개 선택', voucherWallet: '내 쿠폰', noVoucher: '사용 가능한 쿠폰이 없습니다.', expiresSoon: '곧 만료', saleDiscount: '동일 날짜 세일', googleDiscount: 'Google Shopping', birthdayDiscount: '생일 혜택', loyaltyDiscount: '회원 등급', clearanceSubtotal: '창고 정리', regularSubtotal: '일반 상품 소계', capNotice: '총 할인은 정가의 15%로 제한되었습니다.', capReachedVoucher: '주문이 이미 정가 15% 할인 한도에 도달해 이 코드를 더 적용할 수 없습니다.', selectProduct: '상품 선택', quoteUpdating: '가격 업데이트 중…' },
}

function voucherBlockedByDiscountCap(quote: CartQuote): boolean {
  return Boolean(
    quote.promo &&
    quote.breakdown.voucherDiscountAmount <= 0 &&
    quote.breakdown.capAdjustmentAmount > 0
  )
}

export function PartnerSiteShopCartClient({ siteSlug, partnerSlug, locale, chatPath }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const saleT = CART_SALE_COPY[locale] ?? CART_SALE_COPY.en
  const siteSaleT = partnerSiteSaleCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount, setCartCount, tracking } = usePartnerSiteShop()
  const [items, setItems] = useState<SiteCartLine[]>([])
  const [loading, setLoading] = useState(true)
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
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set())
  const [quote, setQuote] = useState<CartQuote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
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
    const next = Array.isArray(json.items) ? json.items : []
    setItems(next)
    setCartCount(
      next.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0)
    )
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
    setLoading(true)
    void loadCart().finally(() => setLoading(false))
  }, [customDomain, isAuthenticated, loadCart, ready, siteSlug])

  useEffect(() => {
    if (!ready) return
    void loadAddressBook()
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
  }, [siteSlug])

  const promoErrorText = useCallback(
    (code: string): string => {
      const map: Record<string, string> = {
        not_found: t.promoErrorNotFound,
        invalid_code: t.promoErrorNotFound,
        inactive: t.promoErrorInactive,
        not_started: t.promoErrorNotStarted,
        expired: t.promoErrorExpired,
        below_min_subtotal: t.promoErrorBelowMinSubtotal,
        usage_limit_reached: t.promoErrorUsageLimitReached,
        per_user_limit_reached: t.promoErrorPerUserLimitReached,
        first_order_only: t.promoErrorFirstOrderOnly,
        no_eligible_items: t.promoErrorNoEligibleItems,
        grant_required: t.promoErrorGrantRequired,
      }
      return map[code] ?? t.promoErrorGeneric
    },
    [t]
  )

  const selectedItems = useMemo(
    () => items.filter((item) => selectedLineIds.has(item.id)),
    [items, selectedLineIds]
  )
  const fallbackSubtotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const unit = parseVndFromPriceHint(item.card.price_hint)
        return sum + unit * item.quantity
      }, 0),
    [selectedItems]
  )

  const fetchQuote = useCallback(async (
    lines: SiteCartLine[],
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
    promoCode?: string
  ): Promise<CartQuote | null | undefined> => {
    const gen = ++quoteGenRef.current
    const next = await fetchQuote(lines, promoCode)
    if (gen !== quoteGenRef.current) return undefined
    return next
  }, [fetchQuote])

  const applyQuoteResult = useCallback((next: CartQuote | null, requestedCode: string) => {
    if (!requestedCode) {
      setQuote(next)
      return
    }
    if (!next) {
      setAppliedPromo(null)
      setPromoMessage(t.promoErrorGeneric)
      setPromoMessageKind('error')
      return
    }
    setQuote(next)
    if (next.promoError) {
      setAppliedPromo(null)
      setPromoMessage(promoErrorText(next.promoError))
      setPromoMessageKind('error')
      return
    }
    if (voucherBlockedByDiscountCap(next) && next.promo) {
      setAppliedPromo(next.promo)
      setPromoMessage(saleT.capReachedVoucher)
      setPromoMessageKind('warn')
      return
    }
    if (next.promo && next.breakdown.voucherDiscountAmount <= 0) {
      setAppliedPromo(null)
      setPromoMessage(t.promoErrorNoEligibleItems)
      setPromoMessageKind('error')
      return
    }
    if (next.promo) {
      setAppliedPromo(next.promo)
      if (next.breakdown.capAdjustmentAmount > 0) {
        setPromoMessage(saleT.capNotice)
        setPromoMessageKind('warn')
      } else {
        setPromoMessage('')
        setPromoMessageKind('')
      }
      return
    }
    setAppliedPromo(null)
    setPromoMessage(t.promoErrorGeneric)
    setPromoMessageKind('error')
  }, [promoErrorText, saleT.capNotice, saleT.capReachedVoucher, t.promoErrorGeneric, t.promoErrorNoEligibleItems])

  const activePromoCode = appliedPromo?.code ?? ''

  useEffect(() => {
    if (appliedPromo?.code) {
      setSelectedWalletCode(appliedPromo.code)
      setPromoCodeInput((current) => current.trim() ? current : appliedPromo.code)
    }
  }, [appliedPromo?.code])

  useEffect(() => {
    if (!ready || loading || selectedItems.length === 0) {
      setQuote(null)
      return
    }
    if (promoBusy) return
    if (skipAutoQuoteRef.current) {
      skipAutoQuoteRef.current = false
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setQuoteLoading(true)
      void requestQuote(selectedItems, activePromoCode)
        .then((next) => {
          if (cancelled || next === undefined) return
          applyQuoteResult(next, activePromoCode)
        })
        .finally(() => {
          if (!cancelled) setQuoteLoading(false)
        })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [activePromoCode, applyQuoteResult, loading, promoBusy, ready, requestQuote, selectedItems])

  useEffect(() => {
    if (!ready || selectedItems.length === 0) {
      setWalletVouchers([])
      return
    }
    const subtotal = quote?.breakdown.regularEffectiveSubtotal ?? fallbackSubtotal
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

  async function applyPromoCodeValue(code: string) {
    const trimmed = code.trim()
    if (!trimmed || promoBusy) return
    const wallet = walletVouchers.find((item) => item.code.toLowerCase() === trimmed.toLowerCase())
    if (wallet && !wallet.eligible) {
      setSelectedWalletCode(wallet.code)
      setPromoCodeInput(wallet.code)
      setAppliedPromo(null)
      setPromoMessage(promoErrorText(wallet.ineligibleReason ?? ''))
      setPromoMessageKind('error')
      return
    }
    setPromoBusy(true)
    setPromoMessage('')
    setPromoMessageKind('')
    setPromoCodeInput(trimmed)
    setSelectedWalletCode(wallet?.code || trimmed)
    try {
      const next = await requestQuote(selectedItems, trimmed)
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
      if (expected == null || expected <= 0 || expected >= list) return sum
      return sum + (list - expected) * Math.max(1, item.quantity)
    }, 0)
  }, [quote?.saleCalendar?.phase, quotedLineById, selectedItems])
  const depositPreview = useMemo(() => {
    if (depositPolicy.mode === 'none') return null
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
  }, [depositPolicy, payableSubtotal])

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
      const created = json.order ?? null
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
      {loading ? <p className="pw-shop-muted">…</p> : null}
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
        {items.map((item) => {
          const lineQuote = quotedLineById.get(item.id)
          const unitPrice = lineQuote?.effectiveUnitPrice ?? parseVndFromPriceHint(item.card.price_hint)
          const listUnitPrice = lineQuote?.listUnitPrice ?? unitPrice
          const lineTotal = unitPrice * Math.max(1, item.quantity)
          return (
          <div key={item.id} className={`pw-shop-cart-row${selectedLineIds.has(item.id) ? ' is-selected' : ''}`} data-pw-el={PW_EL.line}>
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
            <img src={item.card.image_url} alt={item.card.name} data-pw-el={PW_EL.cardMedia} />
            <div className="pw-shop-cart-row-main">
              <strong data-pw-el={PW_EL.cardName}>{item.card.name}</strong>
              <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>
                {formatVnd(unitPrice)}
                {listUnitPrice > unitPrice ? <del className="pw-price-compare"> {formatVnd(listUnitPrice)}</del> : null}
                {lineQuote?.isClearance ? <span className="pw-shop-address-default"> {saleT.clearanceSubtotal}</span> : null}
              </p>
              {lineQuote?.expectedSaleUnitPrice != null &&
              lineQuote.expectedSaleUnitPrice > 0 &&
              lineQuote.expectedSaleUnitPrice < listUnitPrice ? (
                <p className="pw-shop-cart-teaser">
                  {siteSaleT.expectedPrice} {formatVnd(lineQuote.expectedSaleUnitPrice)}
                  {' · '}
                  {siteSaleT.expectedSave
                    .replace('{pct}', String(quote?.saleCalendar?.discountPercent ?? 0))
                    .replace('{amount}', formatVnd(listUnitPrice - lineQuote.expectedSaleUnitPrice))}
                </p>
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
            <p className="pw-shop-cart-line-total">{formatVnd(lineTotal)}</p>
          </div>
          )
        })}
      </div>
      </section>
        <div className="pw-shop-cart-summary" data-pw-region={PW_REGION.cartSummary}>
          {quoteLoading ? <p className="pw-shop-muted">{saleT.quoteUpdating}</p> : null}
          <p data-pw-el={PW_EL.price}>
            {t.cartSubtotal}: {formatVnd(subtotal)}
          </p>
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
                />
              ) : null}
            </div>
          ) : null}
          {quote?.saleCalendar?.phase === 'active' && quote.saleCalendar.countdownTo ? (
            <PartnerSiteSaleCountdown
              countdownTo={quote.saleCalendar.countdownTo}
              phase="active"
              locale={locale}
            />
          ) : null}
          {quote ? (
            <div className="pw-shop-cart-discount-breakdown">
              {quote.breakdown.regularEffectiveSubtotal > 0 ? (
                <p><span>{saleT.regularSubtotal}</span><strong>{formatVnd(quote.breakdown.regularEffectiveSubtotal)}</strong></p>
              ) : null}
              {quote.breakdown.siteSaleDiscountAmount > 0 ? (
                <p><span>{saleT.saleDiscount}</span><strong>−{formatVnd(quote.breakdown.siteSaleDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.googleDiscountAmount > 0 ? (
                <p><span>{saleT.googleDiscount}</span><strong>−{formatVnd(quote.breakdown.googleDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.voucherDiscountAmount > 0 ? (
                <p><span>{appliedPromo?.name || t.cartPromoDiscountLabel}</span><strong>−{formatVnd(quote.breakdown.voucherDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.birthdayDiscountAmount > 0 ? (
                <p><span>{saleT.birthdayDiscount}</span><strong>−{formatVnd(quote.breakdown.birthdayDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.loyaltyDiscountAmount > 0 ? (
                <p><span>{saleT.loyaltyDiscount}{quote.loyalty.tierName ? ` ${quote.loyalty.tierName}` : ''}</span><strong>−{formatVnd(quote.breakdown.loyaltyDiscountAmount)}</strong></p>
              ) : null}
              {quote.breakdown.clearanceSubtotal > 0 ? (
                <p className="is-clearance"><span>{saleT.clearanceSubtotal}</span><strong>{formatVnd(quote.breakdown.clearanceSubtotal)}</strong></p>
              ) : null}
              {quote.breakdown.capAdjustmentAmount > 0 && promoMessageKind !== 'warn' ? (
                <p className="pw-shop-cart-promo-msg is-warn">{saleT.capNotice}</p>
              ) : null}
            </div>
          ) : null}
          <div className="pw-shop-cart-promo" data-pw-el={PW_EL.coupon}>
            <label>{t.cartPromoLabel}</label>
            {walletVouchers.length > 0 ? (
              <div className="pw-shop-cart-wallet">
                <strong>{saleT.voucherWallet}</strong>
                {walletVouchers.map((voucher) => {
                  const selectedCode = (appliedPromo?.code || selectedWalletCode).trim().toLowerCase()
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
                      disabled={promoBusy}
                      onChange={() => {}}
                      onClick={() => {
                        void applyPromoCodeValue(voucher.code)
                      }}
                    />
                    <span><b>{voucher.code}</b> — {voucher.name}{voucher.expiresSoon ? ` · ${saleT.expiresSoon}` : ''}</span>
                  </label>
                  )
                })}
              </div>
            ) : isAuthenticated ? <p className="pw-shop-muted">{saleT.noVoucher}</p> : null}
            {appliedPromo || selectedWalletCode ? (
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
          <p className="pw-shop-cart-grand" data-pw-el={PW_EL.price}>
            {t.cartTotalLabel}: {formatVnd(orderTotal)}
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
                  <textarea rows={3} value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} data-pw-el={PW_EL.field} />
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
                disabled={checkoutBusy || quoteLoading || selectedItems.length === 0}
                onClick={() => void checkout()}
                data-pw-el={PW_EL.checkout}
              >
                {checkoutBusy ? t.cartCheckingOut : t.cartCheckout}
              </button>
            </div>
            {status && !needsAuth ? <p className="pw-shop-muted">{status}</p> : null}
          </div>
          {needsAuth && checkoutLoginRequired ? <p className="pw-shop-muted">{t.checkoutAuthRequired}</p> : null}
          {showAddressModal ? (
            <div className="pw-shop-address-modal" role="dialog" aria-modal="true" onClick={() => setShowAddressModal(false)}>
              <div className="pw-shop-address-modal-card" onClick={(e) => e.stopPropagation()}>
                <h3>{t.addressCartModalTitle}</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveCartAddress()
                  }}
                >
                  <PartnerSiteAddressFormFields value={addressForm} onChange={setAddressForm} t={t} idPrefix="cart" />
                  <div className="pw-shop-address-form-actions">
                    <button type="submit" className="pw-shop-btn pw-shop-btn-buy" disabled={addressSaving} data-pw-el={PW_EL.submit}>
                      {addressSaving ? '…' : t.addressSaveBook}
                    </button>
                    <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => setShowAddressModal(false)}>
                      {t.addressCancel}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      ) : null}
    </div>
  )
}

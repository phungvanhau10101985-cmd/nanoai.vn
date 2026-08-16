'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
  partnerSiteInfoPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  trackPartnerSiteBeginCheckout,
  trackPartnerSitePurchase,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import { PartnerSiteShopOrderConfirmation } from '@/components/partner-website/shop/partner-site-shop-order-confirmation'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  partnerSlug: string
  shopTitle?: string
  locale: WebLocale
  chatPath: string
}

type OrderSnapshot = {
  id?: string
  payment_qr_url?: string | null
  payment_reference?: string | null
  required_amount?: number | null
  payment_method?: 'cod' | 'bank_transfer' | 'ewallet' | null
  shipping_fee_amount?: number | null
}

export function PartnerSiteShopCartClient({ siteSlug, partnerSlug, shopTitle, locale, chatPath }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount, tracking } = usePartnerSiteShop()
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
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; name: string; discountAmount: number } | null>(null)
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
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'ewallet'>('bank_transfer')

  const loadCart = useCallback(async () => {
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json()) as { items?: SiteCartLine[] }
    setItems(Array.isArray(json.items) ? json.items : [])
  }, [authHeaders, captureFromResponse, partnerSlug])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    void loadCart().finally(() => setLoading(false))
  }, [loadCart, ready])

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
        }) => {
          setCheckoutLoginRequired(json.checkoutLoginRequired !== false)
          setShippingPolicy({
            feeAmount: Math.max(0, Math.round(json.shippingPolicy?.feeAmount ?? 0)),
            freeThresholdAmount:
              json.shippingPolicy?.freeThresholdAmount == null ? null : Math.max(0, Math.round(json.shippingPolicy.freeThresholdAmount)),
            carrierLabel: String(json.shippingPolicy?.carrierLabel ?? '').trim() || null,
          })
          setEwalletAvailable(json.ewalletAvailable === true)
        }
      )
      .catch(() => {
        setCheckoutLoginRequired(true)
      })
  }, [siteSlug])

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const unit = parseVndFromPriceHint(item.card.price_hint)
        return sum + unit * item.quantity
      }, 0),
    [items]
  )

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

  async function applyPromoCode() {
    const code = promoCodeInput.trim()
    if (!code || promoBusy) return
    setPromoBusy(true)
    setPromoMessage('')
    try {
      const cartLines = items
        .map((item) => ({
          inventoryId: item.card.inventory_id || '',
          lineSubtotal: parseVndFromPriceHint(item.card.price_hint) * item.quantity,
        }))
        .filter((l) => l.inventoryId)
      const res = await fetch(`/api/site/${encodeURIComponent(siteSlug)}/promotions/validate`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ code, cartLines }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        code?: string
        name?: string
        discountAmount?: number
      }
      if (!json.ok) {
        setAppliedPromo(null)
        setPromoMessage(promoErrorText(json.error ?? ''))
        return
      }
      setAppliedPromo({ code: json.code ?? code, name: json.name ?? '', discountAmount: json.discountAmount ?? 0 })
      setPromoMessage('')
    } finally {
      setPromoBusy(false)
    }
  }

  function removePromoCode() {
    setAppliedPromo(null)
    setPromoCodeInput('')
    setPromoMessage('')
  }

  const payableSubtotal = Math.max(0, subtotal - (appliedPromo?.discountAmount ?? 0))
  const shippingFeeEstimate = useMemo(() => {
    if (shippingPolicy.feeAmount <= 0) return 0
    if (shippingPolicy.freeThresholdAmount != null && payableSubtotal >= shippingPolicy.freeThresholdAmount) return 0
    return shippingPolicy.feeAmount
  }, [shippingPolicy, payableSubtotal])
  const orderTotal = payableSubtotal + shippingFeeEstimate

  async function saveItems(next: SiteCartLine[]) {
    setItems(next)
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ items: next }),
    })
    captureFromResponse(res)
    await refreshCartCount()
  }

  async function checkout() {
    if (items.length === 0 || checkoutBusy) return
    if (!orderName.trim() || !orderPhone.trim() || !orderAddress.trim()) {
      setStatus(`${t.checkoutName}, ${t.checkoutPhone}, ${t.checkoutAddress}`)
      return
    }
    setCheckoutBusy(true)
    setStatus('')
    setNeedsAuth(false)
    const checkoutLines = items.map((item) => ({
      itemId: item.card.inventory_id || item.id,
      itemName: item.card.name,
      value: parseVndFromPriceHint(item.card.price_hint),
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
          items: items.map((item) => ({
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
      if (json.order?.id) {
        trackPartnerSitePurchase(tracking, {
          transactionId: json.order.id,
          value: orderTotal,
          lines: checkoutLines,
          customerPhone: orderPhone.trim() || undefined,
        })
      }
      setItems([])
      await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/cart`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ items: [] }),
      })
      await refreshCartCount()
      // W3.2 — chuyển sang trang cảm ơn (giữ confirmation inline nếu không có mã đơn).
      if (json.order?.id && typeof window !== 'undefined') {
        const thankYou = partnerSiteInfoPath(siteSlug, 'thank-you', { customDomain })
        window.location.assign(`${thankYou}?order=${encodeURIComponent(json.order.id)}`)
        return
      }
      setCompletedOrder(json.order ?? null)
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (completedOrder) {
    return <PartnerSiteShopOrderConfirmation locale={locale} order={completedOrder} chatPath={chatPath} />
  }

  return (
    <div>
      <section className="pw-shop-cart-list" data-pw-region={PW_REGION.cartList}>
      <h1 data-pw-el={PW_EL.sectionTitle}>{t.cartTitle}</h1>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>
          {t.cartEmpty}{' '}
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })}>{t.backToShop}</Link>
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {items.map((item) => (
          <div key={item.id} className="pw-shop-cart-row" data-pw-el={PW_EL.line}>
            <img src={item.card.image_url} alt={item.card.name} data-pw-el={PW_EL.cardMedia} />
            <div>
              <strong data-pw-el={PW_EL.cardName}>{item.card.name}</strong>
              {item.card.price_hint ? <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>{item.card.price_hint}</p> : null}
              {item.color ? <p className="pw-shop-muted">{t.colorLabel}: {item.color}</p> : null}
              {item.size ? <p className="pw-shop-muted">{t.sizeLabel}: {item.size}</p> : null}
              <label style={{ display: 'grid', gap: 4, marginTop: 8, maxWidth: 80 }} data-pw-el={PW_EL.qty}>
                {t.quantity}
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={item.quantity}
                  onChange={(e) => {
                    const q = Math.max(1, Math.min(99, Number(e.target.value) || 1))
                    void saveItems(items.map((x) => (x.id === item.id ? { ...x, quantity: q } : x)))
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              data-pw-el={PW_EL.remove}
              onClick={() => void saveItems(items.filter((x) => x.id !== item.id))}
            >
              {t.cartRemove}
            </button>
          </div>
        ))}
      </div>
      </section>
      {items.length > 0 ? (
        <div className="pw-shop-cart-summary" data-pw-region={PW_REGION.cartSummary} style={{ marginTop: 24 }}>
          <p data-pw-el={PW_EL.price}>
            {t.cartSubtotal}: {formatVnd(subtotal)}
          </p>
          <div style={{ marginTop: 12 }} data-pw-el={PW_EL.coupon}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{t.cartPromoLabel}</label>
            {appliedPromo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="pw-shop-price">
                  {appliedPromo.code} — {t.cartPromoDiscountLabel} {formatVnd(appliedPromo.discountAmount)}
                </span>
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={removePromoCode}>
                  {t.cartPromoRemove}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  placeholder={t.cartPromoPlaceholder}
                  style={{ flex: '1 1 200px' }}
                />
                <button
                  type="button"
                  className="pw-shop-btn pw-shop-btn-outline"
                  disabled={promoBusy || !promoCodeInput.trim()}
                  onClick={() => void applyPromoCode()}
                >
                  {promoBusy ? t.cartPromoApplying : t.cartPromoApply}
                </button>
              </div>
            )}
            {promoMessage ? <p className="pw-shop-muted" style={{ marginTop: 6 }}>{promoMessage}</p> : null}
          </div>
          <p className="pw-shop-muted" style={{ marginTop: 8 }}>
            {shippingFeeEstimate > 0
              ? `${t.cartShippingFeeLabel}: ${formatVnd(shippingFeeEstimate)}`
              : shippingPolicy.feeAmount > 0
                ? t.cartShippingFeeFree
                : t.cartShippingFeeIncluded}
            {shippingPolicy.carrierLabel
              ? ` — ${t.shippingCarrierLabel}: ${shippingPolicy.carrierLabel}`
              : ''}
            {shippingPolicy.freeThresholdAmount != null && shippingFeeEstimate > 0
              ? ` — ${t.cartShippingFreeThresholdHint.replace('{amount}', formatVnd(shippingPolicy.freeThresholdAmount))}`
              : ''}
          </p>
          <p style={{ marginTop: 8, fontWeight: 700 }} data-pw-el={PW_EL.price}>
            {t.cartTotalLabel}: {formatVnd(orderTotal)}
          </p>
          {ewalletAvailable ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>{t.checkoutPaymentMethodLabel}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'bank_transfer'}
                    onChange={() => setPaymentMethod('bank_transfer')}
                  />
                  {t.checkoutPaymentMethodBank}
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="payment-method"
                    checked={paymentMethod === 'ewallet'}
                    onChange={() => setPaymentMethod('ewallet')}
                  />
                  {t.checkoutPaymentMethodEwallet}
                </label>
              </div>
              <p className="pw-shop-muted" style={{ marginTop: 4, fontSize: 12 }}>{t.checkoutPaymentMethodHint}</p>
            </div>
          ) : null}
          <div className="pw-shop-form" data-pw-region={PW_REGION.form} style={{ marginTop: 20 }}>
            {!checkoutLoginRequired ? (
              <p className="pw-shop-muted" style={{ marginBottom: 12 }}>
                {t.checkoutGuestHint}
              </p>
            ) : null}
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
            <label data-pw-el={PW_EL.label}>
              {t.checkoutNote}
              <textarea rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} data-pw-el={PW_EL.field} />
            </label>
            <button type="button" className="pw-shop-btn pw-shop-btn-buy" disabled={checkoutBusy} onClick={() => void checkout()} data-pw-el={PW_EL.checkout}>
              {checkoutBusy ? t.cartCheckingOut : t.cartCheckout}
            </button>
            {status && !needsAuth ? <p className="pw-shop-muted">{status}</p> : null}
          </div>
          {needsAuth && checkoutLoginRequired ? (
            <PartnerSiteShopAuthPanel
              partnerSlug={partnerSlug}
              siteSlug={siteSlug}
              shopTitle={shopTitle}
              locale={locale}
              onAuthed={() => {
                setNeedsAuth(false)
                void checkout()
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

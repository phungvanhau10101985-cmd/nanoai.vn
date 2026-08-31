'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PartnerSiteOrderGoogleCustomerReviews } from '@/components/partner-website/shop/partner-site-order-google-customer-reviews'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import {
  markGoogleCustomerReviewsForOrder,
} from '@/lib/partner-website/shop/google-customer-reviews'
import {
  isPartnerShopDepositWaiting,
  partnerOrderPayableTotal,
  partnerOrderRemainingAfterDeposit,
  shouldShowDepositSuccessPage,
} from '@/lib/partner-website/shop/order-deposit'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteOrderDetailPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { trackPartnerSitePurchase } from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'

type DepositOrder = {
  id: string
  status: string
  payment_reference?: string | null
  customer_email?: string | null
  created_at?: string | null
  required_amount?: number | null
  paid_amount?: number | null
  amount_after_discount?: number | null
  subtotal_amount?: number | null
  shipping_fee_amount?: number | null
  deposit_percent?: number | null
  payment_qr_url?: string | null
  payment_method?: string | null
  product_name?: string | null
}

type PaymentDisplay =
  | { kind: 'bank'; bank_name: string; account_number: string; account_holder: string }
  | { kind: 'ewallet'; provider_label: string; account_name: string; account_number: string; qr_url: string }
  | null

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  orderId: string
  shopTitle: string
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])
  return (
    <button
      type="button"
      className="pw-shop-btn pw-shop-btn-buy pw-shop-btn-sm"
      onClick={() => {
        const v = text.trim()
        if (!v) return
        void navigator.clipboard?.writeText(v).then(() => setCopied(true)).catch(() => {})
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}

export function PartnerSiteShopDepositClient({
  siteSlug,
  partnerSlug,
  locale,
  orderId,
  shopTitle,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { tracking } = usePartnerSiteShop()
  const [order, setOrder] = useState<DepositOrder | null>(null)
  const [paymentDisplay, setPaymentDisplay] = useState<PaymentDisplay>(null)
  const [merchantId, setMerchantId] = useState<number | null>(null)
  const [shopPercent, setShopPercent] = useState(30)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [toast, setToast] = useState('')
  const prevStatusRef = useRef<string | null>(null)

  const orderApi = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(orderId)}`

  const load = useCallback(async () => {
    const res = await fetch(orderApi, { credentials: 'same-origin', headers: authHeaders() })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as {
      order?: DepositOrder
      payment_display?: PaymentDisplay
      default_deposit_percent?: number
      google_customer_reviews_merchant_id?: number | null
    }
    if (!res.ok || !json.order) {
      setOrder(null)
      return
    }
    setOrder(json.order)
    setPaymentDisplay(json.payment_display ?? null)
    if (typeof json.default_deposit_percent === 'number' && json.default_deposit_percent > 0) {
      setShopPercent(Math.max(1, Math.min(99, Math.round(json.default_deposit_percent))))
    }
    const mid = Number(json.google_customer_reviews_merchant_id ?? 0)
    setMerchantId(Number.isInteger(mid) && mid > 0 ? mid : null)
  }, [authHeaders, captureFromResponse, orderApi])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load, ready])

  useEffect(() => {
    if (!order || !isPartnerShopDepositWaiting(order)) return
    const iv = window.setInterval(() => {
      void load()
    }, 4000)
    return () => window.clearInterval(iv)
  }, [load, order])

  useEffect(() => {
    if (!order) return
    const prev = prevStatusRef.current
    const nowDone = shouldShowDepositSuccessPage(order)
    const wasWaiting = prev === 'awaiting_payment' || prev === 'waiting_deposit' || prev === 'payment_checking'
    const landedPaid = nowDone && (prev === null || prev === '')
    if (nowDone && (wasWaiting || landedPaid)) {
      markGoogleCustomerReviewsForOrder(order.id)
    }
    if (wasWaiting && nowDone) {
      setToast(t.depositToastBody)
      const key = `pw_purchase_tracked_order_${order.id}`
      let tracked = false
      try {
        tracked = window.localStorage.getItem(key) === '1'
      } catch {
        /* private */
      }
      if (!tracked) {
        try {
          window.localStorage.setItem(key, '1')
        } catch {
          /* ignore */
        }
        const value = partnerOrderPayableTotal({
          amount_after_discount: order.amount_after_discount ?? order.subtotal_amount,
          shipping_fee_amount: order.shipping_fee_amount,
        })
        trackPartnerSitePurchase(tracking, {
          transactionId: order.id,
          value,
          lines: [
            {
              itemId: order.id,
              itemName: order.product_name || shopTitle,
              value,
              quantity: 1,
            },
          ],
        })
      }
    }
    prevStatusRef.current = order.status
  }, [order, shopTitle, t.depositToastBody, tracking])

  const depositOption = useMemo(() => {
    const p = Math.round(Number(order?.deposit_percent ?? shopPercent))
    return p >= 100 ? 100 : shopPercent
  }, [order?.deposit_percent, shopPercent])

  async function setDepositPercent(next: number) {
    if (!order || updating || next === depositOption) return
    setUpdating(true)
    try {
      const res = await fetch(orderApi, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ action: 'set_deposit_percent', percent: next }),
      })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        order?: DepositOrder
        payment_display?: PaymentDisplay
      }
      if (res.ok && json.order) {
        setOrder(json.order)
        if (json.payment_display !== undefined) setPaymentDisplay(json.payment_display)
      }
    } finally {
      setUpdating(false)
    }
  }

  const ordersHref = partnerSiteOrdersPath(siteSlug, { customDomain })
  const detailHref = partnerSiteOrderDetailPath(siteSlug, orderId, { customDomain })

  if (loading) {
    return (
      <div className="pw-shop-deposit-center">
        <p className="pw-shop-muted">{t.depositLoading}</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="pw-shop-deposit-center">
        <p>{t.depositNotFound}</p>
        <Link href={ordersHref} className="pw-shop-btn">
          {t.depositBackToOrders}
        </Link>
      </div>
    )
  }

  const required = Math.max(0, Math.round(Number(order.required_amount ?? 0)))
  if (required <= 0) {
    return (
      <div className="pw-shop-deposit-center">
        <p>{t.depositNotRequired}</p>
        <Link href={detailHref} className="pw-shop-btn">
          {t.depositViewOrder}
        </Link>
      </div>
    )
  }

  const code = (order.payment_reference || order.id).trim()
  const payable = partnerOrderPayableTotal({
    amount_after_discount: order.amount_after_discount ?? order.subtotal_amount,
    shipping_fee_amount: order.shipping_fee_amount,
  })
  const remaining = partnerOrderRemainingAfterDeposit({
    amount_after_discount: order.amount_after_discount ?? order.subtotal_amount,
    shipping_fee_amount: order.shipping_fee_amount,
    required_amount: order.required_amount,
    paid_amount: order.paid_amount,
  })
  const qr =
    paymentDisplay?.kind === 'ewallet'
      ? paymentDisplay.qr_url
      : String(order.payment_qr_url ?? '').trim()
  const bank = paymentDisplay?.kind === 'bank' ? paymentDisplay : null

  if (shouldShowDepositSuccessPage(order)) {
    const paid = Math.max(Number(order.paid_amount ?? 0), required)
    return (
      <div>
        {toast ? (
          <div className="pw-shop-deposit-toast" role="status">
            <strong>{t.depositToastTitle}</strong>
            <p style={{ margin: '4px 0 0' }}>{toast}</p>
          </div>
        ) : null}
        <PartnerSiteOrderGoogleCustomerReviews
          merchantId={merchantId}
          locale={locale}
          order={{
            id: order.id,
            order_code: code,
            customer_email: order.customer_email,
            created_at: order.created_at,
            status: order.status,
            required_amount: order.required_amount,
            paid_amount: order.paid_amount,
          }}
          showAfterDepositSuccess
        />
        <div className="pw-shop-deposit">
          <div className="pw-shop-deposit-success-head">
            <span className="mark" aria-hidden>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <div>
              <h1>{t.depositSuccessTitle}</h1>
              <p>{t.depositSuccessLead}</p>
            </div>
          </div>
          <div className="pw-shop-deposit-success-body">
            <div className="pw-shop-deposit-success-card">
              <p>
                <strong>
                  {t.depositPageCode.replace('{code}', code)}
                </strong>
              </p>
              <p>
                {t.orderStatusLabel}: <strong>{t.depositStatusPaid}</strong>
              </p>
              <p>
                {t.depositPaidLabel}: <strong>{formatVnd(paid)}</strong>
              </p>
              {remaining > 0 ? (
                <p className="pw-shop-muted">{t.depositRemainingHint.replace('{amount}', formatVnd(remaining))}</p>
              ) : null}
            </div>
            <p className="pw-shop-muted">{t.depositSuccessThanks}</p>
            {merchantId ? (
              <div className="pw-shop-deposit-gcr">
                <p style={{ fontWeight: 700, margin: 0 }}>{t.gcrOptInTitle}</p>
                <p className="pw-shop-muted" style={{ margin: '6px 0 0' }}>
                  {t.gcrOptInHint}
                </p>
              </div>
            ) : null}
            <div className="pw-shop-deposit-actions">
              <Link href={detailHref} className="pw-shop-btn pw-shop-btn-buy">
                {t.depositViewOrder}
              </Link>
              <Link href={ordersHref} className="pw-shop-btn pw-shop-btn-outline">
                {t.depositBackToOrders}
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!isPartnerShopDepositWaiting(order)) {
    return (
      <div className="pw-shop-deposit-center">
        <p>{t.depositWrongStatus}</p>
        <Link href={detailHref} className="pw-shop-btn">
          {t.depositViewOrder}
        </Link>
      </div>
    )
  }

  return (
    <div className="pw-shop-deposit">
      <div className="pw-shop-deposit-head">
        <h1>{t.depositPageTitle}</h1>
        <p>{t.depositPageCode.replace('{code}', code)}</p>
      </div>
      <div className="pw-shop-deposit-money">
        <div>
          <p className="k">{t.depositTotalLabel}</p>
          <p className="v">{formatVnd(payable)}</p>
        </div>
        <div className="need">
          <p className="k">{t.depositNeedLabel}</p>
          <p className="v">{formatVnd(required)}</p>
          <p className="pw-shop-muted" style={{ margin: 0, fontSize: 11 }}>
            {t.depositNeedHint}
          </p>
        </div>
        <div>
          <p className="k">{t.depositOnDeliveryLabel}</p>
          <p className="v">{formatVnd(remaining)}</p>
          <p className="pw-shop-muted" style={{ margin: 0, fontSize: 11 }}>
            {t.depositOnDeliveryHint}
          </p>
        </div>
      </div>
      <div className="pw-shop-deposit-body">
        <div className="pw-shop-deposit-col">
          {order.payment_method !== 'ewallet' ? (
            <div className="pw-shop-deposit-box">
              <p className="lbl">{t.depositChooseLevel}</p>
              <div className="pw-shop-deposit-opts">
                <label>
                  <input
                    type="radio"
                    name="deposit_option"
                    checked={depositOption !== 100}
                    disabled={updating}
                    onChange={() => void setDepositPercent(shopPercent)}
                  />
                  {t.depositPercentOption.replace('{percent}', String(shopPercent))}
                </label>
                <label>
                  <input
                    type="radio"
                    name="deposit_option"
                    checked={depositOption === 100}
                    disabled={updating}
                    onChange={() => void setDepositPercent(100)}
                  />
                  {t.depositFullOption}
                </label>
              </div>
              {updating ? <p className="pw-shop-muted">{t.depositUpdating}</p> : null}
            </div>
          ) : null}
          <div className="pw-shop-deposit-box">
            <p className="lbl">{t.depositBankLabel}</p>
            {bank ? (
              <p className="pw-shop-deposit-sepay">
                {bank.bank_name} · {bank.account_number}
              </p>
            ) : paymentDisplay?.kind === 'ewallet' && paymentDisplay.account_number ? (
              <p className="pw-shop-deposit-sepay">
                {paymentDisplay.provider_label} · {paymentDisplay.account_number}
              </p>
            ) : null}
            <p className="pw-shop-deposit-instruct">{t.depositQrHint}</p>
            {bank ? (
              <div style={{ marginTop: 10 }}>
                <div className="pw-shop-deposit-row">
                  <span className="k">{t.depositBankLabel}</span>
                  <span className="v">{bank.bank_name}</span>
                </div>
                <div className="pw-shop-deposit-row">
                  <span className="k">{t.depositAccountLabel}</span>
                  <span className="v">{bank.account_number}</span>
                </div>
                <div className="pw-shop-deposit-row">
                  <span className="k">{t.depositHolderLabel}</span>
                  <span className="v">{bank.account_holder}</span>
                </div>
                <div style={{ marginTop: 8 }}>
                  <CopyButton text={bank.account_number} label={t.depositCopyAccount} copiedLabel={t.depositCopied} />
                </div>
              </div>
            ) : paymentDisplay?.kind === 'ewallet' ? (
              <div style={{ marginTop: 10 }}>
                <div className="pw-shop-deposit-row">
                  <span className="k">{t.checkoutPaymentMethodEwallet}</span>
                  <span className="v">{paymentDisplay.provider_label}</span>
                </div>
                {paymentDisplay.account_number ? (
                  <div className="pw-shop-deposit-row">
                    <span className="k">{t.depositAccountLabel}</span>
                    <span className="v">{paymentDisplay.account_number}</span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
          {code ? (
            <div className="pw-shop-deposit-box">
              <p className="lbl">{t.depositTransferContent}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className="pw-shop-deposit-memo">{code}</span>
                <CopyButton text={code} label={t.depositCopyContent} copiedLabel={t.depositCopied} />
              </div>
              <p className="pw-shop-deposit-hint" style={{ marginTop: 8 }}>
                {t.depositTransferHint}
              </p>
            </div>
          ) : null}
        </div>
        <div className="pw-shop-deposit-col">
          <div className="pw-shop-deposit-box pw-shop-deposit-qr">
            <p className="lbl">{t.depositQrTitle}</p>
            {qr ? <img src={qr} alt="QR" /> : null}
            {qr ? (
              <a href={qr} download={`qr-${code}.png`} className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-sm" target="_blank" rel="noreferrer">
                {t.depositDownloadQr}
              </a>
            ) : null}
            <p className="pw-shop-deposit-hint">{t.depositPollingHint}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

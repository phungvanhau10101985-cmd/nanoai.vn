'use client'

import Link from 'next/link'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { PartnerSiteOrderGoogleCustomerReviews } from '@/components/partner-website/shop/partner-site-order-google-customer-reviews'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import {
  markGoogleCustomerReviewsForOrder,
} from '@/lib/partner-website/shop/google-customer-reviews'
import {
  detectInAppBrowser,
  getInAppBrowserShortName,
  isLikelyMobile,
  type InAppBrowserKind,
} from '@/lib/partner-website/shop/in-app-browser'
import { depositQrDownloadFilename } from '@/lib/messaging/deposit-qr-image'
import {
  isPartnerShopDepositWaiting,
  partnerOrderPayableTotal,
  partnerOrderRemainingAfterDeposit,
  shouldShowDepositSuccessPage,
} from '@/lib/partner-website/shop/order-deposit'
import {
  readPartnerSiteCheckoutHandoff,
  clearPartnerSiteCheckoutHandoff,
  type PartnerSiteDepositPaymentDisplay,
} from '@/lib/partner-website/shop/partner-site-checkout-handoff'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { saveImageBlob, trySaveFilePicker, trySyncBlobDownload } from '@/lib/partner-website/shop/save-image-blob'
import { isSepayStyleOrderPayment } from '@/lib/messaging/sepay-order-ui'
import {
  bankTransferMemoFromPaymentReference,
  displayShopOrderCode,
} from '@/lib/messaging/shop-payment-reference'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteOrderDetailPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { trackPartnerSitePurchase } from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import {
  PartnerOrderDiscountBreakdown,
  type PartnerOrderDiscountFields,
} from '@/components/partner-website/shop/partner-order-discount-breakdown'
import {
  PartnerSiteOrderEmsTracking,
  PartnerSiteOrderShipmentSteps,
  PartnerSiteOrderSplitGroup,
  genericShippingTimelineSteps,
  type ShopShipmentEventView,
  type ShopSiblingOrderView,
} from '@/components/partner-website/shop/partner-site-order-fulfillment-bits'

type DepositOrder = PartnerOrderDiscountFields & {
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
  promo_code?: string | null
  loyalty_tier_name?: string | null
  fulfillment_source?: 'vietnam' | 'china' | null
  source_platform?: string | null
  tracking_number?: string | null
  shipping_status?: string | null
}

type PaymentDisplay = PartnerSiteDepositPaymentDisplay | null

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
  const [toastKind, setToastKind] = useState<'info' | 'pay'>('info')
  const [siblings, setSiblings] = useState<ShopSiblingOrderView[]>([])
  const [shipmentEvents, setShipmentEvents] = useState<ShopShipmentEventView[]>([])
  const prevStatusRef = useRef<string | null>(null)
  const qrBlobRef = useRef<Blob | null>(null)
  const [qrBlobReady, setQrBlobReady] = useState(false)
  const [qrDownloading, setQrDownloading] = useState(false)
  const [qrSavePreviewUrl, setQrSavePreviewUrl] = useState<string | null>(null)
  const [inAppKind, setInAppKind] = useState<InAppBrowserKind | null>(null)

  const orderApi = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(orderId)}`

  const load = useCallback(async (opts?: { poll?: boolean }) => {
    const url = opts?.poll ? `${orderApi}?poll=1` : orderApi
    const ctrl = new AbortController()
    const timer = window.setTimeout(() => ctrl.abort(), 8000)
    try {
      const res = await fetch(url, { credentials: 'same-origin', headers: authHeaders(), signal: ctrl.signal })
      captureFromResponse(res)
      const json = (await res.json().catch(() => ({}))) as {
        order?: DepositOrder
        payment_display?: PaymentDisplay
        default_deposit_percent?: number
        google_customer_reviews_merchant_id?: number | null
        sibling_orders?: ShopSiblingOrderView[]
        shipment_events?: ShopShipmentEventView[]
      }
      if (!res.ok || !json.order) {
        return
      }
      setOrder(json.order)
      if (!opts?.poll) {
        clearPartnerSiteCheckoutHandoff(siteSlug)
        setSiblings(Array.isArray(json.sibling_orders) ? json.sibling_orders : [])
        setShipmentEvents(Array.isArray(json.shipment_events) ? json.shipment_events : [])
        setPaymentDisplay(json.payment_display ?? null)
        if (typeof json.default_deposit_percent === 'number' && json.default_deposit_percent > 0) {
          setShopPercent(Math.max(1, Math.min(99, Math.round(json.default_deposit_percent))))
        }
        const mid = Number(json.google_customer_reviews_merchant_id ?? 0)
        setMerchantId(Number.isInteger(mid) && mid > 0 ? mid : null)
      }
    } catch {
      /* aborted / network */
    } finally {
      window.clearTimeout(timer)
    }
  }, [authHeaders, captureFromResponse, orderApi, siteSlug])

  useLayoutEffect(() => {
    const handoff = readPartnerSiteCheckoutHandoff(siteSlug, orderId)
    if (!handoff?.order) return
    setOrder(handoff.order as DepositOrder)
    setPaymentDisplay(handoff.payment_display ?? null)
    if (typeof handoff.default_deposit_percent === 'number' && handoff.default_deposit_percent > 0) {
      setShopPercent(Math.max(1, Math.min(99, Math.round(handoff.default_deposit_percent))))
    }
    setLoading(false)
  }, [orderId, siteSlug])

  useEffect(() => {
    setInAppKind(detectInAppBrowser())
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = () => {
      if (cancelled) return
      void load().finally(() => {
        if (!cancelled) setLoading(false)
      })
    }
    if (ready) {
      run()
      return () => {
        cancelled = true
      }
    }
    const t = window.setTimeout(run, 1200)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [load, ready])

  useEffect(() => {
    if (!order || !isPartnerShopDepositWaiting(order)) return
    const iv = window.setInterval(() => {
      void load({ poll: true })
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
      setToastKind('pay')
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

  useEffect(() => {
    if (!toast || toastKind === 'pay') return
    const tmr = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(tmr)
  }, [toast, toastKind])

  const depositOption = useMemo(() => {
    const p = Math.round(Number(order?.deposit_percent ?? shopPercent))
    return p >= 100 ? 100 : shopPercent
  }, [order?.deposit_percent, shopPercent])

  const displayQr = useMemo(() => {
    if (paymentDisplay?.kind === 'ewallet') return String(paymentDisplay.qr_url ?? '').trim()
    return String(order?.payment_qr_url ?? '').trim()
  }, [order?.payment_qr_url, paymentDisplay])
  const waitingDeposit = Boolean(order && isPartnerShopDepositWaiting(order))
  const depositOrderId = order?.id ?? ''

  useEffect(() => {
    qrBlobRef.current = null
    setQrBlobReady(false)
    if (!waitingDeposit || !displayQr || !depositOrderId) return
    let cancelled = false
    const qrApi = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(depositOrderId)}/deposit-qr-image`
    fetch(qrApi, { credentials: 'same-origin', headers: authHeaders() })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('qr'))))
      .then((blob) => {
        if (!cancelled) {
          qrBlobRef.current = blob
          setQrBlobReady(true)
        }
      })
      .catch(() => {
        if (cancelled) return
        fetch(displayQr, { mode: 'cors' })
          .then((res) => (res.ok ? res.blob() : null))
          .then((blob) => {
            if (!cancelled && blob) qrBlobRef.current = blob
          })
          .catch(() => {})
          .finally(() => {
            if (!cancelled) setQrBlobReady(true)
          })
      })
    return () => {
      cancelled = true
    }
  }, [authHeaders, depositOrderId, displayQr, partnerSlug, waitingDeposit])

  useEffect(() => {
    return () => {
      if (qrSavePreviewUrl) URL.revokeObjectURL(qrSavePreviewUrl)
    }
  }, [qrSavePreviewUrl])

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

  function closeQrSavePreview() {
    setQrSavePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }

  async function handleDownloadQr() {
    if (!order || !displayQr) return
    setQrDownloading(true)
    const filename = depositQrDownloadFilename(displayShopOrderCode(order.payment_reference || '') || order.id)
    try {
      let blob = qrBlobRef.current
      if (!blob) {
        const qrApi = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(order.id)}/deposit-qr-image`
        const res = await fetch(qrApi, { credentials: 'same-origin', headers: authHeaders() })
        blob = res.ok ? await res.blob() : null
        if (!blob) {
          const fallback = await fetch(displayQr, { mode: 'cors' })
          if (!fallback.ok) throw new Error('no_qr')
          blob = await fallback.blob()
        }
        qrBlobRef.current = blob
        setQrBlobReady(true)
      }

      if (!isLikelyMobile() && !inAppKind) {
        try {
          if (await trySaveFilePicker(blob, filename)) {
            setToastKind('info')
            setToast(t.depositQrSaved)
            return
          }
        } catch (e) {
          if ((e as Error)?.name === 'AbortError') return
        }
      }

      if (trySyncBlobDownload(blob, filename)) {
        setToastKind('info')
        setToast(t.depositQrSaved)
        return
      }

      const result = await saveImageBlob(blob, filename, {
        shareTitle: t.depositQrTitle,
        preferShareOnMobile: true,
      })
      if (result === 'download') {
        setToastKind('info')
        setToast(t.depositQrSaved)
        return
      }
      if (result === 'share') {
        setToastKind('info')
        setToast(t.depositQrSaveShareHint)
        return
      }

      const url = URL.createObjectURL(blob)
      setQrSavePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      setToastKind('info')
      setToast(inAppKind ? t.depositQrSaveInAppHint : t.depositQrSaveManualHint)
    } catch {
      setToastKind('info')
      setToast(t.depositQrSaveFailed)
    } finally {
      setQrDownloading(false)
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

  const rawRef = (order.payment_reference || '').trim()
  const code = displayShopOrderCode(rawRef) || order.id.trim()
  const isSepay = isSepayStyleOrderPayment({
    payment_qr_url: order.payment_qr_url,
    payment_reference: rawRef,
  })
  const transferMemo = bankTransferMemoFromPaymentReference(rawRef, isSepay) || code
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
            {toastKind === 'pay' ? <strong>{t.depositToastTitle}</strong> : null}
            <p style={{ margin: toastKind === 'pay' ? '4px 0 0' : 0 }}>{toast}</p>
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
              <PartnerSiteOrderSplitGroup
                t={t}
                siteSlug={siteSlug}
                customDomain={customDomain}
                currentId={order.id}
                siblings={siblings}
              />
              <PartnerSiteOrderEmsTracking t={t} trackingNumber={order.tracking_number} />
              <p>
                {t.orderStatusLabel}: <strong>{t.depositStatusPaid}</strong>
              </p>
              <p>
                {t.depositPaidLabel}: <strong>{formatVnd(paid)}</strong>
              </p>
              {remaining > 0 ? (
                <p className="pw-shop-muted">{t.depositRemainingHint.replace('{amount}', formatVnd(remaining))}</p>
              ) : null}
              <div style={{ marginTop: 16 }}>
                <PartnerSiteOrderShipmentSteps
                  t={t}
                  events={shipmentEvents}
                  fallback={genericShippingTimelineSteps(order.shipping_status, t)}
                />
              </div>
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
    <>
    <div className="pw-shop-deposit">
      {toast ? (
        <div className="pw-shop-deposit-toast" role="status">
          <p style={{ margin: 0 }}>{toast}</p>
        </div>
      ) : null}
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
          <p className="pw-shop-deposit-money-hint">{t.depositNeedHint}</p>
        </div>
        <div>
          <p className="k">{t.depositOnDeliveryLabel}</p>
          <p className="v">{formatVnd(remaining)}</p>
          <p className="pw-shop-deposit-money-hint">{t.depositOnDeliveryHint}</p>
        </div>
        {order.payment_method !== 'ewallet' ? (
          <div className="pw-shop-deposit-level">
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
      </div>
      <div className="pw-shop-deposit-body">
        <div className="pw-shop-deposit-pay">
          <div className="pw-shop-deposit-box pw-shop-deposit-qr">
            <p className="lbl">{t.depositQrTitle}</p>
            {required > 0 ? (
              <p className="pw-shop-deposit-qr-need">
                {t.depositNeedLabel}: {formatVnd(required)}
              </p>
            ) : null}
            {qr ? <img src={qr} alt="QR" /> : null}
            {qr ? (
              <button
                type="button"
                className="pw-shop-btn pw-shop-btn-outline pw-shop-btn-sm pw-shop-deposit-qr-dl"
                onClick={() => void handleDownloadQr()}
                disabled={qrDownloading || !qrBlobReady}
              >
                {qrDownloading ? (
                  <>
                    <span className="pw-shop-deposit-spin" aria-hidden />
                    {t.depositDownloadQrBusy}
                  </>
                ) : !qrBlobReady ? (
                  <>
                    <span className="pw-shop-deposit-spin" aria-hidden />
                    {t.depositDownloadQrPreparing}
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {inAppKind ? t.depositSaveQr : t.depositDownloadQr}
                  </>
                )}
              </button>
            ) : null}
            <p className="pw-shop-deposit-hint">
              {t.depositPollingHint}
              {inAppKind ? ` ${t.depositQrInAppHoldHint.replace('{app}', getInAppBrowserShortName(inAppKind))}` : ''}
            </p>
          </div>
        </div>
        <div className="pw-shop-deposit-info">
          <div className="pw-shop-deposit-box">
            <p className="lbl">{t.depositBankLabel}</p>
            <p className="pw-shop-deposit-instruct">{t.depositQrHint}</p>
            {bank ? (
              <div className="pw-shop-deposit-transfer">
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
                <div className="pw-shop-deposit-copy">
                  <CopyButton text={bank.account_number} label={t.depositCopyAccount} copiedLabel={t.depositCopied} />
                </div>
              </div>
            ) : paymentDisplay?.kind === 'ewallet' ? (
              <div className="pw-shop-deposit-transfer">
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
          {transferMemo ? (
            <div className="pw-shop-deposit-box">
              <p className="lbl">{t.depositTransferContent}</p>
              <div className="pw-shop-deposit-memo-row">
                <span className="pw-shop-deposit-memo">{transferMemo}</span>
                <div className="pw-shop-deposit-copy">
                  <CopyButton text={transferMemo} label={t.depositCopyContent} copiedLabel={t.depositCopied} />
                </div>
              </div>
              <p className="pw-shop-deposit-hint" style={{ marginTop: 8 }}>
                {t.depositTransferHint}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="pw-shop-deposit-extra">
        <PartnerOrderDiscountBreakdown locale={locale} order={order} />
        <PartnerSiteOrderSplitGroup
          t={t}
          siteSlug={siteSlug}
          customDomain={customDomain}
          currentId={order.id}
          siblings={siblings}
        />
        <PartnerSiteOrderEmsTracking t={t} trackingNumber={order.tracking_number} />
        {shipmentEvents.length > 0 ? (
          <PartnerSiteOrderShipmentSteps t={t} events={shipmentEvents} fallback={[]} />
        ) : null}
      </div>
    </div>
    {qrSavePreviewUrl ? (
      <div
        className="pw-shop-deposit-qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pw-qr-save-title"
        onClick={closeQrSavePreview}
      >
        <div className="pw-shop-deposit-qr-modal-card" onClick={(e) => e.stopPropagation()}>
          <h2 id="pw-qr-save-title">{t.depositQrSaveTitle}</h2>
          <p>{inAppKind ? t.depositQrSaveInAppHint : t.depositQrSaveManualHint}</p>
          <div className="pw-shop-deposit-qr-modal-img">
            <img src={qrSavePreviewUrl} alt="QR" draggable={false} />
          </div>
          <button
            type="button"
            className="pw-shop-btn pw-shop-btn-buy"
            onClick={() => {
              const blob = qrBlobRef.current
              if (!blob) return
              const filename = depositQrDownloadFilename(code)
              if (trySyncBlobDownload(blob, filename)) {
                setToastKind('info')
                setToast(t.depositQrSaved)
                closeQrSavePreview()
                return
              }
              void saveImageBlob(blob, filename, {
                shareTitle: t.depositQrTitle,
                preferShareOnMobile: true,
              }).then((result) => {
                if (result === 'download') {
                  setToastKind('info')
                  setToast(t.depositQrSaved)
                  closeQrSavePreview()
                } else if (result === 'share') {
                  setToastKind('info')
                  setToast(t.depositQrSaveShareHint)
                }
              })
            }}
          >
            {t.depositQrSaveDownloadFile}
          </button>
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={closeQrSavePreview}>
            {t.depositQrSaveClose}
          </button>
        </div>
      </div>
    ) : null}
    </>
  )
}

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { PartnerSiteOrderGoogleCustomerReviews } from '@/components/partner-website/shop/partner-site-order-google-customer-reviews'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import { markGoogleCustomerReviewsForOrder } from '@/lib/partner-website/shop/google-customer-reviews'
import {
  isPartnerShopDepositWaiting,
  partnerOrderPayableTotal,
  shouldRedirectToDepositAfterCreate,
} from '@/lib/partner-website/shop/order-deposit'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import {
  partnerSiteOrderDepositPath,
  partnerSiteOrdersPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { formatPartnerSiteOrderStatus } from '@/lib/partner-website/shop/partner-site-order-labels'
import {
  PartnerOrderDiscountBreakdown,
  type PartnerOrderDiscountFields,
} from '@/components/partner-website/shop/partner-order-discount-breakdown'

type DetailOrder = PartnerOrderDiscountFields & {
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
  shipping_address?: string | null
  product_name?: string | null
  promo_code?: string | null
  loyalty_tier_name?: string | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  orderId: string
}

export function PartnerSiteShopOrderDetailClient({ siteSlug, partnerSlug, locale, orderId }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [order, setOrder] = useState<DetailOrder | null>(null)
  const [merchantId, setMerchantId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  const orderApi = `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(orderId)}`

  const load = useCallback(async () => {
    const res = await fetch(orderApi, { credentials: 'same-origin', headers: authHeaders() })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as {
      order?: DetailOrder
      google_customer_reviews_merchant_id?: number | null
    }
    if (!res.ok || !json.order) {
      setOrder(null)
      return
    }
    setOrder(json.order)
    const mid = Number(json.google_customer_reviews_merchant_id ?? 0)
    setMerchantId(Number.isInteger(mid) && mid > 0 ? mid : null)
  }, [authHeaders, captureFromResponse, orderApi])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load, ready])

  useEffect(() => {
    if (!order?.id) return
    if (shouldRedirectToDepositAfterCreate(order) || isPartnerShopDepositWaiting(order)) {
      window.location.replace(partnerSiteOrderDepositPath(siteSlug, order.id, { customDomain }))
      return
    }
    if (Number(order.required_amount ?? 0) <= 0) {
      markGoogleCustomerReviewsForOrder(order.id)
    }
  }, [customDomain, order, siteSlug])

  const ordersHref = partnerSiteOrdersPath(siteSlug, { customDomain })

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

  if (shouldRedirectToDepositAfterCreate(order) || isPartnerShopDepositWaiting(order)) {
    return (
      <div className="pw-shop-deposit-center">
        <p className="pw-shop-muted">{t.depositLoading}</p>
      </div>
    )
  }

  const code = (order.payment_reference || order.id).trim()
  const payable = partnerOrderPayableTotal({
    amount_after_discount: order.amount_after_discount ?? order.subtotal_amount,
    shipping_fee_amount: order.shipping_fee_amount,
  })
  const ship = Math.max(0, Math.round(Number(order.shipping_fee_amount ?? 0)))
  const isCod = Number(order.required_amount ?? 0) <= 0

  return (
    <div>
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
      />
      <div className="pw-shop-deposit">
        <div className="pw-shop-deposit-success-head">
          <span className="mark" aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <div>
            <h1>{t.orderConfirmTitle}</h1>
            <p>{t.orderConfirmLead}</p>
          </div>
        </div>
        <div className="pw-shop-deposit-success-body">
          <div className="pw-shop-deposit-success-card">
            <p>
              <strong>{t.depositPageCode.replace('{code}', code)}</strong>
            </p>
            {order.product_name ? <p>{order.product_name}</p> : null}
            <p>
              {t.orderStatusLabel}: <strong>{formatPartnerSiteOrderStatus(locale, order.status)}</strong>
            </p>
            {ship > 0 ? (
              <p>
                {t.cartShippingFeeLabel}: {formatVnd(ship)}
              </p>
            ) : null}
            <PartnerOrderDiscountBreakdown locale={locale} order={order} />
            <p>
              {t.cartTotalLabel}: <strong>{formatVnd(payable)}</strong>
            </p>
            {order.shipping_address ? (
              <p>
                {t.orderAddressLabel}: {order.shipping_address}
              </p>
            ) : null}
            {isCod ? <p className="pw-shop-muted">{t.orderConfirmCodNote}</p> : null}
          </div>
          {merchantId ? (
            <div className="pw-shop-deposit-gcr">
              <p style={{ fontWeight: 700, margin: 0 }}>{t.gcrOptInTitle}</p>
              <p className="pw-shop-muted" style={{ margin: '6px 0 0' }}>
                {t.gcrOptInHint}
              </p>
            </div>
          ) : null}
          <div className="pw-shop-deposit-actions">
            <Link href={ordersHref} className="pw-shop-btn pw-shop-btn-buy">
              {t.depositBackToOrders}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  formatPartnerSiteOrderDate,
  formatPartnerSiteOrderStatus,
  formatPartnerSiteShippingStatus,
} from '@/lib/partner-website/shop/partner-site-order-labels'

type OrderRow = {
  id: string
  status?: string | null
  shipping_status?: string | null
  product_name?: string | null
  product_image_url?: string | null
  required_amount?: number | null
  subtotal_amount?: number | null
  quantity?: number | null
  payment_qr_url?: string | null
  payment_reference?: string | null
  shipping_address?: string | null
  created_at?: string | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  chatPath: string
}

export function PartnerSiteShopOrdersClient({ siteSlug, partnerSlug, locale, chatPath }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready) return
    void (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/orders`, {
          credentials: 'same-origin',
          headers: authHeaders(),
        })
        captureFromResponse(res)
        const json = (await res.json()) as { orders?: OrderRow[] }
        setOrders(Array.isArray(json.orders) ? json.orders : [])
      } finally {
        setLoading(false)
      }
    })()
  }, [authHeaders, captureFromResponse, partnerSlug, ready])

  return (
    <div>
      <h1>{t.ordersTitle}</h1>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && orders.length === 0 ? <p className="pw-shop-muted">{t.ordersEmpty}</p> : null}
      <ul className="pw-shop-orders-list">
        {orders.map((o) => {
          const expanded = expandedId === o.id
          const qr = o.payment_qr_url?.trim() ?? ''
          const ref = o.payment_reference?.trim() ?? ''
          const showPayment = Boolean(qr || ref || (o.required_amount != null && o.required_amount > 0))
          return (
            <li key={o.id} className="pw-shop-order-card">
              <div className="pw-shop-order-card-head">
                {o.product_image_url ? (
                  <img src={o.product_image_url} alt={o.product_name ?? ''} className="pw-shop-order-thumb" />
                ) : null}
                <div className="pw-shop-order-card-main">
                  <strong>{o.product_name || t.orderIdLabel}</strong>
                  <p className="pw-shop-muted">
                    {t.orderIdLabel}: {o.id}
                  </p>
                  {o.created_at ? (
                    <p className="pw-shop-muted">
                      {t.orderDateLabel}: {formatPartnerSiteOrderDate(locale, o.created_at)}
                    </p>
                  ) : null}
                  {o.status ? (
                    <p className="pw-shop-muted">
                      {t.orderStatusLabel}: {formatPartnerSiteOrderStatus(locale, o.status)}
                    </p>
                  ) : null}
                  {o.shipping_status ? (
                    <p className="pw-shop-muted">
                      {t.orderShippingStatusLabel}: {formatPartnerSiteShippingStatus(locale, o.shipping_status)}
                    </p>
                  ) : null}
                  {o.quantity != null && o.quantity > 0 ? (
                    <p className="pw-shop-muted">
                      {t.orderQuantityLabel}: {o.quantity}
                    </p>
                  ) : null}
                  {o.required_amount != null && o.required_amount > 0 ? (
                    <p>
                      {t.depositAmount}: <strong>{formatVnd(Number(o.required_amount))}</strong>
                    </p>
                  ) : null}
                </div>
              </div>
              {showPayment ? (
                <div className="pw-shop-order-actions">
                  <button
                    type="button"
                    className="pw-shop-btn pw-shop-btn-outline"
                    onClick={() => setExpandedId(expanded ? null : o.id)}
                  >
                    {expanded ? t.orderHidePayment : t.orderViewPayment}
                  </button>
                </div>
              ) : null}
              {expanded && showPayment ? (
                <div className="pw-shop-order-payment">
                  {ref ? (
                    <p className="pw-shop-muted">
                      {t.paymentReference}: {ref}
                    </p>
                  ) : null}
                  {qr ? (
                    <p style={{ marginTop: 12 }}>
                      <img src={qr} alt="QR" className="pw-shop-order-qr" />
                    </p>
                  ) : null}
                  <p className="pw-shop-muted">{t.depositPolicyNote}</p>
                  <p style={{ marginTop: 12 }}>
                    <a href={chatPath} className="pw-shop-btn">
                      {t.navChat}
                    </a>
                  </p>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

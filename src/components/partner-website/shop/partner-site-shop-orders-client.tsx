'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  formatPartnerSiteOrderDate,
  formatPartnerSiteOrderStatus,
  formatPartnerSiteShippingStatus,
} from '@/lib/partner-website/shop/partner-site-order-labels'
import {
  countPartnerSiteOrdersByStatusFilter,
  orderMatchesPartnerSiteStatusFilter,
  parsePartnerSiteOrderStatusFilter,
  PARTNER_SITE_ORDER_STATUS_FILTER_KEYS,
  type PartnerSiteOrderStatusFilterKey,
} from '@/lib/partner-website/shop/partner-site-order-status-filters'

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
  has_review?: boolean | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  chatPath: string
  /** W5.3 — filter ban đầu (vd từ hash `#orders?tab=waiting_payment`). */
  initialFilter?: string | null
}

function filterLabel(
  key: PartnerSiteOrderStatusFilterKey,
  t: ReturnType<typeof getPartnerSiteShopCopy>
): string {
  switch (key) {
    case 'all':
      return t.ordersFilterAll
    case 'waiting_payment':
      return t.ordersFilterWaitingPayment
    case 'processing':
      return t.ordersFilterProcessing
    case 'delivered':
      return t.ordersFilterDelivered
    case 'reviewed':
      return t.ordersFilterReviewed
    case 'cancelled':
      return t.ordersFilterCancelled
  }
}

export function PartnerSiteShopOrdersClient({
  siteSlug: _siteSlug,
  partnerSlug,
  locale,
  chatPath,
  initialFilter,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(_siteSlug)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PartnerSiteOrderStatusFilterKey>(() =>
    parsePartnerSiteOrderStatusFilter(initialFilter)
  )

  useEffect(() => {
    setFilter(parsePartnerSiteOrderStatusFilter(initialFilter))
  }, [initialFilter])

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

  const counts = useMemo(() => countPartnerSiteOrdersByStatusFilter(orders), [orders])
  const visibleOrders = useMemo(
    () => orders.filter((o) => orderMatchesPartnerSiteStatusFilter(o, filter)),
    [filter, orders]
  )

  const selectFilter = (key: PartnerSiteOrderStatusFilterKey) => {
    setFilter(key)
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const onAccountOrders = /\/account\/orders\/?$/.test(url.pathname)
    if (onAccountOrders) {
      if (key === 'all') url.searchParams.delete('tab')
      else url.searchParams.set('tab', key)
      url.hash = ''
      window.history.replaceState(null, '', `${url.pathname}${url.search}`)
      return
    }
    if (key === 'all') {
      url.hash = '#orders'
    } else {
      url.hash = `#orders?tab=${key}`
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  return (
    <div>
      <h1>{t.ordersTitle}</h1>

      {!loading && orders.length > 0 ? (
        <div className="pw-shop-order-filters" role="tablist" aria-label={t.ordersFilterAriaLabel}>
          {PARTNER_SITE_ORDER_STATUS_FILTER_KEYS.map((key) => {
            const count = counts[key]
            const active = filter === key
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`pw-shop-order-filter-chip${active ? ' is-active' : ''}`}
                onClick={() => selectFilter(key)}
              >
                <span>{filterLabel(key, t)}</span>
                {count > 0 ? <span className="pw-shop-order-filter-badge">{count}</span> : null}
              </button>
            )
          })}
        </div>
      ) : null}

      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && orders.length === 0 ? <p className="pw-shop-muted">{t.ordersEmpty}</p> : null}
      {!loading && orders.length > 0 && visibleOrders.length === 0 ? (
        <p className="pw-shop-muted">{t.ordersFilterEmpty}</p>
      ) : null}

      <ul className="pw-shop-orders-list">
        {visibleOrders.map((o) => {
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

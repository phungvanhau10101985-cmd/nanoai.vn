'use client'

import Link from 'next/link'
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
import { partnerSiteOrderDepositPath, partnerSiteOrderDetailPath, partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'

type OrderRow = {
  id: string
  status?: string | null
  shipping_status?: string | null
  product_name?: string | null
  product_image_url?: string | null
  product_inventory_id?: string | null
  product_url?: string | null
  required_amount?: number | null
  subtotal_amount?: number | null
  paid_amount?: number | null
  quantity?: number | null
  payment_qr_url?: string | null
  payment_reference?: string | null
  shipping_address?: string | null
  created_at?: string | null
  has_review?: boolean | null
  can_cancel?: boolean | null
  can_confirm_received?: boolean | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  chatPath: string
  initialFilter?: string | null
}

type Panel = 'none' | 'detail' | 'payment' | 'track' | 'cancel' | 'confirm'

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
    case 'returned':
      return t.ordersFilterReturned
  }
}

function timelineSteps(
  ship: string | null | undefined,
  t: ReturnType<typeof getPartnerSiteShopCopy>
): Array<{ key: string; label: string; done: boolean; active: boolean }> {
  const order = ['pending', 'confirmed', 'packing', 'shipping', 'delivered']
  const idx = Math.max(0, order.indexOf(String(ship ?? 'pending')))
  const labels = [
    t.orderTimelineCreated,
    t.orderTimelineConfirmed,
    t.orderTimelinePacking,
    t.orderTimelineShipping,
    t.orderTimelineDelivered,
  ]
  return order.map((key, i) => ({
    key,
    label: labels[i] ?? key,
    done: i < idx || ship === 'delivered',
    active: i === idx && ship !== 'delivered' && ship !== 'cancelled' && ship !== 'returned',
  }))
}

export function PartnerSiteShopOrdersClient({
  siteSlug,
  partnerSlug,
  locale,
  chatPath,
  initialFilter,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('none')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [actionStatus, setActionStatus] = useState('')
  const [filter, setFilter] = useState<PartnerSiteOrderStatusFilterKey>(() =>
    parsePartnerSiteOrderStatusFilter(initialFilter)
  )

  useEffect(() => {
    setFilter(parsePartnerSiteOrderStatusFilter(initialFilter))
  }, [initialFilter])

  const reload = async () => {
    const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/orders`, {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json()) as { orders?: OrderRow[] }
    setOrders(Array.isArray(json.orders) ? json.orders : [])
  }

  useEffect(() => {
    if (!ready) return
    void (async () => {
      setLoading(true)
      try {
        await reload()
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once session ready
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
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const onOrdersList = /\/orders$/.test(path) || /\/account\/orders$/.test(path)
    if (onOrdersList) {
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

  const togglePanel = (id: string, next: Panel) => {
    if (openId === id && panel === next) {
      setOpenId(null)
      setPanel('none')
      return
    }
    setOpenId(id)
    setPanel(next)
    setActionStatus('')
  }

  async function patchOrder(orderId: string, action: 'cancel' | 'confirm_received', reason?: string) {
    setBusyId(orderId)
    setActionStatus('')
    try {
      const res = await fetch(
        `/api/messaging/guest/${encodeURIComponent(partnerSlug)}/order/${encodeURIComponent(orderId)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ action, reason }),
        }
      )
      captureFromResponse(res)
      if (!res.ok) {
        setActionStatus(t.orderActionFailed)
        return
      }
      await reload()
      setActionStatus(action === 'cancel' ? t.orderCancelOk : t.orderConfirmReceivedOk)
      setPanel('none')
      setOpenId(null)
      setCancelReason('')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div data-pw-region={PW_REGION.accountMain}>
      <h1 data-pw-el={PW_EL.heading}>{t.ordersTitle}</h1>

      {!loading ? (
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
                <span className="pw-shop-order-filter-badge">{count}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && orders.length === 0 ? <p className="pw-shop-muted" data-pw-el={PW_EL.empty}>{t.ordersEmpty}</p> : null}
      {!loading && orders.length > 0 && visibleOrders.length === 0 ? (
        <p className="pw-shop-muted">{t.ordersFilterEmpty}</p>
      ) : null}
      {actionStatus ? <p className="pw-shop-muted" style={{ marginTop: 8 }}>{actionStatus}</p> : null}

      <ul className="pw-shop-orders-list">
        {visibleOrders.map((o) => {
          const open = openId === o.id
          const qr = o.payment_qr_url?.trim() ?? ''
          const ref = o.payment_reference?.trim() ?? ''
          const showPayment = Boolean(qr || ref || (o.required_amount != null && o.required_amount > 0))
          const waitingPay = o.status === 'awaiting_payment' || o.status === 'payment_checking'
          const canTrack =
            o.status !== 'cancelled' &&
            o.shipping_status !== 'cancelled' &&
            (o.status === 'paid_verified' ||
              o.status === 'pending_manual_review' ||
              ['confirmed', 'packing', 'shipping', 'delivered'].includes(String(o.shipping_status ?? '')))
          const reviewHref = o.product_inventory_id
            ? partnerSiteProductPath(siteSlug, o.product_inventory_id, {
                customDomain,
                name: o.product_name,
              })
            : o.product_url || ''
          const steps = timelineSteps(o.shipping_status, t)

          return (
            <li key={o.id} className="pw-shop-order-card" data-pw-el={PW_EL.card}>
              <div className="pw-shop-order-card-head">
                {o.product_image_url ? (
                  <img src={o.product_image_url} alt={o.product_name ?? ''} className="pw-shop-order-thumb" />
                ) : null}
                <div className="pw-shop-order-card-main">
                  <strong>{o.product_name || t.orderIdLabel}</strong>
                  <p className="pw-shop-muted">
                    {t.orderIdLabel}: {ref || o.id}
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

              <div className="pw-shop-order-actions">
                <Link
                  href={partnerSiteOrderDetailPath(siteSlug, o.id, { customDomain })}
                  className="pw-shop-btn pw-shop-btn-outline"
                >
                  {t.depositViewOrder}
                </Link>
                <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => togglePanel(o.id, 'detail')}>
                  {open && panel === 'detail' ? t.orderHideDetail : t.orderDetail}
                </button>
                {showPayment && waitingPay ? (
                  <Link href={partnerSiteOrderDepositPath(siteSlug, o.id, { customDomain })} className="pw-shop-btn">
                    {t.orderPayDeposit}
                  </Link>
                ) : null}
                {canTrack ? (
                  <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => togglePanel(o.id, 'track')}>
                    {open && panel === 'track' ? t.orderHideTrack : t.orderTrack}
                  </button>
                ) : null}
                {o.can_confirm_received ? (
                  <button type="button" className="pw-shop-btn" onClick={() => togglePanel(o.id, 'confirm')}>
                    {t.orderConfirmReceived}
                  </button>
                ) : null}
                {o.has_review === false && o.shipping_status === 'delivered' && reviewHref ? (
                  <a href={reviewHref} className="pw-shop-btn pw-shop-btn-outline">
                    {t.orderReview}
                  </a>
                ) : null}
                {o.can_cancel ? (
                  <button type="button" className="pw-shop-btn pw-shop-btn-outline" onClick={() => togglePanel(o.id, 'cancel')}>
                    {t.orderCancel}
                  </button>
                ) : null}
              </div>

              {open && panel === 'detail' ? (
                <div className="pw-shop-order-payment">
                  {o.shipping_address ? (
                    <p>
                      <strong>{t.orderAddressLabel}:</strong> {o.shipping_address}
                    </p>
                  ) : null}
                  {o.subtotal_amount != null ? (
                    <p className="pw-shop-muted">
                      {t.cartSubtotal}: {formatVnd(Number(o.subtotal_amount))}
                    </p>
                  ) : null}
                  {o.paid_amount != null && o.paid_amount > 0 ? (
                    <p className="pw-shop-muted">
                      {t.depositAmount}: {formatVnd(Number(o.paid_amount))}
                    </p>
                  ) : null}
                  {ref ? (
                    <p className="pw-shop-muted">
                      {t.paymentReference}: {ref}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {open && panel === 'payment' && showPayment ? (
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

              {open && panel === 'track' ? (
                <div className="pw-shop-order-payment">
                  <p style={{ fontWeight: 700, margin: '0 0 10px' }}>{t.orderTimelineTitle}</p>
                  <ol className="pw-shop-order-timeline">
                    {steps.map((step) => (
                      <li
                        key={step.key}
                        className={step.done ? 'is-done' : step.active ? 'is-active' : undefined}
                      >
                        {step.label}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {open && panel === 'confirm' ? (
                <div className="pw-shop-order-payment">
                  <p>{t.orderConfirmReceivedHint}</p>
                  <div className="pw-shop-order-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="pw-shop-btn"
                      disabled={busyId === o.id}
                      onClick={() => void patchOrder(o.id, 'confirm_received')}
                    >
                      {t.orderConfirmReceived}
                    </button>
                    <button
                      type="button"
                      className="pw-shop-btn pw-shop-btn-outline"
                      onClick={() => {
                        setOpenId(null)
                        setPanel('none')
                      }}
                    >
                      {t.reviewsFormCancel}
                    </button>
                  </div>
                </div>
              ) : null}

              {open && panel === 'cancel' ? (
                <div className="pw-shop-order-payment">
                  <p className="pw-shop-muted">{t.orderCancelHint}</p>
                  <label className="pw-shop-muted" style={{ display: 'block', marginTop: 8 }}>
                    {t.orderCancelReason}
                    <input
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--pw-border, #e5e7eb)' }}
                    />
                  </label>
                  <div className="pw-shop-order-actions" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      className="pw-shop-btn pw-shop-btn-outline"
                      disabled={busyId === o.id}
                      onClick={() => void patchOrder(o.id, 'cancel', cancelReason)}
                    >
                      {t.orderCancel}
                    </button>
                    <button
                      type="button"
                      className="pw-shop-btn"
                      onClick={() => {
                        setOpenId(null)
                        setPanel('none')
                      }}
                    >
                      {t.reviewsFormCancel}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

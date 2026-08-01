'use client'

import { useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import { formatVnd } from '@/lib/partner-website/shop/cart-line-utils'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'

type OrderRow = {
  id: string
  status?: string | null
  product_name?: string | null
  required_amount?: number | null
  created_at?: string | null
}

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
}

export function PartnerSiteShopOrdersClient({ siteSlug, partnerSlug, locale }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

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
      <ul style={{ listStyle: 'none', padding: 0, marginTop: 16, display: 'grid', gap: 12 }}>
        {orders.map((o) => (
          <li key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 16, background: '#fff' }}>
            <strong>{o.product_name || t.orderIdLabel}</strong>
            <p className="pw-shop-muted">{t.orderIdLabel}: {o.id}</p>
            {o.status ? <p className="pw-shop-muted">Status: {o.status}</p> : null}
            {o.required_amount != null ? <p>{t.depositAmount}: {formatVnd(Number(o.required_amount))}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  )
}

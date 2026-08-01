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
import { partnerSiteProductsPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import {
  trackPartnerSiteBeginCheckout,
  trackPartnerSitePurchase,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PartnerSiteShopAuthPanel } from '@/components/partner-website/shop/partner-site-shop-auth-panel'
import { PartnerSiteShopOrderConfirmation } from '@/components/partner-website/shop/partner-site-shop-order-confirmation'

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  chatPath: string
}

type OrderSnapshot = {
  id?: string
  payment_qr_url?: string | null
  payment_reference?: string | null
  required_amount?: number | null
}

export function PartnerSiteShopCartClient({ siteSlug, partnerSlug, locale, chatPath }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount, tracking } = usePartnerSiteShop()
  const [items, setItems] = useState<SiteCartLine[]>([])
  const [loading, setLoading] = useState(true)
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [orderName, setOrderName] = useState('')
  const [orderPhone, setOrderPhone] = useState('')
  const [orderAddress, setOrderAddress] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [status, setStatus] = useState('')
  const [completedOrder, setCompletedOrder] = useState<OrderSnapshot | null>(null)

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

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        const unit = parseVndFromPriceHint(item.card.price_hint)
        return sum + unit * item.quantity
      }, 0),
    [items]
  )

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
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          action: 'cart_checkout',
          form: {
            customerName: orderName.trim(),
            customerPhone: orderPhone.trim(),
            shippingAddress: orderAddress.trim(),
            note: orderNote.trim(),
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
        } else {
          setStatus(json.error || t.authFailed)
        }
        return
      }
      setCompletedOrder(json.order ?? null)
      if (json.order?.id) {
        trackPartnerSitePurchase(tracking, {
          transactionId: json.order.id,
          value: subtotal,
          lines: checkoutLines,
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
    } finally {
      setCheckoutBusy(false)
    }
  }

  if (completedOrder) {
    return <PartnerSiteShopOrderConfirmation locale={locale} order={completedOrder} chatPath={chatPath} />
  }

  return (
    <div>
      <h1>{t.cartTitle}</h1>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="pw-shop-muted">
          {t.cartEmpty}{' '}
          <Link href={partnerSiteProductsPath(siteSlug)}>{t.backToShop}</Link>
        </p>
      ) : null}
      <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
        {items.map((item) => (
          <div key={item.id} className="pw-shop-cart-row">
            <img src={item.card.image_url} alt={item.card.name} />
            <div>
              <strong>{item.card.name}</strong>
              {item.card.price_hint ? <p className="pw-shop-price">{item.card.price_hint}</p> : null}
              {item.color ? <p className="pw-shop-muted">{t.colorLabel}: {item.color}</p> : null}
              {item.size ? <p className="pw-shop-muted">{t.sizeLabel}: {item.size}</p> : null}
              <label style={{ display: 'grid', gap: 4, marginTop: 8, maxWidth: 80 }}>
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
              onClick={() => void saveItems(items.filter((x) => x.id !== item.id))}
            >
              {t.cartRemove}
            </button>
          </div>
        ))}
      </div>
      {items.length > 0 ? (
        <div style={{ marginTop: 24 }}>
          <p>
            {t.cartSubtotal}: {formatVnd(subtotal)}
          </p>
          <div className="pw-shop-form" style={{ marginTop: 20 }}>
            <label>
              {t.checkoutName}
              <input value={orderName} onChange={(e) => setOrderName(e.target.value)} />
            </label>
            <label>
              {t.checkoutPhone}
              <input value={orderPhone} onChange={(e) => setOrderPhone(e.target.value)} />
            </label>
            <label>
              {t.checkoutAddress}
              <textarea rows={3} value={orderAddress} onChange={(e) => setOrderAddress(e.target.value)} />
            </label>
            <label>
              {t.checkoutNote}
              <textarea rows={2} value={orderNote} onChange={(e) => setOrderNote(e.target.value)} />
            </label>
            <button type="button" className="pw-shop-btn" disabled={checkoutBusy} onClick={() => void checkout()}>
              {checkoutBusy ? t.cartCheckingOut : t.cartCheckout}
            </button>
            {status && !needsAuth ? <p className="pw-shop-muted">{status}</p> : null}
          </div>
          {needsAuth ? (
            <PartnerSiteShopAuthPanel
              partnerSlug={partnerSlug}
              siteSlug={siteSlug}
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

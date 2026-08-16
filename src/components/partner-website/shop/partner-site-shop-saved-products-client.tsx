'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import { mergeSiteCartLine, type SiteCartLine } from '@/lib/partner-website/shop/cart-line-utils'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartApiPath,
  partnerSiteCartPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Mode = 'favorites' | 'recently-viewed'

type Props = {
  siteSlug: string
  locale: WebLocale
  mode: Mode
}

function toCartCard(p: PartnerSitePersonalizationProduct): PartnerAiProductCard {
  return {
    name: p.name,
    image_url: p.image_url,
    product_url: p.product_url,
    price_hint: p.price_hint || undefined,
    inventory_id: p.inventory_id,
    sku: p.sku || undefined,
  }
}

export function PartnerSiteShopSavedProductsClient({ siteSlug, locale, mode }: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const { refreshCartCount } = usePartnerSiteShop()
  const [products, setProducts] = useState<PartnerSitePersonalizationProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  const title = mode === 'favorites' ? t.wishlistTitle : t.recentlyViewedTitle
  const empty = mode === 'favorites' ? t.wishlistEmpty : t.recentlyViewedEmpty
  const apiTail = mode === 'favorites' ? 'favorites?limit=48' : 'recently-viewed?limit=48'

  const load = useCallback(async () => {
    const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, apiTail), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    const json = (await res.json().catch(() => ({}))) as { products?: PartnerSitePersonalizationProduct[] }
    setProducts(Array.isArray(json.products) ? json.products : [])
  }, [apiTail, authHeaders, captureFromResponse, siteSlug])

  useEffect(() => {
    if (!ready) return
    setLoading(true)
    void load().finally(() => setLoading(false))
  }, [load, ready])

  async function toggleFavorite(product: PartnerSitePersonalizationProduct) {
    if (busyId) return
    setBusyId(product.inventory_id)
    setMessage('')
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'events'), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          event: mode === 'favorites' ? 'remove_favorite' : 'toggle_favorite',
          inventory_id: product.inventory_id,
        }),
      })
      captureFromResponse(res)
      if (!res.ok) return
      if (mode === 'favorites') {
        setProducts((prev) => prev.filter((p) => p.inventory_id !== product.inventory_id))
      } else {
        await load()
      }
    } finally {
      setBusyId(null)
    }
  }

  async function clearRecentlyViewed() {
    if (busyId || mode !== 'recently-viewed' || products.length === 0) return
    setBusyId('clear')
    setMessage('')
    try {
      const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, 'recently-viewed'), {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: authHeaders(),
      })
      captureFromResponse(res)
      if (!res.ok) return
      setProducts([])
      setMessage(t.recentlyViewedCleared)
    } finally {
      setBusyId(null)
    }
  }

  async function addToCart(product: PartnerSitePersonalizationProduct) {
    if (busyId) return
    setBusyId(product.inventory_id)
    setMessage('')
    try {
      const cartRes = await fetch(partnerSiteCartApiPath(siteSlug), {
        credentials: 'same-origin',
        headers: authHeaders(),
      })
      captureFromResponse(cartRes)
      const cartJson = (await cartRes.json().catch(() => ({}))) as { items?: SiteCartLine[] }
      const existing = Array.isArray(cartJson.items) ? cartJson.items : []
      const line: SiteCartLine = {
        id: crypto.randomUUID(),
        card: toCartCard(product),
        quantity: 1,
        color: '',
        size: '',
        note: '',
      }
      const merged = mergeSiteCartLine(existing, line)
      const saveRes = await fetch(partnerSiteCartApiPath(siteSlug), {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ items: merged }),
      })
      captureFromResponse(saveRes)
      if (!saveRes.ok) {
        setMessage(t.authFailed)
        return
      }
      await refreshCartCount()
      setMessage(t.addedToCart)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
      <div className="pw-shop-page-head">
        <h1 data-pw-el={PW_EL.sectionTitle}>{title}</h1>
        {mode === 'recently-viewed' && !loading && products.length > 0 ? (
          <button
            type="button"
            className="pw-shop-btn pw-shop-btn-outline"
            disabled={busyId === 'clear'}
            onClick={() => void clearRecentlyViewed()}
          >
            {t.recentlyViewedClear}
          </button>
        ) : null}
      </div>
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && products.length === 0 ? (
        <p className="pw-shop-muted">
          {empty}{' '}
          <Link href={partnerSiteProductsPath(siteSlug, { customDomain })}>{t.backToShop}</Link>
        </p>
      ) : null}
      {message ? <p className="pw-shop-muted">{message}</p> : null}
      <div className="pw-shop-grid" style={{ marginTop: 20 }} data-pw-el={PW_EL.grid} data-pw-grid>
        {products.map((p) => {
          const href =
            p.detail_path ||
            partnerSiteProductPath(siteSlug, p.inventory_id, {
              customDomain,
              name: p.name,
            })
          const busy = busyId === p.inventory_id
          return (
            <article key={p.inventory_id} className="pw-shop-card" data-pw-el={PW_EL.card}>
              <Link href={href} data-pw-el={PW_EL.cardMedia}>
                <img src={p.image_url} alt={p.name} />
              </Link>
              <div className="pw-shop-card-body">
                <Link href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <strong data-pw-el={PW_EL.cardName}>{p.name}</strong>
                </Link>
                {p.price_hint ? <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>{p.price_hint}</p> : null}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    className="pw-shop-btn"
                    disabled={busy}
                    data-pw-el={PW_EL.cardCart}
                    onClick={() => void addToCart(p)}
                  >
                    {t.addToCart}
                  </button>
                  <button
                    type="button"
                    className="pw-shop-btn pw-shop-btn-outline"
                    disabled={busy}
                    onClick={() => void toggleFavorite(p)}
                  >
                    {mode === 'favorites' ? t.favoriteRemove : t.favoriteAdd}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {products.length > 0 ? (
        <p style={{ marginTop: 24 }}>
          <Link href={partnerSiteCartPath(siteSlug, { customDomain })} className="pw-shop-btn">
            {t.navCart}
          </Link>
        </p>
      ) : null}
    </section>
  )
}

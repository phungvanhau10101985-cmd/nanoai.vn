'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartPath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
  partnerSiteProductsPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteCustomDomain } from '@/lib/partner-website/shop/partner-site-custom-domain-context'
import { PartnerSiteListingProductCard } from '@/components/partner-website/shop/partner-site-listing-product-card'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Mode = 'favorites' | 'recently-viewed'

type Props = {
  siteSlug: string
  locale: WebLocale
  mode: Mode
  initialProducts?: PartnerSitePersonalizationProduct[]
}

export function PartnerSiteShopSavedProductsClient({
  siteSlug,
  locale,
  mode,
  initialProducts,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [products, setProducts] = useState<PartnerSitePersonalizationProduct[]>(
    () => initialProducts ?? []
  )
  const [loading, setLoading] = useState(initialProducts == null)
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
    let cancelled = false
    if (initialProducts == null) setLoading(true)
    void load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialProducts, isAuthenticated, load])

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
            <PartnerSiteListingProductCard
              key={p.inventory_id}
              locale={locale}
              product={p}
              href={href}
              favorited={mode === 'favorites'}
              onFavorite={() => {
                if (!busy) void toggleFavorite(p)
              }}
            />
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

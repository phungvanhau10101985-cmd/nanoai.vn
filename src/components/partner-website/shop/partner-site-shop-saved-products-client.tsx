'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { usePartnerSiteGuestSession } from '@/hooks/use-partner-site-guest-session'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSitePersonalizationProduct } from '@/lib/partner-website/shop/partner-site-personalization'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import {
  partnerSiteCartPath,
  partnerSiteHomePath,
  partnerSitePersonalizationApiPath,
  partnerSiteProductPath,
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

const RECENTLY_VIEWED_LIMIT = 24

export function PartnerSiteShopSavedProductsClient({
  siteSlug,
  locale,
  mode,
  initialProducts,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const customDomain = usePartnerSiteCustomDomain()
  const { ready, isAuthenticated, authHeaders, captureFromResponse } = usePartnerSiteGuestSession(siteSlug)
  const [products, setProducts] = useState<PartnerSitePersonalizationProduct[]>(
    () => initialProducts ?? []
  )
  const [loading, setLoading] = useState(initialProducts == null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const prevAuthRef = useRef<boolean | null>(null)

  const isViewed = mode === 'recently-viewed'
  const title = isViewed ? t.accountViewedProducts : t.wishlistTitle
  const empty = isViewed ? t.recentlyViewedEmpty : t.wishlistEmpty
  const apiTail = isViewed ? `recently-viewed?limit=${RECENTLY_VIEWED_LIMIT}` : 'favorites?limit=48'
  const homeHref = partnerSiteHomePath(siteSlug, { customDomain })

  const load = useCallback(async () => {
    if (!ready) return
    const res = await fetch(partnerSitePersonalizationApiPath(siteSlug, apiTail), {
      credentials: 'same-origin',
      headers: authHeaders(),
    })
    captureFromResponse(res)
    if (!res.ok) return
    const json = (await res.json().catch(() => ({}))) as { products?: PartnerSitePersonalizationProduct[] }
    if (!Array.isArray(json.products)) return
    const next = json.products
    setProducts((prev) => {
      // Guest/session GET often returns [] and must not wipe SSR or a local unlike.
      if (next.length === 0 && prev.length > 0) return prev
      return next
    })
  }, [apiTail, authHeaders, captureFromResponse, ready, siteSlug])

  useEffect(() => {
    if (!ready) return
    prevAuthRef.current = isAuthenticated
    // SSR already painted cookies. Refetching on auth flip races unlike and empties the grid.
    if ((initialProducts?.length ?? 0) > 0) return
    let cancelled = false
    if (initialProducts == null) setLoading(true)
    void load().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [initialProducts, isAuthenticated, load, ready])

  useEffect(() => {
    if (!isViewed) return
    const onViewed = () => {
      void load()
    }
    document.addEventListener('pw-recently-viewed-updated', onViewed)
    return () => document.removeEventListener('pw-recently-viewed-updated', onViewed)
  }, [isViewed, load])

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
    if (busyId || !isViewed || products.length === 0) return
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
      try {
        document.dispatchEvent(new Event('pw-recently-viewed-updated'))
      } catch {
        /* ignore */
      }
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
      <div className="pw-shop-page-head">
        <h1 data-pw-el={PW_EL.sectionTitle}>{title}</h1>
        {isViewed ? (
          <p className="pw-shop-muted" style={{ margin: '4px 0 0' }}>
            {t.recentlyViewedCount.replace('{count}', String(products.length))}
          </p>
        ) : null}
        {isViewed && !loading && products.length > 0 ? (
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
      {isViewed ? (
        <p className="pw-shop-muted" style={{ marginTop: 8, maxWidth: 720, lineHeight: 1.45 }}>
          {t.recentlyViewedSyncNote}
        </p>
      ) : null}
      {loading ? <p className="pw-shop-muted">…</p> : null}
      {!loading && products.length === 0 ? (
        <div className="pw-shop-empty" style={{ marginTop: 20, textAlign: 'center' }}>
          <p className="pw-shop-muted">{empty}</p>
          <p style={{ marginTop: 12 }}>
            <Link href={homeHref} className="pw-shop-btn pw-shop-btn-buy">
              {isViewed ? t.recentlyViewedExplore : t.backToShop}
            </Link>
          </p>
        </div>
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
      {!isViewed && products.length > 0 ? (
        <p style={{ marginTop: 24 }}>
          <Link href={partnerSiteCartPath(siteSlug, { customDomain })} className="pw-shop-btn">
            {t.navCart}
          </Link>
        </p>
      ) : null}
    </section>
  )
}

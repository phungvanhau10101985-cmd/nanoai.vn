'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { PartnerAiProductCard } from '@/lib/messaging/partner-ai-product-cards'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteProductPath, partnerSiteProductsApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import type { WebLocale } from '@/lib/i18n/config'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteViewItemList,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  partnerSlug: string
  locale: WebLocale
  initialProducts: PartnerSiteShopProduct[]
  initialTotal: number
}

export function PartnerSiteShopCatalogClient({
  siteSlug,
  partnerSlug,
  locale,
  initialProducts,
  initialTotal,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const [products, setProducts] = useState(initialProducts)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [offset, setOffset] = useState(initialProducts.length)
  const [query, setQuery] = useState('')

  const loadMore = useCallback(async () => {
    if (loading || products.length >= initialTotal) return
    setLoading(true)
    try {
      const res = await fetch(
        `${partnerSiteProductsApiPath(siteSlug)}?offset=${offset}&limit=24`,
        { cache: 'no-store' }
      )
      const json = (await res.json()) as { products?: PartnerSiteShopProduct[] }
      const next = json.products ?? []
      setProducts((prev) => [...prev, ...next])
      setOffset((o) => o + next.length)
    } finally {
      setLoading(false)
    }
  }, [initialTotal, loading, offset, products.length, siteSlug])

  useEffect(() => {
    setProducts(initialProducts)
    setOffset(initialProducts.length)
  }, [initialProducts])

  useEffect(() => {
    trackPartnerSiteViewItemList(
      tracking,
      initialProducts.map((p) => shopProductToTrackingProduct(p))
    )
  }, [initialProducts, tracking])

  async function runSearch() {
    const q = query.trim()
    if (q.length < 2) return
    setSearching(true)
    try {
      const fd = new FormData()
      fd.set('mode', 'text')
      fd.set('q', q)
      const res = await fetch(`/api/messaging/guest/${encodeURIComponent(partnerSlug)}/inventory-vector-search`, {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const json = (await res.json()) as { ok?: boolean; cards?: PartnerAiProductCard[] }
      if (!res.ok || !json.ok || !Array.isArray(json.cards)) return
      setProducts(
        json.cards
          .filter((c) => c.inventory_id)
          .map((c) => ({
            id: c.inventory_id!,
            name: c.name,
            description: '',
            detailDescription: '',
            galleryImages: [],
            detailImages: [],
            productVideoUrl: null,
            priceHint: c.price_hint ?? '',
            imageUrl: c.image_url,
            productUrl: c.product_url,
            sku: c.sku ?? '',
            detailPath: partnerSiteProductPath(siteSlug, c.inventory_id!, { name: c.name }),
            stockQty: 0,
          }))
      )
    } finally {
      setSearching(false)
    }
  }

  return (
    <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
      <h1 data-pw-el={PW_EL.sectionTitle}>{t.catalogTitle}</h1>
      <div className="pw-shop-toolbar" data-pw-region={PW_REGION.toolbar} style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
        />
        <button type="button" className="pw-shop-btn" disabled={searching} onClick={() => void runSearch()}>
          {searching ? '…' : t.searchButton}
        </button>
      </div>
      {products.length === 0 ? <p className="pw-shop-muted">{t.catalogEmpty}</p> : null}
      <div className="pw-shop-grid" data-pw-el={PW_EL.grid} data-pw-grid style={{ marginTop: 20 }}>
        {products.map((p) => (
          <article key={p.id} className="pw-shop-card" data-pw-el={PW_EL.card}>
            <Link href={p.detailPath} data-pw-el={PW_EL.cardMedia}>
              <img src={p.imageUrl} alt={p.name} loading="lazy" />
            </Link>
            <div className="pw-shop-card-body">
              <Link href={p.detailPath}>
                <h3 data-pw-el={PW_EL.cardName}>{p.name}</h3>
              </Link>
              {p.priceHint ? <p className="pw-shop-price" data-pw-el={PW_EL.cardPrice}>{p.priceHint}</p> : null}
              <Link href={p.detailPath} className="pw-shop-btn" style={{ marginTop: 12 }} data-pw-el={PW_EL.cardBuy}>
                {t.productDetail}
              </Link>
            </div>
          </article>
        ))}
      </div>
      {products.length < initialTotal && !query.trim() ? (
        <p style={{ marginTop: 24 }}>
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" disabled={loading} onClick={() => void loadMore()}>
            {loading ? '…' : t.loadMore}
          </button>
        </p>
      ) : null}
    </section>
  )
}

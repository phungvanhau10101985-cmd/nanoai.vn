'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteProductsApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
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
  heading?: string
  apiQuery?: string
}

export function PartnerSiteShopCatalogClient({
  siteSlug,
  locale,
  initialProducts,
  initialTotal,
  heading,
  apiQuery,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const [products, setProducts] = useState(initialProducts)
  const [loading, setLoading] = useState(false)
  const [offset, setOffset] = useState(initialProducts.length)

  const loadMore = useCallback(async () => {
    if (loading || products.length >= initialTotal) return
    setLoading(true)
    try {
      const res = await fetch(
        `${partnerSiteProductsApiPath(siteSlug)}?offset=${offset}&limit=24${apiQuery ? `&${apiQuery.replace(/^\?/, '')}` : ''}`,
        { cache: 'no-store' }
      )
      const json = (await res.json()) as { products?: PartnerSiteShopProduct[] }
      const next = json.products ?? []
      setProducts((prev) => [...prev, ...next])
      setOffset((o) => o + next.length)
    } finally {
      setLoading(false)
    }
  }, [apiQuery, initialTotal, loading, offset, products.length, siteSlug])

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

  return (
    <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
      <h1 data-pw-el={PW_EL.sectionTitle}>{heading || t.catalogTitle}</h1>
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
      {products.length < initialTotal ? (
        <p style={{ marginTop: 24 }}>
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" disabled={loading} onClick={() => void loadMore()}>
            {loading ? '…' : t.loadMore}
          </button>
        </p>
      ) : null}
    </section>
  )
}

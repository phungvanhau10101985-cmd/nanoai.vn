'use client'

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
import { PartnerSiteListingProductCard } from '@/components/partner-website/shop/partner-site-listing-product-card'

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
          <PartnerSiteListingProductCard key={p.id} locale={locale} product={p} href={p.detailPath} />
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

'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  buildPartnerCategoryListingSearch,
  parsePartnerCategoryListingFromSearchParams,
  partnerCategoryListingHasFilters,
  partnerCategoryListingPageCount,
  PARTNER_CATEGORY_PAGE_SIZE,
  type PartnerCategoryListingQuery,
  type PartnerCategoryListingSort,
} from '@/lib/partner-website/shop/partner-site-category-listing'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteProductsApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteViewItemList,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'
import { PW_EL, PW_REGION } from '@/lib/partner-website/visual-editor/pw-ui-contract'

type Props = {
  siteSlug: string
  categoryId: string
  locale: WebLocale
  initialProducts: PartnerSiteShopProduct[]
  initialTotal: number
  priceRange: { min: number; max: number } | null
  initialFacets?: {
    sizes: Array<{ value: string; count: number }>
    colors: Array<{ value: string; count: number }>
  }
}

function listingHref(pathname: string, q: Partial<PartnerCategoryListingQuery>): string {
  const search = buildPartnerCategoryListingSearch(q)
  return search ? `${pathname}?${search}` : pathname
}

export function PartnerSiteCategoryProductsClient({
  siteSlug,
  categoryId,
  locale,
  initialProducts,
  initialTotal,
  priceRange,
  initialFacets,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const listing = useMemo(
    () => parsePartnerCategoryListingFromSearchParams(searchParams, { defaultSort: 'newest' }),
    [searchParams]
  )

  const [products, setProducts] = useState(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [minLocal, setMinLocal] = useState(listing.minPrice != null ? String(listing.minPrice) : '')
  const [maxLocal, setMaxLocal] = useState(listing.maxPrice != null ? String(listing.maxPrice) : '')
  const [facetSizes, setFacetSizes] = useState(initialFacets?.sizes ?? [])
  const [facetColors, setFacetColors] = useState(initialFacets?.colors ?? [])

  useEffect(() => {
    setMinLocal(listing.minPrice != null ? String(listing.minPrice) : '')
    setMaxLocal(listing.maxPrice != null ? String(listing.maxPrice) : '')
  }, [listing.minPrice, listing.maxPrice])

  useEffect(() => {
    trackPartnerSiteViewItemList(
      tracking,
      initialProducts.map((p) => shopProductToTrackingProduct(p))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pushListing = useCallback(
    (next: Partial<PartnerCategoryListingQuery>) => {
      const dest = listingHref(pathname, { ...listing, page: 1, ...next })
      startTransition(() => {
        router.push(dest, { scroll: false })
      })
    },
    [listing, pathname, router]
  )

  const skipInitialFetch = useMemo(
    () =>
      listing.page === 1 &&
      listing.sort === 'newest' &&
      !listing.size &&
      !listing.color &&
      listing.minPrice == null &&
      listing.maxPrice == null,
    [listing]
  )
  const skippedRef = useRef(skipInitialFetch)

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('categoryId', categoryId)
    params.set('offset', String((listing.page - 1) * PARTNER_CATEGORY_PAGE_SIZE))
    params.set('limit', String(PARTNER_CATEGORY_PAGE_SIZE))
    params.set('sort', listing.sort)
    if (listing.minPrice != null) params.set('min_price', String(listing.minPrice))
    if (listing.maxPrice != null) params.set('max_price', String(listing.maxPrice))
    if (listing.size) params.set('size', listing.size)
    if (listing.color) params.set('color', listing.color)
    if (listing.sort === 'random' && listing.randomSeed) params.set('r', listing.randomSeed)
    let cancelled = false
    if (skippedRef.current) {
      skippedRef.current = false
      void fetch(`${partnerSiteProductsApiPath(siteSlug)}?${params.toString()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((json: { facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }> } }) => {
          if (!cancelled && json.facets) {
            setFacetSizes(json.facets.sizes ?? [])
            setFacetColors(json.facets.colors ?? [])
          }
        })
        .catch(() => {})
      return () => {
        cancelled = true
      }
    }
    setLoading(true)
    void fetch(`${partnerSiteProductsApiPath(siteSlug)}?${params.toString()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json: {
        products?: PartnerSiteShopProduct[]
        total?: number
        facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }> }
      }) => {
        if (cancelled) return
        setProducts(json.products ?? [])
        if (typeof json.total === 'number') setTotal(json.total)
        if (json.facets) {
          setFacetSizes(json.facets.sizes ?? [])
          setFacetColors(json.facets.colors ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, listing.color, listing.maxPrice, listing.minPrice, listing.page, listing.randomSeed, listing.size, listing.sort, siteSlug])

  const applyPrice = useCallback(() => {
    const min = minLocal.trim() ? Math.max(0, Number(minLocal)) : null
    const max = maxLocal.trim() ? Math.max(0, Number(maxLocal)) : null
    if ((Number.isFinite(min) ? min : null) === listing.minPrice && (Number.isFinite(max) ? max : null) === listing.maxPrice) {
      return
    }
    pushListing({
      minPrice: Number.isFinite(min) ? min : null,
      maxPrice: Number.isFinite(max) ? max : null,
    })
  }, [listing.maxPrice, listing.minPrice, maxLocal, minLocal, pushListing])

  const hasActive = partnerCategoryListingHasFilters(listing)
  const showBar =
    hasActive ||
    products.length > 0 ||
    Boolean(priceRange && priceRange.max > priceRange.min) ||
    facetSizes.length > 0 ||
    facetColors.length > 0
  const pageCount = partnerCategoryListingPageCount(total)
  const pages = useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, listing.page - 2)
    const end = Math.min(pageCount, start + 4)
    for (let p = start; p <= end; p += 1) out.push(p)
    return out
  }, [listing.page, pageCount])

  return (
    <div>
      {showBar ? (
        <div
          className="pw-shop-filters"
          data-pw-region={PW_REGION.filters}
          aria-label={t.categoryFiltersAria}
          aria-busy={isPending || loading || undefined}
        >
          {facetSizes.length > 0 ? (
            <label>
              {t.categoryFilterSize}
              <select
                value={listing.size}
                data-pw-el={PW_EL.facet}
                onChange={(e) => pushListing({ size: e.target.value })}
              >
                <option value="">{t.categoryFilterAllSizes}</option>
                {facetSizes.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.value} ({f.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {facetColors.length > 0 ? (
            <label>
              {t.categoryFilterColor}
              <select
                value={listing.color}
                data-pw-el={PW_EL.facet}
                onChange={(e) => pushListing({ color: e.target.value })}
              >
                <option value="">{t.categoryFilterAllColors}</option>
                {facetColors.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.value} ({f.count})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {t.categoryFilterMinPrice}
            <input
              type="number"
              min={0}
              step={1000}
              placeholder={priceRange ? String(priceRange.min) : ''}
              value={minLocal}
              onChange={(e) => setMinLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyPrice()
              }}
            />
          </label>
          <label>
            {t.categoryFilterMaxPrice}
            <input
              type="number"
              min={0}
              step={1000}
              placeholder={priceRange ? String(priceRange.max) : ''}
              value={maxLocal}
              onChange={(e) => setMaxLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyPrice()
              }}
            />
          </label>
          <label data-pw-region={PW_REGION.toolbar}>
            {t.categorySortLabel}
            <select
              value={listing.sort}
              data-pw-el={PW_EL.sort}
              onChange={(e) => pushListing({ sort: e.target.value as PartnerCategoryListingSort })}
            >
              <option value="random">{t.categorySortRandom}</option>
              <option value="newest">{t.categorySortNewest}</option>
              <option value="oldest">{t.categorySortOldest}</option>
              <option value="views_desc">{t.categorySortViews}</option>
              <option value="price_asc">{t.categorySortPriceAsc}</option>
              <option value="price_desc">{t.categorySortPriceDesc}</option>
            </select>
          </label>
          {hasActive ? (
            <button
              type="button"
              className="pw-shop-btn pw-shop-btn-outline"
              style={{ height: 36, padding: '0 12px' }}
              onClick={() => startTransition(() => router.push(pathname, { scroll: false }))}
            >
              {t.categoryFilterClear}
            </button>
          ) : null}
        </div>
      ) : null}

      <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
        {loading || isPending ? (
          <div className="pw-shop-grid" data-pw-el={PW_EL.grid} data-pw-grid aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <article key={i} className="pw-shop-card" style={{ minHeight: 220, background: 'var(--pw-surface)' }} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="pw-shop-muted">{t.catalogEmpty}</p>
        ) : (
          <div className="pw-shop-grid" data-pw-el={PW_EL.grid} data-pw-grid>
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
        )}
        {pageCount > 1 ? (
          <nav className="pw-shop-page-nav" aria-label="Pagination">
            {listing.page > 1 ? (
              <Link href={listingHref(pathname, { ...listing, page: listing.page - 1 })}>{t.categoryPagePrev}</Link>
            ) : null}
            {pages.map((p) => (
              <Link
                key={p}
                href={listingHref(pathname, { ...listing, page: p })}
                className={p === listing.page ? 'is-current' : undefined}
              >
                {p}
              </Link>
            ))}
            {listing.page < pageCount ? (
              <Link href={listingHref(pathname, { ...listing, page: listing.page + 1 })}>{t.categoryPageNext}</Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  )
}

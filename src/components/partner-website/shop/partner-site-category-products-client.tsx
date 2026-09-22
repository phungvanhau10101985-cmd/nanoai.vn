'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import {
  buildPartnerCategoryListingSearch,
  parsePartnerCategoryListingFromSearchParams,
  partnerCategoryListingHasFilters,
  partnerCategoryListingImplicitSort,
  partnerCategoryListingMergeQuery,
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
import { PartnerSiteListingProductCard } from '@/components/partner-website/shop/partner-site-listing-product-card'
import { PW_SHOP_SOFT_NAV_EVENT } from '@/components/partner-website/shop/partner-site-soft-nav-relay'
import { PW_LISTING_FILTER_SLOT_ATTR } from '@/lib/partner-website/shop/listing-head'

type Props = {
  siteSlug: string
  categoryId?: string
  /** 188 `/?q=` listing — omit categoryId. */
  searchQuery?: string
  /** `/kho-sale` — warehouse=1 shop list. */
  warehouse?: boolean
  /** React fallback `/products` (no category). */
  shopList?: boolean
  locale: WebLocale
  initialProducts: PartnerSiteShopProduct[]
  initialTotal: number
  priceRange: { min: number; max: number } | null
  initialFacets?: {
    sizes: Array<{ value: string; count: number }>
    colors: Array<{ value: string; count: number }>
    styleTags?: Array<{ value: string; count: number }>
  }
  /** SSR listing so this client does not need `useSearchParams` (Suspense stall). */
  initialListing?: PartnerCategoryListingQuery
}

function listingHref(
  pathname: string,
  q: Partial<PartnerCategoryListingQuery>,
  extras?: { searchQ?: string; defaultSort?: PartnerCategoryListingSort }
): string {
  const qs = buildPartnerCategoryListingSearch(q, { defaultSort: extras?.defaultSort })
  const params = new URLSearchParams(qs)
  const searchQ = extras?.searchQ?.trim()
  if (searchQ) params.set('q', searchQ)
  const s = params.toString()
  return s ? `${pathname}?${s}` : pathname
}

function formatFilterPriceHint(n: number, locale: WebLocale): string {
  const tag = locale === 'vi' ? 'vi-VN' : locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : locale === 'ko' ? 'ko-KR' : 'en-US'
  return `${Math.round(n).toLocaleString(tag)} ₫`
}

export function PartnerSiteCategoryProductsClient({
  siteSlug,
  categoryId,
  searchQuery,
  warehouse = false,
  shopList = false,
  locale,
  initialProducts,
  initialTotal,
  priceRange,
  initialFacets,
  initialListing,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const router = useRouter()
  const pathname = usePathname()
  const isTextSearch = Boolean(searchQuery?.trim())
  const parseOpts = isTextSearch ? { defaultSort: 'random' as const } : undefined
  const [listing, setListing] = useState<PartnerCategoryListingQuery>(
    () =>
      initialListing ??
      parsePartnerCategoryListingFromSearchParams(new URLSearchParams(), parseOpts)
  )
  const implicitSort = partnerCategoryListingImplicitSort(listing, { search: isTextSearch })
  const listingExtras = useMemo(
    () => ({ searchQ: searchQuery?.trim() || undefined, defaultSort: implicitSort }),
    [implicitSort, searchQuery]
  )

  const [products, setProducts] = useState(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [minLocal, setMinLocal] = useState(listing.minPrice != null ? String(listing.minPrice) : '')
  const [maxLocal, setMaxLocal] = useState(listing.maxPrice != null ? String(listing.maxPrice) : '')
  const [facetSizes, setFacetSizes] = useState(initialFacets?.sizes ?? [])
  const [facetColors, setFacetColors] = useState(initialFacets?.colors ?? [])
  const [facetStyleTags, setFacetStyleTags] = useState(initialFacets?.styleTags ?? [])
  const [showFashionFacets, setShowFashionFacets] = useState(
    () =>
      Boolean(initialFacets?.sizes?.length || initialFacets?.colors?.length || initialFacets?.styleTags?.length) ||
      initialFacets === undefined
  )
  const hasInitialFacets = initialFacets !== undefined

  useLayoutEffect(() => {
    const applySearch = (search: string) => {
      setListing((prev) => {
        const next = parsePartnerCategoryListingFromSearchParams(new URLSearchParams(search), parseOpts)
        if (
          prev.page === next.page &&
          prev.sort === next.sort &&
          prev.minPrice === next.minPrice &&
          prev.maxPrice === next.maxPrice &&
          prev.size === next.size &&
          prev.color === next.color &&
          prev.styleTag === next.styleTag &&
          prev.randomSeed === next.randomSeed
        ) {
          return prev
        }
        return next
      })
    }
    const onPop = () => applySearch(window.location.search)
    const onSoftNav = (ev: Event) => {
      const href = (ev as CustomEvent<{ href?: string }>).detail?.href
      if (!href) return
      try {
        const url = new URL(href, window.location.href)
        if (url.pathname !== window.location.pathname) return
        applySearch(url.search)
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('popstate', onPop)
    window.addEventListener(PW_SHOP_SOFT_NAV_EVENT, onSoftNav)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener(PW_SHOP_SOFT_NAV_EVENT, onSoftNav)
    }
  }, [isTextSearch])

  useLayoutEffect(() => {
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
      const merged = partnerCategoryListingMergeQuery(listing, next, { search: isTextSearch })
      const dest = listingHref(pathname, merged, {
        searchQ: searchQuery?.trim() || undefined,
        defaultSort: partnerCategoryListingImplicitSort(merged, { search: isTextSearch }),
      })
      const qs = dest.includes('?') ? dest.slice(dest.indexOf('?') + 1) : ''
      setListing(parsePartnerCategoryListingFromSearchParams(new URLSearchParams(qs), parseOpts))
      router.push(dest, { scroll: false })
    },
    [isTextSearch, listing, pathname, router, searchQuery]
  )

  const skipInitialFetch = useMemo(
    () =>
      listing.page === 1 &&
      listing.sort === implicitSort &&
      !listing.size &&
      !listing.color &&
      !listing.styleTag &&
      listing.minPrice == null &&
      listing.maxPrice == null,
    [implicitSort, listing]
  )
  const skippedRef = useRef(skipInitialFetch)

  useLayoutEffect(() => {
    const params = new URLSearchParams()
    if (isTextSearch && searchQuery) params.set('q', searchQuery)
    else if (categoryId) params.set('categoryId', categoryId)
    if (warehouse) params.set('warehouse', '1')
    params.set('offset', String((listing.page - 1) * PARTNER_CATEGORY_PAGE_SIZE))
    params.set('limit', String(PARTNER_CATEGORY_PAGE_SIZE))
    params.set('sort', listing.sort)
    params.set('facets', '1')
    if (listing.minPrice != null) params.set('min_price', String(listing.minPrice))
    if (listing.maxPrice != null) params.set('max_price', String(listing.maxPrice))
    if (listing.size) params.set('size', listing.size)
    if (listing.color) params.set('color', listing.color)
    if (listing.styleTag) params.set('style_tag', listing.styleTag)
    if (listing.sort === 'random' && listing.randomSeed) params.set('r', listing.randomSeed)
    let cancelled = false
    if (skippedRef.current) {
      skippedRef.current = false
      if (hasInitialFacets) return
      void fetch(`${partnerSiteProductsApiPath(siteSlug)}?${params.toString()}`, { cache: 'no-store' })
        .then((res) => res.json())
        .then((json: {
          facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }>; styleTags?: Array<{ value: string; count: number }> }
          facetDefs?: unknown[]
        }) => {
          if (!cancelled && json.facets) {
            setFacetSizes(json.facets.sizes ?? [])
            setFacetColors(json.facets.colors ?? [])
            setFacetStyleTags(json.facets.styleTags ?? [])
          }
          if (!cancelled && Array.isArray(json.facetDefs)) setShowFashionFacets(json.facetDefs.length > 0)
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
        facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }>; styleTags?: Array<{ value: string; count: number }> }
        facetDefs?: unknown[]
      }) => {
        if (cancelled) return
        setProducts(json.products ?? [])
        if (typeof json.total === 'number') setTotal(json.total)
        if (json.facets) {
          setFacetSizes(json.facets.sizes ?? [])
          setFacetColors(json.facets.colors ?? [])
          setFacetStyleTags(json.facets.styleTags ?? [])
        }
        if (Array.isArray(json.facetDefs)) setShowFashionFacets(json.facetDefs.length > 0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, hasInitialFacets, isTextSearch, listing.color, listing.maxPrice, listing.minPrice, listing.page, listing.randomSeed, listing.size, listing.sort, listing.styleTag, searchQuery, siteSlug, warehouse, shopList])

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

  const hasActive = partnerCategoryListingHasFilters(listing, { defaultSort: implicitSort })
  const showBar = true
  const pageCount = partnerCategoryListingPageCount(total)
  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null)
  useLayoutEffect(() => {
    const find = () => document.querySelector<HTMLElement>(`[${PW_LISTING_FILTER_SLOT_ATTR}]`)
    setFilterSlot(find())
    if (find()) return
    const id = window.requestAnimationFrame(() => setFilterSlot(find()))
    return () => window.cancelAnimationFrame(id)
  }, [])
  const pages = useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, listing.page - 2)
    const end = Math.min(pageCount, start + 4)
    for (let p = start; p <= end; p += 1) out.push(p)
    return out
  }, [listing.page, pageCount])

  const filterBar = showBar ? (
        <div
          className="pw-shop-filters"
          data-pw-react-filters="1"
          data-pw-region={PW_REGION.filters}
          aria-label={t.categoryFiltersAria}
          aria-busy={loading || undefined}
        >
          {showFashionFacets ? (
            <>
              <label>
                <span className="pw-shop-filter-label">{t.categoryFilterSize}</span>
                <select
                  value={listing.size}
                  data-pw-el={PW_EL.facet}
                  data-pw-facet="size"
                  aria-label={t.categoryFilterSize}
                  onChange={(e) => pushListing({ size: e.target.value })}
                >
                  <option value="">{t.categoryFilterAllSizes}</option>
                  {listing.size && !facetSizes.some((f) => f.value === listing.size) ? (
                    <option value={listing.size}>{listing.size}</option>
                  ) : null}
                  {facetSizes.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.value} ({f.count})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="pw-shop-filter-label">{t.categoryFilterStyle}</span>
                <select
                  value={listing.styleTag}
                  data-pw-el={PW_EL.facet}
                  data-pw-facet="style"
                  aria-label={t.categoryFilterStyle}
                  onChange={(e) => pushListing({ styleTag: e.target.value })}
                >
                  <option value="">{t.categoryFilterAllStyles}</option>
                  {listing.styleTag && !facetStyleTags.some((f) => f.value === listing.styleTag) ? (
                    <option value={listing.styleTag}>{listing.styleTag}</option>
                  ) : null}
                  {facetStyleTags.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.value}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="pw-shop-filter-label">{t.categoryFilterColor}</span>
                <select
                  value={listing.color}
                  data-pw-el={PW_EL.facet}
                  data-pw-facet="color"
                  aria-label={t.categoryFilterColor}
                  onChange={(e) => pushListing({ color: e.target.value })}
                >
                  <option value="">{t.categoryFilterAllColors}</option>
                  {listing.color && !facetColors.some((f) => f.value === listing.color) ? (
                    <option value={listing.color}>{listing.color}</option>
                  ) : null}
                  {facetColors.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.value} ({f.count})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label>
            <span className="pw-shop-filter-label">{t.categoryFilterMinPrice}</span>
            <input
              type="number"
              min={0}
              step={1000}
              data-pw-facet="min_price"
              placeholder={priceRange ? formatFilterPriceHint(priceRange.min, locale) : t.categoryFilterPriceMinPh}
              aria-label={t.categoryFilterMinPrice}
              value={minLocal}
              onChange={(e) => setMinLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyPrice()
              }}
            />
          </label>
          <label>
            <span className="pw-shop-filter-label">{t.categoryFilterMaxPrice}</span>
            <input
              type="number"
              min={0}
              step={1000}
              data-pw-facet="max_price"
              placeholder={priceRange ? formatFilterPriceHint(priceRange.max, locale) : t.categoryFilterPriceMaxPh}
              aria-label={t.categoryFilterMaxPrice}
              value={maxLocal}
              onChange={(e) => setMaxLocal(e.target.value)}
              onBlur={applyPrice}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyPrice()
              }}
            />
          </label>
          <label data-pw-region={PW_REGION.toolbar}>
            <span className="pw-shop-filter-label">{t.categorySortLabel}</span>
            <select
              value={listing.sort}
              data-pw-el={PW_EL.sort}
              aria-label={t.categorySortLabel}
              onChange={(e) => pushListing({ sort: e.target.value as PartnerCategoryListingSort })}
            >
              <option value="random">{t.categorySortRandom}</option>
              <option value="newest">{t.categorySortNewest}</option>
              <option value="oldest">{t.categorySortOldest}</option>
              <option value="views_desc">{t.categorySortViews}</option>
            </select>
          </label>
          {hasActive ? (
            <button
              type="button"
              className="pw-shop-filter-clear"
              data-pw-filter-clear="1"
              onClick={() => {
                const dest = listingHref(
                  pathname,
                  { page: 1, sort: 'random' },
                  {
                    searchQ: searchQuery?.trim() || undefined,
                    defaultSort: 'random',
                  }
                )
                const qs = dest.includes('?') ? dest.slice(dest.indexOf('?') + 1) : ''
                setListing(parsePartnerCategoryListingFromSearchParams(new URLSearchParams(qs), parseOpts))
                router.push(dest, { scroll: false })
              }}
            >
              {t.categoryFilterClear}
            </button>
          ) : null}
        </div>
  ) : null

  return (
    <div>
      {filterSlot && filterBar ? createPortal(filterBar, filterSlot) : filterBar}

      <section data-pw-region={PW_REGION.catalog} data-pw-catalog>
        {loading ? (
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
              <PartnerSiteListingProductCard key={p.id} locale={locale} product={p} href={p.detailPath} />
            ))}
          </div>
        )}
        {pageCount > 1 ? (
          <nav className="pw-shop-page-nav" aria-label="Pagination">
            {listing.page > 1 ? (
              <Link href={listingHref(pathname, { ...listing, page: listing.page - 1 }, listingExtras)}>
                {t.categoryPagePrev}
              </Link>
            ) : null}
            {pages.map((p) => (
              <Link
                key={p}
                href={listingHref(pathname, { ...listing, page: p }, listingExtras)}
                className={p === listing.page ? 'is-current' : undefined}
              >
                {p}
              </Link>
            ))}
            {listing.page < pageCount ? (
              <Link href={listingHref(pathname, { ...listing, page: listing.page + 1 }, listingExtras)}>
                {t.categoryPageNext}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </div>
  )
}

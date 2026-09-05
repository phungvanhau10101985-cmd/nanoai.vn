'use client'

import Link from 'next/link'
import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
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
import {
  PartnerSiteSaleMediaMarks,
  PartnerSiteSalePriceBlock,
} from '@/components/partner-website/shop/partner-site-sale-face'
import { PW_LISTING_FILTER_SLOT_ATTR } from '@/lib/partner-website/shop/listing-head'

type Props = {
  siteSlug: string
  categoryId?: string
  /** 188 `/?q=` listing — omit categoryId. */
  searchQuery?: string
  locale: WebLocale
  initialProducts: PartnerSiteShopProduct[]
  initialTotal: number
  priceRange: { min: number; max: number } | null
  initialFacets?: {
    sizes: Array<{ value: string; count: number }>
    colors: Array<{ value: string; count: number }>
    styleTags?: Array<{ value: string; count: number }>
  }
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
  const isTextSearch = Boolean(searchQuery?.trim())
  const defaultSort: PartnerCategoryListingSort = isTextSearch ? 'random' : 'newest'
  const listingExtras = useMemo(
    () => ({ searchQ: searchQuery?.trim() || undefined, defaultSort }),
    [defaultSort, searchQuery]
  )
  const listing = useMemo(
    () => parsePartnerCategoryListingFromSearchParams(searchParams, { defaultSort }),
    [defaultSort, searchParams]
  )

  const [products, setProducts] = useState(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(false)
  const [minLocal, setMinLocal] = useState(listing.minPrice != null ? String(listing.minPrice) : '')
  const [maxLocal, setMaxLocal] = useState(listing.maxPrice != null ? String(listing.maxPrice) : '')
  const [facetSizes, setFacetSizes] = useState(initialFacets?.sizes ?? [])
  const [facetColors, setFacetColors] = useState(initialFacets?.colors ?? [])
  const [facetStyleTags, setFacetStyleTags] = useState(initialFacets?.styleTags ?? [])
  const hasInitialFacets = initialFacets !== undefined

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
      const dest = listingHref(pathname, { ...listing, page: 1, ...next }, listingExtras)
      startTransition(() => {
        router.push(dest, { scroll: false })
      })
    },
    [listing, listingExtras, pathname, router]
  )

  const skipInitialFetch = useMemo(
    () =>
      listing.page === 1 &&
      listing.sort === defaultSort &&
      !listing.size &&
      !listing.color &&
      !listing.styleTag &&
      listing.minPrice == null &&
      listing.maxPrice == null,
    [defaultSort, listing]
  )
  const skippedRef = useRef(skipInitialFetch)

  useEffect(() => {
    const params = new URLSearchParams()
    if (isTextSearch && searchQuery) params.set('q', searchQuery)
    else if (categoryId) params.set('categoryId', categoryId)
    params.set('offset', String((listing.page - 1) * PARTNER_CATEGORY_PAGE_SIZE))
    params.set('limit', String(PARTNER_CATEGORY_PAGE_SIZE))
    params.set('sort', listing.sort)
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
        .then((json: { facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }>; styleTags?: Array<{ value: string; count: number }> } }) => {
          if (!cancelled && json.facets) {
            setFacetSizes(json.facets.sizes ?? [])
            setFacetColors(json.facets.colors ?? [])
            setFacetStyleTags(json.facets.styleTags ?? [])
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
        facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }>; styleTags?: Array<{ value: string; count: number }> }
      }) => {
        if (cancelled) return
        setProducts(json.products ?? [])
        if (typeof json.total === 'number') setTotal(json.total)
        if (json.facets) {
          setFacetSizes(json.facets.sizes ?? [])
          setFacetColors(json.facets.colors ?? [])
          setFacetStyleTags(json.facets.styleTags ?? [])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [categoryId, hasInitialFacets, isTextSearch, listing.color, listing.maxPrice, listing.minPrice, listing.page, listing.randomSeed, listing.size, listing.sort, listing.styleTag, searchQuery, siteSlug])

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

  const hasActive = partnerCategoryListingHasFilters(listing, { defaultSort })
  const showBar =
    hasActive ||
    products.length > 0 ||
    Boolean(priceRange && priceRange.max > priceRange.min) ||
    facetSizes.length > 0 ||
    facetColors.length > 0 ||
    facetStyleTags.length > 0
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
          aria-busy={isPending || loading || undefined}
        >
          {facetSizes.length > 0 ? (
            <label>
              <span className="pw-shop-filter-label">{t.categoryFilterSize}</span>
              <select
                value={listing.size}
                data-pw-el={PW_EL.facet}
                aria-label={t.categoryFilterSize}
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
          {facetStyleTags.length > 0 || listing.styleTag ? (
            <label>
              <span className="pw-shop-filter-label">{t.categoryFilterStyle}</span>
              <select
                value={listing.styleTag}
                data-pw-el={PW_EL.facet}
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
          ) : null}
          {facetColors.length > 0 ? (
            <label>
              <span className="pw-shop-filter-label">{t.categoryFilterColor}</span>
              <select
                value={listing.color}
                data-pw-el={PW_EL.facet}
                aria-label={t.categoryFilterColor}
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
            <span className="pw-shop-filter-label">{t.categoryFilterMinPrice}</span>
            <input
              type="number"
              min={0}
              step={1000}
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
              <option value="price_asc">{t.categorySortPriceAsc}</option>
              <option value="price_desc">{t.categorySortPriceDesc}</option>
            </select>
          </label>
          {hasActive ? (
            <button
              type="button"
              className="pw-shop-filter-clear"
              onClick={() =>
                startTransition(() =>
                  router.push(listingHref(pathname, { page: 1, sort: defaultSort }, listingExtras), {
                    scroll: false,
                  })
                )
              }
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
                <Link href={p.detailPath} data-pw-el={PW_EL.cardMedia} style={{ position: 'relative', display: 'block' }}>
                  <PartnerSiteSaleMediaMarks product={p} locale={locale} />
                  <img src={p.imageUrl} alt={p.name} loading="lazy" />
                </Link>
                <div className="pw-shop-card-body">
                  <Link href={p.detailPath}>
                    <h3 data-pw-el={PW_EL.cardName}>{p.name}</h3>
                  </Link>
                  <PartnerSiteSalePriceBlock product={p} locale={locale} fallback={p.priceHint} />
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

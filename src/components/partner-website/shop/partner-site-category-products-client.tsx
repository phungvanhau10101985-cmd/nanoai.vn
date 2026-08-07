'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { PartnerSiteShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { getPartnerSiteShopCopy } from '@/lib/partner-website/shop/partner-site-shop-copy'
import { partnerSiteProductsApiPath } from '@/lib/partner-website/shop/partner-site-shop-paths'
import { usePartnerSiteShop } from '@/lib/partner-website/shop/partner-site-shop-context'
import {
  shopProductToTrackingProduct,
  trackPartnerSiteViewItemList,
} from '@/lib/partner-website/shop/partner-site-shop-tracking'

/**
 * W4.9/W4.11 — lưới sản phẩm trong 1 trang danh mục (chỉ sản phẩm gán trực tiếp, không gộp nhánh con)
 * + lọc khoảng giá + facet size/màu (fashion) + sắp xếp.
 */

type CategorySort = 'newest' | 'price_asc' | 'price_desc'

type Props = {
  siteSlug: string
  categoryId: string
  locale: WebLocale
  initialProducts: PartnerSiteShopProduct[]
  initialTotal: number
  priceRange: { min: number; max: number } | null
}

export function PartnerSiteCategoryProductsClient({
  siteSlug,
  categoryId,
  locale,
  initialProducts,
  initialTotal,
  priceRange,
}: Props) {
  const t = getPartnerSiteShopCopy(locale)
  const { tracking } = usePartnerSiteShop()
  const [products, setProducts] = useState(initialProducts)
  const [total, setTotal] = useState(initialTotal)
  const [offset, setOffset] = useState(initialProducts.length)
  const [loading, setLoading] = useState(false)
  const [sort, setSort] = useState<CategorySort>('newest')
  const [minPriceInput, setMinPriceInput] = useState('')
  const [maxPriceInput, setMaxPriceInput] = useState('')
  const [appliedMinPrice, setAppliedMinPrice] = useState<number | null>(null)
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<number | null>(null)
  const [sizeFacet, setSizeFacet] = useState('')
  const [colorFacet, setColorFacet] = useState('')
  const [facetSizes, setFacetSizes] = useState<Array<{ value: string; count: number }>>([])
  const [facetColors, setFacetColors] = useState<Array<{ value: string; count: number }>>([])

  useEffect(() => {
    trackPartnerSiteViewItemList(
      tracking,
      initialProducts.map((p) => shopProductToTrackingProduct(p))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildQuery = useCallback(
    (
      nextOffset: number,
      nextSort: CategorySort,
      min: number | null,
      max: number | null,
      size: string,
      color: string
    ) => {
      const params = new URLSearchParams()
      params.set('categoryId', categoryId)
      params.set('offset', String(nextOffset))
      params.set('limit', '24')
      params.set('sort', nextSort)
      if (min !== null) params.set('minPrice', String(min))
      if (max !== null) params.set('maxPrice', String(max))
      if (size) params.set('size', size)
      if (color) params.set('color', color)
      return `${partnerSiteProductsApiPath(siteSlug)}?${params.toString()}`
    },
    [categoryId, siteSlug]
  )

  const fetchPage = useCallback(
    async (
      nextOffset: number,
      nextSort: CategorySort,
      min: number | null,
      max: number | null,
      size: string,
      color: string,
      append: boolean
    ) => {
      setLoading(true)
      try {
        const res = await fetch(buildQuery(nextOffset, nextSort, min, max, size, color), { cache: 'no-store' })
        const json = (await res.json()) as {
          products?: PartnerSiteShopProduct[]
          total?: number
          facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }> }
        }
        const next = json.products ?? []
        setProducts((prev) => (append ? [...prev, ...next] : next))
        setOffset(nextOffset + next.length)
        if (typeof json.total === 'number') setTotal(json.total)
        if (!append && json.facets) {
          setFacetSizes(json.facets.sizes ?? [])
          setFacetColors(json.facets.colors ?? [])
        }
      } finally {
        setLoading(false)
      }
    },
    [buildQuery]
  )

  useEffect(() => {
    // Warm facet chips without wiping SSR product list unless filters later change.
    void fetch(buildQuery(0, 'newest', null, null, '', ''), { cache: 'no-store' })
      .then((r) => r.json())
      .then((json: { facets?: { sizes?: Array<{ value: string; count: number }>; colors?: Array<{ value: string; count: number }> } }) => {
        if (json.facets) {
          setFacetSizes(json.facets.sizes ?? [])
          setFacetColors(json.facets.colors ?? [])
        }
      })
      .catch(() => {})
  }, [buildQuery, categoryId])

  const loadMore = useCallback(() => {
    if (loading || products.length >= total) return
    void fetchPage(offset, sort, appliedMinPrice, appliedMaxPrice, sizeFacet, colorFacet, true)
  }, [
    appliedMaxPrice,
    appliedMinPrice,
    colorFacet,
    fetchPage,
    loading,
    offset,
    products.length,
    sizeFacet,
    sort,
    total,
  ])

  const applyFilters = useCallback(() => {
    const min = minPriceInput.trim() ? Math.max(0, Number(minPriceInput)) : null
    const max = maxPriceInput.trim() ? Math.max(0, Number(maxPriceInput)) : null
    setAppliedMinPrice(Number.isFinite(min) ? min : null)
    setAppliedMaxPrice(Number.isFinite(max) ? max : null)
    void fetchPage(
      0,
      sort,
      Number.isFinite(min) ? min : null,
      Number.isFinite(max) ? max : null,
      sizeFacet,
      colorFacet,
      false
    )
  }, [colorFacet, fetchPage, maxPriceInput, minPriceInput, sizeFacet, sort])

  const clearFilters = useCallback(() => {
    setMinPriceInput('')
    setMaxPriceInput('')
    setAppliedMinPrice(null)
    setAppliedMaxPrice(null)
    setSizeFacet('')
    setColorFacet('')
    void fetchPage(0, sort, null, null, '', '', false)
  }, [fetchPage, sort])

  const onSortChange = useCallback(
    (next: CategorySort) => {
      setSort(next)
      void fetchPage(0, next, appliedMinPrice, appliedMaxPrice, sizeFacet, colorFacet, false)
    },
    [appliedMaxPrice, appliedMinPrice, colorFacet, fetchPage, sizeFacet]
  )

  const toggleSize = useCallback(
    (value: string) => {
      const next = sizeFacet === value ? '' : value
      setSizeFacet(next)
      void fetchPage(0, sort, appliedMinPrice, appliedMaxPrice, next, colorFacet, false)
    },
    [appliedMaxPrice, appliedMinPrice, colorFacet, fetchPage, sizeFacet, sort]
  )

  const toggleColor = useCallback(
    (value: string) => {
      const next = colorFacet === value ? '' : value
      setColorFacet(next)
      void fetchPage(0, sort, appliedMinPrice, appliedMaxPrice, sizeFacet, next, false)
    },
    [appliedMaxPrice, appliedMinPrice, fetchPage, sizeFacet, sort, colorFacet]
  )

  const hasActiveFilters =
    appliedMinPrice !== null || appliedMaxPrice !== null || Boolean(sizeFacet) || Boolean(colorFacet)
  const showFilterBar = Boolean(priceRange && priceRange.max > priceRange.min) || facetSizes.length > 0 || facetColors.length > 0

  const priceRangeHint = useMemo(() => {
    if (!priceRange) return ''
    return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale).format(priceRange.min)} – ${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : locale).format(priceRange.max)}`
  }, [locale, priceRange])

  return (
    <div>
      {showFilterBar ? (
        <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
          {facetSizes.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.sizeLabel}</span>
              {facetSizes.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={sizeFacet === f.value ? 'pw-shop-btn' : 'pw-shop-btn pw-shop-btn-outline'}
                  style={{ padding: '5px 10px', fontSize: 12 }}
                  onClick={() => toggleSize(f.value)}
                >
                  {f.value} ({f.count})
                </button>
              ))}
            </div>
          ) : null}
          {facetColors.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{t.colorLabel}</span>
              {facetColors.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={colorFacet === f.value ? 'pw-shop-btn' : 'pw-shop-btn pw-shop-btn-outline'}
                  style={{ padding: '5px 10px', fontSize: 12 }}
                  onClick={() => toggleColor(f.value)}
                >
                  {f.value} ({f.count})
                </button>
              ))}
            </div>
          ) : null}
          {priceRange && priceRange.max > priceRange.min ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                {t.categoryFilterMinPrice}
                <input
                  type="number"
                  min={0}
                  placeholder={priceRangeHint ? String(priceRange.min) : ''}
                  value={minPriceInput}
                  onChange={(e) => setMinPriceInput(e.target.value)}
                  style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                {t.categoryFilterMaxPrice}
                <input
                  type="number"
                  min={0}
                  placeholder={priceRangeHint ? String(priceRange.max) : ''}
                  value={maxPriceInput}
                  onChange={(e) => setMaxPriceInput(e.target.value)}
                  style={{ width: 100, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                />
              </label>
              <button type="button" className="pw-shop-btn" style={{ padding: '7px 14px' }} onClick={applyFilters}>
                {t.categoryFilterApply}
              </button>
              {hasActiveFilters ? (
                <button
                  type="button"
                  className="pw-shop-btn pw-shop-btn-outline"
                  style={{ padding: '7px 14px' }}
                  onClick={clearFilters}
                >
                  {t.categoryFilterClear}
                </button>
              ) : null}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 'auto' }}>
                {t.categorySortLabel}
                <select
                  value={sort}
                  onChange={(e) => onSortChange(e.target.value as CategorySort)}
                  style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}
                >
                  <option value="newest">{t.categorySortNewest}</option>
                  <option value="price_asc">{t.categorySortPriceAsc}</option>
                  <option value="price_desc">{t.categorySortPriceDesc}</option>
                </select>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {products.length === 0 ? (
        <p className="pw-shop-muted">{t.catalogEmpty}</p>
      ) : (
        <div className="pw-shop-grid">
          {products.map((p) => (
            <article key={p.id} className="pw-shop-card">
              <Link href={p.detailPath}>
                <img src={p.imageUrl} alt={p.name} loading="lazy" />
              </Link>
              <div className="pw-shop-card-body">
                <Link href={p.detailPath}>
                  <h3>{p.name}</h3>
                </Link>
                {p.priceHint ? <p className="pw-shop-price">{p.priceHint}</p> : null}
                <Link href={p.detailPath} className="pw-shop-btn" style={{ marginTop: 12 }}>
                  {t.productDetail}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
      {products.length < total ? (
        <p style={{ marginTop: 24 }}>
          <button type="button" className="pw-shop-btn pw-shop-btn-outline" disabled={loading} onClick={loadMore}>
            {loading ? '…' : t.loadMore}
          </button>
        </p>
      ) : null}
    </div>
  )
}

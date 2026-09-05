import { NextRequest, NextResponse } from 'next/server'
import {
  fetchCategoryIdsForInventoryFromPg,
  fetchPartnerCategoriesFlatFromPg,
} from '@/lib/db/messaging-partner-categories-pg'
import {
  fetchPartnerCategoryFacetCountsFromPg,
  fetchPartnerInventoryCardPageByCategoryFromPg,
  fetchPartnerInventoryCardPageByTextSearchFromPg,
  fetchPartnerInventoryShopCardPageFromPg,
  fetchPartnerTextSearchFacetCountsFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { partnerShopFacetDefsForIndustry } from '@/lib/partner-website/shop/partner-shop-industry-facets'
import { findPartnerSearchAliasByKeywordFromPg } from '@/lib/db/messaging-partner-search-aliases-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { inventoryCardRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { toPartnerSiteCardPayload } from '@/lib/partner-website/shop/partner-site-card-payload'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerStorefrontSaleCalendarForRequest } from '@/lib/partner-website/promotions/partner-feature-test-storefront'
import { applyPartnerSiteSaleToShopProduct } from '@/lib/partner-website/promotions/partner-site-sale-display'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = request.nextUrl.searchParams
  const offset = Math.max(0, Number(sp.get('offset') ?? 0) || 0)
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') ?? 24) || 24))
  const q = String(sp.get('q') ?? sp.get('search') ?? '').trim()
  const collection = String(sp.get('collection') ?? sp.get('tag') ?? '').trim()
  const saleRaw = String(sp.get('sale') ?? '').trim().toLowerCase()
  const sale = saleRaw === '1' || saleRaw === 'true' || saleRaw === 'yes'
  const warehouseRaw = String(sp.get('warehouse') ?? '').trim().toLowerCase()
  const warehouse = warehouseRaw === '1' || warehouseRaw === 'true' || warehouseRaw === 'kho-sale'
  const sortRaw = String(sp.get('sort') ?? '').trim().toLowerCase()
  const sort =
    sortRaw === 'newest' || sortRaw === 'name' ? (sortRaw as 'newest' | 'name') : 'default'
  const categorySortRaw = String(sp.get('sort') ?? '').trim().toLowerCase()
  const categorySort =
    categorySortRaw === 'newest' ||
    categorySortRaw === 'oldest' ||
    categorySortRaw === 'views_desc' ||
    categorySortRaw === 'name' ||
    categorySortRaw === 'price_asc' ||
    categorySortRaw === 'price_desc' ||
    categorySortRaw === 'random'
      ? (categorySortRaw as
          | 'newest'
          | 'oldest'
          | 'views_desc'
          | 'name'
          | 'price_asc'
          | 'price_desc'
          | 'random')
      : 'newest'
  /** 188 `/?q=` — sort trống / id_desc / default = ngẫu nhiên. */
  const textSearchSort: typeof categorySort =
    !categorySortRaw || categorySortRaw === 'default' || categorySortRaw === 'id_desc'
      ? 'random'
      : categorySort
  const minPriceRaw = sp.get('min_price') ?? sp.get('minPrice')
  const maxPriceRaw = sp.get('max_price') ?? sp.get('maxPrice')
  const randomSeed = String(sp.get('r') ?? '').trim().slice(0, 32)
  const minPrice = minPriceRaw != null && minPriceRaw !== '' ? Number(minPriceRaw) : undefined
  const maxPrice = maxPriceRaw != null && maxPriceRaw !== '' ? Number(maxPriceRaw) : undefined
  const size = String(sp.get('size') ?? '').trim()
  const color = String(sp.get('color') ?? '').trim()
  const styleTag = String(sp.get('style_tag') ?? sp.get('styleTag') ?? '').trim()
  const ids = String(sp.get('ids') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => UUID_RE.test(x))
    .slice(0, 48)

  // PDP «Sản phẩm tương tự» — same primary category as the current product,
  // current product excluded. Falls back to newest inventory when the product
  // has no category (flat /products shops). `relatedTo` and legacy `related=1&exclude=` both work.
  const relatedRaw = String(sp.get('related') ?? '').trim().toLowerCase()
  const relatedFlag = relatedRaw === '1' || relatedRaw === 'true'
  let categoryId = String(sp.get('categoryId') ?? '').trim()
  let preferIds = ids
  const relatedTo = String(sp.get('relatedTo') ?? '').trim()
  const excludeIds = String(sp.get('exclude') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => UUID_RE.test(x))
    .slice(0, 8)
  let categoryPath: string | null = null
  if (relatedTo && UUID_RE.test(relatedTo) && !excludeIds.includes(relatedTo)) {
    excludeIds.push(relatedTo)
  }
  const relatedSeed = relatedTo && UUID_RE.test(relatedTo) ? relatedTo : excludeIds[0] || ''
  if ((relatedFlag || relatedTo) && relatedSeed && !(categoryId && UUID_RE.test(categoryId))) {
    const links = await fetchCategoryIdsForInventoryFromPg(relatedSeed)
    const primary = links?.find((l) => l.isPrimary) ?? links?.[0]
    if (primary && UUID_RE.test(primary.categoryId)) categoryId = primary.categoryId
  }
  const related = Boolean(relatedFlag || (relatedTo && UUID_RE.test(relatedTo)))

  // M3.4 — keyword alias shortcut before text/vector search.
  if (q && !(categoryId && UUID_RE.test(categoryId)) && preferIds.length === 0) {
    const alias = await findPartnerSearchAliasByKeywordFromPg(shop.partnerId, q)
    if (alias?.inventoryId && UUID_RE.test(alias.inventoryId)) {
      preferIds = [alias.inventoryId]
    } else if (alias?.categoryId && UUID_RE.test(alias.categoryId)) {
      categoryId = alias.categoryId
    }
  }

  const fetchLimit = Math.min(48, limit + excludeIds.length + 1)
  const use188TextSearch =
    Boolean(q) &&
    !(categoryId && UUID_RE.test(categoryId)) &&
    preferIds.length === 0 &&
    !related &&
    !sale &&
    !warehouse &&
    !collection
  const page = use188TextSearch
    ? await fetchPartnerInventoryCardPageByTextSearchFromPg(shop.partnerId, {
        offset,
        limit: fetchLimit,
        q,
        sort: textSearchSort,
        randomSeed: textSearchSort === 'random' ? randomSeed || undefined : undefined,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
        size: size || undefined,
        color: color || undefined,
        styleTag: styleTag || undefined,
      })
    : categoryId && UUID_RE.test(categoryId)
      ? await fetchPartnerInventoryCardPageByCategoryFromPg(shop.partnerId, {
          offset,
          limit: fetchLimit,
          categoryId,
          sort: categorySort,
          randomSeed: categorySort === 'random' ? randomSeed || undefined : undefined,
          minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
          size: size || undefined,
          color: color || undefined,
          styleTag: styleTag || undefined,
        })
      : await fetchPartnerInventoryShopCardPageFromPg(shop.partnerId, {
          offset,
          limit: fetchLimit,
          q: preferIds.length ? undefined : q || undefined,
          collection: collection || undefined,
          sale: sale || undefined,
          warehouse: warehouse || undefined,
          ids: preferIds.length ? preferIds : undefined,
          sort,
        })
  if (!page) return NextResponse.json({ error: 'Could not load products' }, { status: 500 })

  const excludeSet = new Set(excludeIds)
  const saleConfig = await fetchPartnerSaleCalendarConfigFromPg(shop.partnerId)
  const saleCalendar = await resolvePartnerStorefrontSaleCalendarForRequest({
    request,
    partnerId: shop.partnerId,
    settings: saleConfig,
  })
  const mapped = page.rows
    .map((row) => {
      return inventoryCardRowToShopProduct(shop.site.siteSlug, row)
    })
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .filter((p) => !excludeSet.has(p.id))
  const hasMore = mapped.length > limit || offset + limit < page.count
  const products = mapped.slice(0, limit).map((product) =>
    toPartnerSiteCardPayload(
      applyPartnerSiteSaleToShopProduct(product, saleCalendar, {
        clearanceEnabled: saleConfig.clearanceEnabled,
        clearancePercent: saleConfig.clearanceDiscountPercent,
      })
    )
  )

  if (related && categoryId && UUID_RE.test(categoryId)) {
    const flat = await fetchPartnerCategoriesFlatFromPg(shop.partnerId)
    categoryPath = flat?.find((c) => c.id === categoryId)?.path?.trim() || null
  }

  const facetDefs = partnerShopFacetDefsForIndustry(shop.industryKey)
  const facets =
    use188TextSearch && facetDefs.length > 0
      ? await fetchPartnerTextSearchFacetCountsFromPg(shop.partnerId, q)
      : categoryId && UUID_RE.test(categoryId) && facetDefs.length > 0 && !related
        ? await fetchPartnerCategoryFacetCountsFromPg(shop.partnerId, categoryId)
        : null

  // Prefer mapped count when filters drop invalid rows; keep DB total for pagination UI.
  return NextResponse.json({
    ok: true,
    source: use188TextSearch ? 'words' : related ? 'related' : 'shop',
    products,
    saleCalendar,
    hasMore,
    total: products.length < page.rows.length ? products.length : page.count,
    mapped: products.length,
    inventoryTotal: related ? products.length : page.count,
    offset,
    limit,
    facetDefs,
    facets: facets ?? { sizes: [], colors: [], styleTags: [] },
    filters: {
      q: q || null,
      collection: collection || null,
      sale,
      warehouse,
      sort: use188TextSearch
        ? textSearchSort
        : categoryId && UUID_RE.test(categoryId)
          ? categorySort
          : sort,
      ids: ids.length ? ids : null,
      categoryId: categoryId && UUID_RE.test(categoryId) ? categoryId : null,
      categoryPath,
      relatedTo: relatedTo && UUID_RE.test(relatedTo) ? relatedTo : null,
      exclude: excludeIds.length ? excludeIds : null,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
      size: size || null,
      color: color || null,
      styleTag: styleTag || null,
    },
  })
}

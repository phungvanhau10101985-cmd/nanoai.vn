import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerCategoryFacetCountsFromPg,
  fetchPartnerInventoryPageByCategoryFromPg,
  fetchPartnerInventoryShopPageFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { partnerShopFacetDefsForIndustry } from '@/lib/partner-website/shop/partner-shop-industry-facets'
import { findPartnerSearchAliasByKeywordFromPg } from '@/lib/db/messaging-partner-search-aliases-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

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
  const sortRaw = String(sp.get('sort') ?? '').trim().toLowerCase()
  const sort =
    sortRaw === 'newest' || sortRaw === 'name' ? (sortRaw as 'newest' | 'name') : 'default'
  const categorySortRaw = String(sp.get('sort') ?? '').trim().toLowerCase()
  const categorySort =
    categorySortRaw === 'newest' || categorySortRaw === 'name' || categorySortRaw === 'price_asc' || categorySortRaw === 'price_desc'
      ? (categorySortRaw as 'newest' | 'name' | 'price_asc' | 'price_desc')
      : 'newest'
  const minPriceRaw = sp.get('minPrice')
  const maxPriceRaw = sp.get('maxPrice')
  const minPrice = minPriceRaw != null && minPriceRaw !== '' ? Number(minPriceRaw) : undefined
  const maxPrice = maxPriceRaw != null && maxPriceRaw !== '' ? Number(maxPriceRaw) : undefined
  const size = String(sp.get('size') ?? '').trim()
  const color = String(sp.get('color') ?? '').trim()
  const ids = String(sp.get('ids') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => UUID_RE.test(x))
    .slice(0, 48)

  let categoryId = String(sp.get('categoryId') ?? '').trim()
  let preferIds = ids

  // M3.4 — keyword alias shortcut before text/vector search.
  if (q && !(categoryId && UUID_RE.test(categoryId)) && preferIds.length === 0) {
    const alias = await findPartnerSearchAliasByKeywordFromPg(shop.partnerId, q)
    if (alias?.inventoryId && UUID_RE.test(alias.inventoryId)) {
      preferIds = [alias.inventoryId]
    } else if (alias?.categoryId && UUID_RE.test(alias.categoryId)) {
      categoryId = alias.categoryId
    }
  }

  const page =
    categoryId && UUID_RE.test(categoryId)
      ? await fetchPartnerInventoryPageByCategoryFromPg(shop.partnerId, {
          offset,
          limit,
          categoryId,
          sort: categorySort,
          minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
          maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
          size: size || undefined,
          color: color || undefined,
        })
      : await fetchPartnerInventoryShopPageFromPg(shop.partnerId, {
          offset,
          limit,
          q: preferIds.length ? undefined : q || undefined,
          collection: collection || undefined,
          sale: sale || undefined,
          ids: preferIds.length ? preferIds : undefined,
          sort,
        })
  if (!page) return NextResponse.json({ error: 'Could not load products' }, { status: 500 })

  const products = page.rows
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  const facetDefs = partnerShopFacetDefsForIndustry(shop.industryKey)
  const facets =
    categoryId && UUID_RE.test(categoryId) && facetDefs.length > 0
      ? await fetchPartnerCategoryFacetCountsFromPg(shop.partnerId, categoryId)
      : null

  // Prefer mapped count when filters drop invalid rows; keep DB total for pagination UI.
  return NextResponse.json({
    ok: true,
    products,
    total: products.length < page.rows.length ? products.length : page.count,
    mapped: products.length,
    inventoryTotal: page.count,
    offset,
    limit,
    facetDefs,
    facets: facets ?? { sizes: [], colors: [] },
    filters: {
      q: q || null,
      collection: collection || null,
      sale,
      sort: categoryId && UUID_RE.test(categoryId) ? categorySort : sort,
      ids: ids.length ? ids : null,
      categoryId: categoryId && UUID_RE.test(categoryId) ? categoryId : null,
      minPrice: Number.isFinite(minPrice) ? minPrice : null,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : null,
      size: size || null,
      color: color || null,
    },
  })
}

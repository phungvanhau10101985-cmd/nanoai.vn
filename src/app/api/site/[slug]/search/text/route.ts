import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryPageByTextSearchFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { fetchPartnerCategoriesFlatFromPg } from '@/lib/db/messaging-partner-categories-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { matchInventoryForPublicTextSearchApi } from '@/lib/messaging/partner-inventory-text-embedding'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  partnerSiteCategoryPath,
  partnerSiteKhoSalePath,
  partnerSiteProductPath,
} from '@/lib/partner-website/shop/partner-site-shop-paths'
import {
  isSaleListingSearchTerm,
  matchPartnerCategoryPathForSearch,
  tokenizePartnerTextSearch,
} from '@/lib/partner-website/shop/partner-site-text-search'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Same-platform shop text search — 188 `/?q=` principle:
 * 1. Sale keyword → redirect `/kho-sale`
 * 2. Category slug match → redirect `/c/{path}`
 * 3. All words ILIKE on search_document (not description)
 * 4. Vector ANN only when catalog total is 0 (same as NanoAI fallback on 188)
 */

function mapVectorProducts(
  siteSlug: string,
  matches: Array<{
    inventory_id: string
    name: string
    sku: string | null
    image_url: string
    product_url?: string | null
    score?: number | null
  }>
) {
  return matches.map((m) => ({
    id: m.inventory_id,
    inventory_id: m.inventory_id,
    name: m.name,
    sku: m.sku,
    imageUrl: m.image_url,
    image_url: m.image_url,
    productUrl: m.product_url ?? null,
    product_url: m.product_url ?? null,
    priceHint: null as string | null,
    price_hint: null as string | null,
    score: m.score ?? null,
    detailPath: partnerSiteProductPath(siteSlug, m.inventory_id, { name: m.name }),
  }))
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handleTextSearch(request, ctx, 'GET')
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handleTextSearch(request, ctx, 'POST')
}

async function handleTextSearch(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
  method: 'GET' | 'POST'
) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let q = ''
  let limit = getPartnerPublicInventorySearchDefaultLimit()

  if (method === 'POST') {
    try {
      const body = (await request.json()) as { q?: unknown; query?: unknown; limit?: unknown }
      q = String(body.q ?? body.query ?? '').trim()
      if (body.limit != null) {
        const n = parseInt(String(body.limit), 10)
        if (Number.isFinite(n)) limit = n
      }
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  } else {
    const sp = request.nextUrl.searchParams
    q = String(sp.get('q') ?? sp.get('search') ?? '').trim()
    const n = parseInt(String(sp.get('limit') ?? ''), 10)
    if (Number.isFinite(n)) limit = n
  }

  limit = Math.max(1, Math.min(PARTNER_PUBLIC_INVENTORY_SEARCH_MAX, limit))
  if (q.length < 1) {
    return NextResponse.json({ error: 'q required' }, { status: 400 })
  }

  if (isSaleListingSearchTerm(q)) {
    return NextResponse.json({
      ok: true,
      source: 'redirect',
      q,
      products: [],
      total: 0,
      redirect_path: partnerSiteKhoSalePath(shop.site.siteSlug),
    })
  }

  const words = tokenizePartnerTextSearch(q)
  if (words.length) {
    const flat = await fetchPartnerCategoriesFlatFromPg(shop.partnerId, { activeOnly: true })
    const categoryPath = matchPartnerCategoryPathForSearch(q, flat ?? [])
    if (categoryPath) {
      return NextResponse.json({
        ok: true,
        source: 'redirect',
        q,
        products: [],
        total: 0,
        redirect_path: partnerSiteCategoryPath(shop.site.siteSlug, categoryPath),
      })
    }
  }

  const page = words.length
    ? await fetchPartnerInventoryPageByTextSearchFromPg(shop.partnerId, {
        offset: 0,
        limit,
        q,
        sort: 'random',
      })
    : { rows: [], count: 0 }

  if (!page) {
    return NextResponse.json({ error: 'Could not search products' }, { status: 500 })
  }

  if (page.count > 0) {
    const products = page.rows
      .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
      .filter((p): p is NonNullable<typeof p> => Boolean(p))
      .map((p) => ({
        id: p.id,
        inventory_id: p.id,
        name: p.name,
        sku: p.sku || null,
        imageUrl: p.imageUrl,
        image_url: p.imageUrl,
        productUrl: p.productUrl,
        product_url: p.productUrl,
        priceHint: p.priceHint || null,
        price_hint: p.priceHint || null,
        score: null as number | null,
        detailPath: p.detailPath,
      }))
    return NextResponse.json({
      ok: true,
      source: 'words',
      q,
      products,
      total: page.count,
    })
  }

  if (q.length >= 2) {
    const vector = await matchInventoryForPublicTextSearchApi(shop.partnerId, q, limit)
    if (vector.ok && vector.matches.length) {
      const products = mapVectorProducts(shop.site.siteSlug, vector.matches)
      return NextResponse.json({
        ok: true,
        source: 'vector',
        q,
        products,
        total: products.length,
      })
    }
  }

  return NextResponse.json({
    ok: true,
    source: 'words',
    q,
    products: [],
    total: 0,
  })
}

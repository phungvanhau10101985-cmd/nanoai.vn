import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryShopPageFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { matchInventoryForPublicTextSearchApi } from '@/lib/messaging/partner-inventory-text-embedding'
import {
  getPartnerPublicInventorySearchDefaultLimit,
  PARTNER_PUBLIC_INVENTORY_SEARCH_MAX,
} from '@/lib/messaging/partner-public-search-limits'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { partnerSiteProductPath } from '@/lib/partner-website/shop/partner-site-shop-paths'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Same-platform shop text search — no Bearer key.
 * Tries vector text embed first, falls back to inventory `q` filter.
 */
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

  const vector = await matchInventoryForPublicTextSearchApi(shop.partnerId, q, limit)
  if (vector.ok && vector.matches.length) {
    const products = vector.matches.map((m) => ({
      id: m.inventory_id,
      inventory_id: m.inventory_id,
      name: m.name,
      sku: m.sku,
      imageUrl: m.image_url,
      image_url: m.image_url,
      productUrl: m.product_url,
      product_url: m.product_url,
      priceHint: null as string | null,
      price_hint: null as string | null,
      score: m.score ?? null,
      detailPath: partnerSiteProductPath(shop.site.siteSlug, m.inventory_id),
    }))
    return NextResponse.json({
      ok: true,
      source: 'vector',
      q,
      products,
      total: products.length,
    })
  }

  const page = await fetchPartnerInventoryShopPageFromPg(shop.partnerId, {
    offset: 0,
    limit,
    q,
    sort: 'default',
  })
  if (!page) {
    return NextResponse.json({ error: 'Could not search products' }, { status: 500 })
  }

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
    source: 'ilike',
    q,
    products,
    total: page.count,
  })
}

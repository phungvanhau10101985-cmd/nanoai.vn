import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryShopPageFromPg } from '@/lib/db/messaging-partner-inventory-pg'
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
  const ids = String(sp.get('ids') ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter((x) => UUID_RE.test(x))
    .slice(0, 48)

  const page = await fetchPartnerInventoryShopPageFromPg(shop.partnerId, {
    offset,
    limit,
    q: q || undefined,
    collection: collection || undefined,
    sale: sale || undefined,
    ids: ids.length ? ids : undefined,
    sort,
  })
  if (!page) return NextResponse.json({ error: 'Could not load products' }, { status: 500 })

  const products = page.rows
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  // Prefer mapped count when filters drop invalid rows; keep DB total for pagination UI.
  return NextResponse.json({
    ok: true,
    products,
    total: products.length < page.rows.length ? products.length : page.count,
    mapped: products.length,
    inventoryTotal: page.count,
    offset,
    limit,
    filters: {
      q: q || null,
      collection: collection || null,
      sale,
      sort,
      ids: ids.length ? ids : null,
    },
  })
}

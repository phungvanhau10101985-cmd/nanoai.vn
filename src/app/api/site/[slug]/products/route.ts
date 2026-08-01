import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerInventoryActivePageWithCountFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const offset = Math.max(0, Number(request.nextUrl.searchParams.get('offset') ?? 0) || 0)
  const limit = Math.min(48, Math.max(1, Number(request.nextUrl.searchParams.get('limit') ?? 24) || 24))

  const page = await fetchPartnerInventoryActivePageWithCountFromPg(shop.partnerId, offset, limit)
  if (!page) return NextResponse.json({ error: 'Could not load products' }, { status: 500 })

  const products = page.rows
    .map((row) => inventoryRowToShopProduct(shop.site.siteSlug, row))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))

  return NextResponse.json({
    ok: true,
    products,
    total: page.count,
    offset,
    limit,
  })
}

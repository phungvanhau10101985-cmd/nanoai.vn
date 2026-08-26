import { NextRequest, NextResponse } from 'next/server'
import { resolveRelatedProductContext } from '@/lib/partner-website/shop/related-products-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  isSiteProductFavorite,
  resolveSiteVisitorContext,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; inventoryId: string }> }
) {
  const { slug, inventoryId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const id = inventoryId.trim()
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(shop.partnerId, id)
  if (!row || row.is_active === false) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const product = inventoryRowToShopProduct(shop.site.siteSlug, row, { pdp: true })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const relatedCtx = await resolveRelatedProductContext(shop.partnerId, id)
  const productWithCategory = {
    ...product,
    categoryId: relatedCtx.categoryId,
    categoryPath: relatedCtx.categoryPath,
  }

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const isFavorite = await isSiteProductFavorite({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    inventoryId: id,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, product: productWithCategory, is_favorite: isFavorite },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

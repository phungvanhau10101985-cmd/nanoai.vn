import { NextRequest, NextResponse } from 'next/server'
import { resolveRelatedProductContext } from '@/lib/partner-website/shop/related-products-pg'
import { fetchPartnerInventoryRowByIdForPartnerFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { inventoryRowToShopProduct } from '@/lib/partner-website/shop/inventory-to-shop-product'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  isSiteProductFavorite,
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { resolvePartnerStorefrontSaleCalendarForRequest } from '@/lib/partner-website/promotions/partner-feature-test-storefront'
import { applyPartnerStorefrontSaleFaces } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { partnerSiteBirthdayOfferJson } from '@/lib/partner-website/promotions/partner-site-sale-display'
import { pgQueryOne } from '@/lib/db/pg-query'
import { fetchSourceStockInventoryByIdFromPg } from '@/lib/db/messaging-partner-source-stock-pg'
import { enqueueProductViewStockCheckIfNeeded } from '@/lib/messaging/source-stock-check/worker'

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

  const isBuyView = request.nextUrl.searchParams.get('view') === 'buy'
  const product = inventoryRowToShopProduct(shop.site.siteSlug, row, { pdp: !isBuyView })
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  const [saleConfig, clearanceRow] = await Promise.all([
    fetchPartnerSaleCalendarConfigFromPg(shop.partnerId),
    pgQueryOne<{ is_clearance: boolean }>(
      `select is_clearance from public.messaging_partner_inventory
       where partner_id = $1::uuid and id = $2::uuid`,
      [shop.partnerId, id]
    ).catch(() => null),
  ])
  product.isClearance = clearanceRow?.is_clearance === true
  const saleCalendar = await resolvePartnerStorefrontSaleCalendarForRequest({
    request,
    partnerId: shop.partnerId,
    settings: saleConfig,
  })
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const emailNormalized = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  const faced = await applyPartnerStorefrontSaleFaces([product], {
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    linkedUserId: visitor.thread.linkedUserId,
    emailNormalized,
    overlay: {
      state: saleCalendar,
      clearanceEnabled: saleConfig.clearanceEnabled,
      clearancePercent: saleConfig.clearanceDiscountPercent,
    },
  })
  const flashed = faced[0]
  const birthdayOffer = partnerSiteBirthdayOfferJson(flashed)
  if (isBuyView) {
    return jsonSitePersonalization(
      request,
      {
        ok: true,
        product: flashed,
        saleCalendar,
        birthdayOffer,
        is_favorite: false,
      },
      200,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }
  void (async () => {
    try {
      const mini = await fetchSourceStockInventoryByIdFromPg(shop.partnerId, id)
      if (!mini) return
      await enqueueProductViewStockCheckIfNeeded({
        partnerId: shop.partnerId,
        inventoryId: id,
        productUrl: mini.product_url,
        status: mini.source_stock_status,
        checkedAt: mini.source_stock_checked_at,
        nextCheckAt: mini.source_stock_next_check_at,
      })
    } catch {
      /* PDP không chờ kiểm tra nguồn */
    }
  })()

  const relatedCtx = await resolveRelatedProductContext(shop.partnerId, id)
  const productWithCategory = {
    ...flashed,
    categoryId: relatedCtx.categoryId,
    categoryPath: relatedCtx.categoryPath,
  }
  const isFavorite = await isSiteProductFavorite({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    inventoryId: id,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, product: productWithCategory, saleCalendar, birthdayOffer, is_favorite: isFavorite },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

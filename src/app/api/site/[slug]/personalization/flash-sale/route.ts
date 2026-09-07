import { NextRequest, NextResponse } from 'next/server'
import { listPartnerFlashSaleBlockFromPg } from '@/lib/db/messaging-partner-flash-sale-pg'
import { applyPartnerFlashSaleToProduct } from '@/lib/partner-website/promotions/partner-flash-sale'
import { loadPartnerSiteSaleOverlay } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  mapInventoryRowToPersonalizationProduct,
  resolveSiteVisitorContext,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const overlay = await loadPartnerSiteSaleOverlay(shop.partnerId).catch(() => null)
  const block = await listPartnerFlashSaleBlockFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    timezone: overlay?.state.timezone,
  })
  const products = block.rows
    .map((row) => {
      const mapped = mapInventoryRowToPersonalizationProduct(shop.site.siteSlug, row, overlay)
      return mapped ? applyPartnerFlashSaleToProduct(mapped, block.assignment) : null
    })
    .filter((product): product is NonNullable<typeof product> => Boolean(product))

  const res = jsonSitePersonalization(
    request,
    {
      ok: true,
      products,
      countdown_to: block.assignment.slot.endAt.toISOString(),
      slot_start_at: block.assignment.slot.startAt.toISOString(),
      slot_end_at: block.assignment.slot.endAt.toISOString(),
      slot_key: block.assignment.slot.key,
      enabled: block.enabled,
      count: products.length,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
  res.headers.set('Cache-Control', 'private, no-store')
  return res
}

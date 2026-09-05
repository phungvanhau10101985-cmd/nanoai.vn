import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolvePartnerStorefrontSaleCalendarForRequest } from '@/lib/partner-website/promotions/partner-feature-test-storefront'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const config = await fetchPartnerSaleCalendarConfigFromPg(shop.partnerId)
  const state = await resolvePartnerStorefrontSaleCalendarForRequest({
    request,
    partnerId: shop.partnerId,
    settings: config,
  })
  return NextResponse.json({
    ok: true,
    state,
    clearance: {
      enabled: config.clearanceEnabled,
      discountPercent: config.clearanceDiscountPercent,
    },
  })
}

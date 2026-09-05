import { NextResponse } from 'next/server'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolvePartnerSaleCalendarState } from '@/lib/partner-website/promotions/partner-sale-calendar'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const config = await fetchPartnerSaleCalendarConfigFromPg(shop.partnerId)
  const state = resolvePartnerSaleCalendarState({ settings: config })
  return NextResponse.json({
    ok: true,
    state,
    clearance: {
      enabled: config.clearanceEnabled,
      discountPercent: config.clearanceDiscountPercent,
    },
  })
}

import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { fetchShopCheckoutLoginRequiredForPartnerFromPg } from '@/lib/partner-website/shop/shop-checkout-auth'
import { partnerCommerceCartEnabled } from '@/lib/partner-website/partner-capabilities'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const checkoutLoginRequired = await fetchShopCheckoutLoginRequiredForPartnerFromPg(shop.partnerId)
  return NextResponse.json({
    ok: true,
    checkoutLoginRequired,
    cartEnabled: partnerCommerceCartEnabled(shop.capabilities),
    capabilities: shop.capabilities,
  })
}

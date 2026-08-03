import { NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolvePartnerShopSso } from '@/lib/partner-website/shop/resolve-partner-shop-sso'

export const dynamic = 'force-dynamic'

/** Cấu hình SSO shop (Google / customer-token) theo workspace — không cần env từng khách. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const sso = await resolvePartnerShopSso(shop.partnerId, _req)
  return NextResponse.json(sso)
}

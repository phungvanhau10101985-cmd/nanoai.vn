import { NextRequest, NextResponse } from 'next/server'
import {
  listPartnerLoyaltyTiersFromPg,
  resolvePartnerCustomerLoyaltyStatusFromPg,
} from '@/lib/db/messaging-partner-loyalty-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { buildPartnerSiteLoyaltyView } from '@/lib/partner-website/shop/partner-site-loyalty'
import {
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

/**
 * Storefront membership status — same engine as checkout loyalty.
 * Public ladder always; spend/current tier only when the visitor has an account identity.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const emailNormalized = await resolveSiteVisitorEmail(request, shop.partnerId, visitor.thread)
  const [status, tiers] = await Promise.all([
    resolvePartnerCustomerLoyaltyStatusFromPg({
      partnerId: shop.partnerId,
      identity: {
        emailNormalized,
        linkedUserId: visitor.thread.linkedUserId,
        guestAccountId: visitor.thread.guestAccountId,
      },
    }),
    listPartnerLoyaltyTiersFromPg(shop.partnerId),
  ])

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      loyalty: buildPartnerSiteLoyaltyView({
        status,
        tiers: tiers ?? [],
      }),
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

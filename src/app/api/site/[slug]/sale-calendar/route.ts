import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolvePartnerStorefrontSaleCalendarForRequest } from '@/lib/partner-website/promotions/partner-feature-test-storefront'
import { loadPartnerStorefrontBirthdayPercent } from '@/lib/partner-website/promotions/partner-site-sale-attach'
import { resolveSiteVisitorEmail } from '@/lib/partner-website/shop/partner-site-personalization'

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
  const [emailNormalized, sessionUser] = await Promise.all([
    resolveSiteVisitorEmail(request, shop.partnerId),
    getEmailSessionUser(),
  ])
  const birthdayPercent = await loadPartnerStorefrontBirthdayPercent({
    partnerId: shop.partnerId,
    linkedUserId: sessionUser?.id ?? null,
    emailNormalized,
  })
  return NextResponse.json({
    ok: true,
    state,
    birthdayOffer: birthdayPercent > 0 ? { percent: birthdayPercent } : null,
    clearance: {
      enabled: config.clearanceEnabled,
      discountPercent: config.clearanceDiscountPercent,
    },
  })
}

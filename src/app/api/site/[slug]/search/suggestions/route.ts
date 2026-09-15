import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerSearchSuggestionsFromPg,
  fetchPartnerVisitorPersonalizationFromPg,
} from '@/lib/db/messaging-partner-visitor-personalization-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { siteVisitorHasShopAccount } from '@/lib/partner-website/shop/partner-site-search-history'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const loggedIn = siteVisitorHasShopAccount(visitor.thread)
  const recent = loggedIn
    ? (
        (
          await fetchPartnerVisitorPersonalizationFromPg({
            partnerId: shop.partnerId,
            accountKey: visitor.accountKey,
          })
        )?.search_queries ?? []
      ).slice(0, 3)
    : []

  const suggestions = await fetchPartnerSearchSuggestionsFromPg({
    partnerId: shop.partnerId,
    accountKey: loggedIn ? visitor.accountKey : null,
    recentQueries: recent,
    limit: 12,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, loggedIn, suggestions },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

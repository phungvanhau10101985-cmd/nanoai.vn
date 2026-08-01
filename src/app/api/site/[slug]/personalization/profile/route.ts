import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  getSiteVisitorProfile,
  resolveSiteVisitorContext,
  resolveSiteVisitorEmail,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const email = await resolveSiteVisitorEmail(request)
  const profile = await getSiteVisitorProfile({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    thread: visitor.thread,
    email,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, profile },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

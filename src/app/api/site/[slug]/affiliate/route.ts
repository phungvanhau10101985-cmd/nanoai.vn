import { NextRequest, NextResponse } from 'next/server'
import {
  attributePartnerAffiliateVisitFromPg,
  fetchPartnerAffiliateWalletFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const wallet = await fetchPartnerAffiliateWalletFromPg({
    partnerId: shop.partnerId,
    guestAccountId: visitor.thread.guestAccountId,
    linkedUserId: visitor.thread.linkedUserId,
  })
  return jsonSitePersonalization(
    request,
    { ok: true, wallet },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const body = (await request.json().catch(() => null)) as { referralCode?: string } | null
  const ok = await attributePartnerAffiliateVisitFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    referralCode: body?.referralCode ?? '',
  })
  return jsonSitePersonalization(
    request,
    { ok },
    ok ? 200 : 400,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

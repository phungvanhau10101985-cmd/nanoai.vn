import { NextRequest, NextResponse } from 'next/server'
import {
  attributePartnerAffiliateVisitFromPg,
  fetchPartnerAffiliateMeFromPg,
  fetchPartnerAffiliateWalletFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'
import {
  affiliateHasLoggedInIdentity,
  affiliateHasStorefrontIdentity,
  loadPartnerSiteAffiliateStorefront,
} from '@/lib/partner-website/shop/partner-site-affiliate-storefront'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  const [wallet, me] = await Promise.all([
    fetchPartnerAffiliateWalletFromPg(store.identity),
    store.identity.guestAccountId || store.identity.linkedUserId
      ? fetchPartnerAffiliateMeFromPg({ ...store.identity, origin: store.origin })
      : Promise.resolve(null),
  ])
  return jsonSitePersonalization(request, { ok: true, wallet, me }, 200, {
    sessionId: store.visitor.sessionId,
    thread: store.visitor.thread,
  })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  if (!affiliateHasStorefrontIdentity(store) || !affiliateHasLoggedInIdentity(store.identity)) {
    return jsonSitePersonalization(request, { ok: false, error: 'AUTH_REQUIRED' }, 401, {
      sessionId: store.visitor.sessionId,
      thread: store.visitor.thread,
    })
  }
  const body = (await request.json().catch(() => null)) as { referralCode?: string } | null
  const ok = await attributePartnerAffiliateVisitFromPg({
    partnerId: store.shop.partnerId,
    accountKey: store.visitor.accountKey,
    referralCode: body?.referralCode ?? '',
    identity: store.identity,
  })
  return jsonSitePersonalization(request, { ok }, ok ? 200 : 400, {
    sessionId: store.visitor.sessionId,
    thread: store.visitor.thread,
  })
}

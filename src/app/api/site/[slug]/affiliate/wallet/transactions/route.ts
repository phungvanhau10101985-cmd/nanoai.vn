import { NextRequest } from 'next/server'
import {
  ensurePartnerAffiliateProfileFromPg,
  listPartnerAffiliateWalletTransactionsFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'
import {
  affiliateHasStorefrontIdentity,
  jsonAffiliateError,
  jsonAffiliateNotFound,
  jsonAffiliateStorefront,
  loadPartnerSiteAffiliateStorefront,
} from '@/lib/partner-website/shop/partner-site-affiliate-storefront'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return jsonAffiliateNotFound()
  if (!affiliateHasStorefrontIdentity(store)) {
    return jsonAffiliateError(request, store, new Error('AUTH_REQUIRED'))
  }
  const profile = await ensurePartnerAffiliateProfileFromPg(store.identity)
  if (!profile) return jsonAffiliateError(request, store, new Error('AUTH_REQUIRED'))
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get('skip')) || 0)
  const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get('limit')) || 30))
  const transactions = await listPartnerAffiliateWalletTransactionsFromPg({
    partnerId: store.shop.partnerId,
    profileId: profile.id,
    skip,
    limit,
  })
  return jsonAffiliateStorefront(request, store, { ok: true, transactions })
}

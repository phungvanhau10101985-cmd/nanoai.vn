import { NextRequest } from 'next/server'
import {
  fetchPartnerAffiliateApplicationFromPg,
  ensurePartnerAffiliateProfileFromPg,
  submitPartnerAffiliateApplicationFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'
import {
  affiliateHasLoggedInIdentity,
  affiliateHasStorefrontIdentity,
  jsonAffiliateError,
  jsonAffiliateNotFound,
  jsonAffiliateStorefront,
  loadPartnerSiteAffiliateStorefront,
} from '@/lib/partner-website/shop/partner-site-affiliate-storefront'
import { notifyPartnerOwnerAffiliateApplication } from '@/lib/messaging/partner-admin-notifications'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return jsonAffiliateNotFound()
  if (!affiliateHasStorefrontIdentity(store)) {
    return jsonAffiliateStorefront(request, store, { ok: true, application: null })
  }
  const profile = await ensurePartnerAffiliateProfileFromPg(store.identity)
  const application = profile
    ? await fetchPartnerAffiliateApplicationFromPg({
        partnerId: store.shop.partnerId,
        profileId: profile.id,
      })
    : null
  return jsonAffiliateStorefront(request, store, { ok: true, application })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return jsonAffiliateNotFound()
  if (!affiliateHasStorefrontIdentity(store) || !affiliateHasLoggedInIdentity(store.identity)) {
    return jsonAffiliateError(request, store, new Error('AUTH_REQUIRED'))
  }
  const body = (await request.json().catch(() => null)) as {
    social_links?: unknown
    socialLinks?: unknown
    note?: string
  } | null
  try {
    const application = await submitPartnerAffiliateApplicationFromPg({
      ...store.identity,
      socialLinks: body?.social_links ?? body?.socialLinks,
      note: body?.note,
    })
    void notifyPartnerOwnerAffiliateApplication({
      partnerId: store.shop.partnerId,
      email: store.identity.emailNormalized,
    })
    return jsonAffiliateStorefront(request, store, { ok: true, application })
  } catch (error) {
    return jsonAffiliateError(request, store, error)
  }
}

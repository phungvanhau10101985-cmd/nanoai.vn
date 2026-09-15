import { NextRequest } from 'next/server'
import {
  fetchPartnerAffiliateMeFromPg,
  savePartnerAffiliateBankAccountFromPg,
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
    return jsonAffiliateStorefront(request, store, { ok: true, bank_account: null })
  }
  const me = await fetchPartnerAffiliateMeFromPg({ ...store.identity, origin: store.origin })
  return jsonAffiliateStorefront(request, store, { ok: true, bank_account: me?.bank_account ?? null })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return jsonAffiliateNotFound()
  if (!affiliateHasStorefrontIdentity(store)) {
    return jsonAffiliateError(request, store, new Error('AUTH_REQUIRED'))
  }
  const body = (await request.json().catch(() => null)) as {
    bank_name?: string
    bank_account?: string
    account_holder?: string
    otp?: string
  } | null
  try {
    const bank_account = await savePartnerAffiliateBankAccountFromPg({
      ...store.identity,
      bankName: String(body?.bank_name ?? ''),
      bankAccount: String(body?.bank_account ?? ''),
      accountHolder: String(body?.account_holder ?? ''),
      otp: String(body?.otp ?? ''),
    })
    return jsonAffiliateStorefront(request, store, { ok: true, bank_account })
  } catch (error) {
    return jsonAffiliateError(request, store, error)
  }
}

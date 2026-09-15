import { NextRequest } from 'next/server'
import { requestPartnerAffiliateBankOtpFromPg } from '@/lib/db/messaging-partner-affiliate-pg'
import { sendPartnerAffiliateOtpEmail } from '@/lib/messaging/partner-affiliate-otp-email'
import {
  affiliateHasStorefrontIdentity,
  jsonAffiliateError,
  jsonAffiliateNotFound,
  jsonAffiliateStorefront,
  loadPartnerSiteAffiliateStorefront,
} from '@/lib/partner-website/shop/partner-site-affiliate-storefront'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const store = await loadPartnerSiteAffiliateStorefront(request, slug)
  if (!store) return jsonAffiliateNotFound()
  if (!affiliateHasStorefrontIdentity(store)) {
    return jsonAffiliateError(request, store, new Error('AUTH_REQUIRED'))
  }
  const body = (await request.json().catch(() => null)) as { amount?: number } | null
  const email = store.emailNormalized || store.identity.emailNormalized
  if (!email) return jsonAffiliateError(request, store, new Error('EMAIL_REQUIRED'))
  try {
    const otp = await requestPartnerAffiliateBankOtpFromPg({
      ...store.identity,
      purpose: 'withdraw',
      email,
      amount: Number(body?.amount) || 0,
    })
    const sent = await sendPartnerAffiliateOtpEmail({
      partnerId: store.shop.partnerId,
      toEmail: otp.email,
      code: otp.code || '',
      expiresInMinutes: otp.expiresInMinutes,
      purpose: 'withdraw',
    })
    if (!sent) return jsonAffiliateError(request, store, new Error('OTP_SEND_FAILED'))
    return jsonAffiliateStorefront(request, store, {
      ok: true,
      email: otp.email,
      expiresInMinutes: otp.expiresInMinutes,
    })
  } catch (error) {
    return jsonAffiliateError(request, store, error)
  }
}

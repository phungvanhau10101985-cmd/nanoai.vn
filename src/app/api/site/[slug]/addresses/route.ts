import { NextRequest } from 'next/server'
import {
  ensurePartnerCustomerAddressesSeededFromPg,
  insertPartnerCustomerAddressFromPg,
} from '@/lib/db/messaging-partner-customer-addresses-pg'
import { parsePartnerSiteAddressInput } from '@/lib/partner-website/shop/partner-site-customer-address'
import { resolveSiteAddressBookAuth } from '@/lib/partner-website/shop/partner-site-customer-address-auth'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const auth = await resolveSiteAddressBookAuth(request, slug)
  if (!auth.ok) return auth.error

  const addresses = await ensurePartnerCustomerAddressesSeededFromPg({
    partnerId: auth.shop.partnerId,
    emailNormalized: auth.email,
    emailRaw: auth.email,
  })

  return jsonSitePersonalization(
    request,
    { ok: true, addresses },
    200,
    { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
  )
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const auth = await resolveSiteAddressBookAuth(request, slug)
  if (!auth.ok) return auth.error

  const body = parsePartnerSiteAddressInput(await request.json().catch(() => null))
  if (!body) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'INVALID_ADDRESS' },
      400,
      { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
    )
  }

  const address = await insertPartnerCustomerAddressFromPg({
    partnerId: auth.shop.partnerId,
    emailNormalized: auth.email,
    emailRaw: auth.email,
    body,
  })
  if (!address) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'SAVE_FAILED' },
      500,
      { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
    )
  }

  return jsonSitePersonalization(
    request,
    { ok: true, address },
    200,
    { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
  )
}

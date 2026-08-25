import { NextRequest } from 'next/server'
import { setDefaultPartnerCustomerAddressFromPg } from '@/lib/db/messaging-partner-customer-addresses-pg'
import {
  isPartnerSiteAddressId,
  resolveSiteAddressBookAuth,
} from '@/lib/partner-website/shop/partner-site-customer-address-auth'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; addressId: string }> }
) {
  const { slug, addressId } = await ctx.params
  const auth = await resolveSiteAddressBookAuth(request, slug)
  if (!auth.ok) return auth.error
  if (!isPartnerSiteAddressId(addressId)) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'NOT_FOUND' },
      404,
      { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
    )
  }

  const address = await setDefaultPartnerCustomerAddressFromPg({
    partnerId: auth.shop.partnerId,
    emailNormalized: auth.email,
    emailRaw: auth.email,
    addressId: addressId.trim(),
  })
  if (!address) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'SAVE_FAILED' },
      404,
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

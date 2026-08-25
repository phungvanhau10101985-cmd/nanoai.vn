import { NextRequest } from 'next/server'
import {
  deletePartnerCustomerAddressFromPg,
  updatePartnerCustomerAddressFromPg,
} from '@/lib/db/messaging-partner-customer-addresses-pg'
import { parsePartnerSiteAddressInput } from '@/lib/partner-website/shop/partner-site-customer-address'
import {
  isPartnerSiteAddressId,
  resolveSiteAddressBookAuth,
} from '@/lib/partner-website/shop/partner-site-customer-address-auth'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

export async function PUT(
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

  const body = parsePartnerSiteAddressInput(await request.json().catch(() => null))
  if (!body) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'INVALID_ADDRESS' },
      400,
      { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
    )
  }

  const address = await updatePartnerCustomerAddressFromPg({
    partnerId: auth.shop.partnerId,
    emailNormalized: auth.email,
    emailRaw: auth.email,
    addressId: addressId.trim(),
    body,
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

export async function DELETE(
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

  const ok = await deletePartnerCustomerAddressFromPg({
    partnerId: auth.shop.partnerId,
    emailNormalized: auth.email,
    emailRaw: auth.email,
    addressId: addressId.trim(),
  })
  if (!ok) {
    return jsonSitePersonalization(
      request,
      { ok: false, error: 'SAVE_FAILED' },
      404,
      { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
    )
  }

  return jsonSitePersonalization(
    request,
    { ok: true },
    200,
    { sessionId: auth.visitor.sessionId, thread: auth.visitor.thread }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import {
  guardPartnerCatalogApi,
  headlessPersonalizationCorsHeaders,
  jsonHeadlessPersonalizationWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { headlessCustomerRefFromRequest } from '@/lib/messaging/partner-headless-cart-utils'
import {
  getSiteVisitorProfile,
  headlessPersonalizationAccountKey,
} from '@/lib/partner-website/shop/partner-site-personalization'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function gateToResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonHeadlessPersonalizationWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(headlessPersonalizationCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerCatalogApi(req, partnerId)
  if (gate) return gateToResponse(req, gate)

  const customerRef = headlessCustomerRefFromRequest(req, req.nextUrl)
  if (!customerRef) {
    return jsonHeadlessPersonalizationWithCors(
      req,
      { error: 'customer_ref required (query or X-Customer-Ref).' },
      400
    )
  }

  const accountKey = headlessPersonalizationAccountKey(customerRef)
  const profile = await getSiteVisitorProfile({
    partnerId,
    accountKey,
    thread: {
      externalThreadId: accountKey,
      linkedUserId: null,
      guestAccountId: null,
      anonymousSessionId: null,
    },
    email: null,
  })

  return jsonHeadlessPersonalizationWithCors(req, {
    ok: true,
    customer_ref: customerRef,
    profile,
  })
}

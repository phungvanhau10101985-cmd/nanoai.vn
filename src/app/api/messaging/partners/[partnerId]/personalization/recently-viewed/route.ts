import { NextRequest, NextResponse } from 'next/server'
import { fetchPartnerWebsiteByPartnerIdPg } from '@/lib/db/messaging-partner-websites-pg'
import {
  guardPartnerCatalogApi,
  headlessPersonalizationCorsHeaders,
  jsonHeadlessPersonalizationWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import { headlessCustomerRefFromRequest } from '@/lib/messaging/partner-headless-cart-utils'
import {
  getSiteRecentlyViewedProducts,
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

  const site = await fetchPartnerWebsiteByPartnerIdPg(partnerId)
  const siteSlug = site?.isPublished ? site.siteSlug.trim() : ''
  if (!siteSlug) {
    return jsonHeadlessPersonalizationWithCors(req, { error: 'Published site not found.' }, 404)
  }

  const limit = Math.min(24, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 8) || 8))
  const products = await getSiteRecentlyViewedProducts({
    partnerId,
    siteSlug,
    accountKey: headlessPersonalizationAccountKey(customerRef),
    limit,
  })

  return jsonHeadlessPersonalizationWithCors(req, {
    ok: true,
    customer_ref: customerRef,
    products,
    count: products.length,
  })
}

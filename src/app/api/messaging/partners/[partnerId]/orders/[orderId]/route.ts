import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerOrderByIdForPartnerFromPg,
  fetchPartnerOrderLinesFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { guardPartnerInventorySearchApi } from '@/lib/messaging/partner-inventory-search-api-guard'
import {
  catalogCorsHeaders,
  jsonCatalogWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import {
  headlessCustomerRefFromRequest,
  headlessExternalThreadId,
  parseHeadlessCustomerRef,
} from '@/lib/messaging/partner-headless-cart-utils'
import { mapPartnerOrderDetailToHeadless } from '@/lib/messaging/partner-headless-order-mapper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function gateToOrdersResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonCatalogWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(catalogCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * GET chi tiết đơn headless — Bearer, CORS.
 * Query/header tuỳ chọn customer_ref — nếu có thì đơn phải thuộc headless:{customer_ref}.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; orderId: string }> }
) {
  const { partnerId, orderId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'headless-orders')
  if (gate) return gateToOrdersResponse(req, gate)

  const oid = String(orderId ?? '').trim()
  if (!ORDER_ID_RE.test(oid)) {
    return jsonCatalogWithCors(req, { error: 'Invalid order id.' }, 400)
  }

  const order = await fetchPartnerOrderByIdForPartnerFromPg(partnerId, oid)
  if (!order) {
    return jsonCatalogWithCors(req, { error: 'Order not found.' }, 404)
  }

  const customerRef =
    parseHeadlessCustomerRef(req.nextUrl.searchParams.get('customer_ref')) ??
    headlessCustomerRefFromRequest(req, req.nextUrl)

  if (customerRef && order.external_thread_id !== headlessExternalThreadId(customerRef)) {
    return jsonCatalogWithCors(req, { error: 'Order not found.' }, 404)
  }

  const lines = await fetchPartnerOrderLinesFromPg(order.id)

  return jsonCatalogWithCors(
    req,
    {
      ok: true,
      order: mapPartnerOrderDetailToHeadless(order, lines),
    },
    200
  )
}

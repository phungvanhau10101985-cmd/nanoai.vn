import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerOrderByPaymentReferenceForPartnerFromPg,
  fetchPartnerOrdersHeadlessPageFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { guardPartnerInventorySearchApi } from '@/lib/messaging/partner-inventory-search-api-guard'
import {
  catalogCorsHeaders,
  jsonCatalogWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import {
  headlessExternalThreadId,
  headlessCustomerRefFromRequest,
  parseHeadlessCustomerRef,
} from '@/lib/messaging/partner-headless-cart-utils'
import {
  mapPartnerOrderToHeadlessSnapshot,
  parseHeadlessOrderStatusFilter,
} from '@/lib/messaging/partner-headless-order-mapper'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_PAGE = 100

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
 * GET danh sách đơn headless — Bearer, CORS.
 * Query: offset, limit (max 100), customer_ref (lọc đơn headless checkout),
 * status (awaiting_payment | payment_checking | paid_verified | pending_manual_review | cancelled),
 * payment_reference (một đơn theo mã CK — trả về orders[] 0–1 phần tử).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'headless-orders')
  if (gate) return gateToOrdersResponse(req, gate)

  const paymentReference = req.nextUrl.searchParams.get('payment_reference')?.trim() ?? ''
  if (paymentReference) {
    const order = await fetchPartnerOrderByPaymentReferenceForPartnerFromPg(partnerId, paymentReference)
    const customerRefFilter = parseHeadlessCustomerRef(
      req.nextUrl.searchParams.get('customer_ref') ?? req.headers.get('x-customer-ref')
    )
    if (order && customerRefFilter && order.external_thread_id !== headlessExternalThreadId(customerRefFilter)) {
      return jsonCatalogWithCors(req, { ok: true, orders: [], total: 0, offset: 0, limit: 1 }, 200)
    }
    return jsonCatalogWithCors(req, {
      ok: true,
      orders: order ? [mapPartnerOrderToHeadlessSnapshot(order)] : [],
      total: order ? 1 : 0,
      offset: 0,
      limit: 1,
      payment_reference: paymentReference.toUpperCase(),
    })
  }

  const customerRef = headlessCustomerRefFromRequest(req, req.nextUrl)

  const statusRaw = req.nextUrl.searchParams.get('status')
  const statusFilter = parseHeadlessOrderStatusFilter(statusRaw)
  if (statusRaw?.trim() && !statusFilter) {
    return jsonCatalogWithCors(req, { error: 'Invalid status filter.' }, 400)
  }

  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset') ?? 0) || 0)
  const limit = Math.min(
    MAX_PAGE,
    Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? 24) || 24)
  )

  const page = await fetchPartnerOrdersHeadlessPageFromPg({
    partnerId,
    externalThreadId: customerRef ? headlessExternalThreadId(customerRef) : null,
    status: statusFilter,
    offset,
    limit,
  })

  if (!page) {
    return jsonCatalogWithCors(req, { error: 'Could not load orders.' }, 500)
  }

  return jsonCatalogWithCors(req, {
    ok: true,
    orders: page.rows.map(mapPartnerOrderToHeadlessSnapshot),
    total: page.count,
    offset,
    limit,
    ...(customerRef ? { customer_ref: customerRef } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  })
}

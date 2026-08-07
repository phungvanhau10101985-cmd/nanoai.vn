import { NextRequest, NextResponse } from 'next/server'
import {
  fetchMessagingGuestCartFromPg,
  upsertMessagingGuestCartFromPg,
} from '@/lib/db/messaging-guest-cart-pg'
import { guardPartnerInventorySearchApi } from '@/lib/messaging/partner-inventory-search-api-guard'
import {
  headlessCartCorsHeaders,
  jsonHeadlessCartWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import {
  headlessAccountKey,
  headlessCustomerRefFromRequest,
  parseHeadlessCustomerRef,
  sanitizeHeadlessCartItems,
} from '@/lib/messaging/partner-headless-cart-utils'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function gateToCartResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonHeadlessCartWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(headlessCartCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * GET/PUT giỏ hàng headless — Bearer + customer_ref (query hoặc header X-Customer-Ref).
 * Lưu server-side theo khóa headless:{customer_ref}; merchant backend giữ ref ổn định cho từng khách.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'headless-cart')
  if (gate) return gateToCartResponse(req, gate)

  const customerRef = headlessCustomerRefFromRequest(req, req.nextUrl)
  if (!customerRef) {
    return jsonHeadlessCartWithCors(req, { error: 'customer_ref required (query or X-Customer-Ref).' }, 400)
  }

  const items = await fetchMessagingGuestCartFromPg({
    partnerId,
    accountKey: headlessAccountKey(customerRef),
  })

  return jsonHeadlessCartWithCors(
    req,
    {
      ok: true,
      customer_ref: customerRef,
      items: Array.isArray(items) ? items : [],
    },
    200
  )
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'headless-cart')
  if (gate) return gateToCartResponse(req, gate)

  const body = (await req.json().catch(() => null)) as {
    customer_ref?: string
    items?: unknown
  } | null

  const customerRef = parseHeadlessCustomerRef(body?.customer_ref ?? headlessCustomerRefFromRequest(req, req.nextUrl))
  if (!customerRef) {
    return jsonHeadlessCartWithCors(
      req,
      { error: 'customer_ref required (body, query, or X-Customer-Ref).' },
      400
    )
  }

  const items = sanitizeHeadlessCartItems(body?.items)
  const ok = await upsertMessagingGuestCartFromPg({
    partnerId,
    accountKey: headlessAccountKey(customerRef),
    cartItems: items,
  })
  if (!ok) {
    return jsonHeadlessCartWithCors(req, { error: 'Could not save cart.' }, 500)
  }

  return jsonHeadlessCartWithCors(
    req,
    { ok: true, customer_ref: customerRef, item_count: Array.isArray(items) ? items.length : 0 },
    200
  )
}

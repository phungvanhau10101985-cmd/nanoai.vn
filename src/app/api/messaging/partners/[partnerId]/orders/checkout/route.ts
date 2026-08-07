import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { upsertMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'
import { completeCartCheckout } from '@/lib/messaging/guest-chat-ordering'
import { guardPartnerInventorySearchApi } from '@/lib/messaging/partner-inventory-search-api-guard'
import {
  headlessWriteCorsHeaders,
  jsonHeadlessWriteWithCors,
} from '@/lib/messaging/partner-catalog-api-guard'
import {
  headlessAccountKey,
  headlessExternalThreadId,
  parseHeadlessCartCheckoutLines,
  parseHeadlessCustomerRef,
} from '@/lib/messaging/partner-headless-cart-utils'
import { mapPartnerOrderToHeadlessSnapshot } from '@/lib/messaging/partner-headless-order-mapper'
import { runMetaPurchaseAfterOrderComplete } from '@/lib/tracking/meta-purchase-after-order'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

async function gateToCheckoutResponse(req: Request, gate: NextResponse) {
  let body: unknown
  try {
    body = await gate.json()
  } catch {
    body = { error: 'Request rejected.' }
  }
  return jsonHeadlessWriteWithCors(req, body, gate.status)
}

export async function OPTIONS(req: Request) {
  const h = new Headers(headlessWriteCorsHeaders(req))
  h.set('Access-Control-Max-Age', '86400')
  return new NextResponse(null, { status: 204, headers: h })
}

/**
 * POST checkout headless — Bearer + customer_ref + items + form giao hàng.
 * Tạo đơn messaging (QR cọc, trạng thái) giống checkout trên /site hoặc widget chat.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const gate = await guardPartnerInventorySearchApi(req, partnerId, 'headless-checkout')
  if (gate) return gateToCheckoutResponse(req, gate)

  const body = (await req.json().catch(() => null)) as {
    customer_ref?: string
    items?: unknown
    form?: {
      customerName?: string
      customerPhone?: string
      shippingAddress?: string
      customerEmail?: string
      note?: string
    }
  } | null

  const customerRef = parseHeadlessCustomerRef(body?.customer_ref)
  if (!customerRef) {
    return jsonHeadlessWriteWithCors(req, { error: 'customer_ref required (1–120 chars, [a-zA-Z0-9._-]).' }, 400)
  }

  const f = body?.form ?? {}
  const customerName = String(f.customerName ?? '').trim()
  const customerPhone = String(f.customerPhone ?? '').trim()
  const shippingAddress = String(f.shippingAddress ?? '').trim()
  const customerEmail = String(f.customerEmail ?? '').trim().toLowerCase()
  const note = String(f.note ?? '').trim()

  const missing: string[] = []
  if (!customerName) missing.push('customerName')
  if (!customerPhone) missing.push('customerPhone')
  if (!shippingAddress) missing.push('shippingAddress')
  if (missing.length > 0) {
    return jsonHeadlessWriteWithCors(
      req,
      { error: 'Missing required form fields.', missing_fields: missing },
      400
    )
  }

  const lines = parseHeadlessCartCheckoutLines(body?.items)
  if (lines.length === 0) {
    return jsonHeadlessWriteWithCors(req, { error: 'Cart has no valid products.' }, 400)
  }

  const externalThreadId = headlessExternalThreadId(customerRef)
  const done = await completeCartCheckout({
    partnerId,
    externalThreadId,
    customerName: customerName || customerEmail || `Headless ${customerRef}`,
    linkedUserId: null,
    guestAccountId: null,
    form: {
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      note,
      lines,
    },
  })

  if ('error' in done) {
    return jsonHeadlessWriteWithCors(req, { error: done.error }, 400)
  }

  await upsertMessagingGuestCartFromPg({
    partnerId,
    accountKey: headlessAccountKey(customerRef),
    cartItems: [],
  })

  let metaPurchase = null as Awaited<ReturnType<typeof runMetaPurchaseAfterOrderComplete>>
  if (isPgConfigured()) {
    try {
      metaPurchase = await runMetaPurchaseAfterOrderComplete({
        partnerId,
        order: done.order,
        request: req,
      })
    } catch (e) {
      console.warn('[headless checkout] meta purchase', e)
    }
  }

  return jsonHeadlessWriteWithCors(
    req,
    {
      ok: true,
      customer_ref: customerRef,
      order: mapPartnerOrderToHeadlessSnapshot(done.order),
      ...(metaPurchase ? { meta_purchase: metaPurchase } : {}),
    },
    200
  )
}

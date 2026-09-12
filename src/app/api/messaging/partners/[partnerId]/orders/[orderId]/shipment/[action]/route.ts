import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerOrderFulfillmentContextFromPg,
  fetchPartnerOrderShipmentEventsFromPg,
} from '@/lib/db/messaging-partner-order-shipment-pg'
import { runAdminShipmentAction } from '@/lib/messaging/fulfillment/order-fulfillment-service'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

type Ctx = { params: Promise<{ partnerId: string; orderId: string; action: string }> }

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured', userId: '' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error, userId: '' }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'orders')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error, userId: '' }
  return { ok: true as const, userId: auth.user.id }
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { partnerId, orderId, action } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  if (action !== 'events') return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
  const order = await fetchPartnerOrderFulfillmentContextFromPg(orderId)
  if (!order || order.partnerId !== partnerId) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  return NextResponse.json({ ok: true, events, fulfillment_source: order.fulfillmentSource })
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { partnerId, orderId, action } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const mapped =
    action === 'clear-customs'
      ? 'clear_customs'
      : action === 'start-vn-packing'
        ? 'start_vn_packing'
        : action === 'mark-out-for-confirm'
          ? 'mark_out_for_confirm'
          : null
  if (!mapped) return NextResponse.json({ error: 'Unknown action' }, { status: 404 })
  const body = (await req.json().catch(() => null)) as {
    note?: string
    shippingProvider?: string
    trackingNumber?: string
  } | null
  const result = await runAdminShipmentAction({
    orderId,
    action: mapped,
    updatedBy: auth.userId,
    note: String(body?.note || '').slice(0, 500),
    shippingProvider: String(body?.shippingProvider || '').slice(0, 80),
    trackingNumber: String(body?.trackingNumber || '').slice(0, 80),
  })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 409 })
  const events = await fetchPartnerOrderShipmentEventsFromPg(orderId)
  return NextResponse.json({ ok: true, events })
}

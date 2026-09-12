import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerOrderForPublicTrackingFromPg,
  fetchPartnerOrderLinesFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { fetchPartnerOrderShipmentEventsFromPg } from '@/lib/db/messaging-partner-order-shipment-pg'
import { fetchEmsTracking } from '@/lib/messaging/shipping/ems-tracking'
import { looksLikeEmsTrackingCode } from '@/lib/messaging/shipping/ems-excel'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

function publicTrackingPayload(order: NonNullable<Awaited<ReturnType<typeof fetchPartnerOrderForPublicTrackingFromPg>>>) {
  return {
    id: order.id,
    payment_reference: order.payment_reference || null,
    status: order.status,
    shipping_status: order.shipping_status,
    customer_name: order.customer_name,
    shipping_address: order.shipping_address,
    currency: order.currency,
    subtotal_amount: order.subtotal_amount,
    total_discount_amount: order.total_discount_amount,
    amount_after_discount: order.amount_after_discount,
    required_amount: order.required_amount,
    paid_amount: order.paid_amount,
    created_at: order.created_at,
    updated_at: order.updated_at,
    product_name: order.product_name,
    product_image_url: order.product_image_url,
    quantity: order.quantity,
  }
}

async function trackOrder(partnerId: string, orderCode: string, phone: string) {
  const order = await fetchPartnerOrderForPublicTrackingFromPg(partnerId, orderCode, phone)
  if (!order) return null
  const lines = await fetchPartnerOrderLinesFromPg(order.id)
  const events = await fetchPartnerOrderShipmentEventsFromPg(order.id)
  const tracking = String(order.tracking_number || '').trim()
  let emsEvents: Array<{ description: string; address: string; tracedAt: string }> = []
  if (tracking && looksLikeEmsTrackingCode(tracking)) {
    const live = await fetchEmsTracking(tracking).catch(() => null)
    emsEvents = (live?.events || []).map((e) => ({
      description: e.description,
      address: e.address || '',
      tracedAt: e.traced_at || '',
    }))
  }
  const shipmentTimeline =
    events.length > 0
      ? events.map((event) => ({
          key: event.stepKey,
          title: event.title,
          status: event.status,
          at: event.completedAt || event.scheduledAt,
          done: event.status === 'completed',
          active: event.status === 'active',
        }))
      : [
          { key: 'created', at: order.created_at, done: true, active: false, title: '' },
          {
            key: 'confirmed',
            at: null,
            done: ['confirmed', 'packing', 'shipping', 'delivered'].includes(order.shipping_status),
            active: order.shipping_status === 'confirmed',
            title: '',
          },
          {
            key: 'packing',
            at: null,
            done: ['packing', 'shipping', 'delivered'].includes(order.shipping_status),
            active: order.shipping_status === 'packing',
            title: '',
          },
          {
            key: 'shipping',
            at: null,
            done: ['shipping', 'delivered'].includes(order.shipping_status),
            active: order.shipping_status === 'shipping',
            title: '',
          },
          {
            key: 'delivered',
            at: null,
            done: order.shipping_status === 'delivered',
            active: false,
            title: '',
          },
        ]
  return {
    order: {
      ...publicTrackingPayload(order),
      fulfillment_source: order.fulfillment_source,
      source_platform: order.source_platform,
      tracking_number: order.tracking_number || null,
      shipping_provider: order.shipping_provider || null,
    },
    lines: lines.map((line) => ({
      id: line.id,
      product_name: line.product_name,
      product_image_url: line.product_image_url,
      product_url: line.product_url,
      unit_price: line.unit_price,
      quantity: line.quantity,
      line_subtotal: line.line_subtotal,
      variant_color: line.variant_color,
      variant_size: line.variant_size,
    })),
    timeline: shipmentTimeline,
    emsEvents,
  }
}

/** GET ?code=&phone= — tra cứu đơn công khai. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const code = String(request.nextUrl.searchParams.get('code') ?? '').trim()
  const phone = String(request.nextUrl.searchParams.get('phone') ?? '').trim()
  if (code.length < 4 || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'code and phone required' }, { status: 400 })
  }

  const result = await trackOrder(shop.partnerId, code, phone)
  if (!result) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ...result })
}

/** POST { code, phone } — cùng logic GET (dùng cho form HTML). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as { code?: string; phone?: string } | null
  const code = String(body?.code ?? '').trim()
  const phone = String(body?.phone ?? '').trim()
  if (code.length < 4 || phone.replace(/\D/g, '').length < 8) {
    return NextResponse.json({ error: 'code and phone required' }, { status: 400 })
  }

  const result = await trackOrder(shop.partnerId, code, phone)
  if (!result) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ...result })
}

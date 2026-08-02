import { NextRequest, NextResponse } from 'next/server'
import {
  fetchPartnerOrderForPublicTrackingFromPg,
  fetchPartnerOrderLinesFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { isPgConfigured } from '@/lib/db/pool'
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
  return {
    order: publicTrackingPayload(order),
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
    timeline: [
      { key: 'created', at: order.created_at, done: true },
      {
        key: 'confirmed',
        at: null,
        done: ['confirmed', 'packing', 'shipping', 'delivered'].includes(order.shipping_status),
      },
      {
        key: 'packing',
        at: null,
        done: ['packing', 'shipping', 'delivered'].includes(order.shipping_status),
      },
      {
        key: 'shipping',
        at: null,
        done: ['shipping', 'delivered'].includes(order.shipping_status),
      },
      {
        key: 'delivered',
        at: null,
        done: order.shipping_status === 'delivered',
      },
    ],
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

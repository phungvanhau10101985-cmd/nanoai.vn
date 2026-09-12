import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import { fetchPartnerOrderDetailForGuestWidgetIfAllowed } from '@/lib/messaging/guest-chat-ordering'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import {
  depositQrDownloadFilename,
} from '@/lib/messaging/deposit-qr-image'
import { fetchDepositQrImageBytes } from '@/lib/messaging/fetch-deposit-qr-image'
import { displayShopOrderCode } from '@/lib/messaging/shop-payment-reference'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ slug: string; orderId: string }> }
) {
  const { slug, orderId } = await ctx.params
  const partner = await resolveCommerceOrderPartnerBySlug(slug)
  if ('error' in partner) {
    const err = commercePartnerErrorResponse(partner.error)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const oid = String(orderId ?? '').trim()
  if (!oid) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const order = await fetchPartnerOrderDetailForGuestWidgetIfAllowed(partner.partnerId, oid, thread)
  if (!order) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const qrUrl = String(order.payment_qr_url ?? '').trim()
  if (!qrUrl) return NextResponse.json({ error: 'QR unavailable' }, { status: 404 })

  try {
    const raw = await fetchDepositQrImageBytes(qrUrl)
    const code = displayShopOrderCode(order.payment_reference || '') || order.id.slice(0, 8)
    const filename = depositQrDownloadFilename(code)
    return new NextResponse(new Uint8Array(raw), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.warn('[deposit-qr-image]', e)
    return NextResponse.json({ error: 'QR fetch failed' }, { status: 502 })
  }
}

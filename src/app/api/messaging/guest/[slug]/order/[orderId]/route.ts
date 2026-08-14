import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import { fetchPartnerOrderDetailForGuestWidgetIfAllowed } from '@/lib/messaging/guest-chat-ordering'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import {
  cancelPartnerOrderForConversationFromPg,
  confirmPartnerOrderReceivedForConversationFromPg,
  insertPartnerOrderEventFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import { notifyPartnerOwnerOrderCustomerAction } from '@/lib/messaging/partner-admin-notifications'
import { notifyPartnerCustomerOrderUpdateFromPg } from '@/lib/db/messaging-partner-customer-notifications-pg'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  return resolveCommerceOrderPartnerBySlug(slug)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await ctx.params
  const partner = await resolvePartner(slug)
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

  return NextResponse.json({
    order,
    partner_display_name: partner.displayName,
    partner_slug: slug,
  })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    const err = commercePartnerErrorResponse(partner.error)
    return NextResponse.json({ error: err.message }, { status: err.status })
  }
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!thread) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const oid = String(orderId ?? '').trim()
  if (!oid) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const existing = await fetchPartnerOrderDetailForGuestWidgetIfAllowed(partner.partnerId, oid, thread)
  if (!existing) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const convId =
    existing.conversation_id ||
    (await fetchGuestWidgetConversationIdFromPg(partner.partnerId, thread.externalThreadId))
  if (!convId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string }
  const action = String(body.action ?? '').trim()

  if (action === 'cancel') {
    const reason = String(body.reason ?? '').trim() || 'Khách hàng hủy'
    const updated = await cancelPartnerOrderForConversationFromPg({
      partnerId: partner.partnerId,
      conversationId: convId,
      orderId: oid,
      reason,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Cannot cancel this order' }, { status: 409 })
    }
    await insertPartnerOrderEventFromPg({
      orderId: updated.id,
      eventType: 'status',
      title: 'Khách hủy đơn',
      detail: reason,
      source: 'customer',
    })
    void notifyPartnerOwnerOrderCustomerAction({
      partnerId: partner.partnerId,
      title: 'Khách hủy đơn',
      body: `${updated.customer_name || 'Khách'} đã hủy đơn ${updated.payment_reference || updated.id.slice(0, 8)}.`,
    })
    void notifyPartnerCustomerOrderUpdateFromPg({
      partnerId: partner.partnerId,
      conversationId: updated.conversation_id,
      title: `Đơn ${updated.payment_reference || updated.id.slice(0, 8)}`,
      body: 'Bạn đã hủy đơn hàng.',
    })
    return NextResponse.json({ ok: true, order: updated })
  }

  if (action === 'confirm_received') {
    const updated = await confirmPartnerOrderReceivedForConversationFromPg({
      partnerId: partner.partnerId,
      conversationId: convId,
      orderId: oid,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Cannot confirm received' }, { status: 409 })
    }
    await insertPartnerOrderEventFromPg({
      orderId: updated.id,
      eventType: 'shipping_status',
      title: 'Khách xác nhận đã nhận hàng',
      detail: 'shipping → delivered',
      source: 'customer',
    })
    void notifyPartnerOwnerOrderCustomerAction({
      partnerId: partner.partnerId,
      title: 'Khách đã nhận hàng',
      body: `${updated.customer_name || 'Khách'} xác nhận đã nhận đơn ${updated.payment_reference || updated.id.slice(0, 8)}.`,
    })
    void notifyPartnerCustomerOrderUpdateFromPg({
      partnerId: partner.partnerId,
      conversationId: updated.conversation_id,
      title: `Đơn ${updated.payment_reference || updated.id.slice(0, 8)}`,
      body: 'Bạn đã xác nhận nhận hàng.',
    })
    return NextResponse.json({ ok: true, order: updated })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

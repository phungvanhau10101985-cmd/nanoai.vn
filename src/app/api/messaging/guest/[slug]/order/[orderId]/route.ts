import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import {
  buildGuestOrderDepositView,
  fetchPartnerOrderDetailForGuestWidgetIfAllowed,
  updateCartOrderDepositPercent,
} from '@/lib/messaging/guest-chat-ordering'
import { buildGuestOrderPagePayload } from '@/lib/messaging/load-guest-order-page'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import { fetchGuestWidgetConversationIdFromPg } from '@/lib/db/customer-care-pg'
import {
  cancelPartnerOrderForConversationFromPg,
  confirmPartnerOrderReceivedForConversationFromPg,
  insertPartnerOrderEventFromPg,
} from '@/lib/db/messaging-partner-orders-pg'
import {
  onPartnerOrderCancelledFulfillment,
  onPartnerOrderCustomerConfirmedReceived,
  partnerOrderCanConfirmReceived,
} from '@/lib/messaging/fulfillment/order-fulfillment-service'
import { notifyPartnerOwnerOrderCustomerAction } from '@/lib/messaging/partner-admin-notifications'
import { emailCustomerOrderCancelled } from '@/lib/messaging/partner-order-customer-email'
import { notifyPartnerCustomerDeliveredWebApp } from '@/lib/messaging/partner-customer-webapp-notify'
import { sendPartnerOrderDeliveredReviewOnce } from '@/lib/messaging/partner-order-review-reminder'

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

  if (request.nextUrl.searchParams.get('poll') === '1') {
    return NextResponse.json({ order })
  }

  return NextResponse.json(
    await buildGuestOrderPagePayload({
      partnerId: partner.partnerId,
      partnerDisplayName: partner.displayName,
      slug,
      order,
    })
  )
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

  const body = (await request.json().catch(() => ({}))) as { action?: string; reason?: string; percent?: number }
  const action = String(body.action ?? '').trim()

  if (action === 'set_deposit_percent') {
    const result = await updateCartOrderDepositPercent({
      partnerId: partner.partnerId,
      orderId: oid,
      thread,
      percent: Number(body.percent),
    })
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 409 })
    }
    const view = await buildGuestOrderDepositView({ partnerId: partner.partnerId, order: result.order })
    return NextResponse.json({ ok: true, ...view })
  }

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
    void import('@/lib/db/messaging-partner-affiliate-pg')
      .then(({ clawbackPartnerAffiliateForOrderFromPg }) =>
        clawbackPartnerAffiliateForOrderFromPg({
          partnerId: partner.partnerId,
          orderId: updated.id,
        })
      )
      .catch((error) => console.warn('[cancel_order:affiliate]', error))
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
    try {
      await emailCustomerOrderCancelled({
        order: updated,
        reason,
        byCustomer: true,
      })
    } catch (e) {
      console.warn('[cancel_order:customer-notify]', e)
    }
    await onPartnerOrderCancelledFulfillment(updated.id)
    return NextResponse.json({ ok: true, order: updated })
  }

  if (action === 'confirm_received') {
    const allowed = await partnerOrderCanConfirmReceived(oid, existing.shipping_status)
    if (!allowed) {
      return NextResponse.json({ error: 'Cannot confirm received' }, { status: 409 })
    }
    const updated = await confirmPartnerOrderReceivedForConversationFromPg({
      partnerId: partner.partnerId,
      conversationId: convId,
      orderId: oid,
    })
    if (!updated) {
      return NextResponse.json({ error: 'Cannot confirm received' }, { status: 409 })
    }
    void import('@/lib/messaging/partner-promotion-auto-grant')
      .then(({ processFirstDeliveredOrderPromotion }) =>
        processFirstDeliveredOrderPromotion({
          partnerId: partner.partnerId,
          orderId: updated.id,
          conversationId: updated.conversation_id,
          emailNormalized: updated.customer_email,
        })
      )
      .catch((error) =>
        console.warn('[confirm_received:first-delivered-promotion]', error)
      )
    void import('@/lib/db/messaging-partner-affiliate-pg')
      .then(({ transitionPartnerAffiliateCommissionFromPg }) =>
        transitionPartnerAffiliateCommissionFromPg({
          partnerId: partner.partnerId,
          orderId: updated.id,
          state: 'confirmed',
        })
      )
      .catch((error) => console.warn('[confirm_received:affiliate]', error))
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
    try {
      await notifyPartnerCustomerDeliveredWebApp(updated, 'customer_confirm')
    } catch (e) {
      console.warn('[confirm_received:customer-notify]', e)
    }
    try {
      await sendPartnerOrderDeliveredReviewOnce({ order: updated })
    } catch (e) {
      console.warn('[confirm_received:review-email]', e)
    }
    await onPartnerOrderCustomerConfirmedReceived(updated.id)
    return NextResponse.json({ ok: true, order: updated })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

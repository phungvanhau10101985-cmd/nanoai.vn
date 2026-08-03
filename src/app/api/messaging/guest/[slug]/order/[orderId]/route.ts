import { NextRequest, NextResponse } from 'next/server'
import {
  commercePartnerErrorResponse,
  resolveCommerceOrderPartnerBySlug,
} from '@/lib/messaging/resolve-commerce-partner'
import { fetchPartnerOrderDetailForGuestWidgetIfAllowed } from '@/lib/messaging/guest-chat-ordering'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'

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

import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { fetchPartnerOrderDetailForGuestWidgetIfAllowed } from '@/lib/messaging/guest-chat-ordering'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  if (active.industry_key === 'hotel') return { error: 'hospitality_uses_hospitality_api' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) {
    const status = partner.error === 'hospitality_uses_hospitality_api' ? 409 : 404
    const error =
      partner.error === 'hospitality_uses_hospitality_api'
        ? 'Hospitality uses dedicated booking APIs.'
        : 'Not found'
    return NextResponse.json({ error }, { status })
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

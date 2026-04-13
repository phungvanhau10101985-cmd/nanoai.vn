import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'
import { fetchPartnerOrderDetailForGuestWidgetIfAllowed } from '@/lib/messaging/guest-chat-ordering'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, displayName: active.display_name }
}

async function resolveThread(
  request: NextRequest
): Promise<{ externalThreadId: string; linkedUserId: string | null; guestAccountId: string | null } | null> {
  const user = await getEmailSessionUser()
  if (user?.id) return { externalThreadId: user.id, linkedUserId: user.id, guestAccountId: null }
  const accountId = readGuestAccountIdFromRequest(request)
  if (accountId) return { externalThreadId: accountId, linkedUserId: null, guestAccountId: accountId }
  const sessionId = readGuestSessionIdFromRequest(request)
  if (!sessionId) return null
  return { externalThreadId: sessionId, linkedUserId: null, guestAccountId: null }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string; orderId: string }> }) {
  const { slug, orderId } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveThread(request)
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

import { NextRequest, NextResponse } from 'next/server'
import { resolveFashionMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { applyGuestIdentityToResponse } from '@/lib/messaging/guest-auth-session'
import {
  resolveGuestIdentity,
  upsertGuestAccountForGoogleIdentity,
} from '@/lib/messaging/guest-widget-identity'
import {
  fetchGuestWidgetConversationIdFromPg,
  upsertConsultedProductKeyForConversationFromPg,
} from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  const active = await resolveFashionMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const body = (await request.json().catch(() => null)) as {
    productUrlKey?: string
    sourceMessageId?: string
  } | null
  const productUrlKey = typeof body?.productUrlKey === 'string' ? body.productUrlKey.trim() : ''
  const sourceMessageId = typeof body?.sourceMessageId === 'string' ? body.sourceMessageId.trim() : ''

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId } = r

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  let effectiveExternalThreadId = identity.externalThreadId
  let effectiveGuestAccountId = identity.guestAccountId
  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(partnerId, request, identity.user)
    if (accountId) {
      effectiveGuestAccountId = accountId
      effectiveExternalThreadId = accountId
    }
  }

  const convIdPg = await fetchGuestWidgetConversationIdFromPg(partnerId, effectiveExternalThreadId)
  if (!convIdPg) {
    return NextResponse.json({ error: 'No conversation.' }, { status: 404 })
  }

  if (!sourceMessageId) {
    return NextResponse.json({ error: 'Missing sourceMessageId.' }, { status: 400 })
  }

  const ok = await upsertConsultedProductKeyForConversationFromPg(convIdPg, sourceMessageId, productUrlKey)
  if (!ok) {
    return NextResponse.json({ error: 'Invalid consult scope.' }, { status: 400 })
  }

  const res = NextResponse.json({ ok: true })
  applyGuestIdentityToResponse(res, request, {
    newSessionId: identity.newSessionId,
    user: identity.user ?? null,
    effectiveExternalThreadId,
    effectiveGuestAccountId,
  })
  return res
}

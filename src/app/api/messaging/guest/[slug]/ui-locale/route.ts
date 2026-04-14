import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { resolveGuestIdentity, upsertGuestAccountForGoogleIdentity } from '@/lib/messaging/guest-widget-identity'
import { fetchGuestWidgetConversationIdFromPg, mergeConversationUiLocaleFromPg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const identity = await resolveGuestIdentity(request)

  const body = (await request.json().catch(() => null)) as { uiLocale?: string } | null
  const loc = normalizeWebLocale(typeof body?.uiLocale === 'string' ? body.uiLocale : '')
  if (!loc) {
    return NextResponse.json({ error: 'Invalid uiLocale.' }, { status: 400 })
  }

  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database unavailable.' }, { status: 503 })
  }

  let effectiveExternalThreadId = identity.externalThreadId
  if (identity.user?.id) {
    const accountId = await upsertGuestAccountForGoogleIdentity(active.id, request, identity.user)
    if (accountId) {
      effectiveExternalThreadId = accountId
    }
  }

  try {
    const convId = await fetchGuestWidgetConversationIdFromPg(active.id, effectiveExternalThreadId)
    if (!convId) {
      return NextResponse.json({ ok: true, merged: false, uiLocale: loc })
    }
    const merged = await mergeConversationUiLocaleFromPg(convId, loc)
    return NextResponse.json({ ok: true, merged, uiLocale: loc })
  } catch (e) {
    console.warn('[guest ui-locale POST]', e)
    return NextResponse.json({ error: 'Failed to update locale.' }, { status: 500 })
  }
}

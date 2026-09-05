import { NextRequest, NextResponse } from 'next/server'
import { resolveCommerceCartPartnerBySlug } from '@/lib/messaging/resolve-commerce-partner'
import { resolveWidgetOrderThreadFromRequest } from '@/lib/messaging/resolve-widget-order-thread'
import { fetchMessagingGuestCartFromPg, upsertMessagingGuestCartFromPg } from '@/lib/db/messaging-guest-cart-pg'
import { sanitizeHeadlessCartItems } from '@/lib/messaging/partner-headless-cart-utils'

export const dynamic = 'force-dynamic'

async function resolvePartner(slug: string) {
  const active = await resolveCommerceCartPartnerBySlug(slug)
  if ('error' in active) return active
  return { partnerId: active.partnerId }
}

function accountKeyFromThread(thread: NonNullable<Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>>): string {
  return (thread.guestAccountId || thread.linkedUserId || thread.externalThreadId || '').trim()
}

function isSignedIn(thread: NonNullable<Awaited<ReturnType<typeof resolveWidgetOrderThreadFromRequest>>> | null): boolean {
  return Boolean(thread?.guestAccountId || thread?.linkedUserId)
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!isSignedIn(thread)) {
    return NextResponse.json(
      { ok: false, error: 'AUTH_REQUIRED_CART_LOGIN', requireAuth: true, items: [] },
      { status: 401 }
    )
  }
  const accountKey = thread ? accountKeyFromThread(thread) : ''
  if (!accountKey) return NextResponse.json({ ok: true, items: [], sync: false })
  const items = await fetchMessagingGuestCartFromPg({ partnerId: partner.partnerId, accountKey })
  return NextResponse.json({ ok: true, items: Array.isArray(items) ? items : [], sync: true })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const partner = await resolvePartner(slug)
  if ('error' in partner) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const thread = await resolveWidgetOrderThreadFromRequest(request, partner.partnerId)
  if (!isSignedIn(thread)) {
    return NextResponse.json(
      { ok: false, error: 'AUTH_REQUIRED_CART_LOGIN', requireAuth: true },
      { status: 401 }
    )
  }
  const accountKey = thread ? accountKeyFromThread(thread) : ''
  if (!accountKey) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  const items = sanitizeHeadlessCartItems(body?.items)
  const ok = await upsertMessagingGuestCartFromPg({ partnerId: partner.partnerId, accountKey, cartItems: items })
  if (!ok) return NextResponse.json({ error: 'Could not save cart.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

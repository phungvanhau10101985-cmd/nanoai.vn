import { NextRequest, NextResponse } from 'next/server'
import {
  createGuestSessionId,
  MESSAGING_GUEST_SESSION_COOKIE,
  MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
  MESSAGING_GUEST_SESSION_SYNC_COOKIE,
  mirrorGuestSessionToClient,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import {
  MESSAGING_GUEST_ACCOUNT_COOKIE,
  MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE,
} from '@/lib/messaging/guest-account-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let sessionId = readGuestSessionIdFromRequestStrictOrLoose(request) ?? ''
  if (!isValidMessagingGuestSessionId(sessionId)) {
    sessionId = createGuestSessionId()
  }

  const res = NextResponse.json({ ok: true, sessionId })
  mirrorGuestSessionToClient(res, request, sessionId)
  return res
}

/** W5.1 — clear guest session + account cookies on this device. */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const res = NextResponse.json({ ok: true })
  const clearOpts = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: request.nextUrl.protocol === 'https:',
    path: '/',
    maxAge: 0,
  }
  const clearSyncOpts = { ...clearOpts, httpOnly: false as const }
  for (const name of [
    MESSAGING_GUEST_SESSION_COOKIE,
    MESSAGING_GUEST_SESSION_COOKIE_LEGACY,
    MESSAGING_GUEST_ACCOUNT_COOKIE,
    MESSAGING_GUEST_ACCOUNT_COOKIE_LEGACY,
  ]) {
    res.cookies.set(name, '', clearOpts)
  }
  res.cookies.set(MESSAGING_GUEST_SESSION_SYNC_COOKIE, '', clearSyncOpts)
  res.cookies.set(MESSAGING_GUEST_ACCOUNT_SYNC_COOKIE, '', clearSyncOpts)
  return res
}

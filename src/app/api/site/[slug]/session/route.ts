import { NextRequest, NextResponse } from 'next/server'
import {
  createGuestSessionId,
  mirrorGuestSessionToClient,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
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

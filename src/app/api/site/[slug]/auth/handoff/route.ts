import { NextRequest, NextResponse } from 'next/server'
import { MESSAGING_GUEST_ACCOUNT_HEADER, writeGuestAccountCookie } from '@/lib/messaging/guest-account-session'
import {
  createGuestSessionId,
  mirrorGuestSessionToClient,
  readGuestSessionIdFromRequestStrictOrLoose,
} from '@/lib/messaging/guest-auth-session'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { upsertGuestAccountForGoogleIdentity } from '@/lib/messaging/guest-widget-identity'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { verifyPartnerSiteGoogleAuthHandoff } from '@/lib/partner-website/shop/partner-site-google-auth-handoff'

export const dynamic = 'force-dynamic'

/**
 * Đổi token handoff (sau Google trên NanoAI) → cookie guest trên domain khách.
 * Gọi từ trình duyệt khi URL có ?pw_auth=…
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as { token?: unknown } | null
  const token = String(body?.token ?? '').trim()
  if (!token) return NextResponse.json({ ok: false, error: 'MISSING_TOKEN' }, { status: 400 })

  const verified = verifyPartnerSiteGoogleAuthHandoff(token)
  if (!verified.ok) {
    const status = verified.error === 'TOKEN_EXPIRED' ? 401 : 400
    return NextResponse.json({ ok: false, error: verified.error }, { status })
  }

  const payload = verified.payload
  if (payload.siteSlug !== shop.site.siteSlug.trim().toLowerCase()) {
    return NextResponse.json({ ok: false, error: 'SITE_MISMATCH' }, { status: 403 })
  }
  if (payload.partnerId !== shop.partnerId) {
    return NextResponse.json({ ok: false, error: 'PARTNER_MISMATCH' }, { status: 403 })
  }

  let sessionId = readGuestSessionIdFromRequestStrictOrLoose(request) ?? ''
  if (!isValidMessagingGuestSessionId(sessionId)) {
    sessionId = createGuestSessionId()
  }

  const accountId = await upsertGuestAccountForGoogleIdentity(
    shop.partnerId,
    request,
    {
      id: payload.authUserId || '',
      email: payload.email,
      aud: 'authenticated',
    },
    { signupSource: 'customer_website', partnerSlug: shop.partnerSlug }
  )

  if (!accountId) {
    return NextResponse.json({ ok: false, error: 'ACCOUNT_FAILED' }, { status: 500 })
  }

  const res = NextResponse.json({
    ok: true,
    accountId,
    email: payload.email,
    path: payload.path,
  })
  mirrorGuestSessionToClient(res, request, sessionId)
  writeGuestAccountCookie(res, request, accountId)
  res.headers.set(MESSAGING_GUEST_ACCOUNT_HEADER, accountId)
  return res
}

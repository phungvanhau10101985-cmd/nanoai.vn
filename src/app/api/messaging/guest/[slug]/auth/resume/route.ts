import { NextRequest, NextResponse } from 'next/server'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
import { applyResumeGuestWebAuth } from '@/lib/messaging/resume-guest-web-auth'
import { MESSAGING_GUEST_ACCOUNT_HEADER } from '@/lib/messaging/guest-account-session'

export const dynamic = 'force-dynamic'

/** Khôi phục phiên khách (JWT email / thiết bị tin cậy / cookie account) — dùng chung mọi web khách. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cookieRes = NextResponse.json({ ok: true })
  const result = await applyResumeGuestWebAuth({
    request,
    response: cookieRes,
    partnerId: active.id,
    signupSource: 'partner_website',
    partnerSlug: slug,
  })

  if (result.accountId) {
    cookieRes.headers.set(MESSAGING_GUEST_ACCOUNT_HEADER, result.accountId)
  }

  return NextResponse.json(
    {
      ok: true,
      synced: result.synced,
      source: result.source,
      accountId: result.accountId,
      email: result.email,
      sessionId: result.sessionId,
    },
    { headers: cookieRes.headers }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { MESSAGING_GUEST_ACCOUNT_HEADER } from '@/lib/messaging/guest-account-session'
import { applyResumeGuestWebAuth } from '@/lib/messaging/resume-guest-web-auth'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'

export const dynamic = 'force-dynamic'

/** Đồng bộ phiên đăng nhập email NanoAI → guest account shop (sau /auth/login hoặc thiết bị tin cậy). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const cookieRes = NextResponse.json({ ok: true })
  const result = await applyResumeGuestWebAuth({
    request,
    response: cookieRes,
    partnerId: shop.partnerId,
    signupSource: 'customer_website',
    partnerSlug: shop.partnerSlug,
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
    },
    { headers: cookieRes.headers }
  )
}

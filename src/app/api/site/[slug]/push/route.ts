import { NextRequest, NextResponse } from 'next/server'
import { PARTNER_CUSTOM_DOMAIN_HEADER } from '@/lib/auth/app-request-headers'
import {
  countPartnerGuestPushSubscriptionsFromPg,
  deletePartnerGuestPushSubscriptionFromPg,
  upsertPartnerGuestPushSubscriptionFromPg,
} from '@/lib/db/messaging-partner-guest-push-subscriptions-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { isWebPushConfigured } from '@/lib/push/send-to-user'

export const dynamic = 'force-dynamic'

function vapidPublicKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || ''
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const configured = isWebPushConfigured()
  const publicKey = configured ? vapidPublicKey() : ''
  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const guestAccountId = visitor.thread.guestAccountId?.trim() ?? ''
  const subscribed = guestAccountId
    ? (await countPartnerGuestPushSubscriptionsFromPg({
        partnerId: shop.partnerId,
        guestAccountId,
      })) > 0
    : false

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      configured,
      publicKey,
      subscribed,
      requireAuth: !guestAccountId,
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: 'push_not_configured' }, { status: 503 })
  }

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const guestAccountId = visitor.thread.guestAccountId?.trim() ?? ''
  if (!guestAccountId) {
    return jsonSitePersonalization(
      request,
      { ok: false, requireAuth: true, error: 'Auth required' },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    endpoint?: string
    keys?: { p256dh?: string; auth?: string }
  } | null
  if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 })
  }

  const customDomain = Boolean(request.headers.get(PARTNER_CUSTOM_DOMAIN_HEADER)?.trim())
  const out = await upsertPartnerGuestPushSubscriptionFromPg({
    partnerId: shop.partnerId,
    guestAccountId,
    endpoint: String(body.endpoint),
    p256dh: String(body.keys.p256dh),
    auth: String(body.keys.auth),
    userAgent: request.headers.get('user-agent'),
    customDomain,
  })
  if (!out.ok) {
    console.error('[site/push subscribe]', out.error)
    return NextResponse.json({ error: out.error || 'save_failed' }, { status: 500 })
  }

  return jsonSitePersonalization(
    request,
    { ok: true, subscribed: true },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const guestAccountId = visitor.thread.guestAccountId?.trim() ?? ''
  if (!guestAccountId) {
    return jsonSitePersonalization(
      request,
      { ok: false, requireAuth: true, error: 'Auth required' },
      401,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string }
  const ok = await deletePartnerGuestPushSubscriptionFromPg({
    partnerId: shop.partnerId,
    guestAccountId,
    endpoint: body.endpoint,
  })
  return jsonSitePersonalization(
    request,
    { ok },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import {
  countUnreadPartnerCustomerNotificationsFromPg,
  listPartnerCustomerNotificationsFromPg,
  markAllPartnerCustomerNotificationsReadFromPg,
  markPartnerCustomerNotificationReadFromPg,
} from '@/lib/db/messaging-partner-customer-notifications-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

/**
 * W5.2 — guest customer notifications.
 * GET: list (default limit 50, max 100)
 * PATCH: mark one read `{ notificationId }` or mark all `{ markAllRead: true }`
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const guestAccountId = visitor.thread.guestAccountId?.trim() ?? ''
  if (!guestAccountId) {
    return jsonSitePersonalization(
      request,
      { ok: true, notifications: [], unreadCount: 0, requireAuth: true },
      200,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const url = request.nextUrl
  if (url.searchParams.get('count') === '1' || url.searchParams.get('unread') === '1') {
    const unreadCount = await countUnreadPartnerCustomerNotificationsFromPg({
      partnerId: shop.partnerId,
      guestAccountId,
    })
    return jsonSitePersonalization(
      request,
      { ok: true, unreadCount },
      200,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const limit = Number(url.searchParams.get('limit') ?? 100)
  const offset = Number(url.searchParams.get('offset') ?? url.searchParams.get('skip') ?? 0)
  const rows = await listPartnerCustomerNotificationsFromPg({
    partnerId: shop.partnerId,
    guestAccountId,
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  })
  if (rows === null) return NextResponse.json({ error: 'Could not load notifications' }, { status: 500 })
  const unreadCount = await countUnreadPartnerCustomerNotificationsFromPg({
    partnerId: shop.partnerId,
    guestAccountId,
  })

  return jsonSitePersonalization(
    request,
    {
      ok: true,
      unreadCount,
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.href,
        readAt: n.readAt,
        createdAt: n.createdAt,
        scheduledAt: n.scheduledAt,
      })),
    },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
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

  const body = (await request.json().catch(() => ({}))) as {
    notificationId?: string
    markAllRead?: boolean
  }

  if (body.markAllRead) {
    const count = await markAllPartnerCustomerNotificationsReadFromPg({
      partnerId: shop.partnerId,
      guestAccountId,
    })
    return jsonSitePersonalization(
      request,
      { ok: true, marked: count },
      200,
      { sessionId: visitor.sessionId, thread: visitor.thread }
    )
  }

  const notificationId = body.notificationId?.trim() ?? ''
  if (!notificationId) {
    return NextResponse.json({ error: 'notificationId or markAllRead required' }, { status: 400 })
  }

  const ok = await markPartnerCustomerNotificationReadFromPg({
    partnerId: shop.partnerId,
    guestAccountId,
    notificationId,
  })
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return jsonSitePersonalization(
    request,
    { ok: true },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

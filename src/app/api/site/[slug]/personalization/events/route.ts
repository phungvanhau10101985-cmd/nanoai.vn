import { NextRequest, NextResponse } from 'next/server'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  parsePersonalizationUtm,
  resolveSiteVisitorContext,
  saveSiteVisitorUtmContext,
  trackSitePersonalizationEventDetailed,
} from '@/lib/partner-website/shop/partner-site-personalization'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as {
    event?: string
    inventory_id?: string
    inventory_ids?: unknown
  } | null
  const event = String(body?.event ?? '').trim().toLowerCase()
  if (!event) return NextResponse.json({ error: 'event required' }, { status: 400 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const inventoryId = String(body?.inventory_id ?? '').trim()
  const inventoryIds = Array.isArray(body?.inventory_ids)
    ? body!.inventory_ids
        .filter((x): x is string => typeof x === 'string' && UUID_RE.test(x.trim()))
        .map((x) => x.trim())
        .slice(0, 24)
    : undefined

  const result = await trackSitePersonalizationEventDetailed({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    event,
    inventoryId: UUID_RE.test(inventoryId) ? inventoryId : undefined,
    inventoryIds,
  })

  return jsonSitePersonalization(
    request,
    {
      ok: result.ok,
      ...(typeof result.is_favorite === 'boolean' ? { is_favorite: result.is_favorite } : {}),
    },
    result.ok ? 200 : 400,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const utm = parsePersonalizationUtm(body)
  if (!utm.utm_source && !utm.utm_medium && !utm.utm_campaign && !utm.utm_content && !utm.utm_term) {
    return NextResponse.json({ error: 'At least one UTM field required' }, { status: 400 })
  }

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  const saved = await saveSiteVisitorUtmContext({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
    utm,
  })
  if (!saved) return NextResponse.json({ error: 'Could not save context' }, { status: 500 })

  return jsonSitePersonalization(
    request,
    { ok: true, utm: saved },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

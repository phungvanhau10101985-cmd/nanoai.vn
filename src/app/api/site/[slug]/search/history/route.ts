import { NextRequest, NextResponse } from 'next/server'
import {
  addPartnerVisitorSearchQueryFromPg,
  fetchPartnerVisitorPersonalizationFromPg,
  mergePartnerVisitorSearchQueriesFromPg,
  removePartnerVisitorSearchQueryFromPg,
  clearPartnerVisitorSearchQueriesFromPg,
} from '@/lib/db/messaging-partner-visitor-personalization-pg'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { jsonSitePersonalization } from '@/lib/partner-website/shop/partner-site-personalization-response'
import { resolveSiteVisitorContext } from '@/lib/partner-website/shop/partner-site-personalization'
import {
  mergeSearchQueries,
  normalizeSearchQuery,
  siteVisitorHasShopAccount,
} from '@/lib/partner-website/shop/partner-site-search-history'

export const dynamic = 'force-dynamic'

function guestHistoryPayload() {
  return { ok: true as const, loggedIn: false as const, queries: [] as string[] }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!siteVisitorHasShopAccount(visitor.thread)) {
    return jsonSitePersonalization(request, guestHistoryPayload(), 200, {
      sessionId: visitor.sessionId,
      thread: visitor.thread,
    })
  }

  const row = await fetchPartnerVisitorPersonalizationFromPg({
    partnerId: shop.partnerId,
    accountKey: visitor.accountKey,
  })
  return jsonSitePersonalization(
    request,
    { ok: true, loggedIn: true, queries: row?.search_queries ?? [] },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!siteVisitorHasShopAccount(visitor.thread)) {
    return jsonSitePersonalization(request, guestHistoryPayload(), 200, {
      sessionId: visitor.sessionId,
      thread: visitor.thread,
    })
  }

  let body: { query?: unknown; queries?: unknown } = {}
  try {
    body = (await request.json()) as { query?: unknown; queries?: unknown }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const batch = Array.isArray(body.queries) ? mergeSearchQueries(body.queries) : []
  const single = normalizeSearchQuery(body.query)
  const next = batch.length
    ? await mergePartnerVisitorSearchQueriesFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
        queries: single ? mergeSearchQueries([single], batch) : batch,
      })
    : await addPartnerVisitorSearchQueryFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
        query: single,
      })

  if (!next) return NextResponse.json({ error: 'Could not save history' }, { status: 500 })
  return jsonSitePersonalization(
    request,
    { ok: true, loggedIn: true, queries: next },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const visitor = await resolveSiteVisitorContext(request, shop.partnerId)
  if (!siteVisitorHasShopAccount(visitor.thread)) {
    return jsonSitePersonalization(request, guestHistoryPayload(), 200, {
      sessionId: visitor.sessionId,
      thread: visitor.thread,
    })
  }

  let query = ''
  try {
    const body = (await request.json().catch(() => ({}))) as { query?: unknown }
    query = normalizeSearchQuery(body.query)
  } catch {
    query = ''
  }

  const next = query
    ? await removePartnerVisitorSearchQueryFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
        query,
      })
    : await clearPartnerVisitorSearchQueriesFromPg({
        partnerId: shop.partnerId,
        accountKey: visitor.accountKey,
      })

  if (!next) return NextResponse.json({ error: 'Could not update history' }, { status: 500 })
  return jsonSitePersonalization(
    request,
    { ok: true, loggedIn: true, queries: next },
    200,
    { sessionId: visitor.sessionId, thread: visitor.thread }
  )
}

import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { bumpInventoryCache } from '@/lib/cache/partner-shop-cache'
import {
  deletePartnerListingIdListCacheFromPg,
  listPartnerListingIdListCacheFromPg,
  listPartnerSearchKeywordStatsFromPg,
} from '@/lib/db/messaging-partner-listing-cache-admin-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  isListingIdListCacheScopeType,
  parseListingCacheLimit,
  parseListingCacheOffset,
  SEARCH_CACHE_ID_LIST_PAGE_SIZE,
  SEARCH_KEYWORD_STATS_PAGE_SIZE,
} from '@/lib/partner-website/shop/partner-listing-cache-admin'

export async function GET(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const view = url.searchParams.get('view') === 'keywords' ? 'keywords' : 'ids'
  const offset = parseListingCacheOffset(url.searchParams.get('skip') ?? url.searchParams.get('offset'))

  if (view === 'keywords') {
    const days = Math.min(365, Math.max(1, Math.floor(Number(url.searchParams.get('days'))) || 30))
    const limit = parseListingCacheLimit(
      url.searchParams.get('limit'),
      SEARCH_KEYWORD_STATS_PAGE_SIZE,
      200
    )
    const data = await listPartnerSearchKeywordStatsFromPg({ partnerId: pid, days, offset, limit })
    if (!data) return NextResponse.json({ error: 'Could not load keyword stats' }, { status: 500 })
    return NextResponse.json({ keywords: data.rows, total: data.total, days })
  }

  const scopeRaw = url.searchParams.get('scope_type')
  const scopeType = isListingIdListCacheScopeType(scopeRaw) ? scopeRaw : null
  const limit = parseListingCacheLimit(
    url.searchParams.get('limit'),
    SEARCH_CACHE_ID_LIST_PAGE_SIZE,
    80
  )
  const data = await listPartnerListingIdListCacheFromPg({ partnerId: pid, scopeType, offset, limit })
  if (!data) return NextResponse.json({ error: 'Could not load search cache' }, { status: 500 })
  return NextResponse.json({ rows: data.rows, total: data.total })
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const url = req.nextUrl
  const scopeRaw = url.searchParams.get('scope_type')
  const scopeType = isListingIdListCacheScopeType(scopeRaw) ? scopeRaw : null
  const scopeKey = url.searchParams.get('scope_key')
  const deleted = await deletePartnerListingIdListCacheFromPg({
    partnerId: pid,
    scopeType,
    scopeKey,
  })
  await bumpInventoryCache(pid)
  return NextResponse.json({ ok: true, deleted })
}

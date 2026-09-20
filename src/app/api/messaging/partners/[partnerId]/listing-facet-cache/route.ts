import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { bumpInventoryCache } from '@/lib/cache/partner-shop-cache'
import {
  deletePartnerListingFacetCacheFromPg,
  listPartnerListingFacetCacheFromPg,
} from '@/lib/db/messaging-partner-listing-cache-admin-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  isListingFacetCacheScopeType,
  LISTING_FACET_CACHE_PAGE_SIZE,
  parseListingCacheLimit,
  parseListingCacheOffset,
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
  const scopeRaw = url.searchParams.get('scope_type')
  const scopeType = isListingFacetCacheScopeType(scopeRaw) ? scopeRaw : null
  const offset = parseListingCacheOffset(url.searchParams.get('skip') ?? url.searchParams.get('offset'))
  const limit = parseListingCacheLimit(
    url.searchParams.get('limit'),
    LISTING_FACET_CACHE_PAGE_SIZE,
    80
  )
  const data = await listPartnerListingFacetCacheFromPg({ partnerId: pid, scopeType, offset, limit })
  if (!data) return NextResponse.json({ error: 'Could not load facet cache' }, { status: 500 })
  return NextResponse.json({
    rows: data.rows,
    total: data.total,
    countsByType: data.countsByType,
  })
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
  const scopeType = isListingFacetCacheScopeType(scopeRaw) ? scopeRaw : null
  const scopeKey = url.searchParams.get('scope_key')
  const deleted = await deletePartnerListingFacetCacheFromPg({
    partnerId: pid,
    scopeType,
    scopeKey,
  })
  await bumpInventoryCache(pid)
  return NextResponse.json({ ok: true, deleted })
}

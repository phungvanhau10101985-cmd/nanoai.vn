import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { bumpInventoryCache } from '@/lib/cache/partner-shop-cache'
import {
  fetchPartnerCategoryFacetCountsFromPg,
  fetchPartnerTextSearchFacetCountsFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import {
  listPartnerCategoryIdsForFacetRebuildFromPg,
  listPartnerFacetSearchKeysFromPg,
} from '@/lib/db/messaging-partner-listing-cache-admin-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { pinSearchKeyword } from '@/lib/partner-website/shop/partner-listing-cache-admin'

export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const body = (await req.json().catch(() => ({}))) as {
    scope?: string
    keyword?: string
  }
  const scope = String(body.scope ?? 'all').trim()
  const pinKw = pinSearchKeyword(String(body.keyword ?? ''))

  if (scope === 'pin') {
    if (!pinKw) return NextResponse.json({ error: 'keyword_required' }, { status: 400 })
    const snapshot = await fetchPartnerTextSearchFacetCountsFromPg(pid, pinKw)
    return NextResponse.json({
      ok: true,
      rebuilt: snapshot ? 1 : 0,
      keyword: pinKw,
      productCount: snapshot?.productCount ?? 0,
    })
  }

  const searchKeys =
    scope === 'search' || scope === 'all' ? await listPartnerFacetSearchKeysFromPg(pid) : []
  await bumpInventoryCache(pid)

  let rebuilt = 0
  if (scope === 'category' || scope === 'all') {
    const ids = await listPartnerCategoryIdsForFacetRebuildFromPg(pid)
    for (const id of ids) {
      const snap = await fetchPartnerCategoryFacetCountsFromPg(pid, id)
      if (snap) rebuilt += 1
    }
  }
  if (scope === 'search' || scope === 'all') {
    for (const key of searchKeys) {
      const snap = await fetchPartnerTextSearchFacetCountsFromPg(pid, key)
      if (snap) rebuilt += 1
    }
  }

  return NextResponse.json({ ok: true, rebuilt, scope })
}

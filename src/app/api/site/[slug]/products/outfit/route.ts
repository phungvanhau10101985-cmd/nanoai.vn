import { NextRequest, NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import {
  fetchPartnerOutfitSuggestions,
  parseOutfitSlotParam,
} from '@/lib/partner-website/shop/pdp-outfit-suggestions'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sp = request.nextUrl.searchParams
  const inventoryId = String(sp.get('inventoryId') ?? sp.get('productId') ?? '').trim()
  if (!UUID_RE.test(inventoryId)) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 })
  }

  const locale = normalizeWebLocale(sp.get('locale')) ?? 'vi'
  const offset = Math.max(0, Number(sp.get('offset') ?? 0) || 0)
  const limit = Math.min(48, Math.max(1, Number(sp.get('limit') ?? 12) || 12))
  const slot = parseOutfitSlotParam(sp.get('slot'))

  const data = await fetchPartnerOutfitSuggestions({
    partnerId: shop.partnerId,
    siteSlug: shop.site.siteSlug,
    inventoryId,
    locale,
    limit: Math.min(48, offset + limit + 1),
    slot,
  })
  const slots = data.slots.map((s) => {
    const items = s.items.slice(offset, offset + limit)
    return { ...s, items, hasMore: s.items.length > offset + limit }
  })

  return NextResponse.json({
    ok: true,
    applicable: data.applicable,
    reason: data.reason,
    anchor: data.anchor,
    offset,
    limit,
    hasMore: slots.some((s) => s.hasMore),
    slots,
  })
}

import { NextResponse } from 'next/server'
import { fetchMessagingPartnerContactChannelsFromPg } from '@/lib/db/messaging-partners-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { loadPartnerSiteShopContext } from '@/lib/partner-website/shop/load-partner-site-shop-context'
import { normalizePartnerSiteContactChannels } from '@/lib/partner-website/shop/partner-site-contact-channels'

export const dynamic = 'force-dynamic'

/** S0.7 — public contact deep-links for shop FAB / contact page. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const shop = await loadPartnerSiteShopContext(slug)
  if (!shop) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const raw = await fetchMessagingPartnerContactChannelsFromPg(shop.partnerId)
  const channels = normalizePartnerSiteContactChannels(raw ?? {})
  return NextResponse.json({ ok: true, channels })
}

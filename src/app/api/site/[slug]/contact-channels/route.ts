import { NextResponse } from 'next/server'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchMessagingPartnerContactChannelsBySiteSlugFromPg } from '@/lib/db/messaging-partners-pg'
import { normalizePartnerSiteContactChannels } from '@/lib/partner-website/shop/partner-site-contact-channels'

export const dynamic = 'force-dynamic'

/** S0.7 — public contact deep-links for shop FAB / contact page. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }
  const raw = await fetchMessagingPartnerContactChannelsBySiteSlugFromPg(slug)
  if (!raw) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const channels = normalizePartnerSiteContactChannels(raw)
  return NextResponse.json(
    { ok: true, channels },
    { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' } }
  )
}

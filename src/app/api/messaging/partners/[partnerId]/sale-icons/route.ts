import { NextRequest, NextResponse } from 'next/server'
import { bumpSiteCacheLater } from '@/lib/cache/partner-shop-cache'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { findPartnerSaleIconFromPg } from '@/lib/db/messaging-partner-sale-icon-pg'
import { fetchPartnerWebsitePublishMetaFromPg } from '@/lib/db/messaging-partner-websites-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'
import { listUpcomingPartnerSaleEvents } from '@/lib/partner-website/promotions/partner-sale-calendar'
import { generatePartnerSaleIcon, loadPartnerSaleIconSources } from '@/lib/partner-website/promotions/partner-sale-icon-generate'
import { PARTNER_SALE_ICON_CREDIT_COST } from '@/lib/partner-website/promotions/partner-sale-icon'

export const maxDuration = 180

export async function GET(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  const upcoming = listUpcomingPartnerSaleEvents({ settings: config, limit: 12 }).find(
    (event) => event.sameDayMonth
  )
  const sources = await loadPartnerSaleIconSources(partnerId)
  const asset = upcoming
    ? await findPartnerSaleIconFromPg({
        partnerId,
        day: upcoming.day,
        month: upcoming.month,
      })
    : null
  return NextResponse.json({
    ok: true,
    creditCost: PARTNER_SALE_ICON_CREDIT_COST,
    auto: config.saleIconAuto !== false,
    upcoming: upcoming
      ? {
          day: upcoming.day,
          month: upcoming.month,
          eventDate: upcoming.eventDate,
          discountPercent: upcoming.discountPercent,
        }
      : null,
    sources: {
      faviconUrl: sources.faviconUrl,
      pwaIconUrl: sources.pwaIconUrl,
    },
    asset: asset
      ? {
          day: asset.day,
          month: asset.month,
          imageUrl: asset.imageUrl,
          status: asset.status,
        }
      : null,
  })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    day?: number
    month?: number
    discountPercent?: number
    force?: boolean
  } | null
  const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  const upcoming = listUpcomingPartnerSaleEvents({ settings: config, limit: 12 }).find(
    (event) => event.sameDayMonth
  )
  const day = Number(body?.day ?? upcoming?.day ?? 0)
  const month = Number(body?.month ?? upcoming?.month ?? 0)
  const discountPercent = Number(body?.discountPercent ?? upcoming?.discountPercent ?? 0)
  const created = await generatePartnerSaleIcon({
    partnerId,
    day,
    month,
    discountPercent,
    force: Boolean(body?.force),
    actorUserId: access.actorId,
    chargeCredits: true,
  })
  if (!created.ok) {
    return NextResponse.json({ error: created.error }, { status: created.status ?? 500 })
  }
  const meta = await fetchPartnerWebsitePublishMetaFromPg(partnerId)
  if (meta?.siteSlug) bumpSiteCacheLater(meta.siteSlug)
  return NextResponse.json({ ok: true, asset: created.asset, charged: PARTNER_SALE_ICON_CREDIT_COST })
}

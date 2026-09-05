import { NextRequest, NextResponse } from 'next/server'
import { listPartnerMarketingBannerAssetsFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'
import { isPartnerMarketingBannerKind } from '@/lib/partner-website/promotions/partner-marketing-banner'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const kindRaw = request.nextUrl.searchParams.get('kind')?.trim() ?? ''
  const kind = kindRaw && isPartnerMarketingBannerKind(kindRaw) ? kindRaw : null
  const items = await listPartnerMarketingBannerAssetsFromPg({ partnerId, kind })
  return NextResponse.json({ ok: true, items })
}

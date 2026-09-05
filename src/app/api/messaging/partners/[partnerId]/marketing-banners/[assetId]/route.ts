import { NextRequest, NextResponse } from 'next/server'
import { deletePartnerMarketingBannerAssetFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<{ partnerId: string; assetId: string }> }
) {
  const { partnerId, assetId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const asset = await deletePartnerMarketingBannerAssetFromPg({ partnerId, assetId })
  if (!asset) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, asset })
}

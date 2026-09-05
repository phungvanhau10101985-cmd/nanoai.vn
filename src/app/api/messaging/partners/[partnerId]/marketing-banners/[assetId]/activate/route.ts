import { NextRequest, NextResponse } from 'next/server'
import { activatePartnerMarketingBannerAssetFromPg } from '@/lib/db/messaging-partner-marketing-banner-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<{ partnerId: string; assetId: string }> }
) {
  const { partnerId, assetId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const asset = await activatePartnerMarketingBannerAssetFromPg({ partnerId, assetId })
  if (!asset) {
    return NextResponse.json({ error: 'Chỉ kích hoạt được ảnh đã tạo thành công.' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, asset })
}

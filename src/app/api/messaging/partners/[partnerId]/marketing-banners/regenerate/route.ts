import { NextRequest, NextResponse } from 'next/server'
import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'
import { generatePartnerMarketingBanner } from '@/lib/partner-website/promotions/partner-marketing-banner-generate'
import {
  isPartnerMarketingBannerKind,
  isValidPartnerMarketingBannerDayMonth,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import { partnerSalePercentForSameDayMonth } from '@/lib/partner-website/promotions/partner-sale-calendar'

export const dynamic = 'force-dynamic'
export const maxDuration = 180

export async function POST(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    kind?: string
    day?: number
    month?: number
  } | null
  const kind = String(body?.kind ?? '')
  const day = Number(body?.day)
  const month = Number(body?.month)
  if (!isPartnerMarketingBannerKind(kind) || !isValidPartnerMarketingBannerDayMonth(day, month)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  let discount = 0
  if (kind === 'birthday') {
    const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
    discount = Math.max(0, Math.min(100, Math.floor(Number(promo?.discount_percent) || 10)))
  } else {
    const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
    const percent = partnerSalePercentForSameDayMonth(config, day, month)
    if (percent == null) {
      return NextResponse.json(
        { error: 'Banner sale chỉ áp dụng cho ngày trùng tháng.' },
        { status: 400 }
      )
    }
    discount = percent
  }

  const result = await generatePartnerMarketingBanner({
    partnerId,
    kind,
    day,
    month,
    discountPercent: discount,
    force: true,
    actorUserId: access.actorId,
    chargeCredits: true,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ ok: true, asset: result.asset, message: 'Đã tạo ảnh banner.' })
}

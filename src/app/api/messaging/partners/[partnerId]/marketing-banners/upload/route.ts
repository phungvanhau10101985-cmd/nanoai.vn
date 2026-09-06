import { NextRequest, NextResponse } from 'next/server'
import { fetchBirthdayPromoForPartnerFromPg } from '@/lib/db/messaging-partner-birthday-promo-pg'
import { fetchPartnerSaleCalendarConfigFromPg } from '@/lib/db/messaging-partner-sale-calendar-pg'
import { authorizePartnerMarketingBannerAdmin } from '@/lib/partner-website/promotions/partner-marketing-banner-admin-auth'
import { uploadPartnerMarketingBannerImage } from '@/lib/partner-website/promotions/partner-marketing-banner-generate'
import {
  isPartnerMarketingBannerKind,
  parsePartnerMarketingBannerDateKey,
} from '@/lib/partner-website/promotions/partner-marketing-banner'
import { partnerSalePercentForSameDayMonth } from '@/lib/partner-website/promotions/partner-sale-calendar'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 8 * 1024 * 1024

export async function POST(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorizePartnerMarketingBannerAdmin(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const kind = String(form.get('kind') ?? '')
  const dateKey = String(form.get('dateKey') ?? '')
  const campaignKey = String(form.get('campaignKey') ?? '').trim() || null
  const file = form.get('file')
  if (!isPartnerMarketingBannerKind(kind) || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 })
  }
  const type = file.type || 'image/png'
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(type)) {
    return NextResponse.json({ error: 'invalid_image_type' }, { status: 400 })
  }

  let day = 0
  let month = 0
  let discount = 0
  if (kind === 'birthday' || kind === 'sale') {
    const parsed = parsePartnerMarketingBannerDateKey(dateKey)
    if (!parsed) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
    day = parsed.day
    month = parsed.month
  }

  if (kind === 'birthday') {
    const promo = await fetchBirthdayPromoForPartnerFromPg(partnerId)
    discount = Math.max(0, Math.min(100, Math.floor(Number(promo?.discount_percent) || 10)))
  } else if (kind === 'sale') {
    const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
    const percent = partnerSalePercentForSameDayMonth(config, day, month)
    if (percent == null) {
      return NextResponse.json(
        { error: 'Banner sale chỉ áp dụng cho ngày trùng tháng.' },
        { status: 400 }
      )
    }
    discount = percent
  } else if (kind === 'warehouse') {
    const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
    discount = Number(config.clearanceDiscountPercent) || 0
    if (discount <= 0 || discount > 80) {
      return NextResponse.json({ error: 'Giảm giá kho phải từ 0.5–80%.' }, { status: 400 })
    }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const result = await uploadPartnerMarketingBannerImage({
    partnerId,
    kind,
    day,
    month,
    discountPercent: discount,
    campaignKey,
    file: bytes,
    contentType: type,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }
  return NextResponse.json({ ok: true, asset: result.asset })
}

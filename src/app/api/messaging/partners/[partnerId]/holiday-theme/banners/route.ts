import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import {
  isPartnerHolidayThemeId,
  PARTNER_HOLIDAY_THEME_IDS,
  partnerHolidayBannerCampaignKey,
} from '@/lib/partner-website/promotions/partner-holiday-schedule'
import { loadPartnerHolidayRules } from '@/lib/partner-website/promotions/partner-holiday-theme'
import { generatePartnerMarketingBanner } from '@/lib/partner-website/promotions/partner-marketing-banner-generate'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website_promotions')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const, actorId: auth.user.id }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    code?: string
    force?: boolean
    imageEngine?: string | null
    gptQuality?: string | null
  } | null
  const requested = String(body?.code || '').trim()
  if (requested && !isPartnerHolidayThemeId(requested)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  const codes = requested ? [requested] : [...PARTNER_HOLIDAY_THEME_IDS]
  const rules = await loadPartnerHolidayRules(partnerId)
  const byCode = new Map(rules.map((row) => [row.code, row]))

  const run = async () => {
    for (const code of codes) {
      const rule = byCode.get(code)
      await generatePartnerMarketingBanner({
        partnerId,
        kind: 'holiday',
        day: rule?.startDay ?? 1,
        month: rule?.startMonth ?? 1,
        discountPercent: rule?.salePercent ?? 0,
        campaignKey: partnerHolidayBannerCampaignKey(code),
        force: Boolean(body?.force),
        actorUserId: access.actorId,
        chargeCredits: true,
        imageEngine: body?.imageEngine ?? 'gpt',
        gptQuality: body?.gptQuality ?? null,
      }).catch((error) => {
        console.warn('[holiday-theme/banners]', code, error)
      })
    }
  }

  if (codes.length === 1) {
    const result = await generatePartnerMarketingBanner({
      partnerId,
      kind: 'holiday',
      day: byCode.get(codes[0]!)?.startDay ?? 1,
      month: byCode.get(codes[0]!)?.startMonth ?? 1,
      discountPercent: byCode.get(codes[0]!)?.salePercent ?? 0,
      campaignKey: partnerHolidayBannerCampaignKey(codes[0]!),
      force: Boolean(body?.force),
      actorUserId: access.actorId,
      chargeCredits: true,
      imageEngine: body?.imageEngine ?? 'gpt',
      gptQuality: body?.gptQuality ?? null,
    })
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error, accepted: false },
        { status: result.status ?? 500 }
      )
    }
    return NextResponse.json({
      ok: true,
      accepted: true,
      message: 'Đã tạo banner ngày lễ.',
    })
  }

  void run()
  return NextResponse.json(
    {
      ok: true,
      accepted: true,
      message: 'Đang tạo banner GPT cho 16 dịp. Ảnh sẵn giữ lại; muốn vẽ lại thì bấm Tạo lại trên từng thẻ.',
    },
    { status: 202 }
  )
}

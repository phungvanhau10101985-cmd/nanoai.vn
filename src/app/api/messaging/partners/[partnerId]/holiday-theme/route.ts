import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { upsertPartnerHolidayOccasionFromPg } from '@/lib/db/messaging-partner-holiday-theme-pg'
import { fetchPartnerWebsitePublishMetaFromPg } from '@/lib/db/messaging-partner-websites-pg'
import { bumpInventoryCacheLater, bumpSiteCacheLater } from '@/lib/cache/partner-shop-cache'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { isPartnerHolidayThemeId } from '@/lib/partner-website/promotions/partner-holiday-schedule'
import {
  buildPartnerHolidayAdminState,
  PartnerHolidayScheduleError,
  validatePartnerHolidayOccasionUpdate,
} from '@/lib/partner-website/promotions/partner-holiday-theme'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'website_promotions')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const, actorId: auth.user.id }
}

function localeFrom(request: NextRequest) {
  return (
    normalizeWebLocale(request.nextUrl.searchParams.get('locale') || request.headers.get('x-nanoai-locale')) ??
    'vi'
  )
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const state = await buildPartnerHolidayAdminState({
    partnerId,
    locale: localeFrom(request),
  })
  return NextResponse.json({ ok: true, state })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    code?: string
    enabled?: boolean
    startMonth?: number
    startDay?: number
    endMonth?: number
    endDay?: number
    leadDays?: number
    afterDays?: number
    salePercent?: number
    saleLeadDays?: number | null
    saleDays?: number | null
  } | null
  if (!body?.code || !isPartnerHolidayThemeId(body.code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  try {
    const update = validatePartnerHolidayOccasionUpdate({
      code: body.code,
      enabled: body.enabled,
      startMonth: body.startMonth,
      startDay: body.startDay,
      endMonth: body.endMonth,
      endDay: body.endDay,
      leadDays: body.leadDays,
      afterDays: body.afterDays,
      salePercent: body.salePercent,
      saleLeadDays: body.saleLeadDays,
      saleDays: body.saleDays,
    })
    const ok = await upsertPartnerHolidayOccasionFromPg({
      partnerId,
      ...update,
    })
    if (ok) {
      bumpInventoryCacheLater(partnerId)
      const meta = await fetchPartnerWebsitePublishMetaFromPg(partnerId).catch(() => null)
      if (meta?.siteSlug) bumpSiteCacheLater(meta.siteSlug)
    }
    const state = await buildPartnerHolidayAdminState({
      partnerId,
      locale: localeFrom(request),
    })
    return NextResponse.json({ ok, state })
  } catch (error) {
    const message = error instanceof PartnerHolidayScheduleError ? error.message : 'Không lưu được'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchPartnerSaleCalendarConfigFromPg,
  upsertPartnerSaleCalendarConfigFromPg,
  type PartnerSaleCalendarConfig,
} from '@/lib/db/messaging-partner-sale-calendar-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'
import { bumpInventoryCacheLater } from '@/lib/cache/partner-shop-cache'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(
    auth.user.id,
    partnerId,
    'marketing_campaigns'
  )
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const, actorId: auth.user.id }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const config = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  return NextResponse.json({ ok: true, config })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as Partial<PartnerSaleCalendarConfig> | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const current = await fetchPartnerSaleCalendarConfigFromPg(partnerId)
  const ok = await upsertPartnerSaleCalendarConfigFromPg({
    partnerId,
    settings: {
      enabled: body.enabled ?? current.enabled,
      timezone: body.timezone ?? current.timezone,
      teaserDays: body.teaserDays ?? current.teaserDays,
      oddMonthDiscountPercent:
        body.oddMonthDiscountPercent ?? current.oddMonthDiscountPercent,
      evenMonthDiscountPercent:
        body.evenMonthDiscountPercent ?? current.evenMonthDiscountPercent,
      manualSaleDate: body.manualSaleDate ?? current.manualSaleDate,
      manualDiscountPercent:
        body.manualDiscountPercent ?? current.manualDiscountPercent,
      clearanceEnabled: body.clearanceEnabled ?? current.clearanceEnabled,
      clearanceDiscountPercent:
        body.clearanceDiscountPercent ?? current.clearanceDiscountPercent,
    },
    monthRules: body.monthRules ?? current.monthRules,
  })
  if (ok) {
    bumpInventoryCacheLater(partnerId)
    void writePartnerSaleAuditFromPg({
      partnerId,
      eventType: 'sale_calendar_settings_updated',
      actorKey: access.actorId,
      entityType: 'settings',
      detail: {
        enabled: body.enabled ?? current.enabled,
        timezone: body.timezone ?? current.timezone,
        teaserDays: body.teaserDays ?? current.teaserDays,
      },
    })
  }
  return NextResponse.json({ ok }, { status: ok ? 200 : 500 })
}

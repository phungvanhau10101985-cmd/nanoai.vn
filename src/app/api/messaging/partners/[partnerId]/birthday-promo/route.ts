import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import {
  fetchBirthdayPromoForPartnerFromPg,
  upsertBirthdayPromoForPartnerFromPg,
} from '@/lib/db/messaging-partner-birthday-promo-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'marketing_campaigns')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const }
}

function settingsPayload(partnerId: string, row: Awaited<ReturnType<typeof fetchBirthdayPromoForPartnerFromPg>>) {
  return {
    partner_id: row?.partner_id ?? partnerId,
    enabled: Boolean(row?.enabled),
    discount_percent: Math.max(0, Math.min(100, Number(row?.discount_percent) || 10)),
    offer_days_before_max: Math.max(1, Math.min(120, Number(row?.offer_days_before_max) || 7)),
    offer_days_before_min: Math.max(1, Math.min(120, Number(row?.offer_days_before_min) || 1)),
    updated_at: row?.updated_at ?? new Date().toISOString(),
  }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const row = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  return NextResponse.json({ ok: true, settings: settingsPayload(partnerId, row) })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    enabled?: boolean
    discountPercent?: number
    offerDaysBeforeMax?: number
    offerDaysBeforeMin?: number
  } | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const ok = await upsertBirthdayPromoForPartnerFromPg({
    partnerId,
    enabled: Boolean(body.enabled),
    discountPercent: Number(body.discountPercent) || 0,
    offerDaysBeforeMax: Number(body.offerDaysBeforeMax) || 7,
    offerDaysBeforeMin: Number(body.offerDaysBeforeMin) || 1,
  })
  if (!ok) return NextResponse.json({ error: 'Failed to save birthday promo settings.' }, { status: 500 })
  const row = await fetchBirthdayPromoForPartnerFromPg(partnerId)
  return NextResponse.json({ ok: true, settings: settingsPayload(partnerId, row) })
}

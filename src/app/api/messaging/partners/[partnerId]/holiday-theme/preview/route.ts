import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  clearPartnerHolidayPreviewFromPg,
  savePartnerHolidayPreviewFromPg,
} from '@/lib/db/messaging-partner-holiday-theme-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { isPartnerHolidayThemeId } from '@/lib/partner-website/promotions/partner-holiday-schedule'
import { issuePartnerHolidayPreviewToken } from '@/lib/partner-website/promotions/partner-holiday-preview'

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
  const body = (await request.json().catch(() => null)) as { code?: string } | null
  const code = String(body?.code || '').trim()
  if (!isPartnerHolidayThemeId(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }
  const grant = issuePartnerHolidayPreviewToken(code)
  await savePartnerHolidayPreviewFromPg({
    partnerId,
    code,
    adminId: access.actorId,
    expiresAt: grant.expiresAt,
  })
  return NextResponse.json({
    ok: true,
    code,
    token: grant.token,
    expires_at: grant.expiresAt,
  })
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  await clearPartnerHolidayPreviewFromPg(partnerId)
  return NextResponse.json({ ok: true })
}

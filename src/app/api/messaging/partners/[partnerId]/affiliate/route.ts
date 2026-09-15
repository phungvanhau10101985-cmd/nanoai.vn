import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import {
  fetchPartnerAffiliateSettingsFromPg,
  listPartnerAffiliateApplicationsFromPg,
  listPartnerAffiliateCommissionsAdminFromPg,
  listPartnerAffiliateWithdrawalsFromPg,
  reviewPartnerAffiliateApplicationFromPg,
  reviewPartnerAffiliateWithdrawalFromPg,
  upsertPartnerAffiliateSettingsFromPg,
} from '@/lib/db/messaging-partner-affiliate-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const dynamic = 'force-dynamic'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'marketing_campaigns')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const, actorId: auth.user.id }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const kind = request.nextUrl.searchParams.get('kind') || 'settings'
  const status = request.nextUrl.searchParams.get('status')
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get('skip')) || 0)
  const limit = Math.max(1, Math.min(200, Number(request.nextUrl.searchParams.get('limit')) || 100))
  if (kind === 'applications') {
    const applications = await listPartnerAffiliateApplicationsFromPg({ partnerId, status, skip, limit })
    return NextResponse.json({ ok: true, applications })
  }
  if (kind === 'commissions') {
    const commissions = await listPartnerAffiliateCommissionsAdminFromPg({ partnerId, status, skip, limit })
    return NextResponse.json({ ok: true, commissions })
  }
  if (kind === 'withdrawals') {
    const withdrawals = await listPartnerAffiliateWithdrawalsFromPg({ partnerId, status, skip, limit })
    return NextResponse.json({ ok: true, withdrawals })
  }
  const settings = await fetchPartnerAffiliateSettingsFromPg(partnerId)
  return NextResponse.json({ ok: true, settings })
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    action?: string
    applicationId?: string
    withdrawalId?: string
    adminNote?: string
    settings?: {
      enabled?: boolean
      commissionPercent?: number
      attributionDays?: number
      minimumPayoutAmount?: number
      commissionPolicy?: string | null
    }
  } | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  try {
    if (body.action === 'save_settings' && body.settings) {
      const settings = await upsertPartnerAffiliateSettingsFromPg({
        partnerId,
        enabled: body.settings.enabled === true,
        commissionPercent: Number(body.settings.commissionPercent) || 0,
        attributionDays: Number(body.settings.attributionDays) || 30,
        minimumPayoutAmount: Number(body.settings.minimumPayoutAmount) || 0,
        commissionPolicy: body.settings.commissionPolicy,
        actorId: access.actorId,
      })
      return NextResponse.json({ ok: true, settings })
    }
    if ((body.action === 'approve' || body.action === 'reject') && body.applicationId) {
      const application = await reviewPartnerAffiliateApplicationFromPg({
        partnerId,
        applicationId: body.applicationId,
        action: body.action,
        adminNote: body.adminNote,
        actorId: access.actorId,
      })
      return NextResponse.json({ ok: true, application })
    }
    if ((body.action === 'approve_withdrawal' || body.action === 'reject_withdrawal') && body.withdrawalId) {
      const withdrawal = await reviewPartnerAffiliateWithdrawalFromPg({
        partnerId,
        withdrawalId: body.withdrawalId,
        action: body.action === 'approve_withdrawal' ? 'approve' : 'reject',
        adminNote: body.adminNote,
        actorId: access.actorId,
      })
      return NextResponse.json({ ok: true, withdrawal })
    }
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

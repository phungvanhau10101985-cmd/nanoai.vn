import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { pgQuery, pgQueryOne } from '@/lib/db/pg-query'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { writePartnerSaleAuditFromPg } from '@/lib/db/messaging-partner-sale-audit-pg'

async function authorize(partnerId: string) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'marketing_campaigns')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  return { ok: true as const, actorId: auth.user.id }
}

export async function GET(_request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const [google, affiliate] = await Promise.all([
    pgQueryOne<{
      enabled: boolean
      audience: string
      lock_hours: number
      minimum_price_percent: string | number
    }>(
      `select enabled, audience, lock_hours, minimum_price_percent
       from public.messaging_partner_google_discount_settings where partner_id = $1::uuid`,
      [partnerId]
    ),
    pgQueryOne<{
      enabled: boolean
      commission_percent: string | number
      attribution_days: number
      minimum_payout_amount: string | number
    }>(
      `select enabled, commission_percent, attribution_days, minimum_payout_amount
       from public.messaging_partner_affiliate_settings where partner_id = $1::uuid`,
      [partnerId]
    ),
  ])
  return NextResponse.json({
    ok: true,
    google: {
      enabled: google?.enabled === true,
      merchantId: google?.audience ?? '',
      lockHours: google?.lock_hours ?? 48,
      minimumPricePercent: Number(google?.minimum_price_percent) || 85,
    },
    affiliate: {
      enabled: affiliate?.enabled !== false,
      commissionPercent: Number(affiliate?.commission_percent) || 5,
      attributionDays: affiliate?.attribution_days ?? 30,
      minimumPayoutAmount: Number(affiliate?.minimum_payout_amount) || 0,
    },
  })
}

export async function PUT(request: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const access = await authorize(partnerId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })
  const body = (await request.json().catch(() => null)) as {
    google?: {
      enabled?: boolean
      merchantId?: string
      lockHours?: number
      minimumPricePercent?: number
    }
    affiliate?: {
      enabled?: boolean
      commissionPercent?: number
      attributionDays?: number
      minimumPayoutAmount?: number
    }
  } | null
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  if (body.google) {
    await pgQuery(
      `insert into public.messaging_partner_google_discount_settings (
         partner_id, enabled, audience, lock_hours, minimum_price_percent, updated_at
       ) values ($1::uuid,$2,$3,$4,$5,now())
       on conflict (partner_id) do update set enabled = excluded.enabled,
         audience = excluded.audience, lock_hours = excluded.lock_hours,
         minimum_price_percent = excluded.minimum_price_percent, updated_at = now()`,
      [
        partnerId,
        body.google.enabled === true,
        body.google.merchantId?.trim() ?? '',
        Math.max(1, Math.min(168, Number(body.google.lockHours) || 48)),
        Math.max(1, Math.min(100, Number(body.google.minimumPricePercent) || 85)),
      ]
    )
  }
  if (body.affiliate) {
    await pgQuery(
      `insert into public.messaging_partner_affiliate_settings (
         partner_id, enabled, commission_percent, attribution_days,
         minimum_payout_amount, updated_at
       ) values ($1::uuid,$2,$3,$4,$5,now())
       on conflict (partner_id) do update set enabled = excluded.enabled,
         commission_percent = excluded.commission_percent,
         attribution_days = excluded.attribution_days,
         minimum_payout_amount = excluded.minimum_payout_amount, updated_at = now()`,
      [
        partnerId,
        body.affiliate.enabled === true,
        Math.max(0, Math.min(100, Number(body.affiliate.commissionPercent) || 0)),
        Math.max(1, Math.min(365, Number(body.affiliate.attributionDays) || 30)),
        Math.max(0, Math.round(Number(body.affiliate.minimumPayoutAmount) || 0)),
      ]
    )
  }
  void writePartnerSaleAuditFromPg({
    partnerId,
    eventType: 'sale_program_settings_updated',
    actorKey: access.actorId,
    entityType: 'settings',
    detail: {
      google: body.google ? { ...body.google } : null,
      affiliate: body.affiliate ? { ...body.affiliate } : null,
    },
  })
  return NextResponse.json({ ok: true })
}

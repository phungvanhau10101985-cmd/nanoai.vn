import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchPartnerPaymentSettingsFromPg } from '@/lib/db/messaging-partner-orders-pg'
import {
  fetchPartnerShippingProvinceFeesFromPg,
  replacePartnerShippingProvinceFeesFromPg,
} from '@/lib/db/messaging-partner-shipping-province-fees-pg'
import { fetchMessagingPartnersForDashboardFromPg } from '@/lib/db/messaging-partners-pg'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ partnerId: string }> }

async function authorize(partnerId: string, requireOwner = false) {
  if (!isPgConfigured()) return { ok: false as const, status: 503, error: 'Database not configured' }
  const auth = await getUserForCreditAction()
  if ('error' in auth) return { ok: false as const, status: 401, error: auth.error }
  const access = await assertPartnerDashboardAccess(auth.user.id, partnerId, 'orders')
  if (!access.ok) return { ok: false as const, status: access.status, error: access.error }
  if (requireOwner) {
    const partners = await fetchMessagingPartnersForDashboardFromPg(auth.user.id)
    const match = partners?.find((p) => p.id === partnerId)
    if (match?.dashboard_access !== 'owner') {
      return { ok: false as const, status: 403, error: 'Permission denied' }
    }
  }
  return { ok: true as const }
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  const { partnerId } = await ctx.params
  const auth = await authorize(partnerId)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const [settings, rates] = await Promise.all([
    fetchPartnerPaymentSettingsFromPg(partnerId),
    fetchPartnerShippingProvinceFeesFromPg(partnerId),
  ])
  return NextResponse.json({
    ok: true,
    defaultFeeAmount: Math.max(0, Math.round(settings?.shipping_fee_amount ?? 0)),
    freeThresholdAmount:
      settings?.shipping_free_threshold_amount == null
        ? null
        : Math.max(0, Math.round(settings.shipping_free_threshold_amount)),
    rates,
  })
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  const { partnerId } = await ctx.params
  const auth = await authorize(partnerId, true)
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  const body = (await request.json().catch(() => null)) as {
    rates?: Array<{ province?: string; feeAmount?: number }>
  } | null
  const rates = Array.isArray(body?.rates) ? body.rates : []
  try {
    const saved = await replacePartnerShippingProvinceFeesFromPg({
      partnerId,
      rates: rates.map((row) => ({
        province: String(row.province ?? ''),
        feeAmount: Number(row.feeAmount),
      })),
    })
    return NextResponse.json({ ok: true, rates: saved })
  } catch (e) {
    console.error('[shipping-province-fees PUT]', e)
    return NextResponse.json({ ok: false, error: 'save_failed' }, { status: 500 })
  }
}

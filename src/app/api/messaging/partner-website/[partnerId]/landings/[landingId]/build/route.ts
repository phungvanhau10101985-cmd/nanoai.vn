import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerLandingPageByIdPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { buildPartnerLandingFromProducts } from '@/lib/partner-website/landing/build-partner-landing-from-products'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const pid = partnerId.trim()
  const lid = landingId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = (await req.json().catch(() => ({}))) as {
    locale?: string
    regenerateMockup?: boolean
  }
  const locale = normalizeWebLocale(body.locale) ?? 'vi'

  const landing = await fetchPartnerLandingPageByIdPg(pid, lid)
  if (!landing) {
    return NextResponse.json({ error: 'Landing not found' }, { status: 404 })
  }

  const result = await buildPartnerLandingFromProducts({
    locale,
    userId: auth.user.id,
    partnerId: pid,
    landing,
    regenerateMockup: body.regenerateMockup !== false,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, stage: result.stage },
      { status: 422 }
    )
  }

  return NextResponse.json({
    success: true,
    landing: result.landing,
    mockupUrl: result.mockupUrl,
    assistantMessage: result.assistantMessage,
  })
}

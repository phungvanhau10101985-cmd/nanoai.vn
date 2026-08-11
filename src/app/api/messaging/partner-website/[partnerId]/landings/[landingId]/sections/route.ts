import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerLandingPageByIdPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { ensureDefaultLandingSectionsPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { defaultLandingSectionPlan } from '@/lib/partner-website/landing/landing-ai-types'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3.6 — danh sách section cố định của 1 landing (tự bù section thiếu — landing tạo trước feature này). */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const lid = landingId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const landing = await fetchPartnerLandingPageByIdPg(pid, lid)
  if (!landing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sections = await ensureDefaultLandingSectionsPg(lid, defaultLandingSectionPlan())
  return NextResponse.json({ sections })
}

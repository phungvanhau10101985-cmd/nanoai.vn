import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { runLandingSectionGenerate } from '@/lib/partner-website/landing/landing-ai-section-route-helpers'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3.6 — sinh nội dung lần đầu cho 1 section (text+ảnh nếu có). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string; sectionId: string }> }
) {
  const { partnerId, landingId, sectionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const result = await runLandingSectionGenerate(pid, landingId.trim(), sectionId.trim(), { target: 'all' })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ section: result.section })
}

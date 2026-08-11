import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { fetchPartnerLandingPageByIdPg } from '@/lib/db/messaging-partner-landing-pages-pg'
import { mergeManualLandingSectionDataPg } from '@/lib/db/messaging-partner-landing-sections-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3.6 — sửa tay đè nội dung 1 section (giữ field khác, giống `update_section_manually` của 188). */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string; sectionId: string }> }
) {
  const { partnerId, landingId, sectionId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const lid = landingId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const landing = await fetchPartnerLandingPageByIdPg(pid, lid)
  if (!landing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as { data?: Record<string, unknown> }
  const section = await mergeManualLandingSectionDataPg(lid, sectionId.trim(), body.data ?? {})
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  return NextResponse.json({ section })
}

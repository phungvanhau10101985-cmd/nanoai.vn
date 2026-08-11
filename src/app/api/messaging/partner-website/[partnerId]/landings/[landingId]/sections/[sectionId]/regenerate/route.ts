import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import type { LandingSectionGenerateTarget } from '@/lib/partner-website/landing/landing-ai-dispatcher'
import { runLandingSectionGenerate } from '@/lib/partner-website/landing/landing-ai-section-route-helpers'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3.6 — tạo lại 1 section (target: all | text | image), có thể kèm prompt tuỳ chỉnh của merchant. */
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

  const body = (await req.json().catch(() => ({}))) as { target?: string; customPrompt?: string }
  const target: LandingSectionGenerateTarget =
    body.target === 'text' || body.target === 'image' ? body.target : 'all'

  const result = await runLandingSectionGenerate(pid, landingId.trim(), sectionId.trim(), {
    target,
    customPrompt: (body.customPrompt ?? '').trim() || undefined,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ section: result.section })
}

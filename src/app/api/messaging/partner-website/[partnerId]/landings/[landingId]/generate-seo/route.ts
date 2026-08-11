import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { generateAndSaveLandingSeo } from '@/lib/partner-website/landing/landing-ai-seo'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

/** L3.7 — sinh meta title/description bằng AI (DeepSeek) và lưu vào DB (guardrail chống trùng category page). */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; landingId: string }> }
) {
  const { partnerId, landingId } = await ctx.params
  if (!isPgConfigured()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const onlyMissing = req.nextUrl.searchParams.get('only_missing') === 'true'
  const seo = await generateAndSaveLandingSeo(pid, landingId.trim(), { onlyMissing })
  if (!seo) return NextResponse.json({ error: 'AI could not generate SEO content' }, { status: 502 })
  return NextResponse.json({ metaTitle: seo.metaTitle, metaDescription: seo.metaDescription })
}

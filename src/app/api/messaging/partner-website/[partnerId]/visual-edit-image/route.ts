import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'

export const maxDuration = 120

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string }> }
) {
  const { partnerId } = await ctx.params
  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 })
  }

  const auth = await getUserForCreditAction()
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: 401 })
  }

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'website')
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status })
  }

  const body = (await req.json()) as {
    prompt?: string
    referenceImageUrl?: string | null
    title?: string
  }
  const prompt = String(body.prompt ?? '').trim()
  if (prompt.length < 4) {
    return NextResponse.json({ error: 'prompt too short' }, { status: 400 })
  }

  const ref = body.referenceImageUrl?.trim()
  const result = await runStudioImagePipeline({
    userId: auth.user.id,
    kind: 'product_photo',
    screenLabel: 'Website section image',
    brief: prompt,
    projectTitle: body.title?.trim() || 'Partner website',
    referenceImageUrls: ref && /^https?:\/\//i.test(ref) ? [ref] : undefined,
    productImageUrls: ref && /^https?:\/\//i.test(ref) ? [ref] : undefined,
    aspectRatio: '16:9',
    verbatimPrompt: false,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ publicUrl: result.resultUrl, charged: result.charged })
}

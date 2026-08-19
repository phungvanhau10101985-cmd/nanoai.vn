import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { runStudioImagePipeline } from '@/lib/hub-agent/studio-image-pipeline'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { normalizeLogoAspectRatioForGemini } from '@/lib/partner-website/visual-editor/gemini-working-aspect'

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
    referenceImageUrls?: string[] | null
    referenceImageMeta?: Array<{ screenKey: string; label?: string }> | null
    title?: string
    kind?: string
    aspectRatio?: string
  }
  const prompt = String(body.prompt ?? '').trim()
  if (prompt.length < 4) {
    return NextResponse.json({ error: 'prompt too short' }, { status: 400 })
  }

  const kindRaw = String(body.kind ?? '').trim()
  const kind =
    kindRaw === 'logo' ? 'logo' : kindRaw === 'product_photo' ? 'product_photo' : 'banner'
  const aspectRatio =
    kind === 'logo'
      ? normalizeLogoAspectRatioForGemini(String(body.aspectRatio ?? '').trim() || undefined)
      : String(body.aspectRatio ?? '').trim() || (kind === 'banner' ? '16:9' : '1:1')
  const screenLabel =
    kind === 'logo' ? 'Website logo' : kind === 'banner' ? 'Website banner' : 'Website section image'

  const refs: string[] = []
  const extra = [body.referenceImageUrl, ...(Array.isArray(body.referenceImageUrls) ? body.referenceImageUrls : [])]
  for (const raw of extra) {
    const ref = String(raw || '').trim()
    if (/^https?:\/\//i.test(ref) && !refs.includes(ref)) refs.push(ref)
    if (refs.length >= 6) break
  }
  const meta = Array.isArray(body.referenceImageMeta)
    ? body.referenceImageMeta.slice(0, refs.length)
    : undefined
  const result = await runStudioImagePipeline({
    userId: auth.user.id,
    kind,
    screenLabel,
    brief: prompt,
    projectTitle: body.title?.trim() || 'Partner website',
    referenceImageUrls: refs.length ? refs : undefined,
    referenceImageMeta: meta,
    productImageUrls: kind === 'logo' ? undefined : refs.length ? refs : undefined,
    aspectRatio,
    verbatimPrompt: kind === 'logo',
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ publicUrl: result.resultUrl, charged: result.charged })
}

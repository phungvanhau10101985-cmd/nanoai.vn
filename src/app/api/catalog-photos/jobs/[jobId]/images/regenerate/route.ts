import { NextRequest, NextResponse } from 'next/server'
import { generateUserCatalogPhotoSlot, requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'
import { fetchUserCatalogPhotoJobPg } from '@/lib/db/user-catalog-photo-jobs-pg'
import { getCurrentWebLocale } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const job = await fetchUserCatalogPhotoJobPg(auth.userId, jobId.trim())
  if (!job?.studio.currentSlot) return NextResponse.json({ error: 'no_active_slot' }, { status: 400 })
  const body = (await req.json().catch(() => ({}))) as {
    customPrompt?: string
    prompt?: string
    refUrls?: string[]
    attachUrl?: string
    aspectRatio?: string
  }
  const slot = job.studio.currentSlot
  const attachFromBody = typeof body.attachUrl === 'string' ? body.attachUrl.trim() : ''
  const result = await generateUserCatalogPhotoSlot(
    auth.userId,
    jobId.trim(),
    {
      kind: slot.kind,
      name: slot.name,
      customPrompt: body.customPrompt || body.prompt,
      refUrls: Array.isArray(body.refUrls) && body.refUrls.length ? body.refUrls : slot.refUrls,
      attachUrl: attachFromBody || slot.attachUrl,
      aspectRatio: body.aspectRatio,
    },
    getCurrentWebLocale()
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}

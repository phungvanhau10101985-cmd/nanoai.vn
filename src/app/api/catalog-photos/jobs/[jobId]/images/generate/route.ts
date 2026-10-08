import { NextRequest, NextResponse } from 'next/server'
import { generateUserCatalogPhotoSlot, requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'
import { getCurrentWebLocale } from '@/lib/i18n/server'
import { PRODUCT_STUDIO_SLOT_KINDS, type ProductStudioSlotKind } from '@/lib/partner-website/product-studio/product-studio-types'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as {
    kind?: string
    name?: string
    prompt?: string
    customPrompt?: string
    refUrls?: string[]
    attachUrl?: string
    aspectRatio?: string
  }
  const kind = String(body.kind || '').trim()
  if (!PRODUCT_STUDIO_SLOT_KINDS.includes(kind as ProductStudioSlotKind)) {
    return NextResponse.json({ error: 'kind_required' }, { status: 400 })
  }
  const result = await generateUserCatalogPhotoSlot(
    auth.userId,
    jobId.trim(),
    {
      kind: kind as ProductStudioSlotKind,
      name: body.name,
      customPrompt: body.customPrompt || body.prompt,
      refUrls: Array.isArray(body.refUrls) ? body.refUrls : undefined,
      attachUrl: body.attachUrl,
      aspectRatio: body.aspectRatio,
    },
    getCurrentWebLocale()
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}

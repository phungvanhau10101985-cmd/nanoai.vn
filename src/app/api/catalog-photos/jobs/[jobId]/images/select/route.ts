import { NextRequest, NextResponse } from 'next/server'
import { requireCatalogPhotoUser, selectUserCatalogPhotoImages } from '@/lib/catalog-photo/catalog-photo-http'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const body = (await req.json().catch(() => ({}))) as { kind?: string; urls?: string[] }
  const kind = body.kind === 'detail' ? 'detail' : body.kind === 'gallery' ? 'gallery' : ''
  if (!kind) return NextResponse.json({ error: 'kind_required' }, { status: 400 })
  const result = await selectUserCatalogPhotoImages(
    auth.userId,
    jobId.trim(),
    kind,
    Array.isArray(body.urls) ? body.urls : []
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job })
}

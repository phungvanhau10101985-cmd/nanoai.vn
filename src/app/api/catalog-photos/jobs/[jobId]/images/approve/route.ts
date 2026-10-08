import { NextResponse } from 'next/server'
import { approveUserCatalogPhotoSlot, requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'

export const dynamic = 'force-dynamic'

export async function POST(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const result = await approveUserCatalogPhotoSlot(auth.userId, jobId.trim())
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ job: result.job, done: result.done })
}

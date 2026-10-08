import { NextResponse } from 'next/server'
import { requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'
import { deleteUserCatalogPhotoJobPg, fetchUserCatalogPhotoJobPg } from '@/lib/db/user-catalog-photo-jobs-pg'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const job = await fetchUserCatalogPhotoJobPg(auth.userId, jobId.trim())
  if (!job) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  return NextResponse.json({ job })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { jobId } = await ctx.params
  const ok = await deleteUserCatalogPhotoJobPg(auth.userId, jobId.trim())
  if (!ok) return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

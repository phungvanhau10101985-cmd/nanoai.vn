import { NextRequest, NextResponse } from 'next/server'
import { requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'
import { insertUserCatalogPhotoJobPg, listUserCatalogPhotoJobsPg } from '@/lib/db/user-catalog-photo-jobs-pg'
import { jsonToProductStudioPayload } from '@/lib/partner-website/product-studio/product-studio-types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const status = req.nextUrl.searchParams.get('status')
  const jobs =
    status === 'done'
      ? await listUserCatalogPhotoJobsPg(auth.userId, { status: 'done', limit: 50 })
      : await listUserCatalogPhotoJobsPg(auth.userId, {
          activeOnly: req.nextUrl.searchParams.get('active') !== 'false',
          limit: 8,
        })
  return NextResponse.json({ jobs })
}

export async function POST(req: NextRequest) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const body = (await req.json().catch(() => ({}))) as { payload?: unknown }
  const payload = jsonToProductStudioPayload((body.payload ?? {}) as never)
  if (payload.mode !== 'ai') return NextResponse.json({ error: 'ai_only' }, { status: 400 })
  if (!payload.material.trim()) return NextResponse.json({ error: 'material_required' }, { status: 400 })
  const job = await insertUserCatalogPhotoJobPg({
    userId: auth.userId,
    payload: { ...payload, mode: 'ai', productName: '', price: 0, available: 0 },
  })
  if (!job) return NextResponse.json({ error: 'Could not create job' }, { status: 500 })
  return NextResponse.json({ ok: true, jobId: job.id, job })
}

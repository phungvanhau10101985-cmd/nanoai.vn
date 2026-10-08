import { NextRequest, NextResponse } from 'next/server'
import { requireCatalogPhotoUser } from '@/lib/catalog-photo/catalog-photo-http'
import { prepareGuestChatImageForBunny } from '@/lib/messaging/guest-chat-image'
import { platformBunnyStorageAuth, uploadBunnyStorageObject } from '@/lib/storage/try-on-public-upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function extForMime(mime: string): string {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

export async function POST(req: NextRequest) {
  const auth = await requireCatalogPhotoUser()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ct = req.headers.get('content-type') || ''
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 })
  }
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  }
  const prepared = await prepareGuestChatImageForBunny(Buffer.from(await file.arrayBuffer()), file.type || '', file.name)
  if ('error' in prepared) return NextResponse.json({ error: prepared.error }, { status: 400 })
  const bunny = platformBunnyStorageAuth()
  if (!bunny) return NextResponse.json({ error: 'Storage is not configured.' }, { status: 503 })
  const path = `results/${auth.userId}/catalog_ref_${Date.now()}.${extForMime(prepared.mime)}`
  try {
    const up = await uploadBunnyStorageObject(path, prepared.buffer, { contentType: prepared.mime }, bunny)
    return NextResponse.json({ ok: true, publicUrl: up.publicUrl, path, purpose: 'ref' })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed.' }, { status: 400 })
  }
}

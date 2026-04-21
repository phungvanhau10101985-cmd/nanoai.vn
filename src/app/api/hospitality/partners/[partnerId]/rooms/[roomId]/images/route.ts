import { NextResponse, type NextRequest } from 'next/server'
import {
  fetchHospitalityRoomImagesByRoomPg,
  insertHospitalityRoomImagePg,
} from '@/lib/db/hospitality-pg'
import { requireHospitalityPartnerOwner } from '@/lib/hospitality/hospitality-partner-auth'
import {
  isAllowedHospitalityImageMime,
  uploadHospitalityRoomImageBuffer,
} from '@/lib/hospitality/hospitality-image-upload'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ partnerId: string; roomId: string }> }
) {
  const { partnerId, roomId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const items = await fetchHospitalityRoomImagesByRoomPg(partnerId, roomId)
  return NextResponse.json({ ok: true, items })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ partnerId: string; roomId: string }> }
) {
  const { partnerId, roomId } = await ctx.params
  const gate = await requireHospitalityPartnerOwner(partnerId)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const ctHeader = req.headers.get('content-type') || ''

  if (ctHeader.includes('multipart/form-data')) {
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
    const mime = file.type || ''
    if (!isAllowedHospitalityImageMime(mime)) {
      return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const up = await uploadHospitalityRoomImageBuffer(partnerId, roomId, buffer, mime)
    if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })

    const sortOrder = Number(form.get('sort_order') ?? 0)
    const row = await insertHospitalityRoomImagePg({
      partner_id: partnerId,
      room_id: roomId,
      image_url: up.publicUrl,
      sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
    })
    if (!row) return NextResponse.json({ error: 'INSERT_IMAGE_FAILED' }, { status: 400 })
    return NextResponse.json({ ok: true, item: row })
  }

  let body: { image_url?: string; sort_order?: number }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'BAD_JSON' }, { status: 400 })
  }
  const url = String(body.image_url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'MISSING_IMAGE_URL' }, { status: 400 })
  const row = await insertHospitalityRoomImagePg({
    partner_id: partnerId,
    room_id: roomId,
    image_url: url,
    sort_order: Number(body.sort_order ?? 0),
  })
  if (!row) return NextResponse.json({ error: 'INSERT_IMAGE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true, item: row })
}

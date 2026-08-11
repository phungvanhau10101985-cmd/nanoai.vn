import { NextRequest, NextResponse } from 'next/server'
import { getUserForCreditAction } from '@/lib/auth'
import { assertPartnerDashboardAccess } from '@/lib/partner-website/partner-website-auth'
import { isAllowedGuestImageMime, uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/** PS.3/PS.4 — upload ảnh cho Product Studio: purpose=catalog (ảnh đăng SP) | ref (ảnh tham chiếu AI, không public trong catalog). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await ctx.params
  const auth = await getUserForCreditAction()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: 401 })

  const pid = partnerId.trim()
  const access = await assertPartnerDashboardAccess(auth.user.id, pid, 'inventory')
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const ctHeader = req.headers.get('content-type') || ''
  if (!ctHeader.includes('multipart/form-data')) {
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
  const purposeRaw = String(form.get('purpose') ?? 'catalog').trim().toLowerCase()
  const purpose = purposeRaw === 'ref' ? 'ref' : 'catalog'

  const mime = file.type || ''
  if (!isAllowedGuestImageMime(mime)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
  }
  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadPartnerChatImageBuffer(pid, buffer, mime)
  if ('error' in up) return NextResponse.json({ error: up.error }, { status: 400 })

  return NextResponse.json({ ok: true, publicUrl: up.publicUrl, path: up.path, purpose })
}

import { NextRequest, NextResponse } from 'next/server'
import { getUserForAction } from '@/lib/auth'
import { isPgConfigured } from '@/lib/db/pool'
import { resolvePartnerDashboardAccessFromPg } from '@/lib/messaging/partner-dashboard-access'
import { partnerStaffHasPerm } from '@/lib/messaging/partner-staff-permissions'
import { isAllowedGuestImageMime, uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Upload ảnh shop gửi khách — chủ workspace; multipart: partnerId, file */
export async function POST(request: NextRequest) {
  const auth = await getUserForAction('Unauthorized')
  if ('error' in auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = auth.user

  if (!isPgConfigured()) {
    return NextResponse.json({ error: 'Server database is not configured.' }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const partnerId = String(formData.get('partnerId') ?? '').trim()
  if (!partnerId) {
    return NextResponse.json({ error: 'Missing partnerId.' }, { status: 400 })
  }

  let canSend = false
  try {
    const access = await resolvePartnerDashboardAccessFromPg(user.id, partnerId)
    canSend = access !== null && (access === 'owner' || partnerStaffHasPerm(access, 'inbox'))
  } catch (e) {
    console.warn('[partner/image] PG access check failed', e)
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  if (!canSend) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  }
  const mime = file.type
  if (!isAllowedGuestImageMime(mime)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadPartnerChatImageBuffer(partnerId, buffer, mime)
  if ('error' in up) {
    return NextResponse.json({ error: up.error }, { status: 400 })
  }
  return NextResponse.json({ path: up.path, publicUrl: up.publicUrl })
}

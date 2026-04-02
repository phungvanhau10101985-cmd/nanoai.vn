import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isAllowedGuestImageMime, uploadPartnerChatImageBuffer } from '@/lib/messaging/guest-chat-image'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Upload ảnh shop gửi khách — chủ workspace; multipart: partnerId, file */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  const { data: owned, error: ownErr } = await supabase
    .from('messaging_partners')
    .select('id')
    .eq('id', partnerId)
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (ownErr || !owned) {
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

  const db = createServiceRoleClient()
  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadPartnerChatImageBuffer(db, partnerId, buffer, mime)
  if ('error' in up) {
    return NextResponse.json({ error: up.error }, { status: 400 })
  }
  return NextResponse.json({ path: up.path, publicUrl: up.publicUrl })
}

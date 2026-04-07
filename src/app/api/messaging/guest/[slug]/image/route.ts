import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import {
  isAllowedGuestImageMime,
  uploadGuestChatImageBuffer,
} from '@/lib/messaging/guest-chat-image'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequest,
  writeGuestSessionCookie,
} from '@/lib/messaging/guest-auth-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function resolvePartner(slug: string) {
  if (isReservedMessagingGuestSlug(slug)) {
    return { error: 'not_found' as const }
  }
  const db = createServiceRoleClient()
  const { data: partner, error } = await db
    .from('messaging_partners')
    .select('id, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !partner?.is_active) {
    return { error: 'not_found' as const }
  }
  return { partnerId: partner.id, db }
}

/** Upload ảnh khách (hosted /messaging/p/...) — cần đăng nhập; multipart: file */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const existingSessionId = readGuestSessionIdFromRequest(request)
  const newSessionId = !user?.id && !existingSessionId ? createGuestSessionId() : null

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }
  const file = formData.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Missing file.' }, { status: 400 })
  }
  const mime = file.type
  if (!isAllowedGuestImageMime(mime)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 })
  }

  const r = await resolvePartner(slug)
  if ('error' in r) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const { partnerId, db } = r

  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadGuestChatImageBuffer(db, partnerId, buffer, mime)
  if ('error' in up) {
    return NextResponse.json({ error: up.error }, { status: 400 })
  }
  const res = NextResponse.json({ path: up.path, publicUrl: up.publicUrl })
  if (newSessionId) writeGuestSessionCookie(res, request, newSessionId)
  return res
}

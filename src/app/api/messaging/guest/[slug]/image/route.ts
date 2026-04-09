import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import {
  isAllowedGuestImageMime,
  uploadGuestChatImageBuffer,
} from '@/lib/messaging/guest-chat-image'
import {
  createGuestSessionId,
  readGuestSessionIdFromRequest,
  writeGuestSessionCookie,
  writeGuestSessionHeader,
} from '@/lib/messaging/guest-auth-session'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function resolvePartner(slug: string) {
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) {
    return { error: 'not_found' as const }
  }
  return { partnerId: active.id }
}

/** Upload ảnh khách (hosted /messaging/p/...) — cần đăng nhập; multipart: file */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const user = await getEmailSessionUser()
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
  const { partnerId } = r

  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadGuestChatImageBuffer(partnerId, buffer, mime)
  if ('error' in up) {
    return NextResponse.json({ error: up.error }, { status: 400 })
  }
  const res = NextResponse.json({ path: up.path, publicUrl: up.publicUrl })
  if (newSessionId) {
    writeGuestSessionCookie(res, request, newSessionId)
    writeGuestSessionHeader(res, newSessionId)
  }
  return res
}

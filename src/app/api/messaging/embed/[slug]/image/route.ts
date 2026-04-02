import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import {
  isAllowedGuestImageMime,
  uploadGuestChatImageBuffer,
} from '@/lib/messaging/guest-chat-image'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Embed-Key, X-Session-Id')
  return res
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }))
}

async function resolvePartner(slug: string, embedKey: string) {
  const db = createServiceRoleClient()
  const { data: partner, error } = await db
    .from('messaging_partners')
    .select('id, embed_key, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error || !partner || !partner.is_active) return { error: 'Invalid embed' as const }
  if (partner.embed_key !== embedKey) return { error: 'Invalid embed key' as const }
  return { partnerId: partner.id, db }
}

/** Upload ảnh khách (embed) — multipart + X-Embed-Key, X-Session-Id */
export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const embedKey = request.headers.get('x-embed-key')?.trim() || ''
  const sessionId = request.headers.get('x-session-id')?.trim() || ''
  if (!embedKey || !isValidMessagingGuestSessionId(sessionId)) {
    return cors(NextResponse.json({ error: 'Bad request' }, { status: 400 }))
  }
  const r = await resolvePartner(slug, embedKey)
  if ('error' in r) {
    return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }
  const { partnerId, db } = r

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return cors(NextResponse.json({ error: 'Invalid form data.' }, { status: 400 }))
  }
  const file = formData.get('file')
  if (!file || !(file instanceof File) || file.size <= 0) {
    return cors(NextResponse.json({ error: 'Missing file.' }, { status: 400 }))
  }
  const mime = file.type
  if (!isAllowedGuestImageMime(mime)) {
    return cors(NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 }))
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const up = await uploadGuestChatImageBuffer(db, partnerId, buffer, mime)
  if ('error' in up) {
    return cors(NextResponse.json({ error: up.error }, { status: 400 }))
  }
  return cors(NextResponse.json({ path: up.path, publicUrl: up.publicUrl }))
}

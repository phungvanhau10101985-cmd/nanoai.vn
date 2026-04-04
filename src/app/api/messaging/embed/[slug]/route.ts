import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { postWidgetGuestMessage } from '@/lib/messaging/widget-guest-post'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*')
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
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

export async function GET(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
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
  const { data: conv } = await db
    .from('customer_care_conversations')
    .select('id')
    .eq('partner_id', partnerId)
    .eq('channel', 'widget')
    .eq('external_thread_id', sessionId)
    .maybeSingle()
  if (!conv) {
    return cors(NextResponse.json({ messages: [] }))
  }
  const { data: messages, error } = await db
    .from('customer_care_messages')
    .select('id, direction, body, created_at, raw_payload')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: true })
  if (error) {
    return cors(NextResponse.json({ error: error.message }, { status: 500 }))
  }
  return cors(NextResponse.json({ messages: messages ?? [] }))
}

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
  const body = (await request.json().catch(() => null)) as {
    text?: string
    imageStoragePath?: string
  } | null

  const posted = await postWidgetGuestMessage(db, {
    partnerId,
    externalThreadId: sessionId,
    linkedUserId: null,
    customerName: `Web ${sessionId.slice(0, 8)}`,
    metadata: { source: 'embed' },
    text: body?.text,
    imageStoragePath: body?.imageStoragePath,
  })
  if ('error' in posted) {
    const status = posted.error === 'Invalid message.' ? 400 : 500
    return cors(NextResponse.json({ error: posted.error }, { status }))
  }
  return cors(
    NextResponse.json({
      ok: true,
      shopTyping: posted.shopTyping,
      visionPickRequired: posted.visionPickRequired ?? false,
    })
  )
}

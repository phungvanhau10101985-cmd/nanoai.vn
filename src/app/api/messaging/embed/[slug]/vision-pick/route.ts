import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { executeGuestVisionPick } from '@/lib/messaging/guest-vision-pick'

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

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const embedKey = request.headers.get('x-embed-key')?.trim() || ''
  const sessionId = request.headers.get('x-session-id')?.trim() || ''
  if (!embedKey || !isValidMessagingGuestSessionId(sessionId)) {
    return cors(NextResponse.json({ error: 'Bad request' }, { status: 400 }))
  }

  const body = (await request.json().catch(() => null)) as {
    messageId?: string
    inventoryId?: string
  } | null
  const messageId = body?.messageId?.trim() ?? ''
  const inventoryId = body?.inventoryId?.trim() ?? ''
  if (!messageId || !inventoryId) {
    return cors(NextResponse.json({ error: 'Bad request' }, { status: 400 }))
  }

  const r = await resolvePartner(slug, embedKey)
  if ('error' in r) {
    return cors(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
  }

  const result = await executeGuestVisionPick(r.db, {
    partnerId: r.partnerId,
    externalThreadId: sessionId,
    messageId,
    inventoryId,
  })

  if ('error' in result) {
    const status = result.notFound ? 404 : result.badRequest ? 400 : 500
    return cors(NextResponse.json({ error: result.error }, { status }))
  }

  return cors(
    NextResponse.json({
      ok: true,
      shopTyping: result.shopTyping,
    })
  )
}

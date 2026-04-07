import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { isReservedMessagingGuestSlug } from '@/lib/messaging/reserved-guest-slugs'
import { isValidMessagingGuestSessionId } from '@/lib/messaging/guest-session-id'
import { executeGuestVisionPick } from '@/lib/messaging/guest-vision-pick'
import { readGuestSessionIdFromRequest } from '@/lib/messaging/guest-auth-session'
import { readGuestAccountIdFromRequest } from '@/lib/messaging/guest-account-session'

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

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const embedKey = request.headers.get('x-embed-key')?.trim() || ''
  const sessionId = request.headers.get('x-session-id')?.trim() || ''
  const isEmbed = Boolean(embedKey && isValidMessagingGuestSessionId(sessionId))

  const body = (await request.json().catch(() => null)) as {
    messageId?: string
    inventoryId?: string
  } | null
  const messageId = body?.messageId?.trim() ?? ''
  const inventoryId = body?.inventoryId?.trim() ?? ''
  if (!messageId || !inventoryId) {
    const res = NextResponse.json({ error: 'Bad request' }, { status: 400 })
    return isEmbed ? cors(res) : res
  }

  const r = await resolvePartner(slug)
  if ('error' in r) {
    const res = NextResponse.json({ error: 'Not found' }, { status: 404 })
    return isEmbed ? cors(res) : res
  }
  const { partnerId, db } = r

  let externalThreadId: string | null = null

  if (isEmbed) {
    const { data: partner } = await db
      .from('messaging_partners')
      .select('embed_key')
      .eq('id', partnerId)
      .maybeSingle()
    if (!partner?.embed_key || partner.embed_key !== embedKey) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return cors(res)
    }
    externalThreadId = sessionId
  } else {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user?.id) {
      externalThreadId = user.id
    } else {
      const accountIdFromCookie = readGuestAccountIdFromRequest(request)
      if (accountIdFromCookie) {
        externalThreadId = accountIdFromCookie
      } else {
        const sessionFromCookie = readGuestSessionIdFromRequest(request)
        if (!sessionFromCookie) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        externalThreadId = sessionFromCookie
      }
    }
  }

  const result = await executeGuestVisionPick(db, {
    partnerId,
    externalThreadId,
    messageId,
    inventoryId,
  })

  if ('error' in result) {
    const status = result.notFound ? 404 : result.badRequest ? 400 : 500
    const res = NextResponse.json({ error: result.error }, { status })
    return isEmbed ? cors(res) : res
  }

  const res = NextResponse.json({
    ok: true,
    shopTyping: result.shopTyping,
  })
  return isEmbed ? cors(res) : res
}

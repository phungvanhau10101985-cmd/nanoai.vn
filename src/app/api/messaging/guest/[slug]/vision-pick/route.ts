import { NextRequest, NextResponse } from 'next/server'
import { getEmailSessionUser } from '@/lib/auth/email-session-user'
import { resolveActiveMessagingPartnerBySlug } from '@/lib/messaging/resolve-active-messaging-partner'
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
  const active = await resolveActiveMessagingPartnerBySlug(slug)
  if (!active) return { error: 'not_found' as const }
  return { partnerId: active.id, embedKey: active.embed_key }
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const headerEmbedKey = request.headers.get('x-embed-key')?.trim() || ''
  const sessionId = request.headers.get('x-session-id')?.trim() || ''
  const isEmbed = Boolean(headerEmbedKey && isValidMessagingGuestSessionId(sessionId))

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
  const { partnerId, embedKey: partnerEmbedKey } = r

  let externalThreadId: string | null = null

  if (isEmbed) {
    if (!partnerEmbedKey || partnerEmbedKey !== headerEmbedKey) {
      const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      return cors(res)
    }
    externalThreadId = sessionId
  } else {
    const user = await getEmailSessionUser()
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

  const result = await executeGuestVisionPick({
    partnerId,
    externalThreadId,
    messageId,
    inventoryId,
  })

  if ('error' in result) {
    const status = result.serviceUnavailable
      ? 503
      : result.notFound
        ? 404
        : result.badRequest
          ? 400
          : 500
    const res = NextResponse.json({ error: result.error }, { status })
    return isEmbed ? cors(res) : res
  }

  const res = NextResponse.json({
    ok: true,
    shopTyping: result.shopTyping,
  })
  return isEmbed ? cors(res) : res
}

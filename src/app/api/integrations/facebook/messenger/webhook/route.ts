import { NextRequest, NextResponse } from 'next/server'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import {
  parseFacebookMessengerInbound,
  verifyFacebookMessengerSignature,
} from '@/lib/customer-care/facebook-messenger'
import { findFacebookChannelByPageId, findFacebookChannelByVerifyToken } from '@/lib/messaging/partner-channels-db'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** GET: xác minh webhook Meta — theo env hoặc webhook_verify_token từng Page đối tác. */
export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (mode !== 'subscribe' || !token || !challenge) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const envTok = process.env.FACEBOOK_MESSENGER_VERIFY_TOKEN
  if (envTok && token === envTok) {
    return new NextResponse(challenge, { status: 200 })
  }

  try {
    const found = await findFacebookChannelByVerifyToken(token)
    if ('error' in found && found.error) {
      console.error('[facebook-messenger-webhook] verify lookup', found.error)
      return new NextResponse('Forbidden', { status: 403 })
    }
    if (found.row) {
      return new NextResponse(challenge, { status: 200 })
    }
  } catch (e) {
    console.error('[facebook-messenger-webhook] GET', e)
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const appSecret = process.env.FACEBOOK_MESSENGER_APP_SECRET
  const sig = request.headers.get('x-hub-signature-256')
  if (appSecret) {
    if (!verifyFacebookMessengerSignature(rawBody, sig, appSecret)) {
      return NextResponse.json({ ok: false }, { status: 403 })
    }
  } else {
    console.warn('[facebook-messenger-webhook] FACEBOOK_MESSENGER_APP_SECRET unset — không xác minh chữ ký')
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody) as unknown
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const items = parseFacebookMessengerInbound(body)
  if (items.length === 0) {
    return NextResponse.json({ ok: true, received: 0 })
  }

  let received = 0
  for (const item of items) {
    const pageId = item.facebookPageId
    if (!pageId) continue
    const ch = await findFacebookChannelByPageId(pageId)
    if ('error' in ch && ch.error) {
      console.error('[facebook-messenger-webhook] channel', ch.error)
      continue
    }
    if (!ch.channel) {
      console.warn('[facebook-messenger-webhook] No partner channel for page', pageId)
      continue
    }
    const conv = await ensureConversation({
      partnerId: ch.channel.partner_id,
      channel: 'facebook',
      externalThreadId: item.externalUserId,
      channelExternalRef: pageId,
      customerName: item.customerName,
    })
    if ('error' in conv) {
      console.error('[facebook-messenger-webhook] ensureConversation', conv.error)
      continue
    }
    const ins = await insertMessage({
      conversationId: conv.conversationId,
      direction: 'inbound',
      body: item.text,
      rawPayload: item.raw as import('@/types/database.types').Json,
    })
    if ('error' in ins) {
      console.error('[facebook-messenger-webhook] insertMessage', ins.error)
      continue
    }
    received += 1
    if ('messageId' in ins && ins.messageId) {
      await handlePartnerInboundForAi({
        partnerId: ch.channel.partner_id,
        conversationId: conv.conversationId,
        messageId: ins.messageId,
        inboundBody: item.text,
        channel: 'facebook',
      })
    }
  }

  return NextResponse.json({ ok: true, received })
}

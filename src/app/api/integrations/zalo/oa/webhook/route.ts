import { NextRequest, NextResponse } from 'next/server'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import { parseZaloOaInbound, verifyZaloWebhookSecret } from '@/lib/customer-care/zalo-oa'
import { findZaloChannelByWebhookSecret } from '@/lib/messaging/partner-channels-db'
import { fetchMessagingPartnerByIdFromPg, isMessagingPartnerInboundOpen } from '@/lib/db/messaging-partners-pg'
import { PLATFORM_MESSAGING_PARTNER_ID } from '@/lib/messaging/platform-partner'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function extractSecret(headers: Headers): string {
  return (
    headers.get('x-bot-api-secret-token') ||
    headers.get('X-Bot-Api-Secret-Token') ||
    headers.get('x-zalo-secret') ||
    headers.get('X-Zalo-Secret') ||
    ''
  ).trim()
}

/** POST — xác định đối tác theo secret lưu DB (hoặc legacy env → partner NanoAI). */
export async function POST(request: NextRequest) {
  const headerSecret = extractSecret(request.headers)
  if (!headerSecret) {
    return NextResponse.json({ ok: false }, { status: 403 })
  }

  const rowLookup = await findZaloChannelByWebhookSecret(headerSecret)
  if ('error' in rowLookup && rowLookup.error) {
    console.error('[zalo-oa-webhook] lookup', rowLookup.error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  let partnerId: string | null = rowLookup.row?.partner_id ?? null

  if (!partnerId) {
    const envSecret = process.env.ZALO_OA_WEBHOOK_SECRET || ''
    if (envSecret && verifyZaloWebhookSecret(request.headers, envSecret)) {
      partnerId = PLATFORM_MESSAGING_PARTNER_ID
    } else {
      return NextResponse.json({ ok: false }, { status: 403 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  const items = parseZaloOaInbound(body)
  if (items.length === 0) {
    return NextResponse.json({ ok: true, received: 0 })
  }

  const inboundGate = await fetchMessagingPartnerByIdFromPg(partnerId)
  if (!inboundGate || !isMessagingPartnerInboundOpen(inboundGate)) {
    return NextResponse.json({ ok: true, received: 0, skipped: true })
  }

  let received = 0
  for (const item of items) {
    const conv = await ensureConversation({
      partnerId,
      channel: 'zalo',
      externalThreadId: item.externalUserId,
      channelExternalRef: null,
      customerName: item.customerName,
    })
    if ('error' in conv) {
      console.error('[zalo-oa-webhook] ensureConversation', conv.error)
      continue
    }
    const ins = await insertMessage({
      conversationId: conv.conversationId,
      direction: 'inbound',
      body: item.text,
      rawPayload: item.raw as import('@/types/database.types').Json,
    })
    if ('error' in ins) {
      console.error('[zalo-oa-webhook] insertMessage', ins.error)
      continue
    }
    received += 1
    if ('messageId' in ins && ins.messageId) {
      await handlePartnerInboundForAi({
        partnerId,
        conversationId: conv.conversationId,
        messageId: ins.messageId,
        inboundBody: item.text,
        channel: 'zalo',
      })
    }
  }

  return NextResponse.json({ ok: true, received })
}

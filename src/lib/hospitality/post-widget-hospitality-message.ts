import type { Json } from '@/types/database.types'
import {
  ensureHospitalityConversation,
  insertHospitalityMessage,
  mergeHospitalityConversationUiLocale,
} from '@/lib/hospitality/hospitality-conversation-service'
import { generateHospitalityAutoReply } from '@/lib/hospitality/hospitality-ai-engine'
import { classifyHospitalityIntent } from '@/lib/hospitality/hospitality-intent'

export async function postWidgetHospitalityGuestMessage(params: {
  partnerId: string
  externalThreadId: string
  linkedUserId?: string | null
  customerName: string
  metadata: Json
  uiLocale?: string | null
  text: string
  landingSourceUrl?: string | null
  autoOpening?: boolean
  pageContext?: {
    roomTypeId?: string
    checkinAt?: string
    checkoutAt?: string
    source?: string
  }
}): Promise<{ ok: true; shopTyping?: { maxWaitMs: number } } | { error: string }> {
  const messageText = String(params.text ?? '').trim()
  if (!messageText) return { error: 'Invalid message.' }

  const conv = await ensureHospitalityConversation({
    partnerId: params.partnerId,
    channel: 'widget',
    externalThreadId: params.externalThreadId,
    customerName: params.customerName,
    linkedUserId: params.linkedUserId ?? null,
    metadata: params.metadata ?? {},
  })
  if (!('conversationId' in conv)) {
    return { error: conv.error }
  }

  if (params.uiLocale && params.uiLocale.trim()) {
    await mergeHospitalityConversationUiLocale(conv.conversationId, params.uiLocale.trim())
  }

  const intent = classifyHospitalityIntent(messageText)
  const inboundRawPayload: Json = {
    source: 'widget_hospitality',
    hospitality_intent: intent,
    widget_auto_opening: params.autoOpening === true ? true : undefined,
    page_context:
      params.pageContext && typeof params.pageContext === 'object'
        ? {
            room_type_id: params.pageContext.roomTypeId || undefined,
            checkin_at: params.pageContext.checkinAt || undefined,
            checkout_at: params.pageContext.checkoutAt || undefined,
            source: params.pageContext.source || undefined,
          }
        : undefined,
  }

  const inbound = await insertHospitalityMessage({
    conversationId: conv.conversationId,
    direction: 'inbound',
    body: messageText,
    rawPayload: inboundRawPayload,
    landingSourceUrl: params.landingSourceUrl ?? null,
  })
  if (!('ok' in inbound)) return { error: inbound.error }

  const aiReply = await generateHospitalityAutoReply({
    partner_id: params.partnerId,
    conversation_id: conv.conversationId,
    guest_text: messageText,
  })
  const outbound = await insertHospitalityMessage({
    conversationId: conv.conversationId,
    direction: 'outbound',
    body: aiReply.text,
    rawPayload: {
      source: 'hospitality_ai_auto_reply',
      hospitality_intent: aiReply.intent,
      trigger_message_id: inbound.messageId,
    },
  })
  if (!('ok' in outbound)) return { error: outbound.error }

  return { ok: true, shopTyping: { maxWaitMs: 700 } }
}

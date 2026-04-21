import { insertHospitalityMessageRaw } from '@/lib/hospitality/hospitality-conversation-service'

export async function appendWhatsAppInboundToConversation(params: {
  partner_id: string
  conversation_id: string
  external_message_id: string
  text: string
  from_phone: string
  raw_payload?: Record<string, unknown>
}): Promise<boolean> {
  const message = await insertHospitalityMessageRaw({
    conversationId: params.conversation_id,
    direction: 'inbound',
    body: params.text,
    rawPayload: {
      ...(params.raw_payload ?? {}),
      channel: 'whatsapp',
      whatsapp_message_id: params.external_message_id,
      whatsapp_from: params.from_phone,
    },
  })
  return Boolean(message)
}

export async function appendWhatsAppOutboundToConversation(params: {
  partner_id: string
  conversation_id: string
  external_message_id: string
  text: string
  to_phone: string
  raw_payload?: Record<string, unknown>
}): Promise<boolean> {
  const message = await insertHospitalityMessageRaw({
    conversationId: params.conversation_id,
    direction: 'outbound',
    body: params.text,
    rawPayload: {
      ...(params.raw_payload ?? {}),
      channel: 'whatsapp',
      whatsapp_message_id: params.external_message_id,
      whatsapp_to: params.to_phone,
    },
  })
  return Boolean(message)
}

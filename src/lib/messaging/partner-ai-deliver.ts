import type { Database, Json } from '@/types/database.types'
import { insertMessage } from '@/lib/customer-care/conversation-service'
import { sendFacebookMessengerText } from '@/lib/customer-care/facebook-messenger'
import { sendZaloOaText } from '@/lib/customer-care/zalo-oa'
import { getFacebookSendToken, getZaloSendToken } from '@/lib/messaging/partner-channels-db'

type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']
type ConvRow = Database['public']['Tables']['customer_care_conversations']['Row']

function applyDisclosure(body: string, settings: SettingsRow): string {
  if (!settings.append_ai_disclosure) return body.trim()
  const s = settings.disclosure_suffix?.trim()
  if (!s) return body.trim()
  return `${body.trim()}\n\n${s}`
}

/**
 * Gửi tin outbound tự động (FAQ/AI): lưu DB, đẩy FB/Zalo nếu cần. sender_admin_id = null.
 */
export async function deliverAutomatedPartnerMessage(params: {
  conversation: ConvRow
  settings: SettingsRow
  body: string
  rawPayload: Json
}): Promise<{ error?: string }> {
  const { conversation, settings, body, rawPayload } = params
  const text = applyDisclosure(body, settings)
  if (!text) return { error: 'Empty body' }

  const externalId = conversation.external_thread_id

  if (conversation.channel === 'facebook') {
    let pageToken: string | null = null
    const pageId = conversation.channel_external_ref
    if (pageId) {
      const r = await getFacebookSendToken(conversation.partner_id, pageId)
      if (r.error) return { error: r.error }
      pageToken = r.token ?? null
    }
    if (!pageToken) return { error: 'Facebook Page token missing.' }
    const sent = await sendFacebookMessengerText(externalId, text, pageToken)
    if ('error' in sent) return { error: sent.error }
  } else if (conversation.channel === 'zalo') {
    const r = await getZaloSendToken(conversation.partner_id)
    if (r.error) return { error: r.error }
    const tok = r.token ?? null
    if (!tok) return { error: 'Zalo OA token missing.' }
    const sent = await sendZaloOaText(externalId, text, tok)
    if ('error' in sent) return { error: sent.error }
  }

  const ins = await insertMessage({
    conversationId: conversation.id,
    direction: 'outbound',
    body: text,
    rawPayload,
    senderAdminId: null,
  })
  if ('error' in ins) return { error: ins.error }
  return {}
}

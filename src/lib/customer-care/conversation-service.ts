import type { Json } from '@/types/database.types'
import type { CustomerCareChannel } from '@/lib/customer-care/types'
import { ensureConversationPg, insertMessagePg } from '@/lib/db/customer-care-pg'
import { isPgConfigured } from '@/lib/db/pool'

/**
 * Đảm bảo hàng `customer_care_conversations` — chỉ Postgres (`DATABASE_URL`), không qua REST công khai cũ.
 */
export async function ensureConversation(params: {
  partnerId: string
  channel: CustomerCareChannel
  externalThreadId: string
  channelExternalRef?: string | null
  customerName?: string | null
  customerAvatarUrl?: string | null
  linkedUserId?: string | null
  guestAccountId?: string | null
  metadata?: Json
}): Promise<{ conversationId: string } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'Database is not configured (DATABASE_URL).' }
  }
  try {
    const fromPg = await ensureConversationPg(params)
    if (fromPg?.conversationId) {
      return { conversationId: fromPg.conversationId }
    }
  } catch (e) {
    console.error('[customer-care] ensureConversation', e)
  }
  return { error: 'Could not ensure conversation.' }
}

export async function insertMessage(params: {
  conversationId: string
  direction: 'inbound' | 'outbound'
  body: string
  rawPayload?: Json | null
  senderAdminId?: string | null
  landingSourceUrl?: string | null
}): Promise<{ ok: true; messageId: string } | { error: string }> {
  if (!isPgConfigured()) {
    return { error: 'Database is not configured (DATABASE_URL).' }
  }
  try {
    const fromPg = await insertMessagePg(params)
    if (fromPg) {
      return fromPg
    }
  } catch (e) {
    console.error('[customer-care] insertMessage', e)
  }
  return { error: 'Could not insert message.' }
}

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import {
  buildGuestMediaPayload,
  guestImageObjectExists,
  guestMediaPayloadToJson,
  inboundTextForPartnerAi,
  isGuestMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
  GUEST_CHAT_IMAGE_BUCKET,
} from '@/lib/messaging/guest-chat-image'

type Db = SupabaseClient<Database>

/**
 * Tin inbound từ khách qua widget (trang hosted NanoAI — bắt buộc đăng nhập; hoặc embed API ẩn danh trên site shop).
 * Cho phép chỉ chữ, chỉ ảnh (đã upload), hoặc ảnh + chú thích.
 */
export async function postWidgetGuestMessage(
  db: Db,
  params: {
    partnerId: string
    /** external_thread_id — hosted NanoAI dùng auth user id; embed dùng UUID phiên ẩn danh */
    externalThreadId: string
    /** Liên kết tài khoản Google (hosted); embed để null */
    linkedUserId?: string | null
    customerName: string
    metadata: Json
    text?: string
    imageStoragePath?: string
  }
): Promise<{ ok: true } | { error: string }> {
  const text = params.text?.trim() ?? ''
  const imagePath = params.imageStoragePath?.trim() ?? ''
  if ((!text && !imagePath) || text.length > 8000) {
    return { error: 'Invalid message.' }
  }

  let body: string
  let rawPayload: Json | null = null
  let imagePublicUrl: string | null = null

  if (imagePath) {
    if (!isGuestMessagingStoragePathForPartner(imagePath, params.partnerId)) {
      return { error: 'Invalid image path.' }
    }
    const exists = await guestImageObjectExists(db, imagePath)
    if (!exists) return { error: 'Image not found.' }
    const mime = mimeFromGuestImagePath(imagePath)
    const { data } = db.storage.from(GUEST_CHAT_IMAGE_BUCKET).getPublicUrl(imagePath)
    imagePublicUrl = data.publicUrl
    rawPayload = guestMediaPayloadToJson(buildGuestMediaPayload(imagePublicUrl, imagePath, mime))
    body = text ? `📷 ${text}` : '📷'
  } else {
    body = text
  }

  const conv = await ensureConversation(db, {
    partnerId: params.partnerId,
    channel: 'widget',
    externalThreadId: params.externalThreadId,
    customerName: params.customerName,
    linkedUserId: params.linkedUserId ?? null,
    metadata: params.metadata,
  })
  if ('error' in conv) return { error: conv.error ?? 'Conversation error.' }
  const conversationId = conv.conversationId
  if (!conversationId) return { error: 'Conversation failed.' }

  const ins = await insertMessage(db, {
    conversationId,
    direction: 'inbound',
    body,
    rawPayload,
  })
  if ('error' in ins) return { error: ins.error ?? 'Insert failed.' }

  const newMessageId = 'messageId' in ins ? ins.messageId : null
  if (newMessageId) {
    await handlePartnerInboundForAi(db, {
      partnerId: params.partnerId,
      conversationId,
      messageId: newMessageId,
      inboundBody: inboundTextForPartnerAi(body, imagePublicUrl),
      channel: 'widget',
    })
  }

  return { ok: true }
}

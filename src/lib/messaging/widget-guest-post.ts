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
import {
  buildInventoryMapByVisionProductId,
  visionProductSearchFromImageBuffer,
} from '@/lib/messaging/partner-vision-product-search'
import { hasVisionConfig } from '@/lib/vision-api'

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
): Promise<
  | { ok: true; shopTyping?: { maxWaitMs: number }; visionPickRequired?: boolean }
  | { error: string }
> {
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
  let shopTyping: { maxWaitMs: number } | undefined
  let visionPickRequired = false

  if (newMessageId && imagePath && hasVisionConfig()) {
    const { data: aiSet } = await db
      .from('messaging_partner_ai_settings')
      .select('*')
      .eq('partner_id', params.partnerId)
      .maybeSingle()
    if (aiSet?.vision_product_search_enabled && aiSet.vision_index_ready) {
      try {
        const { data: blob, error: dlErr } = await db.storage.from(GUEST_CHAT_IMAGE_BUCKET).download(imagePath)
        if (!dlErr && blob) {
          const buf = Buffer.from(await blob.arrayBuffer())
          const { data: invRows } = await db
            .from('messaging_partner_inventory')
            .select('*')
            .eq('partner_id', params.partnerId)
          const map = buildInventoryMapByVisionProductId(invRows ?? [], params.partnerId)
          const { candidates, error: se } = await visionProductSearchFromImageBuffer(
            buf,
            aiSet,
            params.partnerId,
            map,
            { userId: params.linkedUserId ?? null }
          )
          const prev = (rawPayload && typeof rawPayload === 'object' ? rawPayload : {}) as Record<string, unknown>
          const merged: Json = {
            ...prev,
            ...(candidates.length > 0
              ? {
                  vision_candidates: candidates,
                  vision_pick_required: true,
                  vision_search_error: undefined,
                }
              : {
                  vision_search_error: se ?? undefined,
                  ...(se ? {} : { vision_catalog_no_hits: true }),
                }),
          } as Json
          await db.from('customer_care_messages').update({ raw_payload: merged }).eq('id', newMessageId)
          if (candidates.length > 0) visionPickRequired = true
        }
      } catch (e) {
        console.error('[messaging] vision product search (guest)', e)
      }
    }
  }

  if (newMessageId && !visionPickRequired) {
    const hint = await handlePartnerInboundForAi(db, {
      partnerId: params.partnerId,
      conversationId,
      messageId: newMessageId,
      inboundBody: inboundTextForPartnerAi(body, imagePublicUrl),
      channel: 'widget',
    })
    if (hint.show) shopTyping = { maxWaitMs: hint.maxWaitMs }
  }

  return { ok: true, shopTyping, visionPickRequired: visionPickRequired || undefined }
}

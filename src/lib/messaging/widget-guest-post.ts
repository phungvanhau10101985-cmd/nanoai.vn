import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import { geminiProductSearchFromImageBuffer } from '@/lib/messaging/partner-gemini-image-search'
import {
  buildGuestMediaPayload,
  guestImageObjectExists,
  guestMediaPayloadToJson,
  inboundTextForPartnerAi,
  isGuestMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
  GUEST_CHAT_IMAGE_BUCKET,
} from '@/lib/messaging/guest-chat-image'
import { VISION_PICK_GRACE_AI_DELAY_SECONDS } from '@/lib/messaging/partner-vision-constants'

type Db = SupabaseClient<Database>
type GuestVisionCandidatePayload = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  score?: number
}

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
  let visionCandidates: GuestVisionCandidatePayload[] = []

  if (imagePath) {
    if (!isGuestMessagingStoragePathForPartner(imagePath, params.partnerId)) {
      return { error: 'Invalid image path.' }
    }
    const exists = await guestImageObjectExists(db, imagePath)
    if (!exists) return { error: 'Image not found.' }
    const mime = mimeFromGuestImagePath(imagePath)
    const { data } = db.storage.from(GUEST_CHAT_IMAGE_BUCKET).getPublicUrl(imagePath)
    imagePublicUrl = data.publicUrl
    const basePayload = guestMediaPayloadToJson(buildGuestMediaPayload(imagePublicUrl, imagePath, mime))

    try {
      const { data: aiSet } = await db
        .from('messaging_partner_ai_settings')
        .select('image_search_api_enabled')
        .eq('partner_id', params.partnerId)
        .maybeSingle()
      if (aiSet?.image_search_api_enabled) {
        const { data: blob, error: dlErr } = await db.storage.from(GUEST_CHAT_IMAGE_BUCKET).download(imagePath)
        if (!dlErr && blob) {
          const buf = Buffer.from(await blob.arrayBuffer())
          const { data: invRows } = await db
            .from('messaging_partner_inventory')
            .select('*')
            .eq('partner_id', params.partnerId)
          const search = await geminiProductSearchFromImageBuffer(buf, params.partnerId, invRows ?? [], {
            maxResults: 5,
            userId: params.linkedUserId ?? null,
          })
          visionCandidates = search.candidates.map((c) => ({
            inventoryId: c.inventoryId,
            name: c.name,
            sku: c.sku,
            image_url: c.image_url,
            ...(c.product_url ? { product_url: c.product_url } : {}),
            ...(typeof c.score === 'number' ? { score: c.score } : {}),
          }))
        }
      }
    } catch (e) {
      console.error('[widget-guest-post] image candidate search', e)
    }

    rawPayload =
      visionCandidates.length > 0
        ? ({
            ...(basePayload && typeof basePayload === 'object' ? (basePayload as Record<string, unknown>) : {}),
            vision_pick_required: true,
            vision_candidates: visionCandidates,
          } as Json)
        : basePayload
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
  const visionPickRequired = visionCandidates.length > 0

  if (newMessageId) {
    const hint = await handlePartnerInboundForAi(db, {
      partnerId: params.partnerId,
      conversationId,
      messageId: newMessageId,
      inboundBody: inboundTextForPartnerAi(body, imagePublicUrl),
      channel: 'widget',
      skipEagerBatchRun: true,
      ...(visionPickRequired
        ? { scheduleAiAfterSeconds: VISION_PICK_GRACE_AI_DELAY_SECONDS }
        : {}),
    })
    if (hint.show) shopTyping = { maxWaitMs: hint.maxWaitMs }
  }

  return { ok: true, shopTyping, visionPickRequired: visionPickRequired || undefined }
}

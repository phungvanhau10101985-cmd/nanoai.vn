import type { Json } from '@/types/database.types'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import {
  buildGuestMediaPayload,
  guestMediaPayloadToJson,
  inboundTextForPartnerAi,
  isGuestMessagingStoragePathForPartner,
  mimeFromGuestImagePath,
} from '@/lib/messaging/guest-chat-image'
import { downloadTryOnObject, getTryOnPublicUrlFromPath, tryOnObjectExistsByPath } from '@/lib/storage/try-on-public-upload'
import { VISION_PICK_GRACE_AI_DELAY_SECONDS } from '@/lib/messaging/partner-vision-constants'
import { countInboundMessagesForConversationPg } from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiEnabledFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchPartnerInventoryPriceHintsByIdsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'

const ANONYMOUS_INBOUND_AUTH_THRESHOLD = 5
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
 * Cho phép chỉ chữ, chỉ ảnh (đã upload), hoặc ảnh + chú thích. Chỉ Postgres cho đếm/AI settings/giá kho.
 */
export async function postWidgetGuestMessage(params: {
  partnerId: string
  externalThreadId: string
  linkedUserId?: string | null
  guestAccountId?: string | null
  customerName: string
  metadata: Json
  text?: string
  imageStoragePath?: string
  pageContext?: {
    sku?: string
    imageUrl?: string
    productUrl?: string
    source?: string
  }
}): Promise<
  | { ok: true; shopTyping?: { maxWaitMs: number }; visionPickRequired?: boolean }
  | { error: string; requireAuth?: boolean }
> {
  const text = params.text?.trim() ?? ''
  const imagePath = params.imageStoragePath?.trim() ?? ''
  const pageContextSku =
    typeof params.pageContext?.sku === 'string' ? params.pageContext.sku.trim().slice(0, 128) : ''
  const pageContextImageUrlRaw =
    typeof params.pageContext?.imageUrl === 'string' ? params.pageContext.imageUrl.trim() : ''
  const pageContextImageUrl = /^https?:\/\//i.test(pageContextImageUrlRaw) ? pageContextImageUrlRaw : ''
  const pageContextProductUrlRaw =
    typeof params.pageContext?.productUrl === 'string' ? params.pageContext.productUrl.trim() : ''
  const pageContextProductUrl = /^https?:\/\//i.test(pageContextProductUrlRaw) ? pageContextProductUrlRaw : ''
  const pageContextHasAny =
    Boolean(pageContextSku) || Boolean(pageContextImageUrl) || Boolean(pageContextProductUrl)
  if ((!text && !imagePath && !pageContextHasAny) || text.length > 8000) {
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
    const exists = await tryOnObjectExistsByPath(imagePath)
    if (!exists) return { error: 'Image not found.' }
    const mime = mimeFromGuestImagePath(imagePath)
    imagePublicUrl = getTryOnPublicUrlFromPath(imagePath)
    const basePayload = guestMediaPayloadToJson(buildGuestMediaPayload(imagePublicUrl, imagePath, mime))
    const imageCaption = text.trim()

    try {
      let aiEnabled = false
      if (isPgConfigured()) {
        const fromPg = await fetchMessagingPartnerAiEnabledFromPg(params.partnerId)
        if (fromPg !== null) {
          aiEnabled = fromPg.enabled
        }
      }
      if (aiEnabled) {
        const buf = await downloadTryOnObject(imagePath)
        if (buf) {
          const search = await geminiProductSearchFromImageBufferViaVectorDb(buf, params.partnerId, {
            maxResults: 5,
            userId: params.linkedUserId ?? null,
          })
          if (search.error) {
            console.error('[widget-guest-post] image candidate search error', {
              partnerId: params.partnerId,
              error: search.error,
            })
          }
          const candidateIds = search.candidates.map((c) => c.inventoryId)
          const priceById = new Map<string, string>()
          if (candidateIds.length > 0 && isPgConfigured()) {
            const priceFromPg = await fetchPartnerInventoryPriceHintsByIdsFromPg(params.partnerId, candidateIds)
            if (priceFromPg !== null) {
              for (const [id, hint] of priceFromPg) priceById.set(id, hint)
            }
          }
          visionCandidates = search.candidates.map((c) => ({
            inventoryId: c.inventoryId,
            name: c.name,
            sku: c.sku,
            image_url: c.image_url,
            ...(c.product_url ? { product_url: c.product_url } : {}),
            ...(c.price_hint?.trim()
              ? { price_hint: c.price_hint.trim() }
              : priceById.get(c.inventoryId)?.trim()
                ? { price_hint: priceById.get(c.inventoryId) }
                : {}),
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
            ...(imageCaption ? { image_caption: imageCaption } : {}),
          } as Json)
        : ({
            ...(basePayload && typeof basePayload === 'object' ? (basePayload as Record<string, unknown>) : {}),
            ...(imageCaption ? { image_caption: imageCaption } : {}),
          } as Json)
    if (pageContextHasAny && rawPayload && typeof rawPayload === 'object') {
      rawPayload = {
        ...(rawPayload as Record<string, unknown>),
        page_context: {
          ...(pageContextSku ? { sku: pageContextSku } : {}),
          ...(pageContextImageUrl ? { image_url: pageContextImageUrl } : {}),
          ...(pageContextProductUrl ? { product_url: pageContextProductUrl } : {}),
          ...(typeof params.pageContext?.source === 'string' ? { source: params.pageContext.source } : {}),
        },
      } as Json
    }
    body = text ? `📷 ${text}` : '📷'
  } else {
    rawPayload =
      pageContextHasAny
        ? ({
            page_context: {
              ...(pageContextSku ? { sku: pageContextSku } : {}),
              ...(pageContextImageUrl ? { image_url: pageContextImageUrl } : {}),
              ...(pageContextProductUrl ? { product_url: pageContextProductUrl } : {}),
              ...(typeof params.pageContext?.source === 'string' ? { source: params.pageContext.source } : {}),
            },
          } as Json)
        : null
    body = text || '📦'
  }

  const conv = await ensureConversation({
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

  if (!params.linkedUserId && !params.guestAccountId) {
    let inboundCount: number | null = null
    if (isPgConfigured()) {
      try {
        inboundCount = await countInboundMessagesForConversationPg(conversationId)
      } catch {
        inboundCount = null
      }
    }
    if (inboundCount === null) {
      return { error: 'Could not verify anonymous message limit.' }
    }
    if (inboundCount >= ANONYMOUS_INBOUND_AUTH_THRESHOLD) {
      return { error: `AUTH_REQUIRED_${ANONYMOUS_INBOUND_AUTH_THRESHOLD}`, requireAuth: true }
    }
  }

  const ins = await insertMessage({
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
    const aiContextHints = [
      pageContextSku ? `[Customer product SKU: ${pageContextSku}]` : '',
      pageContextProductUrl ? `[Customer product URL: ${pageContextProductUrl}]` : '',
      !imagePublicUrl && pageContextImageUrl ? `[Customer product image: ${pageContextImageUrl}]` : '',
    ]
      .filter(Boolean)
      .join('\n')
    // When vision picks are available, wait for customer product selection first.
    // This avoids premature text-based replies for image+caption turns.
    if (!visionPickRequired) {
      const inboundForAi = [inboundTextForPartnerAi(body, imagePublicUrl), aiContextHints].filter(Boolean).join('\n')
      const hint = await handlePartnerInboundForAi({
        partnerId: params.partnerId,
        conversationId,
        messageId: newMessageId,
        inboundBody: inboundForAi,
        channel: 'widget',
        skipEagerBatchRun: true,
        ...(visionPickRequired
          ? { scheduleAiAfterSeconds: VISION_PICK_GRACE_AI_DELAY_SECONDS }
          : {}),
      })
      if (hint.show) shopTyping = { maxWaitMs: hint.maxWaitMs }
    }
  }

  return { ok: true, shopTyping, visionPickRequired: visionPickRequired || undefined }
}

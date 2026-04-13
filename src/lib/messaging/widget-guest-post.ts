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
import { WIDGET_PRODUCT_VECTOR_PICK_MAX } from '@/lib/messaging/partner-vision-constants'
import { findMatchingFaq } from '@/lib/messaging/partner-ai-faq'
import { fetchInventoryRowsBySemanticTextForPartnerAi } from '@/lib/messaging/partner-inventory-text-embedding'
import {
  buildInventoryEmbeddingQueryWithGenderHint,
  customerMessageWantsSimilarCatalogVersusLastConsulted,
  enrichSemanticInventoryRowsForWidget,
  inboundTextLooksLikeFollowUpConsultHeuristic,
} from '@/lib/messaging/partner-inventory-ai-search'
import {
  countInboundMessagesForConversationPg,
  resolveLinkedUserIdForCustomerCarePg,
} from '@/lib/db/customer-care-pg'
import { fetchMessagingPartnerAiEnabledFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import { fetchPartnerInventoryPriceHintsByIdsFromPg } from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  prepareDeferredGuestPaymentVerification,
  verifyOrderPaymentProof,
  type TransferReceiptOcrResult,
} from '@/lib/messaging/guest-chat-ordering'

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
  | {
      ok: true
      shopTyping?: { maxWaitMs: number }
      visionPickRequired?: boolean
      paymentVerificationHandled?: boolean
    }
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

  const linkedUserId = await resolveLinkedUserIdForCustomerCarePg(params.linkedUserId)

  let body: string
  let rawPayload: Json | null = null
  let imagePublicUrl: string | null = null
  /** Gợi ý theo vector (ảnh hoặc chữ) — giống nhau; không lên lịch LLM cho đến khi khách chọn SP. */
  let productPickCandidates: GuestVisionCandidatePayload[] = []
  /** Ảnh biên lai CK — đối chiếu sau khi lưu tin inbound (tránh LLM gợi ý SP). */
  let deferredPaymentVerify: { orderId: string; ocr: TransferReceiptOcrResult } | null = null

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
      if (isPgConfigured() && imagePublicUrl) {
        const prep = await prepareDeferredGuestPaymentVerification({
          partnerId: params.partnerId,
          externalThreadId: params.externalThreadId,
          imagePublicUrl,
        })
        if (prep.defer) {
          deferredPaymentVerify = { orderId: prep.orderId, ocr: prep.ocr }
        }
      }
    } catch (e) {
      console.warn('[widget-guest-post] payment receipt detection', e)
    }

    try {
      let aiEnabled = false
      if (isPgConfigured()) {
        const fromPg = await fetchMessagingPartnerAiEnabledFromPg(params.partnerId)
        if (fromPg !== null) {
          aiEnabled = fromPg.enabled
        }
      }
      if (aiEnabled && !deferredPaymentVerify) {
        const buf = await downloadTryOnObject(imagePath)
        if (buf) {
          const search = await geminiProductSearchFromImageBufferViaVectorDb(buf, params.partnerId, {
            maxResults: WIDGET_PRODUCT_VECTOR_PICK_MAX,
            userId: linkedUserId,
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
          productPickCandidates = search.candidates.map((c) => ({
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
      productPickCandidates.length > 0
        ? ({
            ...(basePayload && typeof basePayload === 'object' ? (basePayload as Record<string, unknown>) : {}),
            vision_pick_required: true,
            vision_candidates: productPickCandidates,
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

    const trimmedText = text.trim()
    const minCharsForVectorPick = 3
    /** Khách đã bấm «Tư vấn» trên thẻ SP — không gắn lại thanh gợi ý vector (tránh lặp UI, vẫn gọi LLM với page_context). */
    const skipTextVectorPick =
      typeof params.pageContext?.source === 'string' &&
      params.pageContext.source === 'product_card_consult'
    /** Tin kiểu «có màu gì» — không chạy embedding/vector trên cả kho (tránh vision_pick + lệch luồng hỏi tiếp). Ngoại lệ: «mẫu khác / tương tự» vẫn gợi ý vector để widget có ứng viên. */
    const skipFollowUpStyleVectorPick =
      inboundTextLooksLikeFollowUpConsultHeuristic(trimmedText) &&
      !customerMessageWantsSimilarCatalogVersusLastConsulted(trimmedText)
    if (trimmedText.length >= minCharsForVectorPick && !skipTextVectorPick && !skipFollowUpStyleVectorPick) {
      try {
        let aiEnabled = false
        if (isPgConfigured()) {
          const fromPg = await fetchMessagingPartnerAiEnabledFromPg(params.partnerId)
          if (fromPg !== null) aiEnabled = fromPg.enabled
        }
        if (aiEnabled) {
          const faq = await findMatchingFaq(params.partnerId, trimmedText)
          if (!faq) {
            const embedQuery = buildInventoryEmbeddingQueryWithGenderHint(trimmedText)
            const rowsRaw = await fetchInventoryRowsBySemanticTextForPartnerAi(
              params.partnerId,
              embedQuery,
              WIDGET_PRODUCT_VECTOR_PICK_MAX
            )
            const rows = await enrichSemanticInventoryRowsForWidget(
              params.partnerId,
              trimmedText,
              rowsRaw,
              WIDGET_PRODUCT_VECTOR_PICK_MAX
            )
            if (rows.length > 0) {
              const candidateIds = rows.map((r) => r.id)
              const priceById = new Map<string, string>()
              if (isPgConfigured()) {
                const priceFromPg = await fetchPartnerInventoryPriceHintsByIdsFromPg(params.partnerId, candidateIds)
                if (priceFromPg !== null) {
                  for (const [id, hint] of priceFromPg) priceById.set(id, hint)
                }
              }
              productPickCandidates = rows.map((row) => {
                const purl = row.product_url?.trim() ?? ''
                const ph =
                  row.price_hint?.trim() ||
                  priceById.get(row.id)?.trim() ||
                  ''
                return {
                  inventoryId: row.id,
                  name: row.name ?? '',
                  sku: row.sku ?? null,
                  image_url: row.image_url ?? '',
                  ...(purl && /^https?:\/\//i.test(purl) ? { product_url: purl } : {}),
                  ...(ph ? { price_hint: ph } : {}),
                }
              })
            }
          }
        }
      } catch (e) {
        console.error('[widget-guest-post] text vector candidate search', e)
      }
    }

    if (productPickCandidates.length > 0) {
      rawPayload = {
        ...(rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {}),
        vision_pick_required: true,
        vision_candidates: productPickCandidates,
      } as Json
    }
  }

  const conv = await ensureConversation({
    partnerId: params.partnerId,
    channel: 'widget',
    externalThreadId: params.externalThreadId,
    customerName: params.customerName,
    linkedUserId,
    metadata: params.metadata,
  })
  if ('error' in conv) return { error: conv.error ?? 'Conversation error.' }
  const conversationId = conv.conversationId
  if (!conversationId) return { error: 'Conversation failed.' }

  if (!linkedUserId && !params.guestAccountId) {
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
  const visionPickRequired = productPickCandidates.length > 0
  let paymentVerificationHandled = false

  if (newMessageId && imagePath && deferredPaymentVerify) {
    try {
      const v = await verifyOrderPaymentProof({
        partnerId: params.partnerId,
        externalThreadId: params.externalThreadId,
        orderId: deferredPaymentVerify.orderId,
        proofImageStoragePath: imagePath,
        linkedUserId: params.linkedUserId,
        guestAccountId: params.guestAccountId,
        preReadOcr: deferredPaymentVerify.ocr,
      })
      if ('error' in v) console.warn('[widget-guest-post] verifyOrderPaymentProof', v.error)
      else paymentVerificationHandled = true
    } catch (e) {
      console.warn('[widget-guest-post] verifyOrderPaymentProof', e)
    }
  }

  if (newMessageId) {
    const aiContextHints = [
      pageContextSku ? `[Customer product SKU: ${pageContextSku}]` : '',
      pageContextProductUrl ? `[Customer product URL: ${pageContextProductUrl}]` : '',
      !imagePublicUrl && pageContextImageUrl ? `[Customer product image: ${pageContextImageUrl}]` : '',
    ]
      .filter(Boolean)
      .join('\n')
    // Khi đã có gợi ý vector (ảnh hoặc chữ), chờ khách chọn SP — không gọi LLM tư vấn trước.
    // Ảnh biên lai CK: đã định tuyến đối chiếu thanh toán — không gọi LLM gợi ý SP.
    if (!visionPickRequired && !deferredPaymentVerify) {
      const inboundForAi = [inboundTextForPartnerAi(body, imagePublicUrl), aiContextHints].filter(Boolean).join('\n')
      const hint = await handlePartnerInboundForAi({
        partnerId: params.partnerId,
        conversationId,
        messageId: newMessageId,
        inboundBody: inboundForAi,
        channel: 'widget',
        skipEagerBatchRun: true,
      })
      if (hint.show) shopTyping = { maxWaitMs: hint.maxWaitMs }
    }
  }

  return {
    ok: true,
    shopTyping,
    visionPickRequired: visionPickRequired || undefined,
    paymentVerificationHandled: paymentVerificationHandled || undefined,
  }
}

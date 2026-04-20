import type { Json } from '@/types/database.types'
import { ensureConversation, insertMessage } from '@/lib/customer-care/conversation-service'
import { handlePartnerInboundForAi } from '@/lib/messaging/partner-ai-inbound'
import { geminiProductSearchFromImageBufferViaVectorDb } from '@/lib/messaging/partner-gemini-image-search'
import {
  buildGuestMediaPayload,
  fetchRemoteProductImageIntoGuestStorage,
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
  fetchLastOutboundCustomerCareMessageBodyPg,
  mergeConversationUiLocaleFromPg,
  resolveLinkedUserIdForCustomerCarePg,
} from '@/lib/db/customer-care-pg'
import { normalizeWebLocale } from '@/lib/i18n/config'
import { fetchMessagingPartnerAiEnabledFromPg } from '@/lib/db/messaging-partner-ai-settings-pg'
import {
  fetchPartnerInventoryPriceHintsByIdsFromPg,
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { fetchMessagingPartnerByIdFromPg, isMessagingPartnerInboundOpen } from '@/lib/db/messaging-partners-pg'
import {
  prepareDeferredGuestPaymentVerification,
  verifyOrderPaymentProof,
  type TransferReceiptOcrResult,
} from '@/lib/messaging/guest-chat-ordering'
import type { PartnerAiWidgetIntent } from '@/lib/messaging/partner-ai-unclear-intent'
import { partnerAiMessageAloneSuggestsClarifyIntent } from '@/lib/messaging/partner-ai-unclear-intent'
import { classifyWidgetInboundIntent } from '@/lib/messaging/partner-ai-widget-intent-classifier'
import { isLikelyVideoOrStreamUrl } from '@/lib/messaging/is-likely-video-url'
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
  /** Ngôn ngữ giao diện khách (vi/en/zh/ja/ko) — lưu vào metadata hội thoại để tin hệ thống đơn hàng đúng ngôn ngữ. */
  uiLocale?: string | null
  text?: string
  imageStoragePath?: string
  /** Tin mở đầu tự động từ link tư vấn (chưa có tương tác nhắn lại). */
  autoOpening?: boolean
  /** URL trang lúc gửi (vd. `window.location.href`) — cột `landing_source_url` cho nguồn traffic / feed Google Facebook. */
  landingSourceUrl?: string | null
  pageContext?: {
    sku?: string
    imageUrl?: string
    /** Ảnh thứ 2 trong gallery trang SP (embed đặt `ctx_image_2`) — ưu tiên sau ảnh kho, trước `ctx_image`. */
    imageUrl2?: string
    productUrl?: string
    /** UUID dòng kho — neo «Tư vấn» trực tiếp, không embed lại ảnh thẻ. */
    inventoryId?: string
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
  const pageContextSku =
    typeof params.pageContext?.sku === 'string' ? params.pageContext.sku.trim().slice(0, 128) : ''
  const pageContextImageUrlRaw =
    typeof params.pageContext?.imageUrl === 'string' ? params.pageContext.imageUrl.trim() : ''
  const pageContextImageUrl2Raw =
    typeof params.pageContext?.imageUrl2 === 'string' ? params.pageContext.imageUrl2.trim() : ''
  let pageContextImageUrl =
    /^https?:\/\//i.test(pageContextImageUrlRaw) && !isLikelyVideoOrStreamUrl(pageContextImageUrlRaw)
      ? pageContextImageUrlRaw
      : ''
  let pageContextImageUrl2 =
    /^https?:\/\//i.test(pageContextImageUrl2Raw) && !isLikelyVideoOrStreamUrl(pageContextImageUrl2Raw)
      ? pageContextImageUrl2Raw
      : ''
  if (!pageContextImageUrl && pageContextImageUrl2) {
    pageContextImageUrl = pageContextImageUrl2
    pageContextImageUrl2 = ''
  }

  const pageContextProductUrlRaw =
    typeof params.pageContext?.productUrl === 'string' ? params.pageContext.productUrl.trim() : ''
  const pageContextProductUrl = /^https?:\/\//i.test(pageContextProductUrlRaw) ? pageContextProductUrlRaw : ''
  const pageContextInventoryIdRaw =
    typeof params.pageContext?.inventoryId === 'string' ? params.pageContext.inventoryId.trim() : ''
  const pageContextInventoryId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    pageContextInventoryIdRaw
  )
    ? pageContextInventoryIdRaw
    : ''

  /** Kho → ảnh thứ 2 gallery (`ctx_image_2`) → ảnh đầu (`ctx_image`). */
  let pageContextImageUrlForVector = ''
  if (isPgConfigured() && (pageContextInventoryId || pageContextSku)) {
    let row = null as Awaited<ReturnType<typeof fetchPartnerInventoryRowByIdForPartnerFromPg>>
    if (pageContextInventoryId) {
      row = await fetchPartnerInventoryRowByIdForPartnerFromPg(params.partnerId, pageContextInventoryId)
    }
    if (!row && pageContextSku) {
      row = await fetchPartnerInventoryRowByComparableSkuFromPg(params.partnerId, pageContextSku)
    }
    const img = row?.image_url ? String(row.image_url).trim() : ''
    if (img && /^https?:\/\//i.test(img)) pageContextImageUrlForVector = img
  }
  if (!pageContextImageUrlForVector && pageContextImageUrl2) {
    pageContextImageUrlForVector = pageContextImageUrl2
  }
  if (!pageContextImageUrlForVector && pageContextImageUrl) {
    pageContextImageUrlForVector = pageContextImageUrl
  }

  let imagePath = params.imageStoragePath?.trim() ?? ''
  /** Ảnh ngữ cảnh → storage → vector (ảnh kho hoặc — nếu không có SKU/id — `ctx_image` legacy). */
  if (!imagePath && pageContextImageUrlForVector) {
    const ing = await fetchRemoteProductImageIntoGuestStorage(params.partnerId, pageContextImageUrlForVector)
    if ('path' in ing) {
      imagePath = ing.path
    } else {
      console.warn('[widget-guest-post] page context image ingest', ing.error)
    }
  }

  const pageContextImageForPayload = pageContextImageUrlForVector
  const pageContextHasAny =
    Boolean(pageContextSku) ||
    Boolean(pageContextImageUrl) ||
    Boolean(pageContextImageUrl2) ||
    Boolean(pageContextProductUrl) ||
    Boolean(pageContextInventoryId)
  /** Bấm «Tư vấn» trên thẻ SP — ảnh chỉ là ngữ cảnh cho LLM; không chạy vision_pick (tránh chỉ hiển thị carousel, không tư vấn). */
  const isProductCardConsult =
    typeof params.pageContext?.source === 'string' && params.pageContext.source.trim() === 'product_card_consult'
  if ((!text && !imagePath && !pageContextHasAny) || text.length > 8000) {
    return { error: 'Invalid message.' }
  }

  if (isPgConfigured()) {
    const gate = await fetchMessagingPartnerByIdFromPg(params.partnerId)
    if (!gate || !isMessagingPartnerInboundOpen(gate)) {
      return { error: 'Shop is not accepting messages.' }
    }
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
      if (aiEnabled && !deferredPaymentVerify && !isProductCardConsult) {
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
      const src = typeof params.pageContext?.source === 'string' ? params.pageContext.source : ''
      rawPayload = {
        ...(rawPayload as Record<string, unknown>),
        page_context: {
          ...(pageContextSku ? { sku: pageContextSku } : {}),
          ...(pageContextImageForPayload ? { image_url: pageContextImageForPayload } : {}),
          ...(pageContextImageUrl2 ? { image_url_2: pageContextImageUrl2 } : {}),
          ...(src === 'product_card_consult' && pageContextProductUrl ? { product_url: pageContextProductUrl } : {}),
          ...(pageContextInventoryId ? { inventory_id: pageContextInventoryId } : {}),
          ...(src ? { source: src } : {}),
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
              ...(pageContextImageForPayload ? { image_url: pageContextImageForPayload } : {}),
              ...(pageContextImageUrl2 ? { image_url_2: pageContextImageUrl2 } : {}),
              ...(typeof params.pageContext?.source === 'string' &&
              params.pageContext.source === 'product_card_consult' &&
              pageContextProductUrl
                ? { product_url: pageContextProductUrl }
                : {}),
              ...(pageContextInventoryId ? { inventory_id: pageContextInventoryId } : {}),
              ...(typeof params.pageContext?.source === 'string' ? { source: params.pageContext.source } : {}),
            },
          } as Json)
        : null
    body = text || '📦'

    let partnerAiWidgetIntentForPayload: PartnerAiWidgetIntent | null = null
    const trimmedText = text.trim()
    const minCharsForVectorPick = 3
    /** Khách đã bấm «Tư vấn» trên thẻ SP — không gắn lại thanh gợi ý vector (tránh lặp UI, vẫn gọi LLM với page_context). */
    const skipTextVectorPick = isProductCardConsult
    /** Tin kiểu «có màu gì» — không chạy embedding/vector trên cả kho (tránh vision_pick + lệch luồng hỏi tiếp). Ngoại lệ: «mẫu khác / tương tự» vẫn gợi ý vector để widget có ứng viên. */
    const skipFollowUpStyleVectorPick =
      inboundTextLooksLikeFollowUpConsultHeuristic(trimmedText) &&
      !customerMessageWantsSimilarCatalogVersusLastConsulted(trimmedText)
    /** Heuristic «không rõ ý định» — khi LLM phân loại không chạy hoặc trả null. */
    const skipClarifyIntentVectorHeuristic = partnerAiMessageAloneSuggestsClarifyIntent(trimmedText)
    if (trimmedText.length >= minCharsForVectorPick && !skipTextVectorPick && !skipFollowUpStyleVectorPick) {
      try {
        let aiEnabled = false
        if (isPgConfigured()) {
          const fromPg = await fetchMessagingPartnerAiEnabledFromPg(params.partnerId)
          if (fromPg !== null) aiEnabled = fromPg.enabled
        }
        if (aiEnabled) {
          const faqUiLoc = normalizeWebLocale(String(params.uiLocale ?? '').trim())
          const faq = await findMatchingFaq(params.partnerId, trimmedText, { locale: faqUiLoc })
          if (!faq) {
            let allowTextVectorSearch = true
            const convEarly = await ensureConversation({
              partnerId: params.partnerId,
              channel: 'widget',
              externalThreadId: params.externalThreadId,
              customerName: params.customerName,
              linkedUserId,
              metadata: params.metadata,
            })
            if ('conversationId' in convEarly) {
              const lastShop = await fetchLastOutboundCustomerCareMessageBodyPg(convEarly.conversationId)
              const classified = await classifyWidgetInboundIntent({
                partnerId: params.partnerId,
                customerText: trimmedText,
                lastShopMessage: lastShop,
              })
              if (classified) {
                partnerAiWidgetIntentForPayload = classified
                if (classified === 'clarify' || classified === 'context_reply') allowTextVectorSearch = false
                if (classified === 'product_search') allowTextVectorSearch = true
              } else {
                allowTextVectorSearch = !skipClarifyIntentVectorHeuristic
              }
            } else {
              allowTextVectorSearch = !skipClarifyIntentVectorHeuristic
            }

            if (allowTextVectorSearch) {
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
    if (partnerAiWidgetIntentForPayload) {
      rawPayload = {
        ...(rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {}),
        partner_ai_widget_intent: partnerAiWidgetIntentForPayload,
      } as Json
    }
  }

  if (params.autoOpening) {
    rawPayload = {
      ...(rawPayload && typeof rawPayload === 'object' ? (rawPayload as Record<string, unknown>) : {}),
      widget_auto_opening: true,
    } as Json
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

  const locNorm = normalizeWebLocale(String(params.uiLocale ?? '').trim())
  if (locNorm) {
    await mergeConversationUiLocaleFromPg(conversationId, locNorm)
  }

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
    landingSourceUrl: params.landingSourceUrl,
  })
  if ('error' in ins) return { error: ins.error ?? 'Insert failed.' }

  const newMessageId = 'messageId' in ins ? ins.messageId : null
  /** Không ghi «đã tư vấn» ở đây — chỉ khi khách bấm «Tư vấn» (`POST …/consult-product`). Tin mở link kèm ảnh/URL chỉ là ngữ cảnh, chưa coi là đã chọn tư vấn. */

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
      pageContextInventoryId ? `[Customer product inventory id: ${pageContextInventoryId}]` : '',
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
        /** Đã merge vào DB — dùng để bỏ FAQ tiếng Việt khi khách chọn UI khác `vi`. */
        widgetUiLocale: locNorm ?? null,
        intentClassifyText: text?.trim() ? text.trim() : null,
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

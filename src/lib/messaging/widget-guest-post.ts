import { GoogleGenerativeAI } from '@google/generative-ai'
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
  fetchPartnerInventoryRowsByIdsInOrderFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { fetchGuestGenderForPartnerConsultCachePg } from '@/lib/db/partner-product-consult-cache-pg'
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
import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
const ANONYMOUS_INBOUND_AUTH_THRESHOLD = 5
type GuestVisionCandidatePayload = {
  inventoryId: string
  name: string
  sku: string | null
  image_url: string
  product_url?: string
  score?: number
}

type ImageProductSignal = {
  productCode: string
  gender: GuestProfileGender | null
  productType: string | null
}

type CaptionCandidateScore = {
  candidate: GuestVisionCandidatePayload
  score: number
  tokenHits: number
  skuHit: boolean
}

const IMAGE_AUTO_PICK_TOP1_MIN_SCORE = 0.86
const IMAGE_AUTO_PICK_TOP1_MIN_GAP = 0.06
const IMAGE_AUTO_PICK_SINGLE_MIN_SCORE = 0.9

function normalizeDetectedGender(raw: string): GuestProfileGender | null {
  const v = raw.trim().toLowerCase()
  if (!v) return null
  if (v === 'male' || v === 'man' || v === 'men' || v === 'boy' || v === 'nam') return 'male'
  if (v === 'female' || v === 'woman' || v === 'women' || v === 'girl' || v === 'nu' || v === 'nữ')
    return 'female'
  return null
}

function inferGenderFromText(text: string): GuestProfileGender | null {
  const t = text.trim().toLowerCase()
  if (!t || /\bunisex\b/i.test(t)) return null
  const hasMale = /\bnam\b|nam\s*giới|đàn\s*ông|\bmen'?s?\b/i.test(t)
  const hasFemale = /\bnữ\b|phụ\s*nữ|nữ\s*giới|\bwomen'?s?\b|\bladies\b/i.test(t)
  if (hasMale && !hasFemale) return 'male'
  if (hasFemale && !hasMale) return 'female'
  return null
}

function normalizeDetectedProductType(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  if (!t) return null
  if (/(tui|túi|bag|handbag|tote|crossbody|satchel|clutch)/i.test(t)) return 'túi'
  if (/(dam|đầm|dress|gown)/i.test(t)) return 'đầm'
  if (/(vay|váy|skirt)/i.test(t)) return 'váy'
  if (/(ao|áo|shirt|blouse|top|hoodie|jacket|coat|blazer|sweater|cardigan)/i.test(t)) return 'áo'
  if (/(quan|quần|pants|trousers|jeans|shorts|legging)/i.test(t)) return 'quần'
  if (/(giay|giày|shoe|sneaker|loafer|boot|heels?)/i.test(t)) return 'giày'
  if (/(dep|dép|sandal|slipper|flip[- ]?flop)/i.test(t)) return 'dép'
  if (/(balo|ba lô|backpack)/i.test(t)) return 'ba lô'
  if (/(vi|ví|wallet)/i.test(t)) return 'ví'
  return null
}

function inferProductTypeFromText(text: string): string | null {
  return normalizeDetectedProductType(text)
}

function normalizeIntentTextForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeIntentText(text: string): string[] {
  const stop = new Set([
    'ban',
    'shop',
    'cho',
    'minh',
    'em',
    'chi',
    'anh',
    'xin',
    'link',
    'sp',
    'san',
    'pham',
    'voi',
    'nhe',
    'nha',
    'a',
    'ah',
    'la',
    'nay',
    'do',
    'giup',
    'tu',
    'van',
  ])
  return normalizeIntentTextForMatch(text)
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stop.has(w))
}

function rankVisionCandidatesByCaption(
  candidates: GuestVisionCandidatePayload[],
  caption: string
): {
  ranked: GuestVisionCandidatePayload[]
  preferred: GuestVisionCandidatePayload | null
} {
  const capNorm = normalizeIntentTextForMatch(caption)
  if (!capNorm || candidates.length < 1) return { ranked: candidates, preferred: null }

  const capTokens = tokenizeIntentText(caption)
  const requestedType = inferProductTypeFromText(caption)

  const scored: CaptionCandidateScore[] = candidates.map((candidate) => {
    const nameNorm = normalizeIntentTextForMatch(candidate.name)
    const skuNorm = normalizeIntentTextForMatch(candidate.sku ?? '')
    const candidateType = inferProductTypeFromText(candidate.name)
    let score = (typeof candidate.score === 'number' ? candidate.score : 0) * 2
    let tokenHits = 0
    let skuHit = false

    if (skuNorm && capNorm.includes(skuNorm)) {
      score += 12
      skuHit = true
    }

    for (const token of capTokens) {
      if (nameNorm.includes(token)) {
        score += 1.4
        tokenHits += 1
      }
    }

    if (tokenHits >= 2) score += 2
    if (requestedType && candidateType) {
      score += requestedType === candidateType ? 2 : -1
    }
    if (nameNorm && capNorm.includes(nameNorm)) {
      score += 5
      tokenHits += 2
    }

    return { candidate, score, tokenHits, skuHit }
  })

  scored.sort((a, b) => b.score - a.score)
  const ranked = scored.map((x) => x.candidate)
  const top = scored[0] ?? null
  const second = scored[1] ?? null
  if (!top) return { ranked, preferred: null }

  const clearBySku = top.skuHit
  const clearByText =
    top.tokenHits >= 2 &&
    top.score >= 4 &&
    (!second || top.score - second.score >= 2)

  return { ranked, preferred: clearBySku || clearByText ? top.candidate : null }
}

function shouldAutoPickTopImageCandidate(
  candidates: GuestVisionCandidatePayload[],
  detectedProductType: string | null,
  options?: { ignoreTypeMismatch?: boolean }
): GuestVisionCandidatePayload | null {
  if (!candidates.length) return null
  const top = candidates[0]
  const topScore = typeof top.score === 'number' && Number.isFinite(top.score) ? top.score : null
  if (topScore === null) return null

  const topType = inferProductTypeFromText(top.name)
  if (!options?.ignoreTypeMismatch && detectedProductType && topType && detectedProductType !== topType) return null

  if (candidates.length === 1) {
    return topScore >= IMAGE_AUTO_PICK_SINGLE_MIN_SCORE ? top : null
  }

  const second = candidates[1]
  const secondScore = typeof second?.score === 'number' && Number.isFinite(second.score) ? second.score : null
  if (secondScore === null) {
    return topScore >= IMAGE_AUTO_PICK_SINGLE_MIN_SCORE ? top : null
  }
  const gap = topScore - secondScore
  if (topScore >= IMAGE_AUTO_PICK_TOP1_MIN_SCORE && gap >= IMAGE_AUTO_PICK_TOP1_MIN_GAP) {
    return top
  }
  return null
}

function inferInventoryRowGender(row: {
  name?: string | null
  description?: string | null
  consult_note?: string | null
}): GuestProfileGender | null {
  const blob = `${row.name ?? ''} ${row.description ?? ''} ${row.consult_note ?? ''}`.toLowerCase()
  if (!blob.trim() || /\bunisex\b/i.test(blob)) return null
  const hasMale = /\bnam\b|nam\s*giới|đàn\s*ông|\bmen'?s?\b/i.test(blob)
  const hasFemale = /\bnữ\b|phụ\s*nữ|nữ\s*giới|\bwomen'?s?\b|\bladies\b/i.test(blob)
  if (hasMale && !hasFemale) return 'male'
  if (hasFemale && !hasMale) return 'female'
  return null
}

function buildAddressingHintByProductGender(gender: GuestProfileGender | null): string {
  if (gender === 'female') {
    return '[Addressing rule: Product is female-oriented. In message to customer, use "chị" (or "em/chị"), do NOT call customer "anh".]'
  }
  if (gender === 'male') {
    return '[Addressing rule: Product is male-oriented. In message to customer, use "anh" (or "em/anh"), avoid calling customer "chị".]'
  }
  return ''
}

function inferInventoryRowProductType(row: {
  name?: string | null
  description?: string | null
  consult_note?: string | null
}): string | null {
  return inferProductTypeFromText(`${row.name ?? ''} ${row.description ?? ''} ${row.consult_note ?? ''}`)
}

function genderAffinityScore(
  row: { name?: string | null; description?: string | null; consult_note?: string | null },
  gender: GuestProfileGender
): number {
  const inferred = inferInventoryRowGender(row)
  if (inferred === gender) return 2
  if (inferred === null) return 1
  return -2
}

async function analyzeProductSignalFromImage(
  imageBuffer: Buffer,
  mime: string
): Promise<ImageProductSignal | null> {
  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt =
      'Read this fashion product image. Extract visible product code/SKU, product gender target, and product type/category.' +
      ' Return strict JSON only: {"productCode":"", "gender":"male|female|unknown", "productType":""}.' +
      ' If no reliable code, productCode must be empty string.'
    const res = await model.generateContent([
      prompt,
      { inlineData: { data: imageBuffer.toString('base64'), mimeType: mime } },
    ] as never)
    void trackFromUsageMetadata(
      res.response.usageMetadata,
      'gemini-2.5-flash',
      'messaging-widget-product-signal-vision',
      null
    )
    const raw = res.response.text().trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(raw) as { productCode?: unknown; gender?: unknown; productType?: unknown }
    const rawCode = typeof parsed.productCode === 'string' ? parsed.productCode.trim() : ''
    const codeMatch = rawCode.match(/[A-Za-z0-9][A-Za-z0-9._-]{1,63}/)
    const productCode = codeMatch ? codeMatch[0] : ''
    const gender = typeof parsed.gender === 'string' ? normalizeDetectedGender(parsed.gender) : null
    const productType =
      typeof parsed.productType === 'string' ? normalizeDetectedProductType(parsed.productType) : null
    if (!productCode && !gender && !productType) return null
    return { productCode, gender, productType }
  } catch {
    return null
  }
}

function productTypeLabelForLocale(locale: string, productType?: string | null): string {
  const t = productType?.trim() || ''
  if (!t) return locale === 'vi' ? 'sản phẩm' : 'product'
  if (locale === 'vi') return t
  return 'product'
}

function buildViReminderFollowUpFromCustomerText(text: string, address: 'anh' | 'chị' | 'bạn'): string {
  const cap = address.charAt(0).toUpperCase() + address.slice(1)
  const t = text.trim().toLowerCase()
  if (!t) return `${cap} chọn giúp em 1 mẫu trước, em tư vấn ngay theo đúng nhu cầu của ${address}.`
  if (/\bgia\b|giá|bao nhiêu|nhiêu tiền|price/i.test(t)) {
    return `${cap} chọn giúp em 1 mẫu trước, em báo giá và tư vấn chi tiết ngay ạ.`
  }
  if (/bao giờ|khi nào|giao|ship|nhận hàng|giao nhanh|thời gian/i.test(t)) {
    return `${cap} chọn giúp em 1 mẫu trước, em báo thời gian giao cụ thể cho mẫu đó ngay ạ.`
  }
  if (/size|số đo|chiều cao|cân nặng|vừa|form/i.test(t)) {
    return `${cap} chọn giúp em 1 mẫu trước, em tư vấn size chuẩn theo mẫu đó ngay ạ.`
  }
  if (/màu|mau|color|đen|trắng|đỏ|hồng|xanh|nâu|kem|be/i.test(t)) {
    return `${cap} chọn giúp em 1 mẫu trước, em kiểm tra màu và tư vấn mẫu phù hợp ngay ạ.`
  }
  return `${cap} chọn giúp em 1 mẫu trước, em tư vấn chi tiết đúng ý ${address} ngay ạ.`
}

function buildVisionPickReminder(
  uiLocale?: string | null,
  productGender?: GuestProfileGender | null,
  productType?: string | null,
  customerText?: string | null,
  customerGender?: GuestProfileGender | null
): string {
  const locale = normalizeWebLocale(String(uiLocale ?? '').trim()) ?? 'vi'
  const typeLabel = productTypeLabelForLocale(locale, productType)
  const preferredGender = customerGender ?? productGender ?? null
  const viAddress = preferredGender === 'male' ? 'anh' : preferredGender === 'female' ? 'chị' : 'bạn'
  const viFollow = buildViReminderFollowUpFromCustomerText(customerText ?? '', viAddress)
  if (locale === 'en') {
    return `I found a few ${typeLabel} samples similar to your image. Please tap the one you want advice on.`
  }
  if (locale === 'zh') {
    return '我找到了几款与您图片相似的商品。请先选择您想咨询的款式。'
  }
  if (locale === 'ja') {
    return '画像に近い商品をいくつか見つけました。相談したい商品を選んでください。'
  }
  if (locale === 'ko') {
    return '보내주신 이미지와 비슷한 상품 샘플을 찾았어요. 상담받고 싶은 상품을 먼저 선택해 주세요.'
  }
  return `Em tìm thêm vài mẫu ${typeLabel} để ${viAddress} tham khảo. ${viFollow}`
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
  const isAutoOpening = params.autoOpening === true
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
  const configuredGuestGender = linkedUserId
    ? await fetchGuestGenderForPartnerConsultCachePg(linkedUserId)
    : null

  let body: string
  let rawPayload: Json | null = null
  let imagePublicUrl: string | null = null
  /** Gợi ý theo vector (ảnh hoặc chữ) — giống nhau; không lên lịch LLM cho đến khi khách chọn SP. */
  let productPickCandidates: GuestVisionCandidatePayload[] = []
  let detectedProductGender: GuestProfileGender | null = null
  let detectedProductType: string | null = null
  let imageMatchedInventoryContext: { inventoryId: string; sku: string } | null = null
  let autoSelectedTopCandidate: GuestVisionCandidatePayload | null = null
  let imageSkuMatchDirectConsult = false
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
          const imageSignal = await analyzeProductSignalFromImage(buf, mime)
          if (imageSignal?.gender) {
            detectedProductGender = imageSignal.gender
          }
          if (imageSignal?.productType) {
            detectedProductType = imageSignal.productType
          }
          if (imageSignal?.productCode) {
            const matchedBySku = await fetchPartnerInventoryRowByComparableSkuFromPg(
              params.partnerId,
              imageSignal.productCode
            )
            if (matchedBySku) {
              imageSkuMatchDirectConsult = true
              imageMatchedInventoryContext = {
                inventoryId: matchedBySku.id,
                sku: (matchedBySku.sku ?? imageSignal.productCode).trim().slice(0, 128),
              }
              detectedProductGender =
                inferInventoryRowGender({
                  name: matchedBySku.name,
                  description: matchedBySku.description,
                  consult_note: matchedBySku.consult_note,
                }) ?? detectedProductGender
              detectedProductType =
                inferInventoryRowProductType({
                  name: matchedBySku.name,
                  description: matchedBySku.description,
                  consult_note: matchedBySku.consult_note,
                }) ?? detectedProductType
            }
          }

          if (!imageSkuMatchDirectConsult) {
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

            if (!detectedProductType && productPickCandidates.length > 0) {
              detectedProductType = inferProductTypeFromText(productPickCandidates[0].name)
            }
            if (!detectedProductGender && productPickCandidates.length > 0) {
              detectedProductGender = inferGenderFromText(productPickCandidates[0].name)
            }

            if (detectedProductGender && productPickCandidates.length > 1 && isPgConfigured()) {
              const rows = await fetchPartnerInventoryRowsByIdsInOrderFromPg(params.partnerId, candidateIds)
              const scoreById = new Map<string, number>()
              for (const row of rows ?? []) {
                scoreById.set(
                  row.id,
                  genderAffinityScore(
                    { name: row.name, description: row.description, consult_note: row.consult_note },
                    detectedProductGender
                  )
                )
              }
              productPickCandidates = [...productPickCandidates].sort((a, b) => {
                const sa = scoreById.get(a.inventoryId) ?? 0
                const sb = scoreById.get(b.inventoryId) ?? 0
                if (sb !== sa) return sb - sa
                return (b.score ?? 0) - (a.score ?? 0)
              })
            }

            const caption = imageCaption.trim()
            const vectorAutoByImage =
              shouldAutoPickTopImageCandidate(productPickCandidates, detectedProductType) ??
              (caption
                ? shouldAutoPickTopImageCandidate(productPickCandidates, detectedProductType, {
                    ignoreTypeMismatch: true,
                  })
                : null)
            if (caption && productPickCandidates.length > 1) {
              const rerank = rankVisionCandidatesByCaption(productPickCandidates, caption)
              productPickCandidates = rerank.ranked
              if (rerank.preferred) {
                autoSelectedTopCandidate = rerank.preferred
                imageMatchedInventoryContext = {
                  inventoryId: rerank.preferred.inventoryId,
                  sku: (rerank.preferred.sku ?? '').trim().slice(0, 128),
                }
                detectedProductType = detectedProductType ?? inferProductTypeFromText(rerank.preferred.name)
              }
            }

            const topCandidate =
              autoSelectedTopCandidate ??
              vectorAutoByImage ??
              shouldAutoPickTopImageCandidate(productPickCandidates, detectedProductType, {
                ignoreTypeMismatch: caption.length > 0,
              })
            if (topCandidate && !autoSelectedTopCandidate) {
              autoSelectedTopCandidate = topCandidate
              imageMatchedInventoryContext = {
                inventoryId: topCandidate.inventoryId,
                sku: (topCandidate.sku ?? '').trim().slice(0, 128),
              }
              detectedProductType = detectedProductType ?? inferProductTypeFromText(topCandidate.name)
            }
          }
        }
      }
    } catch (e) {
      console.error('[widget-guest-post] image candidate search', e)
    }

    rawPayload =
      productPickCandidates.length > 0 && !autoSelectedTopCandidate
        ? ({
            ...(basePayload && typeof basePayload === 'object' ? (basePayload as Record<string, unknown>) : {}),
            vision_pick_required: true,
            vision_candidates: productPickCandidates,
            ...(imageCaption ? { image_caption: imageCaption } : {}),
          } as Json)
        : ({
            ...(basePayload && typeof basePayload === 'object' ? (basePayload as Record<string, unknown>) : {}),
            ...(autoSelectedTopCandidate
              ? {
                  vision_auto_selected: true,
                  vision_selected_inventory_id: autoSelectedTopCandidate.inventoryId,
                  vision_selected_product_label: `${autoSelectedTopCandidate.name}${
                    autoSelectedTopCandidate.sku ? ` (SKU ${autoSelectedTopCandidate.sku})` : ''
                  }`,
                  vision_selected_at: new Date().toISOString(),
                }
              : {}),
            ...(imageCaption ? { image_caption: imageCaption } : {}),
          } as Json)
    if ((pageContextHasAny || imageMatchedInventoryContext) && rawPayload && typeof rawPayload === 'object') {
      const srcRaw = typeof params.pageContext?.source === 'string' ? params.pageContext.source : ''
      const src = srcRaw || (imageMatchedInventoryContext ? 'image_sku_match' : '')
      rawPayload = {
        ...(rawPayload as Record<string, unknown>),
        page_context: {
          ...((pageContextSku || imageMatchedInventoryContext?.sku)
            ? { sku: pageContextSku || imageMatchedInventoryContext?.sku }
            : {}),
          ...(pageContextImageForPayload ? { image_url: pageContextImageForPayload } : {}),
          ...(pageContextImageUrl2 ? { image_url_2: pageContextImageUrl2 } : {}),
          ...(src === 'product_card_consult' && pageContextProductUrl ? { product_url: pageContextProductUrl } : {}),
          ...(pageContextInventoryId || imageMatchedInventoryContext?.inventoryId
            ? { inventory_id: pageContextInventoryId || imageMatchedInventoryContext?.inventoryId }
            : {}),
          ...(src ? { source: src } : {}),
        },
        ...(detectedProductGender ? { product_gender_intent: detectedProductGender } : {}),
        ...(detectedProductType ? { product_type_intent: detectedProductType } : {}),
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
    const skipTextVectorPick = isProductCardConsult || isAutoOpening
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

  if (!isAutoOpening && !linkedUserId && !params.guestAccountId) {
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
    direction: isAutoOpening ? 'outbound' : 'inbound',
    body,
    rawPayload,
    landingSourceUrl: params.landingSourceUrl,
  })
  if ('error' in ins) return { error: ins.error ?? 'Insert failed.' }

  const newMessageId = 'messageId' in ins ? ins.messageId : null
  /** Không ghi «đã tư vấn» ở đây — chỉ khi khách bấm «Tư vấn» (`POST …/consult-product`). Tin mở link kèm ảnh/URL chỉ là ngữ cảnh, chưa coi là đã chọn tư vấn. */

  let shopTyping: { maxWaitMs: number } | undefined
  const visionPickRequired = productPickCandidates.length > 0 && !autoSelectedTopCandidate
  const shouldSendVisionPickReminder = Boolean(imagePath) && visionPickRequired && !imageSkuMatchDirectConsult
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
    if (shouldSendVisionPickReminder) {
      await insertMessage({
        conversationId,
        direction: 'outbound',
        body: buildVisionPickReminder(
          params.uiLocale,
          detectedProductGender,
          detectedProductType,
          text.trim(),
          configuredGuestGender
        ),
        rawPayload: {
          source: 'guest_vision_pick_reminder',
          trigger_message_id: newMessageId,
          vision_pick_required: true,
          vision_candidates: productPickCandidates,
        },
      })
    }

    const aiContextSku = pageContextSku || imageMatchedInventoryContext?.sku || ''
    const aiContextInventoryId = pageContextInventoryId || imageMatchedInventoryContext?.inventoryId || ''
    const aiContextHints = [
      aiContextSku ? `[Customer product SKU: ${aiContextSku}]` : '',
      aiContextInventoryId ? `[Customer product inventory id: ${aiContextInventoryId}]` : '',
      detectedProductGender ? `[Customer product gender intent: ${detectedProductGender}]` : '',
      detectedProductType ? `[Customer product type intent: ${detectedProductType}]` : '',
      buildAddressingHintByProductGender(detectedProductGender),
    ]
      .filter(Boolean)
      .join('\n')
    // Khi đã có gợi ý vector (ảnh hoặc chữ), chờ khách chọn SP — không gọi LLM tư vấn trước.
    // Ảnh biên lai CK: đã định tuyến đối chiếu thanh toán — không gọi LLM gợi ý SP.
    if (!isAutoOpening && !visionPickRequired && !deferredPaymentVerify) {
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

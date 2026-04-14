import {
  customerMessageWantsSimilarCatalogVersusLastConsulted,
  extractCustomerBudgetTargetVnd,
  extractExplicitSkuCandidates,
  inboundTextLooksLikeFollowUpConsultHeuristic,
  looksLikeStandaloneProductQuestion,
  normalizeCustomerMessageForInventorySearch,
} from '@/lib/messaging/partner-inventory-ai-search'

/**
 * Trợ lý mua hàng / tìm SP rõ — không cần hỏi lại ý định.
 * Giữ đồng bộ ý với `STANDALONE_*` trong partner-inventory-ai-search (lặp pattern an toàn).
 */
const CONSULT_OR_PURCHASE_INTENT_RE =
  /\b(?:cần\s+tư\s*vấn|nhờ\s+tư\s*vấn|tư\s*vấn\s+giúp|muốn\s+xem|cho\s+xem|xem\s+(?:mẫu|hàng|sp|sản\s*phẩm)|mua\s+hàng|đặt\s+hàng|đặt\s+giúp|order|báo\s+giá|hỏi\s+giá)\b/i

/** Gợi ý tối thiểu (chỉ từ khóa loại hàng / size) — coi là có ý xem hàng, không «làm rõ ý định». */
const MINIMAL_PRODUCT_HINT_RE =
  /\b(?:váy|đầm|áo|quần|giày|dép|túi|chân\s*váy|set|combo|bộ|dam)\b|(?:^|[\s,.])(?:s|m|l|xl|xxl|xxxl)\b/i

/**
 * Tin mơ hồ / đa ý / không phải tìm SP — khớp nhóm nội bộ «không rõ ý định mua hàng».
 * (Truy cập, cảm xúc, khiếu nại chung, than phiền không kèm loại hàng…)
 * Giữ từ/cụm đủ đặc trưng để precheck + standalone/follow-up loại câu tìm SP rõ.
 */
const UNCLEAR_VAGUE_SIGNAL_RE = new RegExp(
  [
    // truy cập / app / link (mơ hồ)
    'vào\\s+không|không\\s+vào|không\\s+mở|mở\\s+không|vào\\s+hoài|vào\\s+được|truy\\s*cập|login|đăng\\s*nhập',
    'link\\s*(?:hư|lỗi|die|chết)|trang\\s*trắng|load(?:ing)?|treo|lag|đơ\\s*máy|out\\s*ra|bị\\s*đẩy\\s*ra|bị\\s+out',
    // không thấy / không hiện / trống danh sách
    'không\\s+thấy\\s+(?:sản\\s*phẩm|sp|hàng|mẫu|đâu|gì\\s+cả)|không\\s+hiện\\s+(?:sản\\s*phẩm|sp|hàng|gì)',
    'mất\\s+(?:sản\\s*phẩm|sp|hàng|mẫu)|trống\\s+trơn|trống\\s+rỗng|không\\s+có\\s+gì\\s+(?:cả|hết)|hiện\\s+gì\\s+cả',
    // cảm xúc / thán phiền chung (chưa nói mua gì)
    'buồn|stress|mệt|mệt\\s+mỏi|tức|bực|bực\\s+mình|ức\\s+chế|chán|ngán|thất\\s*vọng|không\\s*ưng|tệ\\s*quá|dở\\s*quá',
    'lừa\\s*đảo|lừa\\s+đảo|phát\\s+điên|phát\\s+bực|kì\\s*lạ|kỳ\\s+lạ',
    // hỏi chung / không biết làm gì (tránh «sao vậy / thế nào» đơn lẻ — hay nằm trong câu có SP)
    'ai\\s+bảo|ra\\s+sao|thế\\s+là\\s+sao|nghĩa\\s+là\\s+sao',
    'làm\\s+sao\\s+bây\\s+giờ|biết\\s+làm\\s+sao|phải\\s+làm\\s+sao|tính\\s+sao|tính\\s+thế\\s+nào',
    'không\\s+(?:hiểu|biết)\\s+gì|chẳng\\s+(?:hiểu|biết)\\s+gì|không\\s+rõ\\s+gì|méo\\s+hiểu|\\bconfused\\b',
    'không\\s+biết\\s+(?:chọn|lấy|mua)(?:\\s+gì)?|bí\\s+tay|bó\\s+tay|bí\\s+quá|bí\\s+hết',
    // giao diện / thao tác mơ hồ
    'lạ\\s+quá|khó\\s+hiểu|rối\\s+quá|không\\s+rõ\\s+chỗ|không\\s+biết\\s+bấm|không\\s+biết\\s+tìm',
    'chỗ\\s+nào\\s+vậy|bấm\\s+đâu',
    // shop / hệ thống (chưa nêu mặt hàng) — không dùng «shop ơi» (hay đi kèm câu tìm hàng)
    'shop\\s+làm\\s+gì|sao\\s+shop|tin\\s+nhắn\\s+trước|sai\\s+rồi',
    // tham chiếu mơ hồ
    'cái\\s+đó|cái\\s+kia|chuyện\\s+đó|như\\s+thế|kiểu\\s+đó|cái\\s+này\\s+là\\s+gì',
    // đơn / ship / thanh toán mơ hồ (không mã)
    'giao\\s+lâu|ship\\s+lâu|chưa\\s+nhận|chưa\\s+về|chưa\\s+có\\s+hàng|không\\s+nhận\\s+được\\s*hàng',
    'không\\s+trả\\s+được|chuyển\\s+khoản\\s+không|thanh\\s+toán\\s+không|cod\\s+không',
    'đơn\\s+(?:của\\s+)?(?:tôi|mình|em)\\s+(?:đâu|sao)|đơn\\s+hàng\\s+(?:ở\\s+đâu|sao\\s+rồi)|check\\s+đơn',
    // so giá / uy tín mơ hồ (cụm ngắn — tránh «mắc quá» sau tên SP)
    'bên\\s+kia\\s+rẻ|tin\\s+được\\s+không|uy\\s+tín\\s+không|đắt\\s+vậy',
    // lỗi / sự cố chung (không gắn tên mặt hàng ngay sau)
    'lỗi\\s+rồi|có\\s+vấn\\s+đề|sự\\s+cố|không\\s+ổn|hỏng\\s+rồi',
    // tiếng Anh — tránh where/how (hay là câu tìm SP); giữ lỗi truy cập / không thấy
    "\\b(?:can't\\s+open|can't\\s+access|not\\s+working|doesn't\\s+work|don't\\s+understand)\\b",
    "\\b(?:can't\\s+see|don't\\s+see|nothing\\s+shows|empty\\s+page|broken)\\b",
  ].join('|'),
  'i'
)

export type PartnerAiUnclearIntentInput = {
  message: string
  hasExplicitSku: boolean
  hasVisionInventorySelection: boolean
  similarCatalogVersusLastConsulted: boolean
  followUpSingleProductNoVector: boolean
}

/** Gắn trên raw_payload tin inbound widget — từ LLM phân loại (partner-ai-widget-intent-classifier). */
export type PartnerAiWidgetIntent = 'context_reply' | 'clarify' | 'product_search'

export function parsePartnerAiWidgetIntentFromPayload(raw: unknown): PartnerAiWidgetIntent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as Record<string, unknown>).partner_ai_widget_intent
  if (v === 'context_reply' || v === 'clarify' || v === 'product_search') return v
  return null
}

/** Quyết định nhánh prompt «làm rõ ý định» — ưu tiên payload widget khi có. */
export function partnerAiShouldUseClarifyBranchFromWidgetPayload(
  channel: string | null | undefined,
  inboundRawPayload: unknown,
  heuristicClarify: boolean
): boolean {
  const ch = String(channel ?? '').trim().toLowerCase()
  if (ch !== 'widget') return heuristicClarify
  const wi = parsePartnerAiWidgetIntentFromPayload(inboundRawPayload)
  if (wi === 'clarify') return true
  if (wi === 'context_reply' || wi === 'product_search') return false
  return heuristicClarify
}

/** Tiền kiểm chỉ từ nội dung tin — dùng chung cho LLM và widget (vector strip). */
function partnerAiClarifyPrecheckMessageOnly(message: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(message)
  if (!msg) return false
  if (/https?:\/\//i.test(msg)) return false
  if (extractCustomerBudgetTargetVnd(msg) !== null) return false
  if (extractExplicitSkuCandidates(message).length > 0) return false
  if (looksLikeStandaloneProductQuestion(message)) return false
  if (inboundTextLooksLikeFollowUpConsultHeuristic(message)) return false
  if (customerMessageWantsSimilarCatalogVersusLastConsulted(message)) return false
  if (CONSULT_OR_PURCHASE_INTENT_RE.test(msg)) return false
  if (MINIMAL_PRODUCT_HINT_RE.test(msg) && msg.length <= 40) return false
  return true
}

/**
 * Lời chào / gọi cực ngắn, không kèm mô tả sản phẩm — khớp full string để tránh «shop ơi cho em xem váy».
 */
function partnerAiUltraShortGreetingOrPing(raw: string): boolean {
  const t = normalizeCustomerMessageForInventorySearch(raw).trim()
  if (!t || t.length > 48) return false
  const wc = t.split(/\s+/).filter(Boolean).length
  if (wc > 8) return false
  return /^(?:(?:cảm\s*ơn|cảm\s*ơn\s+shop|thanks?|thank\s+you|chào\s+(?:anh|chị|em|shop)|shop\s+ơi|alo|ê|hú|em\s+ơi|anh\s+ơi|chị\s+ơi)(?:\s*[!?.…]*)?)$/iu.test(
    t
  )
}

/** Phần «dương tính» mơ hồ / ngắn — sau khi precheck đã pass. */
function partnerAiMessageSignalsClarifyIntentContent(message: string): boolean {
  const msg = normalizeCustomerMessageForInventorySearch(message)
  if (partnerAiUltraShortGreetingOrPing(message)) return true
  if (UNCLEAR_VAGUE_SIGNAL_RE.test(msg)) return true
  const words = msg.split(/\s+/).filter(Boolean)
  // Tin ngắn, không gợi ý loại hàng rõ — hay là phàn nàn / hỏi chung (đã lọc qua precheck).
  if (words.length <= 18 && msg.length <= 120 && !MINIMAL_PRODUCT_HINT_RE.test(msg)) return true
  return false
}

/**
 * Widget: **không** gắn thanh `vision_candidates` / `vision_pick_required` — để tin chạy LLM nhánh «làm rõ ý định»
 * (cùng heuristic với `partnerAiInboundNeedsShoppingIntentClarify`, không cần lastConsulted từ DB).
 */
export function partnerAiMessageAloneSuggestsClarifyIntent(message: string): boolean {
  if (process.env.PARTNER_AI_CLARIFY_INTENT === '0') return false
  if (!partnerAiClarifyPrecheckMessageOnly(message)) return false
  return partnerAiMessageSignalsClarifyIntentContent(message)
}

/**
 * `true` → không gọi tìm kho / không gửi thẻ SP; chỉ hỏi khách làm rõ nhu cầu (LLM vẫn chạy để đa ngôn ngữ widget).
 */
export function partnerAiInboundNeedsShoppingIntentClarify(input: PartnerAiUnclearIntentInput): boolean {
  if (process.env.PARTNER_AI_CLARIFY_INTENT === '0') return false

  if (input.hasExplicitSku) return false
  if (input.hasVisionInventorySelection) return false
  if (input.similarCatalogVersusLastConsulted) return false
  if (input.followUpSingleProductNoVector) return false

  if (!partnerAiClarifyPrecheckMessageOnly(input.message)) return false
  return partnerAiMessageSignalsClarifyIntentContent(input.message)
}

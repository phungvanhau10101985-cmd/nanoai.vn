import type { Database, Json } from '@/types/database.types'
import { normalizeWebLocale, type WebLocale } from '@/lib/i18n/config'
import {
  fetchConversationUiLocaleFromPg,
  fetchCustomerCareConversationByIdPg,
  fetchCustomerCareTranscriptLinesFromPg,
} from '@/lib/db/customer-care-pg'
import type { GuestProfileGender } from '@/lib/db/messaging-guest-pg'
import { fetchNanoaiChatProfileFromPg } from '@/lib/db/profiles-repo'
import {
  buildPartnerAiWarehouseVndPricingNote,
  shouldMarkInventoryPricesAsVndForAi,
} from '@/lib/messaging/partner-ai-currency-context'
import {
  fetchPartnerInventoryRowByComparableSkuFromPg,
  fetchPartnerInventoryRowByIdForPartnerFromPg,
} from '@/lib/db/messaging-partner-inventory-pg'
import { isPgConfigured } from '@/lib/db/pool'
import {
  buildInventorySearchQueryWithLastConsulted,
  filterInventoryRowsBySharedCoarseCategory,
  customerMessageWantsSimilarCatalogVersusLastConsulted,
  fetchInventoryRowsByExplicitSku,
  fetchInventoryRowsForPartnerAi,
  fetchInventoryRowsFromPageContextSku,
  fetchInventoryRowsFromProductCardConsultPageContext,
  PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
  customerMessageIsFollowUpContextQuery,
  customerMessageOpensNewProductSearch,
  inboundTextLooksLikeFollowUpConsultHeuristic,
  shouldAugmentInventorySearchWithLastConsulted,
  extractExplicitSkuCandidates,
} from '@/lib/messaging/partner-inventory-ai-search'
import {
  fetchInventoryRowsSimilarToAnchorProductImage,
  fetchInventoryRowsSimilarToExternalImageUrl,
} from '@/lib/messaging/partner-gemini-image-search'
import { enrichInventoryRowsWithMaterialIfNeeded } from '@/lib/messaging/partner-inventory-material-enrichment'
import {
  enrichInventoryMaterialDetailCollageIfNeeded,
  type PartnerMaterialDetailFollowup,
} from '@/lib/messaging/partner-inventory-material-detail-image'
import { fetchLastConsultedInventoryRowFromConversationPg } from '@/lib/messaging/partner-ai-last-consulted-inventory'
import {
  customerMessageAsksAboutRealUsePhoto,
  enrichInventoryRealUseImageIfNeeded,
  type PartnerRealUseImageFollowup,
} from '@/lib/messaging/partner-inventory-real-use-image'
import { aiProductCardsFromPayload, PARTNER_AI_PRODUCT_CARDS_MAX } from '@/lib/messaging/partner-ai-product-cards'
import { partnerAiProductCardFromInventoryRow } from '@/lib/messaging/partner-ai-followup-product-cards-clamp'
import {
  partnerAiInboundNeedsShoppingIntentClarify,
  parsePartnerAiWidgetIntentFromPayload,
  partnerAiShouldUseClarifyBranchFromWidgetPayload,
} from '@/lib/messaging/partner-ai-unclear-intent'
import {
  parsePartnerAiRouteDecision,
  type PartnerAiRouteIntent,
} from '@/lib/messaging/partner-ai-intent-router'
import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import { normalizeGuestPurchaseFlow } from '@/lib/messaging/guest-purchase-flow'
import {
  fetchPartnerPaymentSettingsFromPg,
  type PartnerPaymentSettingsRow,
} from '@/lib/db/messaging-partner-orders-pg'

export type { PartnerMaterialDetailFollowup, PartnerRealUseImageFollowup }

type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

type InvRow = Database['public']['Tables']['messaging_partner_inventory']['Row']

/** Tên màu thường gặp trong kho (tên/mô tả/ghi chú) — không dùng \\b vì từ tiếng Việt có dấu. */
const VI_COLOR_WORD_RE =
  /(đen|trắng|đỏ|hồng|tím|nâu|kem|be|vàng|cam|xám|navy|xanh(?:\s+(?:lá|ngọc|dương|biển|mint|lục|bơ))?|đồng|bạc|đào|chanh|nude|trơn)/giu

function colorLabelsFromInventoryRow(r: InvRow): string {
  const blob = [r.name, r.description, r.consult_note].map((s) => (s ?? '').trim()).filter(Boolean).join(' ')
  if (!blob) return ''
  const seen = new Set<string>()
  for (const m of blob.matchAll(VI_COLOR_WORD_RE)) {
    seen.add(m[0].trim().replace(/\s+/g, ' '))
  }
  if (seen.size === 0) return ''
  return [...seen].join(', ')
}

function colorHintsFromInventoryRow(r: InvRow): string {
  const labels = colorLabelsFromInventoryRow(r)
  if (!labels) return ''
  return ` | Màu sắc (trích từ tên/mô tả/ghi chú kho — ưu tiên khi khách hỏi có màu gì): ${labels}`
}

/** Gói cho AI: câu hỏi khách + mã SKU, tên, giá, màu (từ kho — đúng SP AI/shop vừa tư vấn gần nhất). */
function followUpConsultationSnapshotBlock(
  message: string,
  row: InvRow,
  options?: { markPricesAsVnd?: boolean }
): string {
  const sku = row.sku?.trim() || '(chưa ghi mã SKU trong kho)'
  const name = row.name?.trim() || '(chưa có tên trong kho)'
  const price = row.price_hint?.trim() || '(chưa ghi giá trong kho)'
  const priceLabel = options?.markPricesAsVnd ? 'Giá (kho, đơn vị VNĐ / ₫)' : 'Giá (kho)'
  const colors = colorLabelsFromInventoryRow(row)
  const colorLine = colors
    ? colors
    : '(chưa tách được tên màu tự động — xem mô tả/ghi chú kho ở dòng đầy đủ phía trên)'
  return `

[Sản phẩm AI/shop vừa tư vấn gần nhất — từ kho, dùng để trả lời câu hỏi khách]
Câu hỏi của khách: ${message}
- Mã SKU (kho): ${sku}
- Tên (kho): ${name}
- ${priceLabel}: ${price}
- Màu sắc (kho — trích từ tên/mô tả/ghi chú): ${colorLine}
Trả lời bám đúng bốn dòng trên và dòng kho chi tiết; không gợi ý carousel mẫu khác khi khách chỉ hỏi thuộc tính mẫu này.`
}

function formatInventoryLines(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][],
  options?: { markPricesAsVnd?: boolean }
): string {
  if (!rows.length) return '(Chưa có mặt hàng nào trong danh sách kho.)'
  const priceKey = options?.markPricesAsVnd ? 'Giá (đơn vị VNĐ / ₫)' : 'Giá'
  return rows
    .map((r, i) => {
      const sku = r.sku?.trim() ? ` [Mã/SKU: ${r.sku.trim()}]` : ''
      const stock = r.stock_note?.trim() ? ` | Tồn kho: ${r.stock_note.trim()}` : ''
      const price = r.price_hint?.trim() ? ` | ${priceKey}: ${r.price_hint.trim()}` : ''
      const desc = r.description?.trim() ? ` — Thông số/mô tả: ${r.description.trim()}` : ''
      const img = r.image_url?.trim()
        ? ` | Ảnh chính sản phẩm (URL — nguồn duy nhất để tạo ảnh chi tiết chất liệu và ảnh đời thường/góc tự nhiên): ${r.image_url.trim()}`
        : ''
      const pu = r.product_url?.trim()
      const page =
        pu && /^https?:\/\//i.test(pu) ? ` | Trang sản phẩm (URL): ${pu}` : ''
      const pv = r.product_video_url?.trim()
      const video =
        pv && /^https?:\/\//i.test(pv) ? ` | Video sản phẩm (URL): ${pv}` : ''
      const extra = r.consult_note?.trim() ? ` | Ghi chú tư vấn: ${r.consult_note.trim()}` : ''
      const colors = colorHintsFromInventoryRow(r)
      const mat = r.material_note?.trim() ? ` | Chất liệu (đã lưu/kho): ${r.material_note.trim()}` : ''
      const matImg = r.material_detail_image_url?.trim()
        ? ` | Ảnh chi tiết chất liệu/màu (đã lưu, sinh từ ảnh chính): ${r.material_detail_image_url.trim()}`
        : ''
      const ru1 = r.real_use_image_url?.trim()
      const ru2 = r.real_use_image_url_2?.trim()
      const realUseImg =
        ru1 || ru2
          ? ` | Ảnh đời thường — nhìn sản phẩm chân thực (đã lưu${ru1 && ru2 ? ', tối đa 2 ảnh' : ''}, sinh từ ảnh chính):${ru1 ? ` [1] ${ru1}` : ''}${ru2 ? ` [2] ${ru2}` : ''}`
          : ''
      return `${i + 1}. ${r.name.trim()}${sku}${desc}${colors}${mat}${img}${matImg}${realUseImg}${stock}${price}${page}${video}${extra}`
    })
    .join('\n')
}

/**
 * Neo cọc / thanh toán theo cài đặt hệ thống — hạn chế tư vấn «COD 100% / trả toàn bộ lúc nhận» khi shop mặc định cọc.
 * Không bịa số tuyệt đối: giữ «khoảng / theo form».
 */
function buildPartnerPaymentPolicyBlockForPartnerAi(pay: PartnerPaymentSettingsRow): string {
  if (pay.default_deposit_mode === 'fixed_amount' && pay.default_deposit_amount > 0) {
    const a = new Intl.NumberFormat('vi-VN').format(pay.default_deposit_amount)
    return `

[Thanh toán (cài đặt hệ thống shop) — ưu tiên khi khách hỏi cọc / trả khi nhận / COD]
Đơn mặc định: thường cần **cọc trước** (mức tham chiếu: khoảng **${a}₫**; số thực tế theo form/đơn). **Cấm** tư vấn sai: **không** khẳng định khách được **thanh toán toàn bộ khi nhận hàng** (COD 100% toàn giá) như quy tắc mặc định nếu điều đó **mâu thuẫn** với cọc. Phần còn lại (khi chính sách cho phép) thường lúc **giao hàng** sau cọc. Trả lời **bám sát mặt hàng** đang bàn (dòng kho + tin gần nhất), **không** tổng quát từ sản phẩm/shop khác.`
  }
  if (pay.default_deposit_mode === 'percent' && pay.default_deposit_percent > 0) {
    return `

[Thanh toán (cài đặt hệ thống shop) — ưu tiên khi khách hỏi cọc / trả khi nhận / COD]
Đơn mặc định: thường cần **đặt cọc trước (khoảng ${pay.default_deposit_percent}%** giá trị đơn — tỷ lệ/cọc thực tế theo form/đơn). **Cấm** tư vấn sai: **không** nói «thanh toán toàn bộ khi nhận hàng» / «xem hàng rồi mới trả hết» như thể bước mặc định nếu mâu thuẫn; hãy nói: **cọc theo hướng dẫn (form)**, phần còn lại theo chính sách. Trả lời **thống nhất** với cách tư vấn **đúng mặt hàng** (kho + hội thoại), **không** lẫn quy tắc từ món khác.`
  }
  return `

[Thanh toán (cài đặt hệ thống shop)]
Cài đặt mặc định: **không bắt cọc** theo cấu hình. Nếu **chính sách shop** hoặc tin tư vấn gần đây đã nêu **cọc** cho mặt hàng này — ưu tiên **cọc**; **không** hứa trả 100% lúc nhận nếu mâu thuẫn với cách tư vấn đang thống nhất.`
}

function visionCatalogNoHitsFromTrigger(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (raw as { vision_catalog_no_hits?: unknown }).vision_catalog_no_hits === true
}

function selectedInventoryIdFromTrigger(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const v = (raw as { vision_selected_inventory_id?: unknown }).vision_selected_inventory_id
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function pageContextInventoryIdFromRaw(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pc = (raw as { page_context?: unknown }).page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return null
  const v = (pc as { inventory_id?: unknown }).inventory_id
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function pageContextSkuFromRaw(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pc = (raw as { page_context?: unknown }).page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return null
  const v = (pc as { sku?: unknown }).sku
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Ảnh trang SP từ `page_context` — khi mã không có trong kho vẫn có thể tìm tương tự theo ảnh. */
function pageContextPrimaryImageUrlFromRaw(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const pc = (raw as { page_context?: unknown }).page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return null
  for (const key of ['image_url', 'image_url_2'] as const) {
    const v = (pc as Record<string, unknown>)[key]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  return null
}

function guestMediaImageUrlFromRaw(raw: Json | null | undefined): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const gm = (raw as { guest_media?: { kind?: unknown; url?: unknown } }).guest_media
  if (!gm || typeof gm !== 'object' || Array.isArray(gm)) return null
  if (
    String((gm as { kind?: unknown }).kind || '')
      .trim()
      .toLowerCase() !== 'image'
  ) {
    return null
  }
  const u = typeof (gm as { url?: unknown }).url === 'string' ? (gm as { url: string }).url.trim() : ''
  return /^https?:\/\//i.test(u) ? u : null
}

const PAGE_CONTEXT_INV_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Tin khách kèm `page_context` neo SP từ link/embed/thẻ (**Nhánh B** — tư vấn đúng một dòng kho, không lẫn vector rộng).
 * Trường hợp điển hình: trang chi tiết SP có «Mã SP: A6009», widget gửi `page_context.sku` + khách kèm ảnh và hỏi «da gì» — phải đọc chất liệu từ **dòng kho đúng mã**.
 * Ảnh một mình không đủ: cần sku | inventory_id | product_card_consult+url.
 */
export function rawPayloadHasInboundProductPageContext(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  const pc = (raw as { page_context?: Record<string, unknown> }).page_context
  if (!pc || typeof pc !== 'object' || Array.isArray(pc)) return false
  const source = typeof pc.source === 'string' ? pc.source.trim() : ''
  const sku = typeof pc.sku === 'string' ? pc.sku.trim() : ''
  const inv = typeof pc.inventory_id === 'string' ? pc.inventory_id.trim() : ''
  const pu = typeof pc.product_url === 'string' ? pc.product_url.trim() : ''
  if (sku.length >= 2) return true
  if (PAGE_CONTEXT_INV_ID_RE.test(inv)) return true
  if (source === 'product_card_consult' && pu && /^https?:\/\//i.test(pu)) return true
  if (source === 'product_card_consult' && PAGE_CONTEXT_INV_ID_RE.test(inv)) return true
  if ((source === 'widget_page' || source === 'image_sku_match') && (sku.length >= 2 || PAGE_CONTEXT_INV_ID_RE.test(inv)))
    return true
  return false
}

/** Tên ngôn ngữ đích (tiếng Anh) — neo model + banner thống nhất cho mọi locale. */
const WIDGET_TARGET_LANG_EN: Record<WebLocale, string> = {
  vi: 'Vietnamese',
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  ko: 'Korean',
}

/**
 * Đoạn đầu system theo từng locale — vai trò: nhân viên shop (không phải “trợ lý AI”); đặt ngôn ngữ đích cho JSON `message`.
 * Widget + thiếu locale → fallback tiếng Việt như trước.
 */
const WIDGET_SYSTEM_OPENING: Record<WebLocale, string> = {
  vi:
    'Bạn đóng vai **nhân viên tư vấn của shop** trong khung chat (tin nhắn gửi khách như người thật — không phải bot hay “trợ lý AI”). Khách đang dùng giao diện tiếng Việt — **toàn bộ** trường `message` trong JSON bằng **tiếng Việt**. **Không** giới thiệu là trợ lý/bot/hệ thống; **không** mở đầu chào hỏi lan man — ưu tiên trả lời **đúng trọng tâm** câu hỏi, **ngắn gọn** (chỉ dài khi cần giải thích cụ thể). Giữ tên/mã/URL sản phẩm khớp dữ liệu kho khi cần. Không đổi ngôn ngữ trừ khi khách yêu cầu rõ trong tin này.',
  en:
    'You write as a **real store staff member** in this chat — not a generic “assistant” or AI persona. The customer’s UI language is **English** — the entire JSON `message` field must be **English only**. Do **not** introduce yourself as a chatbot, AI, or assistant; do **not** open with filler or platform names — answer **on point**, **concisely** (longer only when detail is needed). Warehouse lines may contain non-English product names; explain to the customer in English.',
  zh:
    '你在对话中的身份是**店铺真人同事**（像真人接待，不是“智能助手”人设）。顾客界面为**简体中文** — JSON 里给顾客的 `message` 必须**全文简体中文**。**不要**自称助手/机器人/AI，**不要**空话寒暄或平台自我介绍 — **直接回答顾客问题**，**简短切题**（仅在需要说明细节时稍长）。库存原文可能含其他语言，仅作事实；向顾客说明用简体中文。',
  ja:
    'あなたの役割は店の**実在のスタッフ**としてチャットで返すこと（「チャットアシスタント」「AI」として名乗らない）。お客様の UI 言語は**日本語** — JSON の `message` は**日本語のみ**。**自らを Bot/AI/アシスタントと紹介しない**。**無駄な挨拶や前置き、プラットフォーム名の自己紹介をしない** — **質問の要点にすぐ答え**、**簡潔に**（詳細が必要なときだけやや長く）。在庫行の表記が混在していても説明は日本語。',
  ko:
    '역할은 매장 **실제 직원**으로 채팅하는 것입니다(‘챗봇·AI 어시스턴트’로 소개하지 않음). 고객 UI 언어는 **한국어** — JSON `message`는 **한국어만**. **AI/봇/어시스턴트라고 소개하지 않음**. **불필요한 인사·플랫폼 소개 없이** **질문 핵심에 바로 답**하고 **짧고 명확하게** (세부 설명이 필요할 때만 길게). 재고 줄에 다른 언어가 있어도 안내는 한국어로.',
}

function partnerAiOpeningLanguageLine(opts?: {
  channel?: string | null
  uiLocale?: string | null
}): string {
  if (String(opts?.channel || '').trim().toLowerCase() !== 'widget') {
    return 'Bạn đóng vai **nhân viên tư vấn của shop** khi trả lời khách (kênh inbox). Trả lời bằng tiếng Việt trừ khi khách dùng ngôn ngữ khác thì theo ngôn ngữ khách. **Không** giới thiệu là trợ lý AI/bot; **không** mở đầu lan man — đi thẳng vào câu hỏi, ưu tiên ngắn gọn.'
  }
  const loc = normalizeWebLocale(opts?.uiLocale ?? null) ?? 'vi'
  return WIDGET_SYSTEM_OPENING[loc] ?? WIDGET_SYSTEM_OPENING.vi
}

/** Khối ngắn: củng cố giọng nhân viên thật, súc tích — lặp theo locale widget hoặc tiếng Việt cho FB/Zalo. */
function partnerAiMessagingStyleLine(opts?: { channel?: string | null; uiLocale?: string | null }): string {
  const ch = String(opts?.channel || '').trim().toLowerCase()
  const loc = ch === 'widget' ? normalizeWebLocale(opts?.uiLocale ?? null) ?? 'vi' : 'vi'
  const lines: Record<WebLocale, string> = {
    vi: `
Cách viết: tự nhiên như nhân viên đang nhắn tay — bám đúng ý khách; không lặp lời chào kiểu mẫu, không giải thích dài không cần thiết.`,
    en: `
Writing: like a teammate texting a customer — stay on their question; no scripted “hello I am…” openers, no rambling.`,
    zh: `
写法：像同事私聊顾客——紧扣对方问题；不要套路化自我介绍，不要冗长铺陈。`,
    ja: `
文体：スタッフがその場で返信する感じで、お客様の質問に一直線；定型的な自己紹介や長い前置きはしない。`,
    ko: `
문체: 동료가 고객에게 문자하듯 — 질문에 집중; 인사말 상투나 불필요한 장황한 설명 없음.`,
  }
  return lines[loc] ?? lines.vi
}

function partnerAiAddressingPriorityLine(opts?: { channel?: string | null; uiLocale?: string | null }): string {
  const ch = String(opts?.channel || '').trim().toLowerCase()
  const loc = ch === 'widget' ? normalizeWebLocale(opts?.uiLocale ?? null) ?? 'vi' : 'vi'
  const lines: Record<WebLocale, string> = {
    vi: `
Quy tắc xưng hô (bắt buộc tuyệt đối): mọi tin nhắn gửi khách phải bám theo giới tính cài đặt trong khối [Thông tin khách đã lưu trên hệ thống]. Nam dùng "anh", nữ dùng "chị"; không dùng xưng hô ngược giới tính cài đặt. Lịch sử hội thoại gần nhất chỉ để tinh chỉnh sắc thái tự nhiên; nếu lịch sử mâu thuẫn thì vẫn bám giới tính cài đặt. Chỉ khi chưa có dữ liệu giới tính mới fallback theo lịch sử gần nhất; vẫn chưa rõ thì dùng cách gọi trung tính.`,
    en: `
Addressing rule (strict): prioritize the stored guest-profile block (configured account gender). Prefer male->"anh", female->"chị". Use recent conversation history only to fine-tune tone naturally; if history conflicts with configured gender, keep configured gender as primary. Only when gender is missing should you fall back to recent history; if still uncertain, use a neutral natural address.`,
    zh: `
称呼规则（强制）：优先使用“系统已保存的客户信息”中的账号性别设置。男性优先“anh”，女性优先“chị”。最近对话仅用于微调语气自然度；若历史称呼与性别设置冲突，仍以性别设置为主。仅当没有性别数据时再回退到最近历史；仍不确定则使用中性自然称呼。`,
    ja: `
呼称ルール（必須）：保存済みプロフィール（アカウントの性別設定）を最優先。男性は「anh」、女性は「chị」を優先。直近履歴は文体調整の補助のみとし、履歴が性別設定と矛盾しても性別設定を優先する。性別情報がない場合のみ履歴を参照し、それでも不確実なら中立的で自然な呼称にする。`,
    ko: `
호칭 규칙(필수): 저장된 고객 프로필(계정 설정 성별)을 최우선으로 사용합니다. 남성은 "anh", 여성은 "chị"를 우선합니다. 최근 대화 이력은 말투를 자연스럽게 다듬는 보조 근거로만 사용하며, 이력이 성별 설정과 충돌하면 성별 설정을 우선합니다. 성별 정보가 없을 때만 최근 이력을 참고하고, 그래도 불확실하면 중립적이고 자연스러운 호칭을 사용합니다.`,
  }
  return lines[loc] ?? lines.vi
}

/**
 * Bố cục đọc transcript — khớp UI chat (tin shop trái, tin khách phải).
 * Nội dung tiếng Việt: model vẫn viết `message` theo locale routing widget khi có.
 */
const PARTNER_AI_TRANSCRIPT_READING_CONVENTION = `
[Đọc lịch sử — bố cục chat]
Dòng có nhãn **Shop** = phía shop/AI (trên giao diện thường **bên trái**). Dòng có nhãn **Khách** = tin khách (**bên phải**). Luôn phân biệt hai phía; không gán ý định của khách cho tin shop hay ngược lại.
`

/**
 * Quy ước nghiệp vụ: mọi biến thể «mẫu khác / loại khác» quy về hỏi thay thế — bám logic pipeline (có/không ngữ cảnh).
 */
const PARTNER_AI_ALTERNATIVE_MODEL_QUERY_DOCTRINE = `
[Câu hỏi dạng «mẫu khác / loại khác / còn mẫu nào / tương tự / na ná / hàng khác» — quy về **một loại ý**]
Khách đang hỏi **gợi ý thay thế** so với một mẫu đang làm neo trong thread (nếu có).
- **Có ngữ cảnh** (danh sách kho đã neo theo SP vừa tư vấn, hoặc lịch sử có tin **Shop** kèm thẻ/mã sản phẩm, hoặc tin khách kèm ngữ cảnh SP): chỉ đề xuất trong \`products\` các mẫu **cùng nhóm / thay thế hợp lý** cho mẫu neo — không đổi sang ngành khác.
- **Không đủ ngữ cảnh** (hệ thống vào nhánh làm rõ — \`products\` bắt buộc \`[]\`): **không đoán**; hỏi lại khách **loại/mẫu cụ thể** muốn xem (mô tả, ảnh, mã). Ở **tin sau**, khi khách trả lời rõ ý định sản phẩm, mới tìm trong kho và điền \`products\`.
`

/** Một dòng neo tiếng Anh — cùng công thức cho mọi locale đích (kể cả vi không dùng). */
function partnerAiWidgetTargetRoutingLine(opts?: { channel?: string | null; uiLocale?: string | null }): string {
  if (String(opts?.channel || '').trim().toLowerCase() !== 'widget') return ''
  const loc = normalizeWebLocale(opts?.uiLocale ?? null)
  if (!loc || loc === 'vi') return ''
  const name = WIDGET_TARGET_LANG_EN[loc]
  return `\n(Routing — read first) Customer UI locale: **${loc}**. Target language for JSON \`message\` to the customer: **${name}**. Policy/inventory text below may be Vietnamese or mixed — use as data only; write \`message\` entirely in **${name}** (not Vietnamese), unless the UI locale is Vietnamese.`
}

/**
 * Đầu prompt user — cùng cấu trúc cho mọi ngôn ngữ đích (chỉ đổi mã + tên đích).
 */
function partnerAiUserPromptOutputLanguageBanner(opts?: { channel?: string | null; uiLocale?: string | null }): string {
  if (String(opts?.channel || '').trim().toLowerCase() !== 'widget') return ''
  const loc = normalizeWebLocale(opts?.uiLocale ?? null)
  if (!loc || loc === 'vi') return ''
  const name = WIDGET_TARGET_LANG_EN[loc]
  return `[REQUIRED OUTPUT LANGUAGE: ${name} (UI=${loc})]
Write the JSON "message" field **entirely in ${name}** for the customer. Warehouse lines below may be Vietnamese or mixed — treat as source facts; paraphrase advice and explanations only in **${name}**.

`
}

async function resolvePartnerAiLocaleOpts(
  conversationId: string,
  localeOpts?: { channel?: string | null; uiLocale?: string | null }
): Promise<{ channel?: string | null; uiLocale?: string | null } | undefined> {
  if (!localeOpts || String(localeOpts.channel || '').trim().toLowerCase() !== 'widget') return localeOpts
  if (normalizeWebLocale(localeOpts.uiLocale ?? null)) return localeOpts
  if (!isPgConfigured() || !conversationId.trim()) return localeOpts
  try {
    const raw = await fetchConversationUiLocaleFromPg(conversationId)
    const n = normalizeWebLocale(raw ?? null)
    if (n) return { ...localeOpts, uiLocale: n }
  } catch {
    /* ignore */
  }
  return localeOpts
}

type PartnerAiTranscriptMsg = {
  direction: string
  body: string
  created_at: string
  raw_payload: Json | null
}

function formatPartnerAiOneTranscriptLine(m: PartnerAiTranscriptMsg): string {
  const label = m.direction === 'inbound' ? 'Khách' : 'Shop'
  const pl = m.raw_payload as { guest_media?: { kind?: string; url?: string } } | null
  const img = pl?.guest_media?.kind === 'image' && pl.guest_media.url ? pl.guest_media.url : null
  const cap = m.body.replace(/^📷\s*/u, '').trim()
  if (img) {
    const line = [cap || '(ảnh)', img].filter(Boolean).join(' — ')
    return `${label}: ${line}`
  }
  return `${label}: ${m.body}`
}

function formatPartnerAiTranscriptLines(chronological: PartnerAiTranscriptMsg[]): string {
  return chronological.map((m) => formatPartnerAiOneTranscriptLine(m)).join('\n')
}

/** Tin shop **gần nhất** trước cụm tin khách liên tiếp ở cuối transcript («vừa tư vấn»). */
function lastShopOutboundBeforeLatestCustomerChunk(
  chronological: PartnerAiTranscriptMsg[]
): PartnerAiTranscriptMsg | null {
  if (!chronological.length) return null
  let i = chronological.length - 1
  while (i >= 0 && chronological[i].direction === 'inbound') i--
  if (i < 0) return null
  return chronological[i]
}

function outboundMessageSuggestsProductAdvice(m: PartnerAiTranscriptMsg | null): boolean {
  if (!m || m.direction !== 'outbound') return false
  if (m.raw_payload && aiProductCardsFromPayload(m.raw_payload).length > 0) return true
  return extractExplicitSkuCandidates(m.body).length > 0
}

/**
 * Chỉ dùng khi **hỏi tiếp theo ngữ cảnh SP vừa tư vấn** (`followUpSingleProductNoVector`) hoặc **Nhánh B** (neo mã/link — tránh cả transcript dài lẫn SP khác):
 * một tin shop gần nhất (trước tin khách hiện tại). Câu khách gửi riêng ở «Tin nhắn mới nhất của khách».
 */
function formatPartnerAiMinimalTranscriptForFollowUpContext(chronological: PartnerAiTranscriptMsg[]): string {
  if (!chronological.length) {
    return '(Chưa có tin nhắn trước đó.)'
  }
  const last = chronological[chronological.length - 1]
  let scanEnd = chronological.length - 1
  if (last.direction === 'inbound') scanEnd = chronological.length - 2
  let shopLine: string | null = null
  for (let i = scanEnd; i >= 0; i--) {
    if (chronological[i].direction === 'outbound') {
      shopLine = formatPartnerAiOneTranscriptLine(chronological[i])
      break
    }
  }
  if (!shopLine) {
    return '(Chưa có tin trả lời của shop trước câu hỏi hiện tại — có thể là tin đầu thread.)'
  }
  return `Câu trả lời gần nhất của shop (trước tin khách hiện tại):\n${shopLine}\n\n(Câu hỏi / tin hiện tại của khách nằm ở mục «Tin nhắn mới nhất của khách» bên dưới — không lặp lại trong khối này.)`
}

/**
 * Inbound **gần nhất** có `page_context.source === product_card_consult` — neo SKU/UUID từ thẻ (bấm Tư vấn).
 * Quét từ cuối transcript; bỏ qua các tin khách sau đó (vd. hỏi tiếp size/màu).
 */
function latestProductCardConsultAnchorInventoryId(
  chronological: PartnerAiTranscriptMsg[],
  consultedRowForSkuMatch: InvRow | null
): string | null {
  for (let i = chronological.length - 1; i >= 0; i--) {
    const m = chronological[i]
    if (m.direction !== 'inbound') continue
    const raw = m.raw_payload
    if (!rawPayloadIsProductCardConsult(raw)) continue
    const inv = pageContextInventoryIdFromRaw(raw)
    if (inv && PAGE_CONTEXT_INV_ID_RE.test(inv)) return inv
    const sku = pageContextSkuFromRaw(raw)
    if (sku && consultedRowForSkuMatch?.sku) {
      const norm = (s: string) =>
        s
          .trim()
          .toLowerCase()
          .replace(/[\s._-]+/g, '')
      if (norm(sku) === norm(consultedRowForSkuMatch.sku ?? '')) return consultedRowForSkuMatch.id
    }
    continue
  }
  return null
}

/** Không lấy lịch sử thread — chỉ mã + câu khách (Nhánh bấm Tư vấn trên thẻ). */
function formatPartnerAiCardConsultIsolatedTranscript(): string {
  return `[Tư vấn từ thẻ sản phẩm — **không** dùng lịch sử hội thoại phía trên]
Khách vừa bấm **Tư vấn** trên một thẻ trong chat (hoặc đang hỏi tiếp **đúng** mã/inventory đó). **Cấm** tham chiếu chủ đề hay đoạn chat cũ (vd. đã hỏi loại hàng khác — túi/váy/giày…) — **chỉ** tư vấn theo **danh sách kho** trong prompt và **«Tin nhắn mới nhất của khách»** bên dưới.`
}

function buildPartnerAiClarifyShoppingIntentSystem(
  settings: SettingsRow,
  effectiveLocaleOpts: { channel?: string | null; uiLocale?: string | null } | undefined
): string {
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  return `${partnerAiOpeningLanguageLine(effectiveLocaleOpts)}${partnerAiWidgetTargetRoutingLine(effectiveLocaleOpts)}
Giọng điệu: ${tone}${partnerAiMessagingStyleLine(effectiveLocaleOpts)}${partnerAiAddressingPriorityLine(effectiveLocaleOpts)}
${PARTNER_AI_TRANSCRIPT_READING_CONVENTION}
${PARTNER_AI_ALTERNATIVE_MODEL_QUERY_DOCTRINE}

[Tình huống bắt buộc — làm rõ ý định khách / tư vấn mua hàng]
Tin khách **chưa rõ** (kể cả than phiền kiểu «không vào được», «lỗi», «không mở được» — **đừng** coi đó là yêu cầu hỗ trợ kỹ thuật web/app hay hỏi lỗi cụ thể).
- **Cấm** hỏi: trang nào, ứng dụng hay web, mã lỗi, bước khắc phục truy cập, trình duyệt gì — **không** xử lý như ticket IT.
- **Ưu tiên** chuyển sang **tư vấn sản phẩm**: mời khách nói **đang cần tư vấn sản phẩm gì** — có thể **gửi ảnh** mẫu hoặc **tên loại / kiểu**; xưng hô **anh/chị/em** bám **tin khách và lịch sử** (không mặc định «chị» nếu khách xưng «anh»).
- **Ví dụ gợi ý loại hàng** phải **khớp giới** khách thể hiện trong tin/lịch sử:
  - Khách xưng **anh** / rõ **nam** → chỉ ví dụ **đồ nam** (vd. áo sơ mi, quần tây, áo thun/polo, blazer nam, giày/dép nam…); **cấm** lấy váy/đầm/chân váy làm ví dụ mặc định.
  - Khách xưng **chị/em** / rõ **nữ** → ví dụ **đồ nữ** (váy, đầm, set, áo kiểu…).
  - Chưa rõ giới → ví dụ **trung tính** (áo, quần, set đồ…) hoặc hỏi ngắn một ý, **không** ép ví dụ một giới.
- **Không** giới thiệu sản phẩm cụ thể từ kho trong tin này, **không** gắn thẻ/carousel; \`products\` = [].
- Trả lời **ngắn (2–4 câu)**, ấm, lịch sự — đúng ngôn ngữ giao diện khách (theo phần mở đầu system).

Định dạng đầu ra: JSON đúng schema ở cuối prompt user — trường \`products\` **bắt buộc** là mảng rỗng \`[]\`.`
}

function buildPartnerAiClarifyShoppingIntentUser(
  effectiveLocaleOpts: { channel?: string | null; uiLocale?: string | null } | undefined,
  transcript: string,
  latestCustomerMessage: string,
  opts?: { similarAlternativesWithoutPriorConsult?: boolean }
): string {
  const similarNoAnchorBlock =
    opts?.similarAlternativesWithoutPriorConsult === true
      ? `

[Gợi ý nội dung bắt buộc cho tin này — ngữ cảnh hệ thống]
Khách hỏi kiểu «còn/mẫu khác / loại khác», «tương tự», «hàng khác», «na ná»… — **cùng quy về** hỏi **gợi ý thay thế**, nhưng **chưa có** neo SP trong thread (không có tin Shop gần đây kèm thẻ/mã, không kèm ngữ cảnh SP). **Không** đoán loại hàng, **không** giả vờ đã có mẫu đang bàn. Hỏi lại ngắn: **loại/mẫu cụ thể** khách muốn xem thay thế là gì (mô tả, mã, ảnh). Sau khi khách trả lời rõ ý định sản phẩm, tin kế tiếp (hệ thống) mới tìm trong kho — tin này **không** gợi ý carousel.`
      : ''
  return `${partnerAiUserPromptOutputLanguageBanner(effectiveLocaleOpts)}Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}
${similarNoAnchorBlock}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text)","products":[]}
products **phải** là [] (rỗng). Không thêm trường khác.
Trong \`message\`: **không** hỏi khắc phục lỗi truy cập web/app; hướng khách **nêu nhu cầu tư vấn sản phẩm** (ảnh hoặc tên loại). Nếu khách xưng **anh** → ví dụ chỉ **đồ nam**; nếu **chị/em** → ví dụ **đồ nữ**; không lẫn ví dụ nam/nữ sai xưng hô.`
}

const PAUSE_CONVERSATION_ACK_RE =
  /^(?:ok(?:i|ie|ela)?|dạ|da|vâng|vang|ừ|ừm|uhm|ok nha|ok nhé|vậy nhé|thôi nhé|được(?:\s+rồi)?|cảm\s*ơn(?:\s+shop)?|thanks?|thank\s*you|tks|k|kk|mình\s+xem\s+thêm|để\s+mình\s+xem\s+thêm|để\s+chị\s+xem\s+thêm|để\s+em\s+xem\s+thêm)$/iu

function normalizeMessageForPauseIntent(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:()[\]{}'"`~@#$%^&*_+=\\|/<>-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function partnerAiInboundLooksLikePauseConversation(message: string): boolean {
  const raw = message.trim()
  if (!raw) return false
  if (raw.length > 48) return false
  if (/[?？]/u.test(raw)) return false
  const normalized = normalizeMessageForPauseIntent(raw)
  if (!normalized) return false
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length > 7) return false
  return PAUSE_CONVERSATION_ACK_RE.test(normalized)
}

function buildPartnerAiPauseConversationSystem(
  settings: SettingsRow,
  effectiveLocaleOpts: { channel?: string | null; uiLocale?: string | null } | undefined
): string {
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  return `${partnerAiOpeningLanguageLine(effectiveLocaleOpts)}${partnerAiWidgetTargetRoutingLine(effectiveLocaleOpts)}
Giọng điệu: ${tone}${partnerAiMessagingStyleLine(effectiveLocaleOpts)}${partnerAiAddressingPriorityLine(effectiveLocaleOpts)}
${PARTNER_AI_TRANSCRIPT_READING_CONVENTION}

[Tình huống bắt buộc — khách muốn tạm dừng cuộc trò chuyện]
Tin khách là phản hồi chốt nhẹ kiểu "ok/oki/cảm ơn/để xem thêm", thể hiện muốn dừng tạm thời.
- Trả lời ngắn như người thật (1-2 câu), ấm và tự nhiên.
- Bắt buộc có đủ 3 ý: (1) cảm ơn khách, (2) xác nhận tạm dừng tại đây, (3) nhắn shop luôn sẵn sàng hỗ trợ khi khách cần.
- Không tư vấn thêm sản phẩm, không hỏi ngược nhiều câu, không thúc khách chốt đơn.
- Không gắn thẻ sản phẩm; \`products\` bắt buộc là mảng rỗng \`[]\`.

Định dạng đầu ra: JSON đúng schema ở cuối prompt user — trường \`products\` phải là \`[]\`.`
}

function buildPartnerAiPauseConversationUser(
  effectiveLocaleOpts: { channel?: string | null; uiLocale?: string | null } | undefined,
  transcript: string,
  latestCustomerMessage: string
): string {
  return `${partnerAiUserPromptOutputLanguageBanner(effectiveLocaleOpts)}Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text)","products":[]}
Trong \`message\`: viết thật ngắn, tự nhiên như nhân viên đang nhắn tay; cảm ơn + tạm dừng + luôn sẵn sàng hỗ trợ khi cần.`
}

function estimatedAgeFromBirthDateIso(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  if (!mo || !da) return null
  const birth = new Date(y, mo - 1, da)
  if (Number.isNaN(birth.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const md = now.getMonth() - birth.getMonth()
  if (md < 0 || (md === 0 && now.getDate() < birth.getDate())) age -= 1
  return age >= 0 && age < 130 ? age : null
}

/** Khối ngữ cảnh cố định từ DB — không bịa ngoài các dòng này. */
export function formatGuestProfileContextBlockForPartnerAi(profile: {
  birthDate: string | null
  gender: GuestProfileGender | null
}): string {
  const parts: string[] = []
  if (profile.gender === 'male') parts.push('Giới tính khai báo: nam — gợi ý xưng «anh» khi phù hợp.')
  else if (profile.gender === 'female') parts.push('Giới tính khai báo: nữ — gợi ý xưng «chị» khi phù hợp.')
  if (profile.birthDate?.trim()) {
    const iso = profile.birthDate.trim()
    parts.push(`Ngày sinh đã khai (YYYY-MM-DD): ${iso}.`)
    const age = estimatedAgeFromBirthDateIso(iso)
    if (age != null) parts.push(`Tuổi ước lượng từ ngày sinh: ${age}.`)
  }
  if (parts.length === 0) return ''
  return `[Thông tin khách đã lưu trên hệ thống — chỉ dùng để xưng hô và gợi ý độ tuổi phù hợp; không suy diễn thêm ngoài các ý sau:\n${parts.join('\n')}]`
}

export function rawPayloadIsProductCardConsult(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (raw as { page_context?: { source?: string } }).page_context?.source === 'product_card_consult'
}

/** @see docs/PARTNER_AI_PIPELINE_BRANCHES.md — nhánh A/B, clarify, clamp; sửa nhánh nào giữ nhánh kia. */
export async function buildPartnerAiContext(
  partnerId: string,
  conversationId: string,
  settings: SettingsRow,
  latestCustomerMessage: string,
  triggerRawPayload?: Json | null,
  localeOpts?: { channel?: string | null; uiLocale?: string | null }
): Promise<{
  system: string
  user: string
  materialDetailFollowup: PartnerMaterialDetailFollowup | null
  realUseFollowup: PartnerRealUseImageFollowup | null
  /** Neo SP vừa tư vấn — job sau parse có thể ép `products` không lệch carousel. */
  useLastConsultedContext: boolean
  lastConsultedRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null
  /** **Nhánh A** — khách hỏi mẫu/loại/kiểu khác hoặc tương tự / gần giống; job gắn `partner_ai_pipeline_branch: similar_alternatives_catalog` khi chạy LLM đầy đủ. */
  similarCatalogVersusLastConsulted: boolean
  /** Không gọi tìm kho; chỉ hỏi khách làm rõ nhu cầu — `products` luôn []. */
  clarifyShoppingIntent: boolean
  /** Widget `context_reply`: khóa cứng ngữ cảnh theo 1 dòng kho vừa tư vấn gần nhất. */
  forceSingleRowContextReply: boolean
  /**
   * **Nhánh B** — tin kèm `page_context` neo SP (SKU/inventory/thẻ từ link). Chỉ tư vấn đúng dòng kho đó; không lẫn vector/tìm rộng.
   * Đánh dấu nội bộ + clamp `products` sau LLM.
   */
  inboundAnchoredProductConsultBranch: boolean
  inboundAnchoredConsultRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null
  /** Mã/link trang có trong payload nhưng **không** có dòng kho — đã lấy danh sách tương tự bằng ảnh (vector). */
  inboundPageSkuMissImageSimilarFallback: boolean
  /**
   * Nhánh «mẫu khác» neo theo SKU đã tư vấn — đủ thẻ thay thể từ vector: job gửi **tin mẫu** + carousel, **không** gọi LLM.
   */
  similarAlternativesTemplateInventoryRows: Database['public']['Tables']['messaging_partner_inventory']['Row'][] | null
  /** Route intent đã chốt (hard-rule/classifier/fallback) để worker log/debug nhánh pipeline. */
  partnerAiRouteIntent: PartnerAiRouteIntent | null
}> {
  const effectiveLocaleOpts = await resolvePartnerAiLocaleOpts(conversationId, localeOpts)
  const invFmtOpts = { markPricesAsVnd: shouldMarkInventoryPricesAsVndForAi(effectiveLocaleOpts) }

  let guestProfileBlockForAi = ''
  if (isPgConfigured()) {
    try {
      const conv = await fetchCustomerCareConversationByIdPg(conversationId)
      if (conv?.linked_user_id && conv.partner_id === partnerId) {
        const prof = await fetchNanoaiChatProfileFromPg(conv.linked_user_id)
        if (prof && (prof.birthDate || prof.gender)) {
          guestProfileBlockForAi = formatGuestProfileContextBlockForPartnerAi(prof)
        }
      }
    } catch (e) {
      console.warn('[partner-ai-llm] guest profile context', e)
    }
  }

  /**
   * Bấm «Tư vấn» trên thẻ: ưu tiên **SKU / URL / ảnh / vector ảnh** từ `page_context` — **không** trích SKU
   * từ cả đoạn tin dài (dễ khớp nhầm token trong câu mẫu).
   */
  const isConsultCardPick = rawPayloadIsProductCardConsult(triggerRawPayload)
  const payloadRouteIntent = parsePartnerAiRouteDecision(triggerRawPayload)?.intent ?? null
  let partnerAiRouteIntent: PartnerAiRouteIntent | null = isConsultCardPick
    ? 'card_consult_isolated'
    : payloadRouteIntent
  let explicitSkuRows: Database['public']['Tables']['messaging_partner_inventory']['Row'][] = []
  const triggerPageContextInventoryId = pageContextInventoryIdFromRaw(triggerRawPayload)

  if (triggerPageContextInventoryId && isPgConfigured()) {
    try {
      const rowById = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, triggerPageContextInventoryId)
      if (rowById) {
        explicitSkuRows = [rowById]
      }
    } catch (e) {
      console.warn('[partner-ai-llm] page_context inventory_id lookup failed', e)
    }
  }

  if (isConsultCardPick) {
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromPageContextSku(partnerId, triggerRawPayload)
    }
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromProductCardConsultPageContext(partnerId, triggerRawPayload)
    }
  } else {
    /**
     * Widget / trang SP: `page_context.sku` trên **tin kích hoạt** phải thắng khi `latestCustomerMessage` là chuỗi
     * nhiều tin khách (`inboundTail` trong job) — tránh trích SKU từ tin cũ rồi bỏ qua mã đang xem (vd. A6009).
     */
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromPageContextSku(partnerId, triggerRawPayload)
    }
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsByExplicitSku(partnerId, latestCustomerMessage)
    }
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromProductCardConsultPageContext(partnerId, triggerRawPayload)
    }
  }
  if (!partnerAiRouteIntent && explicitSkuRows.length > 0) {
    partnerAiRouteIntent = 'explicit_sku_consult'
  }
  const selectedInventoryId = selectedInventoryIdFromTrigger(triggerRawPayload)
  /** Mã / `inventory_id` trên trang không khớp kho — tìm mẫu gần giống theo ảnh `page_context` hoặc ảnh tin. */
  let inboundPageSkuMissImageSimilarFallback = false

  let lastConsultedRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null
  if (isPgConfigured()) {
    try {
      lastConsultedRow = await fetchLastConsultedInventoryRowFromConversationPg(partnerId, conversationId)
    } catch (e) {
      console.warn('[partner-ai-llm] lastConsulted inventory', e)
    }
  }

  let chronological: {
    direction: string
    body: string
    created_at: string
    raw_payload: Json | null
  }[] = []
  if (isPgConfigured()) {
    try {
      const rows = await fetchCustomerCareTranscriptLinesFromPg(conversationId, 16)
      if (rows?.length) chronological = rows
    } catch (e) {
      console.warn('[partner-ai-llm] transcript (early) PG failed', e)
    }
  }

  /** Tin hỏi tiếp («có màu gì») vẫn neo SP dù payload còn `vision_selected_inventory_id` từ lượt trước. */
  const followUpStyleMessage = inboundTextLooksLikeFollowUpConsultHeuristic(latestCustomerMessage)

  /** **Nhánh A** — «Mẫu khác / loại khác / tương tự / gần giống» — lấy kho bằng embedding ảnh SP neo so với toàn kho, không khóa một dòng kho (đối lập Nhánh B). */
  const similarCatalogVersusLastConsulted =
    partnerAiRouteIntent === 'similar_alternatives' ||
    (partnerAiRouteIntent !== 'new_product_search' &&
      customerMessageWantsSimilarCatalogVersusLastConsulted(latestCustomerMessage))
  if (!partnerAiRouteIntent && similarCatalogVersusLastConsulted) {
    partnerAiRouteIntent = 'similar_alternatives'
  }
  const lastShopTurnForSimilar = lastShopOutboundBeforeLatestCustomerChunk(
    chronological as PartnerAiTranscriptMsg[]
  )
  const shopLastSentProductAdvice = outboundMessageSuggestsProductAdvice(lastShopTurnForSimilar)
  /** [Nhánh B] Tin kèm page_context (link/embed/thẻ) + đã resolve được dòng kho — khóa tư vấn một SP, không lẫn nhánh tìm rộng. */
  let inboundAnchoredProductConsultBranch =
    !similarCatalogVersusLastConsulted &&
    explicitSkuRows.length > 0 &&
    Boolean(rawPayloadHasInboundProductPageContext(triggerRawPayload))
  const widgetIntent = parsePartnerAiWidgetIntentFromPayload(triggerRawPayload)
  let contextReplyAnchorRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null
  if (effectiveLocaleOpts?.channel === 'widget' && widgetIntent === 'context_reply' && isPgConfigured()) {
    for (let i = chronological.length - 1; i >= 0; i--) {
      const raw = chronological[i]?.raw_payload ?? null
      const invId = pageContextInventoryIdFromRaw(raw)
      if (invId) {
        const row = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, invId)
        if (row) {
          contextReplyAnchorRow = row
          break
        }
      }
      const sku = pageContextSkuFromRaw(raw)
      if (sku) {
        const row = await fetchPartnerInventoryRowByComparableSkuFromPg(partnerId, sku)
        if (row) {
          contextReplyAnchorRow = row
          break
        }
      }
    }
  }
  const contextReplySingleRow = contextReplyAnchorRow ?? lastConsultedRow
  const forceSingleRowContextFromWidgetIntent =
    effectiveLocaleOpts?.channel === 'widget' &&
    widgetIntent === 'context_reply' &&
    Boolean(contextReplySingleRow) &&
    !similarCatalogVersusLastConsulted
  if (forceSingleRowContextFromWidgetIntent && contextReplySingleRow) {
    lastConsultedRow = contextReplySingleRow
  }

  /** Bấm **Tư vấn** trên thẻ: phiên làm việc chỉ một SKU — không đưa lịch sử thread vào model (tránh kéo chủ đề cũ như túi/váy lẫn nhau). */
  const opensGeneralShopCatalog =
    partnerAiRouteIntent === 'new_product_search' ||
    (partnerAiRouteIntent !== 'follow_up_current_product' &&
      partnerAiRouteIntent !== 'purchase_or_order' &&
      partnerAiRouteIntent !== 'policy_or_order_support' &&
      customerMessageOpensNewProductSearch(latestCustomerMessage))
  if (!partnerAiRouteIntent && opensGeneralShopCatalog) {
    partnerAiRouteIntent = 'new_product_search'
  }
  const latestCardConsultAnchorInvId = latestProductCardConsultAnchorInventoryId(
    chronological as PartnerAiTranscriptMsg[],
    lastConsultedRow
  )
  const cardConsultIsolatedThread =
    partnerAiRouteIntent === 'card_consult_isolated' ||
    (!opensGeneralShopCatalog &&
    !similarCatalogVersusLastConsulted &&
    Boolean(
      (inboundAnchoredProductConsultBranch && isConsultCardPick) ||
        (latestCardConsultAnchorInvId &&
          lastConsultedRow &&
          latestCardConsultAnchorInvId === lastConsultedRow.id)
    ))

  /**
   * Neo «mẫu khác»: SP kèm tin này; tin shop vừa có thẻ/mã; hoặc **dòng kho đang tư vấn** (sau chỉnh widget `context_reply`).
   * Tránh clarify khi vừa tư vấn đúng SKU chỉ vì heuristic không bắt được thẻ trên tin cuối.
   */
  const similarIntentHasUsableThreadAnchor =
    explicitSkuRows.length > 0 || shopLastSentProductAdvice || Boolean(lastConsultedRow)

  const useLastConsultedContext =
    !opensGeneralShopCatalog &&
    Boolean(lastConsultedRow) &&
    (partnerAiRouteIntent === 'follow_up_current_product' ||
      partnerAiRouteIntent === 'purchase_or_order' ||
      partnerAiRouteIntent === 'policy_or_order_support' ||
      shouldAugmentInventorySearchWithLastConsulted(latestCustomerMessage, {
        visionInventorySelected: Boolean(selectedInventoryId) && !followUpStyleMessage,
      }))

  /**
   * Hỏi tiếp SP vừa tư vấn: **không** gọi vector/ANN trên cả kho — chỉ đưa đúng một dòng kho + câu hỏi cho model phân tích.
   * (Không áp khi khách chọn SP từ ảnh vision — nhánh đó vẫn tìm kho rộng.)
   */
  /** Một dòng kho + không vector: trừ khi khách đang chọn SP từ ảnh (vision) trong **tin này** và không phải hỏi tiếp; trừ khi hỏi **mẫu tương tự** (cần vector ảnh + cả kho). */
  const followUpSingleProductNoVector =
    explicitSkuRows.length === 0 &&
    (useLastConsultedContext || (forceSingleRowContextFromWidgetIntent && Boolean(contextReplySingleRow))) &&
    (!selectedInventoryId || followUpStyleMessage) &&
    !similarCatalogVersusLastConsulted

  const heuristicClarifyShoppingIntent = partnerAiInboundNeedsShoppingIntentClarify({
    message: latestCustomerMessage,
    hasExplicitSku: explicitSkuRows.length > 0,
    hasVisionInventorySelection: Boolean(selectedInventoryId),
    similarCatalogVersusLastConsulted,
    followUpSingleProductNoVector,
  })
  /** «Mẫu khác / tương tự» nhưng không có SP trên tin này và shop chưa vừa gửi thẻ/Mã — không tìm kho bừa. */
  const forceClarifySimilarWithoutAnchor =
    similarCatalogVersusLastConsulted && !selectedInventoryId && !similarIntentHasUsableThreadAnchor
  const useClarifyShoppingBranch =
    partnerAiRouteIntent === 'clarify' ||
    forceClarifySimilarWithoutAnchor ||
    partnerAiShouldUseClarifyBranchFromWidgetPayload(
      effectiveLocaleOpts?.channel,
      triggerRawPayload,
      heuristicClarifyShoppingIntent
    )
  if (useClarifyShoppingBranch) {
    const transcriptBlock = formatPartnerAiTranscriptLines(chronological)
    const clarifyUser = buildPartnerAiClarifyShoppingIntentUser(
      effectiveLocaleOpts,
      transcriptBlock,
      latestCustomerMessage,
      {
        similarAlternativesWithoutPriorConsult: forceClarifySimilarWithoutAnchor,
      }
    )
    return {
      system: buildPartnerAiClarifyShoppingIntentSystem(settings, effectiveLocaleOpts),
      user: guestProfileBlockForAi ? `${clarifyUser}\n\n${guestProfileBlockForAi}\n` : clarifyUser,
      materialDetailFollowup: null,
      realUseFollowup: null,
      useLastConsultedContext: false,
      lastConsultedRow: null,
      similarCatalogVersusLastConsulted: false,
      clarifyShoppingIntent: true,
      forceSingleRowContextReply: false,
      inboundAnchoredProductConsultBranch: false,
      inboundAnchoredConsultRow: null,
      inboundPageSkuMissImageSimilarFallback: false,
      similarAlternativesTemplateInventoryRows: null,
      partnerAiRouteIntent,
    }
  }

  if (partnerAiRouteIntent === 'pause_or_close' || partnerAiInboundLooksLikePauseConversation(latestCustomerMessage)) {
    const transcriptBlock = formatPartnerAiTranscriptLines(chronological)
    const pauseUser = buildPartnerAiPauseConversationUser(
      effectiveLocaleOpts,
      transcriptBlock,
      latestCustomerMessage
    )
    return {
      system: buildPartnerAiPauseConversationSystem(settings, effectiveLocaleOpts),
      user: guestProfileBlockForAi ? `${pauseUser}\n\n${guestProfileBlockForAi}\n` : pauseUser,
      materialDetailFollowup: null,
      realUseFollowup: null,
      useLastConsultedContext: false,
      lastConsultedRow: null,
      similarCatalogVersusLastConsulted: false,
      clarifyShoppingIntent: true,
      forceSingleRowContextReply: false,
      inboundAnchoredProductConsultBranch: false,
      inboundAnchoredConsultRow: null,
      inboundPageSkuMissImageSimilarFallback: false,
      similarAlternativesTemplateInventoryRows: null,
      partnerAiRouteIntent: partnerAiRouteIntent ?? 'pause_or_close',
    }
  }

  /** Khi bật nhánh similar catalog bằng vector neo, lưu `inventory_id` mẫu gốc để tách thẻ «mẫu khác». */
  let similarCatalogAnchorRowId: string | null = null

  let invForContext: Database['public']['Tables']['messaging_partner_inventory']['Row'][] = []
  let selectedRowBlock = ''
  let selectedRowForEnrich: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null

  /** Có payload trang SP + ảnh nhưng không neo được dòng kho — ưu tiên nhánh tìm tương tự theo ảnh, không khóa 1 dòng «last consulted». */
  const extImgWhenPageContextSkuMiss =
    pageContextPrimaryImageUrlFromRaw(triggerRawPayload) ?? guestMediaImageUrlFromRaw(triggerRawPayload)
  const pageContextWantsImageSimilarWhenSkuMiss =
    explicitSkuRows.length === 0 &&
    !similarCatalogVersusLastConsulted &&
    rawPayloadHasInboundProductPageContext(triggerRawPayload) &&
    Boolean(extImgWhenPageContextSkuMiss?.trim())

  if (followUpSingleProductNoVector && lastConsultedRow && !pageContextWantsImageSimilarWhenSkuMiss) {
    let row = lastConsultedRow
    if (isPgConfigured()) {
      try {
        const fresh = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, lastConsultedRow.id)
        if (fresh) row = fresh
      } catch (e) {
        console.warn('[partner-ai-llm] refresh lastConsulted row for follow-up', e)
      }
    }
    lastConsultedRow = row
    invForContext = [row]
  } else {
    let inv: Database['public']['Tables']['messaging_partner_inventory']['Row'][] = []
    /**
     * «Mẫu khác / tương tự»: neo theo **thẻ SP tin này** (bấm Tư vấn + nhắn) nếu có — không chỉ chờ `lastConsultedRow` từ DB.
     */
    if (similarCatalogVersusLastConsulted && !selectedInventoryId) {
      /** SP neo: `page_context` / thẻ tin này → không thì **vector ảnh của dòng kho vừa tư vấn** (`lastConsultedRow`). */
      const anchorForSimilar = explicitSkuRows[0] ?? lastConsultedRow ?? null
      if (anchorForSimilar) {
        try {
          let anchorFresh = anchorForSimilar
          if (isPgConfigured()) {
            try {
              const got = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, anchorForSimilar.id)
              if (got) anchorFresh = got
            } catch (e) {
              console.warn('[partner-ai-llm] refresh anchor row for similar catalog', e)
            }
          }
          const rawSimilar = await fetchInventoryRowsSimilarToAnchorProductImage(partnerId, anchorFresh, {
            limit: PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
          })
          const filtered = filterInventoryRowsBySharedCoarseCategory(anchorFresh, rawSimilar)
          const aid = anchorFresh.id
          similarCatalogAnchorRowId = aid
          inv = [anchorFresh, ...filtered.filter((r) => r.id !== aid)].slice(0, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
        } catch (e) {
          console.warn('[partner-ai-llm] similar catalog by anchor image', e)
        }
      }
    }
    if (inv.length === 0 && explicitSkuRows.length > 0 && !similarCatalogVersusLastConsulted) {
      inv = explicitSkuRows.slice(0, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
    }
    if (inv.length === 0 && explicitSkuRows.length > 0 && similarCatalogVersusLastConsulted) {
      /* Vector ảnh trống / lỗi: vẫn neo ít nhất đúng mặt hàng trên thẻ. */
      inv = explicitSkuRows.slice(0, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
    }
    if (inv.length === 0) {
      const extImg =
        pageContextPrimaryImageUrlFromRaw(triggerRawPayload) ?? guestMediaImageUrlFromRaw(triggerRawPayload)
      if (
        extImg &&
        !similarCatalogVersusLastConsulted &&
        explicitSkuRows.length === 0 &&
        rawPayloadHasInboundProductPageContext(triggerRawPayload)
      ) {
        try {
          const byImg = await fetchInventoryRowsSimilarToExternalImageUrl(partnerId, extImg, {
            limit: PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
          })
          if (byImg.length > 0) {
            inboundPageSkuMissImageSimilarFallback = true
            const top = byImg[0]
            const rawRest = byImg.slice(1)
            const filtered = filterInventoryRowsBySharedCoarseCategory(top, rawRest)
            const merged =
              filtered.length > 0
                ? [top, ...filtered.filter((r) => r.id !== top.id)]
                : byImg
            inv = merged.slice(0, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
          }
        } catch (e) {
          console.warn('[partner-ai-llm] page context sku miss → image similar fallback', e)
        }
      }
      if (inv.length === 0) {
        const searchAnchorRow =
          explicitSkuRows[0] ?? (shopLastSentProductAdvice ? lastConsultedRow : null) ?? null
        const inventorySearchMessage =
          searchAnchorRow &&
          (useLastConsultedContext || similarCatalogVersusLastConsulted || explicitSkuRows.length > 0)
            ? buildInventorySearchQueryWithLastConsulted(searchAnchorRow, latestCustomerMessage)
            : latestCustomerMessage
        inv = await fetchInventoryRowsForPartnerAi(partnerId, inventorySearchMessage, {
          budgetSourceMessage: latestCustomerMessage,
        })
      }
    }
    invForContext = inv
    if (selectedInventoryId && isPgConfigured() && explicitSkuRows.length === 0) {
      try {
        const sel = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, selectedInventoryId)
        if (sel) {
          selectedRowForEnrich = sel
          invForContext = [sel, ...inv.filter((r) => r.id !== sel.id)]
        }
      } catch (e) {
        console.warn('[partner-ai-llm] selected inventory PG failed', e)
      }
    }
    if (
      useLastConsultedContext &&
      lastConsultedRow &&
      explicitSkuRows.length === 0 &&
      !inboundPageSkuMissImageSimilarFallback
    ) {
      const lid = lastConsultedRow.id
      if (!invForContext.some((r) => r.id === lid)) {
        invForContext = [lastConsultedRow, ...invForContext.filter((r) => r.id !== lid)].slice(
          0,
          PARTNER_AI_INVENTORY_CONTEXT_LIMIT
        )
      }
    }
  }

  if (forceSingleRowContextFromWidgetIntent && invForContext.length > 1) {
    const forcedRow = contextReplySingleRow ?? invForContext[0] ?? null
    if (forcedRow) {
      invForContext = [forcedRow]
      selectedRowForEnrich = forcedRow
      if (explicitSkuRows.length > 0) explicitSkuRows = [forcedRow]
    }
  }

  if (cardConsultIsolatedThread && lastConsultedRow) {
    let row = lastConsultedRow
    if (isPgConfigured()) {
      try {
        const fresh = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, lastConsultedRow.id)
        if (fresh) row = fresh
      } catch (e) {
        console.warn('[partner-ai-llm] pre-enrich refresh row for card consult isolation', e)
      }
    }
    lastConsultedRow = row
    invForContext = [row]
    explicitSkuRows = [row]
    selectedRowForEnrich = null
  }

  const materialEnriched = await enrichInventoryRowsWithMaterialIfNeeded(partnerId, latestCustomerMessage, {
    explicitSkuRows,
    invForContext,
    selectedRow: selectedRowForEnrich,
  })
  explicitSkuRows = materialEnriched.explicitSkuRows
  invForContext = materialEnriched.invForContext
  selectedRowForEnrich = materialEnriched.selectedRow

  if (forceSingleRowContextFromWidgetIntent && invForContext.length > 1) {
    const forcedRow = contextReplySingleRow ?? selectedRowForEnrich ?? invForContext[0] ?? null
    if (forcedRow) {
      invForContext = [forcedRow]
      selectedRowForEnrich = forcedRow
      if (explicitSkuRows.length > 0) explicitSkuRows = [forcedRow]
    }
  }

  let materialDetailFollowup: PartnerMaterialDetailFollowup | null = null
  let realUseFollowup: PartnerRealUseImageFollowup | null = null
  let realUsePhotoLimitExceeded = false

  if (customerMessageAsksAboutRealUsePhoto(latestCustomerMessage)) {
    const realEnriched = await enrichInventoryRealUseImageIfNeeded(partnerId, conversationId, latestCustomerMessage, {
      explicitSkuRows,
      invForContext,
      selectedRow: selectedRowForEnrich,
      lastConsultedRow: useLastConsultedContext ? lastConsultedRow : null,
    })
    explicitSkuRows = realEnriched.explicitSkuRows
    invForContext = realEnriched.invForContext
    selectedRowForEnrich = realEnriched.selectedRow
    realUseFollowup = realEnriched.realUseFollowup
    realUsePhotoLimitExceeded = realEnriched.realUsePhotoLimitExceeded
  } else {
    const collageEnriched = await enrichInventoryMaterialDetailCollageIfNeeded(partnerId, latestCustomerMessage, {
      explicitSkuRows,
      invForContext,
      selectedRow: selectedRowForEnrich,
      lastConsultedRow: useLastConsultedContext ? lastConsultedRow : null,
    })
    explicitSkuRows = collageEnriched.explicitSkuRows
    invForContext = collageEnriched.invForContext
    selectedRowForEnrich = collageEnriched.selectedRow
    materialDetailFollowup = collageEnriched.materialDetailFollowup
  }

  /** Nhánh B: sau enrich vẫn chỉ một dòng kho neo — tránh LLM thấy nhiều dòng từ merge. */
  let inboundAnchoredConsultRow: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null
  if (inboundAnchoredProductConsultBranch && explicitSkuRows.length > 0) {
    inboundAnchoredConsultRow = explicitSkuRows[0]
    if (isPgConfigured()) {
      try {
        const fresh = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, inboundAnchoredConsultRow.id)
        if (fresh) inboundAnchoredConsultRow = fresh
      } catch (e) {
        console.warn('[partner-ai-llm] refresh inbound anchored consult row', e)
      }
    }
    invForContext = [inboundAnchoredConsultRow]
    explicitSkuRows = [inboundAnchoredConsultRow]
    /** Chỉ một nguồn dòng kho trong prompt — không thêm khối «chọn từ ảnh» / trùng lặp. */
    selectedRowForEnrich = null
  }

  if (cardConsultIsolatedThread && lastConsultedRow) {
    let row = lastConsultedRow
    if (isPgConfigured()) {
      try {
        const fresh = await fetchPartnerInventoryRowByIdForPartnerFromPg(partnerId, lastConsultedRow.id)
        if (fresh) row = fresh
      } catch (e) {
        console.warn('[partner-ai-llm] refresh row for card consult isolation', e)
      }
    }
    lastConsultedRow = row
    invForContext = [row]
    explicitSkuRows = [row]
    selectedRowForEnrich = null
    inboundAnchoredConsultRow = row
    inboundAnchoredProductConsultBranch = true
  }

  /** Gợi ý mẫu khác theo vector kho (không gọi LLM) — bỏ dòng neo, chỉ dòng build được thẻ. */
  let similarAlternativesTemplateInventoryRows: InvRow[] | null = null
  /** Neo mẫu gốc: vector ảnh (ưu tiên) hoặc SP khách chọn / vừa tư vấn khi vector không gán id. */
  const anchorIdForSimilarTemplate =
    similarCatalogAnchorRowId ??
    (similarCatalogVersusLastConsulted
      ? selectedRowForEnrich?.id ?? explicitSkuRows[0]?.id ?? lastConsultedRow?.id ?? null
      : null)
  if (
    similarCatalogVersusLastConsulted &&
    anchorIdForSimilarTemplate &&
    !inboundAnchoredProductConsultBranch &&
    !inboundPageSkuMissImageSimilarFallback &&
    !materialDetailFollowup &&
    !realUseFollowup
  ) {
    const altRows: InvRow[] = []
    for (const r of invForContext) {
      if (r.id === anchorIdForSimilarTemplate) continue
      if (partnerAiProductCardFromInventoryRow(r)) {
        altRows.push(r)
        if (altRows.length >= PARTNER_AI_PRODUCT_CARDS_MAX) break
      }
    }
    similarAlternativesTemplateInventoryRows = altRows.length > 0 ? altRows : null
  }

  if (selectedRowForEnrich) {
    selectedRowBlock = `\n\nMặt hàng khách đã CHỌN từ danh sách ảnh gợi ý (ưu tiên cao nhất, chỉ tư vấn theo hàng này nếu không có yêu cầu đổi mẫu):\n${formatInventoryLines([selectedRowForEnrich], invFmtOpts)}

Bắt buộc (khi khách chưa đổi sang mẫu khác): trả lời bằng cách **nêu ưu điểm / giá trị cho khách** — tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp mặc, dễ phối đồ… — diễn giải từ đúng các trường trong dòng kho (tên, mô tả, ghi chú tư vấn, chất liệu/kiểu nếu có); không chỉ đọc máy mã/giá. Không bịa công dụng y tế hay hứa hiệu quả tuyệt đối.`
  }

  const effectiveFollowUpSingleProductNoVector =
    followUpSingleProductNoVector && !inboundPageSkuMissImageSimilarFallback

  const transcript = cardConsultIsolatedThread
    ? formatPartnerAiCardConsultIsolatedTranscript()
    : effectiveFollowUpSingleProductNoVector ||
        inboundAnchoredProductConsultBranch ||
        inboundPageSkuMissImageSimilarFallback
      ? formatPartnerAiMinimalTranscriptForFollowUpContext(chronological)
      : formatPartnerAiTranscriptLines(chronological)

  let partnerPaymentPolicyBlock = ''
  if (isPgConfigured()) {
    try {
      const paySet = await fetchPartnerPaymentSettingsFromPg(partnerId)
      if (paySet) partnerPaymentPolicyBlock = buildPartnerPaymentPolicyBlockForPartnerAi(paySet)
    } catch (e) {
      console.warn('[partner-ai-llm] payment settings for system prompt', e)
    }
  }

  const policy = settings.shop_policy?.trim() || '(Shop chưa nhập chính sách.)'
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  const salesExtra = settings.sales_coaching_instructions?.trim() ?? ''
  const salesShopBlock =
    salesExtra.length > 0
      ? `

Chỉ dẫn bổ sung do shop tự nhập (ưu tiên phù hợp ngành hàng / đối tượng khách):
${salesExtra}`
      : ''

  const inChatBuyNowCtaBlock =
    normalizeGuestPurchaseFlow(settings.guest_purchase_flow) === 'in_chat'
      ? `
- **Đặt hàng trên chat (thẻ SP có nút «Mua ngay»):** Khi đã nêu chính sách cọc / quy trình mua **và** JSON có **thẻ sản phẩm** (trường \`products\` không rỗng) — **không** kết tin bằng câu hỏi kiểu «muốn lấy màu nào và size nào để shop báo giá cọc cụ thể», «cho em biết màu size để báo cọc» — vì màu, size và số cọc được **chọn/ xem trong form** sau khi bấm Mua ngay. Hãy kết bằng **một câu ngắn, dễ hiểu**: khách **bấm «Mua ngay»** trên thẻ rồi **điền thông tin nhận hàng và hoàn tất đơn** (có thể diễn đạt gọn: «bấm Mua ngay và hoàn thành đơn hàng»). Chỉ hỏi màu/size trực tiếp trong **message** khi **không** gửi thẻ, hoặc khi khách hỏi tư vấn chưa định đặt.`
      : ''

  /** Khối mặc định — luôn có; shop mở rộng qua `sales_coaching_instructions` + chính sách. */
  const khoContextInstructionForSystem = cardConsultIsolatedThread
    ? `[Tư vấn từ thẻ — **cô lập** khỏi lịch sử thread]
Phần user prompt **không** chứa lịch sử chat thật — chỉ hướng dẫn + **một dòng kho** + **tin mới nhất của khách**. **Cấm** bám chủ đề/đoạn chat cũ (vd. đã hỏi túi rồi váy…) dù khách lỡ nhắn nhảy sang loại hàng khác: **chỉ** tư vấn theo **đúng dòng kho** (đúng mã/SP từ thẻ). Nếu khách hỏi hàng **khác ngành / khác mã**, trả lời ngắn: đang hỗ trợ **đúng mẫu trong kho**; mời hỏi tiếp về **mẫu đó** hoặc **bấm Tư vấn** trên thẻ sản phẩm khác. Trong JSON: \`products\` tối đa **một** thẻ — đúng dòng kho, hoặc \`[]\` nếu chỉ trả lời chữ.`
    : inboundAnchoredProductConsultBranch
      ? `[Nhánh B — Tin từ **trang sản phẩm shop đang xem** + mã **Mã SP / SKU trên trang** (vd. A6009) và/hoặc \`inventory_id\` trong payload; khách có thể **gửi kèm ảnh** cùng mặt hàng đó.]
Câu kiểu «da gì / chất liệu gì / vải gì» = hỏi **đúng mã đó trong kho shop**, không phải hỏi chung cả cửa hàng. **Ảnh đính kèm** và **lịch sử hội thoại** chỉ là ngữ cảnh — **sự thật catalog** là **tên, mô tả, chất liệu/ghi chú trong một dòng kho** duy nhất dưới đây; **cấm** mô tả kiểu dáng hoặc chất liệu **mâu thuẫn** dòng kho (vd. kho ghi túi da bò mà nói «váy đuôi cá voan», «lông thú» là sai).
Phần «Danh sách kho» trong prompt user là **đúng một dòng** — **chính** mã/link đang hỏi; **không** nhét thêm dòng kho khác, **không** lặp cùng mặt hàng ở nhiều khối; **không** phải kết quả vector trên toàn kho. Trong JSON: \`products\` tối đa **một** thẻ — copy đúng từ dòng kho, hoặc \`[]\` nếu chỉ cần trả lời chữ.`
    : inboundPageSkuMissImageSimilarFallback
      ? `[Trang / mã khách đang xem **không** có dòng tương ứng trong kho. Phần «Danh sách kho» là **ứng viên gần giống theo ảnh** (vector trên kho — đã lọc thô cùng nhóm khi có). Nói thật với khách: chưa có đúng mã đó trong dữ liệu shop; đây là **mẫu tương tự để tham khảo**. Trong JSON: \`products\` có thể **nhiều** thẻ hợp lý từ danh sách — **không** khẳng định có đúng mã/link trên trang nếu không nằm trong dòng kho.`
    : similarCatalogVersusLastConsulted
      ? `[Nhánh A — Gợi ý **mẫu / loại / kiểu khác** hoặc **tương tự / gần giống** (cùng nhóm ý: «có mẫu khác không», «còn loại khác không», «xem thêm mẫu», «na ná», «design khác»…). **Nhánh riêng** — không áp quy tắc khóa **một dòng kho** của Nhánh B; không xử như chỉ hỏi thuộc tính một SP. Danh sách kho trong user prompt là ứng viên **cùng nhóm** với mẫu neo (vector ảnh + lọc thô); trong JSON \`products\` có thể **nhiều** thẻ (thường 4–8 khi kho có), **không** carousel lệch ngành.`
    : effectiveFollowUpSingleProductNoVector
    ? `Trong prompt user, phần «Danh sách kho» chỉ có **đúng một dòng** — sản phẩm shop/AI **vừa tư vấn**; **không** phải kết quả tìm (vector/embedding) trên toàn kho. Nhiệm vụ của bạn: **đọc câu hỏi khách** và trả lời bằng cách **phân tích trực tiếp** các trường trên dòng đó (tên, mô tả, giá, màu, tồn, ghi chú…). Không xử lý như khách đang lần đầu tìm hàng hay cần gợi ý nhiều mẫu.`
      : explicitSkuRows.length > 0
        ? `Trong prompt user, phần «Danh sách kho» đã được **neo theo mã/SKU** (tin khách hoặc trang sản phẩm đang xem); **không** phải kết quả tìm rộng (vector) trên toàn kho. Chỉ tư vấn theo các dòng khớp mã; không lẫn sang mẫu khác, không gợi ý carousel nhiều thẻ thay thế trừ khi khách chủ động muốn xem thêm hoặc so sánh.`
        : `Danh sách kho trong prompt user đã được hệ thống lấy bằng **khớp từ khóa + vector** theo đúng tin khách (kể cả nam/nữ); dùng để tư vấn.`

  const cardConsultIsolationSystemAddendum = cardConsultIsolatedThread
    ? `
[Luật cô lập từ thẻ — **ghi đè** quy tắc «đổi chủ đề» chung khi mâu thuẫn]
Đang trong phiên **Tư vấn từ thẻ**: **không** ưu tiên đổi sang ngành/loại hàng theo tin mới nhất nếu đó **lệch** với **một dòng kho** duy nhất đã cho — xử như khách đang **cùng phiên tư vấn mẫu đó**; nhắc khéo và giữ đúng dữ liệu kho.
`
    : ''

  const salesDefaultBlock = `
Hướng tư vấn tăng khả năng mua (mềm, không ép, không spam):
- Khi tư vấn dựa trên **thông tin sản phẩm có trong kho** (tên, mô tả, ghi chú tư vấn, mã, giá, tồn…): đừng chỉ liệt kê thông số — hãy diễn giải thành **ưu điểm và lợi ích cho khách**: mặc lên tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp (tiệc, đi làm, hằng ngày…), dễ phối đồ hoặc thoải mái khi sử dụng — luôn bám sát dữ liệu thật trong kho; không phóng đại, không khẳng định y học, giảm cân, trị bệnh hay hiệu quả tuyệt đối.
- Khi đã nêu đủ thông tin sản phẩm từ kho, có thể gợi ý nhẹ bước tiếp (size/màu, hoặc chiều cao–cân nặng nếu cần) — **không** ra lệnh, **không** hối chốt. Ưu tiên để khách **tự suy nghĩ**; mời thao tác trên giao diện (đặt hàng, xem thẻ) chỉ khi tự nhiên phù hợp ngữ cảnh.
- **Không** lặp lại cùng kiểu câu hỏi chốt màu/size kiểu "chị chọn hồng hay đen ạ?", "đã chọn được màu chưa?" ở **nhiều tin liên tiếp** — dễ gây cảm giác ép mua. Nếu đã gợi ý một lần, các tin sau **tập trung trả lời đúng câu hỏi** của khách; chỉ nhắc màu/size khi khách hỏi hoặc khi thật cần để tư vấn tiếp.
- Giảm do dự: có thể nhắc một dòng về đổi trả / giao hàng / thanh toán CHỈ khi đã có trong chính sách shop ở trên; không bịa thêm.
- **Cọc vs thanh toán khi nhận (trả toàn bộ lúc nhận / COD 100%):** Mỗi câu trả lời phải **khớp** (1) chính sách shop, (2) khối **[Thanh toán (cài đặt hệ thống shop)]** nếu xuất hiện, (3) cách tư vấn **đã gửi gần đây** về **đúng mặt hàng** (dòng kho / thẻ / lịch sử cùng sản phẩm). Nếu mặt hàng/phiên tư vấn đang thống nhất **có cọc** mà khách hỏi trả toàn bộ lúc nhận — **không** hứa trả 100% khi giao; giải thích **cọc trước** và phần còn lại (nếu chính sách/shop quy định) theo **đúng sản phẩm** đang bàn, **không** hợp thức hóa từ món khác.
- **Chính sách đổi size / đổi hàng (tiếng Việt — tránh nhầm từ):** Khi diễn đạt, phân biệt rõ: (1) **Không vừa size** = số đo/size không khớp (chật, rộng, sai size so với bảng size / thực tế mặc) — mới là căn cứ **đổi size** theo chính sách shop (nếu shop có ghi). (2) **Không vừa ý** = không thích màu, form, phối đồ, cảm nhận thẩm mỹ, «mặc không ưng» theo nghĩa rộng **nhưng vẫn đúng size** — **không** gọi là «chưa vừa size», **không** hứa đổi size cho trường hợp này trừ khi chính sách shop nêu rõ. Không dùng chung một cụm kiểu «mặc không vừa ý thì đổi size» để gộp cả hai ý.
- **Hủy đơn / hoàn cọc / trả tiền cọc:** Khi khách đòi hủy đơn hoặc hoàn cọc, **không** đồng ý ngay, **không** hứa «shop sẽ hủy và hoàn tiền» / «xử lý hoàn cọc» một cách dễ dãi trừ khi **chính sách shop ở trên** ghi rõ được phép và điều kiện. Ưu tiên **giữ đơn**; trả lời **khéo, ấm** — nêu **khó khăn / ràng buộc** theo đúng chính sách **chỉ khi đã có trong chính sách**, không bịa điều khoản; không cam kết số tiền / thời hạn hoàn cụ thể nếu không có trong dữ liệu đã cho. Có thể gợi phương án trong phạm vi shop cho phép (đổi size, đổi mẫu…) nếu chính sách có — **không** đề nghị «chuyển lên bộ phận quản lý», «chuyển lên chủ shop xem xét», «shop xem xét lại rồi báo» hay hỏi «chị có muốn shop làm vậy không» trừ khi **chính sách shop** tự ghi rõ quy trình escalate (hiếm); mặc định **không** mở lối thoát quản lý.
- **Khách băn khoăn / lo lắng về đặt cọc (chưa đòi hủy rõ):** Thể hiện **đồng cảm** (hiểu chị có thể chưa thoải mái khi đặt cọc). Giải thích ngắn lý do cọc / thời gian hàng **theo chính sách & kho** đã có — **không** hứa nới lỏng hay thay đổi chính sách. Kết thúc nhẹ: chúc chị **sớm chọn được / mua được** món **ưng ý** (có thể là mẫu đang xem hoặc chung chung), **không** kèm câu hỏi kiểu «có muốn shop chuyển lên quản lý / xem xét không ạ».
- Nhấn mạnh giá trị (phù hợp dáng, dịp mặc, chất liệu) thay vì ép mua; tránh nhiều câu hỏi trong một tin — tối đa một lời mở / gợi ý nhẹ, không xếp hàng nhiều câu hỏi.
- Không hứa giảm giá hay khuyến mãi ngoài chính sách đã cho.${inChatBuyNowCtaBlock}${salesShopBlock}`

  const system = `${partnerAiOpeningLanguageLine(effectiveLocaleOpts)}${partnerAiWidgetTargetRoutingLine(effectiveLocaleOpts)}
Giọng điệu: ${tone}${partnerAiMessagingStyleLine(effectiveLocaleOpts)}${partnerAiAddressingPriorityLine(effectiveLocaleOpts)}
${PARTNER_AI_TRANSCRIPT_READING_CONVENTION}
${PARTNER_AI_ALTERNATIVE_MODEL_QUERY_DOCTRINE}
Tuân thủ nghiêm các quy tắc / chính sách sau (không bịa điều không có trong dữ liệu):
${policy}${partnerPaymentPolicyBlock}
${salesDefaultBlock}
${khoContextInstructionForSystem}${cardConsultIsolationSystemAddendum} Chỉ giới thiệu sản phẩm từ danh sách đó. Khi giới thiệu hoặc so sánh mặt hàng cụ thể, ưu tiên nói **lợi ích cho khách** (thẩm mỹ, độ phù hợp, sự thoải mái…) xuất phát từ thông tin trong kho, không chỉ đọc giá/mã. Nếu không có đúng sản phẩm trong danh sách, nói rõ chưa thấy thông tin khớp và chuyển hướng tư vấn: hỏi khách có muốn xem sản phẩm tương tự đang có trong kho không.
Khi khách hỏi về chất liệu/vải/vật liệu: ưu tiên trả lời theo trường "Chất liệu (đã lưu/kho)" hoặc mô tả/ghi chú trong dòng kho nếu có; không bịa chất liệu ngoài dữ liệu đã cho.
Trong mỗi dòng kho, **ảnh chính sản phẩm (URL)** là ảnh gốc shop khai báo; hệ thống dùng đúng ảnh đó làm nguồn để tạo (1) ảnh chi tiết chất liệu/màu và (2) ảnh **đời thường / góc tự nhiên** (nhìn sản phẩm chân thực) — không dùng ảnh khác làm nguồn, và **không** gọi các ảnh sinh ra là "ảnh tham khảo" khi nói với khách.
Nếu trong kho có "Ảnh chi tiết chất liệu/màu (đã lưu)" kèm URL, đó là ảnh phóng chi tiết chất liệu/màu **sinh từ ảnh chính** — nhắc khách xem ảnh đính kèm (không cần dán lại URL trong message).
Khi khách hỏi ảnh chụp thực tế / mặc thật / dùng thật: nếu kho có mục **Ảnh đời thường — nhìn sản phẩm chân thực (đã lưu)** kèm URL — đó là ảnh được tạo từ **ảnh chính** theo phong cách **đời thường, góc tự nhiên** để khách **xem sản phẩm chân thực** (không phải ảnh studio); trong **tin gửi khách** giữ giọng thống nhất với chú thích hệ thống (ảnh đời thường / góc tự nhiên / nhìn sản phẩm chân thực), **không** gọi là "ảnh tham khảo", **không** tự nói "ảnh AI" hay "ảnh phần mềm tạo". Không khẳng định ảnh chụp tại showroom/shop trừ khi dữ liệu kho ghi rõ. Khi khách vừa xem thẻ sản phẩm và hỏi ảnh thực tế — mặc định hiểu đúng mẫu đó; không bảo "không có ảnh" nếu hệ thống đang hoặc sắp gửi kèm ảnh. Trong một cuộc chat, tối đa hai ảnh loại này cho cùng một mặt hàng; không hứa gửi thêm khi đã đủ.
Khi tin khách **ngắn** và chỉ hỏi thuộc tính (màu, size, tồn, giá, ship…) **mà không nêu tên/mã sản phẩm mới**: mặc định hiểu là đang hỏi về **mặt hàng shop vừa giới thiệu** trong lịch sử gần hoặc khối «mặt hàng đang thảo luận / đã chọn» nếu có — không trả lời như câu hỏi độc lập không có ngữ cảnh.
Khi khách **đổi chủ đề / loại hàng** (vd. vừa xem váy lại hỏi giày, dép, túi…): ưu tiên **đúng ngành đang hỏi trong tin hiện tại** và danh sách kho phù hợp tin đó — không kéo carousel mẫu cũ hay câu «chọn sản phẩm» như thể chưa đổi ý.
Khi khách hỏi một loại hàng mới (vd. «shop có túi xách không») mà **Danh sách kho không có dòng cùng loại đó**: chỉ nói theo dữ liệu hiện tại kiểu **«em chưa thấy túi xách trong kho/dữ liệu hiện tại»**. **Cấm** tự kết luận «shop chuyên về váy/đầm/áo/thời trang» hoặc liệt kê ngành hàng shop đang chuyên nếu chính sách/shop không ghi rõ. Chỉ gợi ý loại khác khi khách hỏi mở hoặc khi thật tự nhiên, và không gửi thẻ khác ngành.
Khi khách nêu **nam** hoặc **nữ** (đồ nam / đồ nữ): chỉ gợi ý mặt hàng **cùng đối tượng** trong **products** — không đưa váy/đầm nữ khi khách hỏi đồ nam và ngược lại trừ khi mặt hàng ghi **unisex** rõ trong kho.
Khi khách hỏi tìm hàng theo thuộc tính (ví dụ: loại hàng, màu, kiểu dáng, chất liệu, chiều cao gót, khoảng giá), hãy chủ động đề xuất mặt hàng phù hợp từ danh sách kho (nếu có) trong mảng products — thường **4–8** mẫu khi kho có đủ, tối đa **${PARTNER_AI_PRODUCT_CARDS_MAX}** mẫu trong một tin; tránh chỉ trả lời chung chung khi trong kho vẫn có lựa chọn liên quan.
Nếu không có "khớp tuyệt đối", vẫn ưu tiên đưa các mẫu "khớp gần" đang có trong kho vào products để khách chọn tiếp — **nhưng "khớp gần" phải cùng nhóm/nhu cầu với điều khách đang hỏi** (cùng loại sản phẩm hoặc dùng thay thế hợp lý: ví dụ khách hỏi dép lê/giày dép mà kho không có đúng mẫu → chỉ gợi ý các mẫu giày/dép/sandal/dép nam nữ khác trong kho; **không** đưa ba lô, túi xách, ví, phụ kiện không liên quan chỉ vì tên có từ khóa trùng hoặc vì nằm đầu danh sách kho). Chỉ gợi ý ngành hàng khác khi khách **chủ động** hỏi rộng (ví dụ "shop còn gì hot") hoặc đã chuyển sang nhu cầu khác.
Khi đã có products khác rỗng, message phải thật ngắn (1-2 câu), không liệt kê chi tiết từng mẫu, không bullet dài; có thể mở nhẹ (khách xem thẻ/ảnh khi muốn), **không** ép chọn mẫu hay chốt màu ngay.
Khi giới thiệu mặt hàng có "Ảnh (URL)" và/hoặc "Trang sản phẩm (URL)" trong kho, đưa ảnh và link trang vào mảng products trong JSON đầu ra (khách sẽ thấy thẻ sản phẩm có ảnh và giá). Không dán URL ảnh hay URL trang sản phẩm dạng chữ trong trường message nếu đã khai báo đủ trong products.
Nếu trong tin nhắn khách hoặc ngữ cảnh hệ thống có dòng [Customer product SKU: …], đó là mã sản phẩm khách vừa chọn — ưu tiên tư vấn đúng mặt hàng khớp mã trong kho (xem khối "mặt hàng khớp mã/SKU" nếu có). Không đề xuất nhiều thẻ/carousel mẫu khác thay thế trừ khi khách muốn xem thêm hoặc so sánh.
Định dạng đầu ra: một đối tượng JSON đúng schema ở cuối prompt user — không bọc markdown, không giải thích ngoài JSON.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trường \`message\` trong JSON: **súc tích**, đúng ý khách; có thể gạch đầu dòng khi cần — **không** văn mẫu kiểu chatbot, **không** tự giới thiệu vai trò kỹ thuật.
Giọng tư vấn **mở, nhẹ** (như nhân viên thật): ưu tiên làm rõ lo lắng / nhu cầu khi cần; tránh hối mua hoặc bắt chọn màu–size trong mọi tin. Đọc lịch sử — nếu vừa hỏi khách chọn màu (hoặc tương tự) gần đây thì **đừng** lặp lại; chuyển sang trả lời nội dung khách đang hỏi hoặc bổ sung thông tin hữu ích.`

  const explicitSkuBlock =
    inboundAnchoredProductConsultBranch || !explicitSkuRows.length
      ? ''
      : `\n\nCác mặt hàng khớp chính xác mã/SKU khách vừa nhắn (ưu tiên kiểm tra nhóm này trước):
${formatInventoryLines(explicitSkuRows, invFmtOpts)}`

  const inventoryFollowupAugmented = useLastConsultedContext
  const conversationFocusBlock =
    inboundAnchoredProductConsultBranch && explicitSkuRows.length > 0
      ? `\n\n[Nhánh B — bắt buộc — chỉ **một** dòng kho ở phần «Danh sách kho» phía trên (mã/link đang xem). Hỏi chất liệu = **chỉ** căn cứ các trường dòng đó — **không** lẫn nhánh A hay tìm rộng. **Cấm** mô tả loại/chất liệu trái dòng kho. Trong JSON: **products** **0 hoặc 1** — **cấm** carousel.]`
      : inboundPageSkuMissImageSimilarFallback
        ? `\n\n[Bắt buộc — mã/link trên trang không có trong kho; danh sách kho là **gợi ý theo ảnh**. Message: nói rõ đang giới thiệu mẫu **tương tự / gần giống** trong kho (không bảo chắc là đúng mã trang). JSON **products**: nhiều thẻ hợp lệ từ danh sách — chỉ mặt hàng **cùng nhóm**; **cấm** lệch ngành.]`
      : similarCatalogVersusLastConsulted && similarIntentHasUsableThreadAnchor
        ? `\n\n[Nhánh A — bắt buộc — ý khách là **mẫu / loại / kiểu khác** hoặc **tương tự / gần giống** (nhánh riêng; **không** gộp với Nhánh B). Danh sách kho trong prompt là ứng viên **cùng nhóm** với mẫu neo (vector + lọc). Trong JSON: điền **nhiều** \`products\` hợp lý (4–8 khi kho có), **cấm** lệch ngành.`
      : explicitSkuRows.length > 0 && !similarCatalogVersusLastConsulted
      ? `\n\n[Ngữ cảnh bắt buộc — neo mã/SKU khách đã chọn (tin nhắn hoặc trang đang xem), không phải tìm rộng trên cả kho]
${formatInventoryLines(explicitSkuRows, invFmtOpts)}
Trả lời đúng theo **các dòng kho khớp mã** ở trên. Trong JSON: **products** chỉ được **không quá 1** phần tử — nếu cần thẻ thì **chỉ** mặt hàng khớp mã (copy name/image_url/product_url/price_hint/sku từ dòng kho). **Cấm** điền nhiều mẫu lạc mã, **cấm** carousel gợi ý mẫu khác thay thế. Trong **message** không bảo khách «chọn sản phẩm» như thể chưa chọn mẫu. Chỉ để products = [] nếu không cần gửi lại thẻ.`
      : inventoryFollowupAugmented && lastConsultedRow && !similarCatalogVersusLastConsulted
        ? `\n\n[Ngữ cảnh bắt buộc — tin khách gần như chắc chắn là hỏi tiếp về mặt hàng này, không phải tìm sản phẩm mới]
${formatInventoryLines([lastConsultedRow], invFmtOpts)}
Trả lời đúng theo **toàn bộ** dòng kho trên: tên, mô tả, ghi chú, và dòng «Màu sắc (trích từ tên/mô tả/ghi chú kho)» nếu có — đó là nguồn màu đúng cho câu «có màu gì» / «còn màu nào» (không đoán ngoài kho).
Trong JSON: **products** chỉ được **không quá 1** phần tử — nếu cần thẻ thì **chỉ** đúng mặt hàng trên (copy name/image_url/product_url/price_hint/sku từ dòng kho). **Cấm** điền nhiều mẫu, **cấm** carousel gợi ý mẫu khác. Trong **message** không được bảo khách «chọn sản phẩm», «chọn mẫu ưng ý», hay như thể khách chưa đang xem sản phẩm nào — khách đang hỏi tiếp về đúng mẫu này. Chỉ để products = [] nếu không cần gửi lại thẻ (trả lời thuần chữ đủ).`
        : ''

  const followUpSnapshotBlock =
    !cardConsultIsolatedThread &&
    !inboundAnchoredProductConsultBranch &&
    lastConsultedRow &&
    !similarCatalogVersusLastConsulted &&
    !inboundPageSkuMissImageSimilarFallback &&
    customerMessageIsFollowUpContextQuery(latestCustomerMessage, {
      visionInventorySelected: Boolean(selectedInventoryId) && !followUpStyleMessage,
    })
      ? followUpConsultationSnapshotBlock(latestCustomerMessage, lastConsultedRow, invFmtOpts)
      : ''

  const userInventoryPreamble = effectiveFollowUpSingleProductNoVector
    ? `[Chế độ hỏi tiếp — không tạo vector trên cả kho]
Dưới đây là **toàn bộ dữ liệu kho** của **một** sản phẩm — đúng mặt hàng shop/AI **vừa tư vấn gần nhất**. Kết hợp **câu hỏi của khách** (cuối prompt) với **từng trường** trong dòng kho để trả lời (màu, size, giá, tồn…). Đây **không** phải danh sách ứng viên từ tìm kiếm vector; không tư vấn như khách đang lần đầu vào shop.

`
    : inboundPageSkuMissImageSimilarFallback
      ? `[Trang SP / mã khách đang xem **chưa** khớp dòng kho. Danh sách dưới đây là **ứng viên tương tự** do hệ thống so **ảnh** với ảnh trong kho (vector, có lọc thô cùng nhóm). Trả lời gọn: chưa có đúng mã trong kho nếu đúng như vậy; mời khách xem các mẫu gần giống (thẻ **products**).

`
    : similarCatalogVersusLastConsulted && similarIntentHasUsableThreadAnchor
      ? `[Nhánh A — gợi ý **mẫu / loại khác** (nhánh riêng, **không** gộp với Nhánh B). Quy về một ý: thay thế hợp lý cho **mẫu đang neo** (tin Shop vừa gửi thẻ/mã, hoặc SP kèm tin khách / page_context). Danh sách kho bên dười do hệ thống lấy (thường có vector ảnh + lọc cùng nhóm). Trả lời ngắn rồi đưa **nhiều thẻ** (4–8 nếu kho có) trong JSON **products** — **cùng nhóm** với mẫu neo; không lệch ngành.

`
    : inboundAnchoredProductConsultBranch
      ? `[Nhánh B — prompt chỉ chứa **một dòng kho** đúng **Mã SP / link** đang hỏi; mọi câu trả lời thuộc tính (da, chất liệu…) bám **duy nhất** dòng đó.

`
    : explicitSkuRows.length > 0 && !similarCatalogVersusLastConsulted
        ? `[Neo mã sản phẩm — danh sách kho bên dười chỉ gồm mặt hàng **khớp mã/SKU** (từ tin khách hoặc trang sản phẩm đang xem). **Không** phải kết quả tìm vector trên toàn kho; khi điền **products**, tối đa **một** thẻ đúng mã đang thảo luận.

`
        : `Danh sách kho (do shop khai báo; có thể không đầy đủ so với toàn bộ hàng thực tế). Các dòng đầu là mặt hàng được ưu tiên theo mã/tên/từ khóa gần với tin nhắn khách (nếu có), sau đó là các mặt hàng còn lại theo thứ tự shop sắp xếp — tất cả đều có thể dùng để tư vấn; khi chọn mặt hàng đưa vào JSON **products**, vẫn phải **lọc theo đúng chủ đề khách đang hỏi** (đừng chọn mặt hàng chỉ vì xuất hiện sớm trong danh sách nếu khác ngành hàng).

`

  const transcriptSectionLabel = cardConsultIsolatedThread
    ? 'Ngữ cảnh tư vấn (cô lập — không dùng lịch sử chat thật; câu khách thật nằm ở «Tin nhắn mới nhất của khách»)'
    : effectiveFollowUpSingleProductNoVector || inboundAnchoredProductConsultBranch || inboundPageSkuMissImageSimilarFallback
      ? 'Ngữ cảnh hội thoại (tối giản — chỉ một tin shop gần nhất trước câu khách; câu khách ở mục sau)'
      : 'Lịch sử hội thoại gần đây'

  const guestProfilePromptBlock =
    !cardConsultIsolatedThread && guestProfileBlockForAi ? `${guestProfileBlockForAi}\n\n` : ''

  const user = `${partnerAiUserPromptOutputLanguageBanner(effectiveLocaleOpts)}${buildPartnerAiWarehouseVndPricingNote(effectiveLocaleOpts)}${guestProfilePromptBlock}${userInventoryPreamble}${formatInventoryLines(invForContext, invFmtOpts)}
${explicitSkuBlock}
${selectedRowBlock}

${transcriptSectionLabel}:
${transcript}
${conversationFocusBlock}${followUpSnapshotBlock}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}
${
  realUsePhotoLimitExceeded
    ? `

[Tình huống bắt buộc] Khách đã được gửi đủ 2 ảnh đời thường / góc tự nhiên (theo khung shop) cho đúng mặt hàng đang thảo luận trong cuộc chat này. Trong JSON: trả lời ngắn, lịch sự — bên em chỉ có thể gửi tối đa 2 ảnh loại này cho mặt hàng đó; không hứa thêm ảnh. Không cần xin lỗi dài; trong message **không** nói "ảnh AI" nếu đang dùng giọng thống nhất chú thích (ảnh đời thường, nhìn sản phẩm chân thực).
Vẫn điền mảng **products** với đúng mặt hàng đang bàn (name, image_url, product_url, price_hint, sku nếu có trong danh sách kho) để giao diện hiển thị thẻ sản phẩm với nút «Xem chi tiết» và «Mua hàng»; phần message chỉ cần giải thích đã gửi đủ ảnh (theo giới hạn), không nhét URL ảnh nếu đã có trong products.`
    : ''
}
${
  realUseFollowup?.publicUrl && !realUsePhotoLimitExceeded
    ? `

[Chú ý hệ thống] Tin này sẽ kèm ảnh **đời thường, góc tự nhiên** (theo chú thích giao diện — nhìn sản phẩm chân thực), **sinh từ ảnh chính sản phẩm** của mặt hàng đang tư vấn trong kho — không phải ảnh tham khảo độc lập. Trong JSON: mời khách xem ảnh đính kèm; giữ giọng thống nhất với chú thích đó; không nói shop "không có ảnh thực tế" hay "chưa có ảnh chụp" cho đúng mẫu đang bàn; không tự tiết lộ "ảnh AI" trong message.`
    : ''
}
${
  visionCatalogNoHitsFromTrigger(triggerRawPayload)
    ? `

Tình huống bổ sung (bắt buộc xử lý đúng): Tin kích hoạt này kèm ảnh từ khách và shop đã bật tìm sản phẩm theo ảnh, nhưng hệ thống không tìm được mặt hàng tương ứng trong kho (không có ứng viên). Hãy soạn một tin trả lời ngắn, lịch sự:
- Chào hỏi (có thể xưng hô phù hợp giọng shop).
- Cảm ơn khách đã gửi ảnh.
- Nói rõ hiện chưa có mẫu khớp trong dữ liệu kho (không nói “lỗi kỹ thuật” trừ khi có lý do rõ).
- Chủ động hỏi khách có muốn xem các mẫu tương tự đang có bên shop không, và mời khách nêu nhu cầu (màu/size/mức giá).
- Không bịa tên hay giá sản phẩm; không hứa chắc còn hàng nếu không có trong danh sách kho.`
    : ''
}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text, có thể xuống dòng; không nhét URL ảnh/trang sản phẩm nếu đã có trong products). Khi đang tư vấn chi tiết theo dữ liệu kho, ưu tiên nêu ưu điểm/lợi ích cho khách như trên — có thể vài câu có gạch đầu dòng, không chỉ đọc thông số.","products":[]}
products là mảng, tối đa ${PARTNER_AI_PRODUCT_CARDS_MAX} phần tử. Khi giới thiệu mặt hàng từ danh sách kho có ảnh hoặc trang sản phẩm, mỗi phần tử:
{"name":"tên ngắn (có thể gồm mã/SKU)","image_url":"https://...","product_url":"https://...","price_hint":"199.000đ (tuỳ chọn, copy từ cột Giá trong kho nếu có)","sku":"mã trong kho (tuỳ chọn; nếu có thì khách bấm Tư vấn sẽ gửi đúng mã)"}
Chỉ dùng URL http(s) đúng như trong dữ liệu kho; không bịa link. image_url và product_url bắt buộc là chuỗi URL hợp lệ.
Ưu tiên để products có dữ liệu khi trong kho có mặt hàng gần với nhu cầu khách (**cùng nhóm sản phẩm / cùng mục đích dùng** — màu/kiểu lệch một chút vẫn được), kể cả khi không khớp tuyệt đối; **không** lấp đầy products bằng mặt hàng khác ngành (ví dụ đang hỏi dép mà đưa túi xách).
Khi products có phần tử: message không được liệt kê từng tên sản phẩm; chỉ xác nhận ngắn gọn, có thể gợi ý khách xem thẻ khi cần — **không** dùng template ép "chọn màu" / "đã chọn màu chưa" lặp lại nếu trong hội thoại vừa có câu tương tự.
Chỉ để products = [] khi thực sự không tìm được mặt hàng phù hợp hoặc gần phù hợp trong danh sách kho.`

  return {
    system,
    user,
    materialDetailFollowup,
    realUseFollowup,
    useLastConsultedContext,
    lastConsultedRow: forceSingleRowContextFromWidgetIntent ? contextReplySingleRow : lastConsultedRow,
    similarCatalogVersusLastConsulted,
    clarifyShoppingIntent: false,
    forceSingleRowContextReply: forceSingleRowContextFromWidgetIntent,
    inboundAnchoredProductConsultBranch,
    inboundAnchoredConsultRow,
    inboundPageSkuMissImageSimilarFallback,
    similarAlternativesTemplateInventoryRows,
    partnerAiRouteIntent,
  }
}

export type DeepseekPartnerChatUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export type DeepseekPartnerChatResult = {
  text?: string
  error?: string
  model?: string
  usage?: DeepseekPartnerChatUsage
}

type DeepseekPartnerChatTelemetry = {
  feature?: string
  userId?: string | null
}

/** Đủ chỗ cho JSON nhiều thẻ SP (URL dài); 1100 cũ hay cắt giữa chừng → chỉ còn 3–5 mặt hàng. */
function deepseekPartnerAiMaxTokens(): number {
  const raw = process.env.DEEPSEEK_PARTNER_AI_MAX_TOKENS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 8192
  if (!Number.isFinite(n) || n < 512) return 8192
  return Math.min(16384, Math.max(512, Math.floor(n)))
}

export async function deepseekPartnerChat(
  system: string,
  user: string,
  telemetry?: DeepseekPartnerChatTelemetry
): Promise<DeepseekPartnerChatResult> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'DEEPSEEK_API_KEY not configured.' }
  const model = 'deepseek-chat'
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: deepseekPartnerAiMaxTokens(),
        temperature: 0.35,
      }),
    })
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: DeepseekPartnerChatUsage
      error?: { message?: string }
    }
    if (!res.ok) {
      return { error: json?.error?.message || res.statusText || 'DeepSeek error' }
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return { error: 'Empty model output' }
    if (telemetry?.feature) {
      trackOpenAiStyleCompletionUsage({
        userId: telemetry.userId ?? null,
        model,
        feature: telemetry.feature,
        usage: json.usage,
        fallbackPromptChars: system.length + user.length,
        fallbackOutputChars: text.length,
      })
    }
    return { text, model, usage: json.usage }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'DeepSeek fetch failed' }
  }
}

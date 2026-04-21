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
  customerMessageWantsSimilarCatalogVersusLastConsulted,
  fetchInventoryRowsByExplicitSku,
  fetchInventoryRowsForPartnerAi,
  fetchInventoryRowsFromPageContextSku,
  fetchInventoryRowsFromProductCardConsultPageContext,
  PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
  customerMessageIsFollowUpContextQuery,
  inboundTextLooksLikeFollowUpConsultHeuristic,
  shouldAugmentInventorySearchWithLastConsulted,
} from '@/lib/messaging/partner-inventory-ai-search'
import { fetchInventoryRowsSimilarToAnchorProductImage } from '@/lib/messaging/partner-gemini-image-search'
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
import { PARTNER_AI_PRODUCT_CARDS_MAX } from '@/lib/messaging/partner-ai-product-cards'
import {
  partnerAiInboundNeedsShoppingIntentClarify,
  parsePartnerAiWidgetIntentFromPayload,
  partnerAiShouldUseClarifyBranchFromWidgetPayload,
} from '@/lib/messaging/partner-ai-unclear-intent'

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

/**
 * Chỉ dùng khi **hỏi tiếp theo ngữ cảnh SP vừa tư vấn** (`followUpSingleProductNoVector`):
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

function buildPartnerAiClarifyShoppingIntentSystem(
  settings: SettingsRow,
  effectiveLocaleOpts: { channel?: string | null; uiLocale?: string | null } | undefined
): string {
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  return `${partnerAiOpeningLanguageLine(effectiveLocaleOpts)}${partnerAiWidgetTargetRoutingLine(effectiveLocaleOpts)}
Giọng điệu: ${tone}${partnerAiMessagingStyleLine(effectiveLocaleOpts)}

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
  latestCustomerMessage: string
): string {
  return `${partnerAiUserPromptOutputLanguageBanner(effectiveLocaleOpts)}Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text)","products":[]}
products **phải** là [] (rỗng). Không thêm trường khác.
Trong \`message\`: **không** hỏi khắc phục lỗi truy cập web/app; hướng khách **nêu nhu cầu tư vấn sản phẩm** (ảnh hoặc tên loại). Nếu khách xưng **anh** → ví dụ chỉ **đồ nam**; nếu **chị/em** → ví dụ **đồ nữ**; không lẫn ví dụ nam/nữ sai xưng hô.`
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
  /** Hỏi mẫu tương tự — không clamp thẻ về đúng một SKU. */
  similarCatalogVersusLastConsulted: boolean
  /** Không gọi tìm kho; chỉ hỏi khách làm rõ nhu cầu — `products` luôn []. */
  clarifyShoppingIntent: boolean
  /** Widget `context_reply`: khóa cứng ngữ cảnh theo 1 dòng kho vừa tư vấn gần nhất. */
  forceSingleRowContextReply: boolean
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
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsByExplicitSku(partnerId, latestCustomerMessage)
    }
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromPageContextSku(partnerId, triggerRawPayload)
    }
    if (explicitSkuRows.length === 0) {
      explicitSkuRows = await fetchInventoryRowsFromProductCardConsultPageContext(partnerId, triggerRawPayload)
    }
  }
  const selectedInventoryId = selectedInventoryIdFromTrigger(triggerRawPayload)

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

  /** «Mẫu khác / tương tự / gần giống» — lấy kho bằng embedding ảnh SP neo so với toàn kho, không khóa một dòng kho. */
  const similarCatalogVersusLastConsulted = customerMessageWantsSimilarCatalogVersusLastConsulted(latestCustomerMessage)
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

  const useLastConsultedContext =
    Boolean(lastConsultedRow) &&
    shouldAugmentInventorySearchWithLastConsulted(latestCustomerMessage, {
      visionInventorySelected: Boolean(selectedInventoryId) && !followUpStyleMessage,
    })

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
  if (
    partnerAiShouldUseClarifyBranchFromWidgetPayload(
      effectiveLocaleOpts?.channel,
      triggerRawPayload,
      heuristicClarifyShoppingIntent
    )
  ) {
    const transcriptBlock = formatPartnerAiTranscriptLines(chronological)
    const clarifyUser = buildPartnerAiClarifyShoppingIntentUser(
      effectiveLocaleOpts,
      transcriptBlock,
      latestCustomerMessage
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
    }
  }

  let invForContext: Database['public']['Tables']['messaging_partner_inventory']['Row'][] = []
  let selectedRowBlock = ''
  let selectedRowForEnrich: Database['public']['Tables']['messaging_partner_inventory']['Row'] | null = null

  if (followUpSingleProductNoVector && lastConsultedRow) {
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
    if (explicitSkuRows.length > 0) {
      inv = explicitSkuRows.slice(0, PARTNER_AI_INVENTORY_CONTEXT_LIMIT)
    } else if (similarCatalogVersusLastConsulted && lastConsultedRow && !selectedInventoryId) {
      try {
        inv = await fetchInventoryRowsSimilarToAnchorProductImage(partnerId, lastConsultedRow, {
          limit: PARTNER_AI_INVENTORY_CONTEXT_LIMIT,
        })
      } catch (e) {
        console.warn('[partner-ai-llm] similar catalog by anchor image', e)
      }
    }
    if (inv.length === 0) {
      const inventorySearchMessage =
        useLastConsultedContext && lastConsultedRow
          ? buildInventorySearchQueryWithLastConsulted(lastConsultedRow, latestCustomerMessage)
          : latestCustomerMessage
      inv = await fetchInventoryRowsForPartnerAi(partnerId, inventorySearchMessage, {
        budgetSourceMessage: latestCustomerMessage,
      })
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
    if (useLastConsultedContext && lastConsultedRow && explicitSkuRows.length === 0) {
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

  if (selectedRowForEnrich) {
    selectedRowBlock = `\n\nMặt hàng khách đã CHỌN từ danh sách ảnh gợi ý (ưu tiên cao nhất, chỉ tư vấn theo hàng này nếu không có yêu cầu đổi mẫu):\n${formatInventoryLines([selectedRowForEnrich], invFmtOpts)}

Bắt buộc (khi khách chưa đổi sang mẫu khác): trả lời bằng cách **nêu ưu điểm / giá trị cho khách** — tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp mặc, dễ phối đồ… — diễn giải từ đúng các trường trong dòng kho (tên, mô tả, ghi chú tư vấn, chất liệu/kiểu nếu có); không chỉ đọc máy mã/giá. Không bịa công dụng y tế hay hứa hiệu quả tuyệt đối.`
  }

  const transcript = followUpSingleProductNoVector
    ? formatPartnerAiMinimalTranscriptForFollowUpContext(chronological)
    : formatPartnerAiTranscriptLines(chronological)

  const policy = settings.shop_policy?.trim() || '(Shop chưa nhập chính sách.)'
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'
  const salesExtra = settings.sales_coaching_instructions?.trim() ?? ''
  const salesShopBlock =
    salesExtra.length > 0
      ? `

Chỉ dẫn bổ sung do shop tự nhập (ưu tiên phù hợp ngành hàng / đối tượng khách):
${salesExtra}`
      : ''

  /** Khối mặc định — luôn có; shop mở rộng qua `sales_coaching_instructions` + chính sách. */
  const khoContextInstructionForSystem = followUpSingleProductNoVector
    ? `Trong prompt user, phần «Danh sách kho» chỉ có **đúng một dòng** — sản phẩm shop/AI **vừa tư vấn**; **không** phải kết quả tìm (vector/embedding) trên toàn kho. Nhiệm vụ của bạn: **đọc câu hỏi khách** và trả lời bằng cách **phân tích trực tiếp** các trường trên dòng đó (tên, mô tả, giá, màu, tồn, ghi chú…). Không xử lý như khách đang lần đầu tìm hàng hay cần gợi ý nhiều mẫu.`
    : explicitSkuRows.length > 0
      ? `Trong prompt user, phần «Danh sách kho» đã được **neo theo mã/SKU** (tin khách hoặc trang sản phẩm đang xem); **không** phải kết quả tìm rộng (vector) trên toàn kho. Chỉ tư vấn theo các dòng khớp mã; không lẫn sang mẫu khác, không gợi ý carousel nhiều thẻ thay thế trừ khi khách chủ động muốn xem thêm hoặc so sánh.`
      : `Danh sách kho trong prompt user đã được hệ thống lấy bằng **khớp từ khóa + vector** theo đúng tin khách (kể cả nam/nữ); dùng để tư vấn.`

  const salesDefaultBlock = `
Hướng tư vấn tăng khả năng mua (mềm, không ép, không spam):
- Khi tư vấn dựa trên **thông tin sản phẩm có trong kho** (tên, mô tả, ghi chú tư vấn, mã, giá, tồn…): đừng chỉ liệt kê thông số — hãy diễn giải thành **ưu điểm và lợi ích cho khách**: mặc lên tự tin hơn, chỉn chu, tôn dáng, gọn gàng, phù hợp dịp (tiệc, đi làm, hằng ngày…), dễ phối đồ hoặc thoải mái khi sử dụng — luôn bám sát dữ liệu thật trong kho; không phóng đại, không khẳng định y học, giảm cân, trị bệnh hay hiệu quả tuyệt đối.
- Khi đã nêu đủ thông tin sản phẩm từ kho, có thể gợi ý nhẹ bước tiếp (size/màu, hoặc chiều cao–cân nặng nếu cần) — **không** ra lệnh, **không** hối chốt. Ưu tiên để khách **tự suy nghĩ**; mời thao tác trên giao diện (đặt hàng, xem thẻ) chỉ khi tự nhiên phù hợp ngữ cảnh.
- **Không** lặp lại cùng kiểu câu hỏi chốt màu/size kiểu "chị chọn hồng hay đen ạ?", "đã chọn được màu chưa?" ở **nhiều tin liên tiếp** — dễ gây cảm giác ép mua. Nếu đã gợi ý một lần, các tin sau **tập trung trả lời đúng câu hỏi** của khách; chỉ nhắc màu/size khi khách hỏi hoặc khi thật cần để tư vấn tiếp.
- Giảm do dự: có thể nhắc một dòng về đổi trả / giao hàng / thanh toán CHỈ khi đã có trong chính sách shop ở trên; không bịa thêm.
- **Chính sách đổi size / đổi hàng (tiếng Việt — tránh nhầm từ):** Khi diễn đạt, phân biệt rõ: (1) **Không vừa size** = số đo/size không khớp (chật, rộng, sai size so với bảng size / thực tế mặc) — mới là căn cứ **đổi size** theo chính sách shop (nếu shop có ghi). (2) **Không vừa ý** = không thích màu, form, phối đồ, cảm nhận thẩm mỹ, «mặc không ưng» theo nghĩa rộng **nhưng vẫn đúng size** — **không** gọi là «chưa vừa size», **không** hứa đổi size cho trường hợp này trừ khi chính sách shop nêu rõ. Không dùng chung một cụm kiểu «mặc không vừa ý thì đổi size» để gộp cả hai ý.
- **Hủy đơn / hoàn cọc / trả tiền cọc:** Khi khách đòi hủy đơn hoặc hoàn cọc, **không** đồng ý ngay, **không** hứa «shop sẽ hủy và hoàn tiền» / «xử lý hoàn cọc» một cách dễ dãi trừ khi **chính sách shop ở trên** ghi rõ được phép và điều kiện. Ưu tiên **giữ đơn**; trả lời **khéo, ấm** — nêu **khó khăn / ràng buộc** theo đúng chính sách **chỉ khi đã có trong chính sách**, không bịa điều khoản; không cam kết số tiền / thời hạn hoàn cụ thể nếu không có trong dữ liệu đã cho. Có thể gợi phương án trong phạm vi shop cho phép (đổi size, đổi mẫu…) nếu chính sách có — **không** đề nghị «chuyển lên bộ phận quản lý», «chuyển lên chủ shop xem xét», «shop xem xét lại rồi báo» hay hỏi «chị có muốn shop làm vậy không» trừ khi **chính sách shop** tự ghi rõ quy trình escalate (hiếm); mặc định **không** mở lối thoát quản lý.
- **Khách băn khoăn / lo lắng về đặt cọc (chưa đòi hủy rõ):** Thể hiện **đồng cảm** (hiểu chị có thể chưa thoải mái khi đặt cọc). Giải thích ngắn lý do cọc / thời gian hàng **theo chính sách & kho** đã có — **không** hứa nới lỏng hay thay đổi chính sách. Kết thúc nhẹ: chúc chị **sớm chọn được / mua được** món **ưng ý** (có thể là mẫu đang xem hoặc chung chung), **không** kèm câu hỏi kiểu «có muốn shop chuyển lên quản lý / xem xét không ạ».
- Nhấn mạnh giá trị (phù hợp dáng, dịp mặc, chất liệu) thay vì ép mua; tránh nhiều câu hỏi trong một tin — tối đa một lời mở / gợi ý nhẹ, không xếp hàng nhiều câu hỏi.
- Không hứa giảm giá hay khuyến mãi ngoài chính sách đã cho.${salesShopBlock}`

  const system = `${partnerAiOpeningLanguageLine(effectiveLocaleOpts)}${partnerAiWidgetTargetRoutingLine(effectiveLocaleOpts)}
Giọng điệu: ${tone}${partnerAiMessagingStyleLine(effectiveLocaleOpts)}
Tuân thủ nghiêm các quy tắc / chính sách sau (không bịa điều không có trong dữ liệu):
${policy}
${salesDefaultBlock}
${khoContextInstructionForSystem} Chỉ giới thiệu sản phẩm từ danh sách đó. Khi giới thiệu hoặc so sánh mặt hàng cụ thể, ưu tiên nói **lợi ích cho khách** (thẩm mỹ, độ phù hợp, sự thoải mái…) xuất phát từ thông tin trong kho, không chỉ đọc giá/mã. Nếu không có đúng sản phẩm trong danh sách, nói rõ chưa thấy thông tin khớp và chuyển hướng tư vấn: hỏi khách có muốn xem sản phẩm tương tự đang có trong kho không.
Khi khách hỏi về chất liệu/vải/vật liệu: ưu tiên trả lời theo trường "Chất liệu (đã lưu/kho)" hoặc mô tả/ghi chú trong dòng kho nếu có; không bịa chất liệu ngoài dữ liệu đã cho.
Trong mỗi dòng kho, **ảnh chính sản phẩm (URL)** là ảnh gốc shop khai báo; hệ thống dùng đúng ảnh đó làm nguồn để tạo (1) ảnh chi tiết chất liệu/màu và (2) ảnh **đời thường / góc tự nhiên** (nhìn sản phẩm chân thực) — không dùng ảnh khác làm nguồn, và **không** gọi các ảnh sinh ra là "ảnh tham khảo" khi nói với khách.
Nếu trong kho có "Ảnh chi tiết chất liệu/màu (đã lưu)" kèm URL, đó là ảnh phóng chi tiết chất liệu/màu **sinh từ ảnh chính** — nhắc khách xem ảnh đính kèm (không cần dán lại URL trong message).
Khi khách hỏi ảnh chụp thực tế / mặc thật / dùng thật: nếu kho có mục **Ảnh đời thường — nhìn sản phẩm chân thực (đã lưu)** kèm URL — đó là ảnh được tạo từ **ảnh chính** theo phong cách **đời thường, góc tự nhiên** để khách **xem sản phẩm chân thực** (không phải ảnh studio); trong **tin gửi khách** giữ giọng thống nhất với chú thích hệ thống (ảnh đời thường / góc tự nhiên / nhìn sản phẩm chân thực), **không** gọi là "ảnh tham khảo", **không** tự nói "ảnh AI" hay "ảnh phần mềm tạo". Không khẳng định ảnh chụp tại showroom/shop trừ khi dữ liệu kho ghi rõ. Khi khách vừa xem thẻ sản phẩm và hỏi ảnh thực tế — mặc định hiểu đúng mẫu đó; không bảo "không có ảnh" nếu hệ thống đang hoặc sắp gửi kèm ảnh. Trong một cuộc chat, tối đa hai ảnh loại này cho cùng một mặt hàng; không hứa gửi thêm khi đã đủ.
Khi tin khách **ngắn** và chỉ hỏi thuộc tính (màu, size, tồn, giá, ship…) **mà không nêu tên/mã sản phẩm mới**: mặc định hiểu là đang hỏi về **mặt hàng shop vừa giới thiệu** trong lịch sử gần hoặc khối «mặt hàng đang thảo luận / đã chọn» nếu có — không trả lời như câu hỏi độc lập không có ngữ cảnh.
Khi khách **đổi chủ đề / loại hàng** (vd. vừa xem váy lại hỏi giày, dép, túi…): ưu tiên **đúng ngành đang hỏi trong tin hiện tại** và danh sách kho phù hợp tin đó — không kéo carousel mẫu cũ hay câu «chọn sản phẩm» như thể chưa đổi ý.
Khi khách nêu **nam** hoặc **nữ** (đồ nam / đồ nữ): chỉ gợi ý mặt hàng **cùng đối tượng** trong **products** — không đưa váy/đầm nữ khi khách hỏi đồ nam và ngược lại trừ khi mặt hàng ghi **unisex** rõ trong kho.
Khi khách hỏi tìm hàng theo thuộc tính (ví dụ: loại hàng, màu, kiểu dáng, chất liệu, chiều cao gót, khoảng giá), hãy chủ động đề xuất mặt hàng phù hợp từ danh sách kho (nếu có) trong mảng products — thường **4–8** mẫu khi kho có đủ, tối đa **${PARTNER_AI_PRODUCT_CARDS_MAX}** mẫu trong một tin; tránh chỉ trả lời chung chung khi trong kho vẫn có lựa chọn liên quan.
Nếu không có "khớp tuyệt đối", vẫn ưu tiên đưa các mẫu "khớp gần" đang có trong kho vào products để khách chọn tiếp — **nhưng "khớp gần" phải cùng nhóm/nhu cầu với điều khách đang hỏi** (cùng loại sản phẩm hoặc dùng thay thế hợp lý: ví dụ khách hỏi dép lê/giày dép mà kho không có đúng mẫu → chỉ gợi ý các mẫu giày/dép/sandal/dép nam nữ khác trong kho; **không** đưa ba lô, túi xách, ví, phụ kiện không liên quan chỉ vì tên có từ khóa trùng hoặc vì nằm đầu danh sách kho). Chỉ gợi ý ngành hàng khác khi khách **chủ động** hỏi rộng (ví dụ "shop còn gì hot") hoặc đã chuyển sang nhu cầu khác.
Khi đã có products khác rỗng, message phải thật ngắn (1-2 câu), không liệt kê chi tiết từng mẫu, không bullet dài; có thể mở nhẹ (khách xem thẻ/ảnh khi muốn), **không** ép chọn mẫu hay chốt màu ngay.
Khi giới thiệu mặt hàng có "Ảnh (URL)" và/hoặc "Trang sản phẩm (URL)" trong kho, đưa ảnh và link trang vào mảng products trong JSON đầu ra (khách sẽ thấy thẻ sản phẩm có ảnh và giá). Không dán URL ảnh hay URL trang sản phẩm dạng chữ trong trường message nếu đã khai báo đủ trong products.
Nếu trong tin nhắn khách hoặc ngữ cảnh hệ thống có dòng [Customer product SKU: …], đó là mã sản phẩm khách vừa chọn — ưu tiên tư vấn đúng mặt hàng khớp mã trong kho (xem khối "mặt hàng khớp mã/SKU" nếu có). Không đề xuất nhiều thẻ/carousel mẫu khác thay thế trừ khi khách muốn xem thêm hoặc so sánh.
Định dạng đầu ra: một đối tượng JSON đúng schema ở cuối prompt user — không bọc markdown, không giải thích ngoài JSON.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trường \`message\` trong JSON: **súc tích**, đúng ý khách; có thể gạch đầu dòng khi cần — **không** văn mẫu kiểu chatbot, **không** tự giới thiệu vai trò kỹ thuật.
Giọng tư vấn **mở, nhẹ** (như nhân viên thật): ưu tiên làm rõ lo lắng / nhu cầu khi cần; tránh hối mua hoặc bắt chọn màu–size trong mọi tin. Đọc lịch sử — nếu vừa hỏi khách chọn màu (hoặc tương tự) gần đây thì **đừng** lặp lại; chuyển sang trả lời nội dung khách đang hỏi hoặc bổ sung thông tin hữu ích.`

  const explicitSkuBlock = explicitSkuRows.length
    ? `\n\nCác mặt hàng khớp chính xác mã/SKU khách vừa nhắn (ưu tiên kiểm tra nhóm này trước):
${formatInventoryLines(explicitSkuRows, invFmtOpts)}`
    : ''

  const inventoryFollowupAugmented = useLastConsultedContext
  const conversationFocusBlock =
    explicitSkuRows.length > 0 && !similarCatalogVersusLastConsulted
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
    lastConsultedRow &&
    !similarCatalogVersusLastConsulted &&
    customerMessageIsFollowUpContextQuery(latestCustomerMessage, {
      visionInventorySelected: Boolean(selectedInventoryId) && !followUpStyleMessage,
    })
      ? followUpConsultationSnapshotBlock(latestCustomerMessage, lastConsultedRow, invFmtOpts)
      : ''

  const userInventoryPreamble = followUpSingleProductNoVector
    ? `[Chế độ hỏi tiếp — không tạo vector trên cả kho]
Dưới đây là **toàn bộ dữ liệu kho** của **một** sản phẩm — đúng mặt hàng shop/AI **vừa tư vấn gần nhất**. Kết hợp **câu hỏi của khách** (cuối prompt) với **từng trường** trong dòng kho để trả lời (màu, size, giá, tồn…). Đây **không** phải danh sách ứng viên từ tìm kiếm vector; không tư vấn như khách đang lần đầu vào shop.

`
    : similarCatalogVersusLastConsulted && lastConsultedRow
      ? `[Gợi ý mẫu tương tự — danh sách kho bên dười lấy theo **embedding ảnh chính** của mặt hàng shop/AI vừa thảo luận (so khớp **cả kho** qua pgvector). Dòng đầu thường gần mẫu đang xem nhất. Trả lời ngắn rồi đưa **nhiều thẻ** (4–8 nếu kho có) trong JSON **products** — không giới hạn một mẫu; có thể gồm cả mẫu neo nếu vẫn nằm trong danh sách.

`
      : explicitSkuRows.length > 0 && !similarCatalogVersusLastConsulted
        ? `[Neo mã sản phẩm — danh sách kho bên dười chỉ gồm mặt hàng **khớp mã/SKU** (từ tin khách hoặc trang sản phẩm đang xem). **Không** phải kết quả tìm vector trên toàn kho; khi điền **products**, tối đa **một** thẻ đúng mã đang thảo luận.

`
        : `Danh sách kho (do shop khai báo; có thể không đầy đủ so với toàn bộ hàng thực tế). Các dòng đầu là mặt hàng được ưu tiên theo mã/tên/từ khóa gần với tin nhắn khách (nếu có), sau đó là các mặt hàng còn lại theo thứ tự shop sắp xếp — tất cả đều có thể dùng để tư vấn; khi chọn mặt hàng đưa vào JSON **products**, vẫn phải **lọc theo đúng chủ đề khách đang hỏi** (đừng chọn mặt hàng chỉ vì xuất hiện sớm trong danh sách nếu khác ngành hàng).

`

  const user = `${partnerAiUserPromptOutputLanguageBanner(effectiveLocaleOpts)}${buildPartnerAiWarehouseVndPricingNote(effectiveLocaleOpts)}${guestProfileBlockForAi ? `${guestProfileBlockForAi}\n\n` : ''}${userInventoryPreamble}${formatInventoryLines(invForContext, invFmtOpts)}
${explicitSkuBlock}
${selectedRowBlock}

${followUpSingleProductNoVector ? 'Ngữ cảnh hội thoại (tối giản — chỉ một tin shop gần nhất trước câu khách; câu khách ở mục sau)' : 'Lịch sử hội thoại gần đây'}:
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

/** Đủ chỗ cho JSON nhiều thẻ SP (URL dài); 1100 cũ hay cắt giữa chừng → chỉ còn 3–5 mặt hàng. */
function deepseekPartnerAiMaxTokens(): number {
  const raw = process.env.DEEPSEEK_PARTNER_AI_MAX_TOKENS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 8192
  if (!Number.isFinite(n) || n < 512) return 8192
  return Math.min(16384, Math.max(512, Math.floor(n)))
}

export async function deepseekPartnerChat(system: string, user: string): Promise<DeepseekPartnerChatResult> {
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
    return { text, model, usage: json.usage }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'DeepSeek fetch failed' }
  }
}

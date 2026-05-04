import { createHash } from 'node:crypto'
import {
  fetchWidgetIntentCachePg,
  upsertWidgetIntentCachePg,
} from '@/lib/db/messaging-partner-widget-intent-cache-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import {
  createPartnerAiRouteDecision,
  parsePartnerAiRouteIntent,
  type PartnerAiRouteDecision,
} from '@/lib/messaging/partner-ai-intent-router'

/** Đổi khi đổi prompt/schema phân loại — cache cũ không còn khớp. */
export const WIDGET_INTENT_CLASSIFIER_VERSION = 'v3'

export function normalizeIntentCacheText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

const INTENT_TEXT_MAX = 2000

function normalizeIntentCustomerText(s: string): string {
  return normalizeIntentCacheText(s.trim().slice(0, INTENT_TEXT_MAX))
}

function normalizeIntentShopContext(s: string | null): string {
  return normalizeIntentCacheText((s ?? '').trim().slice(0, INTENT_TEXT_MAX))
}

/**
 * Khóa cache: version + partner + tin khách (chuẩn hoá) + ngữ cảnh (tin shop gần nhất, chuẩn hoá).
 * Cùng chữ khách nhưng shop vừa rep khác → hash khác.
 */
export function buildWidgetIntentLookupHash(input: {
  partnerId: string
  customerText: string
  lastShopMessage: string | null
  classifierVersion?: string
}): string {
  const v = input.classifierVersion ?? WIDGET_INTENT_CLASSIFIER_VERSION
  const c = normalizeIntentCustomerText(input.customerText)
  const last = normalizeIntentShopContext(input.lastShopMessage)
  const payload = `${v}\x1f${input.partnerId.trim()}\x1f${c}\x1f${last}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

/**
 * Phân loại 1 lần (DeepSeek chat): route ý định khách vào các nhánh pipeline.
 * Tra cache DB (tin + ngữ cảnh) trước; miss mới gọi API rồi ghi cache.
 * `null` = tắt env, lỗi API, hoặc parse lỗi → widget dùng heuristic regex như cũ.
 */
export async function classifyWidgetInboundIntent(input: {
  partnerId: string
  customerText: string
  lastShopMessage: string | null
}): Promise<PartnerAiRouteDecision | null> {
  if (process.env.PARTNER_AI_WIDGET_INTENT_CLASSIFIER === '0') return null
  if (!process.env.DEEPSEEK_API_KEY?.trim()) return null

  const useCache =
    process.env.PARTNER_AI_WIDGET_INTENT_CACHE !== '0' && isPgConfigured()
  const lookupHash = buildWidgetIntentLookupHash(input)

  if (useCache) {
    const cached = await fetchWidgetIntentCachePg(lookupHash)
    if (cached) {
      return createPartnerAiRouteDecision(cached, {
        confidence: 0.9,
        source: 'ai_classifier',
        reason: 'cache',
      })
    }
  }

  const customerTextNorm = normalizeIntentCustomerText(input.customerText)
  const shopContextNorm = normalizeIntentShopContext(input.lastShopMessage)
  const last = (input.lastShopMessage ?? '').trim().slice(0, INTENT_TEXT_MAX)
  const cur = input.customerText.trim().slice(0, INTENT_TEXT_MAX)

  const system = `Bạn là bộ phân loại ý định cho chat bán hàng. Chỉ trả về **một** JSON hợp lệ, không markdown, không giải thích.
Schema bắt buộc: {"decision":"follow_up_current_product"|"new_product_search"|"similar_alternatives"|"purchase_or_order"|"policy_or_order_support"|"clarify"|"pause_or_close","confidence":0.0-1.0,"category":string|null,"reason":string}

Nghĩa:
- follow_up_current_product: Khách hỏi tiếp sản phẩm/mẫu shop vừa gửi: giá, màu, size, tồn, chất liệu, ảnh thật, ship cho mẫu đó; hoặc phản ứng ngắn về mẫu đang bàn.
- new_product_search: Khách hỏi/tìm loại hàng hoặc nhu cầu mới trong kho rộng: "shop có túi không", "cho xem áo khoác", "có cái nào đựng laptop", "bag nữ còn không". Nếu khách đổi ý khỏi mẫu cũ sang loại khác, chọn nhánh này.
- similar_alternatives: Khách muốn mẫu khác/tương tự/na ná so với mẫu đang bàn: "mẫu khác", "tương tự", "loại khác", "na ná". Nếu chưa có mẫu neo rõ trong tin shop gần nhất thì chọn clarify.
- purchase_or_order: Khách muốn mua/chốt/đặt/lấy hàng/gửi số điện thoại/hỏi cách đặt sau khi đã có sản phẩm đang bàn.
- policy_or_order_support: Khách hỏi chính sách/cọc/thanh toán/ship/đổi trả/hủy đơn/hoàn cọc/check đơn. Nếu câu chỉ là "ship bao lâu" cho mẫu đang bàn thì follow_up_current_product; nếu hỏi chính sách chung thì nhánh này.
- clarify: Chưa rõ cần tư vấn gì: chào chung, lỗi/truy cập/không thấy sản phẩm, cảm xúc/khiếu nại chưa nêu loại hàng; hoặc "xem thêm đi" nhưng không có mẫu neo rõ.
- pause_or_close: Ok/cảm ơn/để xem thêm/thôi nhé/kết thúc, không cần tư vấn thêm.

Không có nhãn card_consult_isolated hoặc explicit_sku_consult ở đây: các nhánh đó do rule cứng bên ngoài xử lý.`

  const user = `Tin shop gần nhất (có thể rỗng nếu hội thoại mới):
${last || '(chưa có tin shop)'}

Tin mới của khách:
${cur}

Trả về JSON đúng schema.`

  let decision: PartnerAiRouteDecision | null = null
  try {
    const res = await deepseekPartnerChat(system, user, {
      feature: 'messaging-widget-intent-classifier',
      userId: null,
    })
    if (res.error || !res.text) return null
    decision = parseWidgetIntentJson(res.text)
  } catch (e) {
    console.warn('[partner-ai-widget-intent-classifier]', e)
    return null
  }

  if (decision && useCache) {
    await upsertWidgetIntentCachePg({
      lookupHash,
      partnerId: input.partnerId.trim(),
      decision: decision.intent,
      classifierVersion: WIDGET_INTENT_CLASSIFIER_VERSION,
      customerTextNorm,
      shopContextNorm,
    })
  }

  return decision
}

function parseWidgetIntentJson(text: string): PartnerAiRouteDecision | null {
  const s = text.trim()
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0]) as {
      decision?: unknown
      confidence?: unknown
      category?: unknown
      reason?: unknown
    }
    const intent = parsePartnerAiRouteIntent(o.decision)
    if (!intent) return null
    return createPartnerAiRouteDecision(intent, {
      confidence: typeof o.confidence === 'number' ? o.confidence : Number(o.confidence ?? 0.8),
      category: typeof o.category === 'string' && o.category.trim() ? o.category.trim().slice(0, 80) : null,
      reason: typeof o.reason === 'string' ? o.reason.trim().slice(0, 200) : null,
      source: 'ai_classifier',
    })
  } catch {
    return null
  }
}

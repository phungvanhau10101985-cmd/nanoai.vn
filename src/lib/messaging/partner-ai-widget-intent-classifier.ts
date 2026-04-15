import { createHash } from 'node:crypto'
import {
  fetchWidgetIntentCachePg,
  upsertWidgetIntentCachePg,
} from '@/lib/db/messaging-partner-widget-intent-cache-pg'
import { isPgConfigured } from '@/lib/db/pool'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { PartnerAiWidgetIntent } from '@/lib/messaging/partner-ai-unclear-intent'

/** Đổi khi đổi prompt/schema phân loại — cache cũ không còn khớp. */
export const WIDGET_INTENT_CLASSIFIER_VERSION = 'v1'

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
 * Phân loại 1 lần (DeepSeek chat): khách bám ngữ cảnh shop / chưa rõ ý / cần tìm SP trong kho.
 * Tra cache DB (tin + ngữ cảnh) trước; miss mới gọi API rồi ghi cache.
 * `null` = tắt env, lỗi API, hoặc parse lỗi → widget dùng heuristic regex như cũ.
 */
export async function classifyWidgetInboundIntent(input: {
  partnerId: string
  customerText: string
  lastShopMessage: string | null
}): Promise<PartnerAiWidgetIntent | null> {
  if (process.env.PARTNER_AI_WIDGET_INTENT_CLASSIFIER === '0') return null
  if (!process.env.DEEPSEEK_API_KEY?.trim()) return null

  const useCache =
    process.env.PARTNER_AI_WIDGET_INTENT_CACHE !== '0' && isPgConfigured()
  const lookupHash = buildWidgetIntentLookupHash(input)

  if (useCache) {
    const cached = await fetchWidgetIntentCachePg(lookupHash)
    if (cached) return cached
  }

  const customerTextNorm = normalizeIntentCustomerText(input.customerText)
  const shopContextNorm = normalizeIntentShopContext(input.lastShopMessage)
  const last = (input.lastShopMessage ?? '').trim().slice(0, INTENT_TEXT_MAX)
  const cur = input.customerText.trim().slice(0, INTENT_TEXT_MAX)

  const system = `Bạn là bộ phân loại ý định (một lần). Chỉ trả về **một** JSON hợp lệ, không markdown, không giải thích.
Schema bắt buộc: {"decision":"context_reply"|"clarify"|"product_search"}

Nghĩa:
- context_reply: Khách **bám ngữ cảnh** tin shop vừa gửi — hỏi tiếp giá/size/màu/tồn/ship/đổi/trả/chốt đơn, phản ứng ngắn về mẫu đang bàn ("còn không", "ok", "đắt quá", "màu khác"), hoặc trả lời đúng chủ đề shop vừa nói. **Không** phải lúc tìm mẫu mới trong kho rộng.
- clarify: **Chưa rõ** cần tư vấn sản phẩm gì: chào chung, khiếu nại UI/truy cập ("không vào", "không thấy sản phẩm", "trắng trang"), cảm xúc, than phiền chưa nêu loại hàng cần xem — cần hỏi khách làm rõ nhu cầu (không ép carousel SP).
- product_search: Khách **rõ ý** tìm/xem/mua theo loại hoặc chuyển sang mẫu mới (vd. "có váy không", "tìm đầm đi tiệc", "cho xem mẫu khác", "mẫu tương tự") — phù hợp gợi ý vector/tìm kho.`

  const user = `Tin shop gần nhất (có thể rỗng nếu hội thoại mới):
${last || '(chưa có tin shop)'}

Tin mới của khách:
${cur}

Trả về JSON đúng schema.`

  let decision: PartnerAiWidgetIntent | null = null
  try {
    const res = await deepseekPartnerChat(system, user)
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
      decision,
      classifierVersion: WIDGET_INTENT_CLASSIFIER_VERSION,
      customerTextNorm,
      shopContextNorm,
    })
  }

  return decision
}

function parseWidgetIntentJson(text: string): PartnerAiWidgetIntent | null {
  const s = text.trim()
  const m = s.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0]) as { decision?: string }
    const d = String(o.decision ?? '').trim()
    if (d === 'context_reply' || d === 'clarify' || d === 'product_search') return d
    return null
  } catch {
    return null
  }
}

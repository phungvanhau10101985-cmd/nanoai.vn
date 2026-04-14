import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'
import type { PartnerAiWidgetIntent } from '@/lib/messaging/partner-ai-unclear-intent'

/**
 * Phân loại 1 lần (DeepSeek): khách đang bám ngữ cảnh shop / chưa rõ ý / cần tìm SP trong kho.
 * `null` = tắt env, lỗi API, hoặc parse lỗi → widget dùng heuristic regex như cũ.
 */
export async function classifyWidgetInboundIntent(input: {
  customerText: string
  lastShopMessage: string | null
}): Promise<PartnerAiWidgetIntent | null> {
  if (process.env.PARTNER_AI_WIDGET_INTENT_CLASSIFIER === '0') return null
  if (!process.env.DEEPSEEK_API_KEY?.trim()) return null

  const last = (input.lastShopMessage ?? '').trim().slice(0, 2000)
  const cur = input.customerText.trim().slice(0, 2000)

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

  try {
    const res = await deepseekPartnerChat(system, user)
    if (res.error || !res.text) return null
    return parseWidgetIntentJson(res.text)
  } catch (e) {
    console.warn('[partner-ai-widget-intent-classifier]', e)
    return null
  }
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

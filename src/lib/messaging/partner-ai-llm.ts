import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { fetchInventoryRowsForPartnerAi } from '@/lib/messaging/partner-inventory-ai-search'

type Db = SupabaseClient<Database>
type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

function formatInventoryLines(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][]
): string {
  if (!rows.length) return '(Chưa có mặt hàng nào trong danh sách kho.)'
  return rows
    .map((r, i) => {
      const sku = r.sku?.trim() ? ` [Mã/SKU: ${r.sku.trim()}]` : ''
      const stock = r.stock_note?.trim() ? ` | Tồn kho: ${r.stock_note.trim()}` : ''
      const price = r.price_hint?.trim() ? ` | Giá: ${r.price_hint.trim()}` : ''
      const desc = r.description?.trim() ? ` — Thông số/mô tả: ${r.description.trim()}` : ''
      const img = r.image_url?.trim() ? ` | Ảnh (URL): ${r.image_url.trim()}` : ''
      const pu = r.product_url?.trim()
      const page =
        pu && /^https?:\/\//i.test(pu) ? ` | Trang sản phẩm (URL): ${pu}` : ''
      const extra = r.consult_note?.trim() ? ` | Ghi chú tư vấn: ${r.consult_note.trim()}` : ''
      return `${i + 1}. ${r.name.trim()}${sku}${desc}${stock}${price}${img}${page}${extra}`
    })
    .join('\n')
}

export async function buildPartnerAiContext(
  db: Db,
  partnerId: string,
  conversationId: string,
  settings: SettingsRow,
  latestCustomerMessage: string
): Promise<{ system: string; user: string }> {
  const inv = await fetchInventoryRowsForPartnerAi(db, partnerId, latestCustomerMessage)

  const { data: msgs } = await db
    .from('customer_care_messages')
    .select('direction, body, created_at, raw_payload')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(14)

  const chronological = (msgs ?? []).reverse()
  const transcript = chronological
    .map((m) => {
      const label = m.direction === 'inbound' ? 'Khách' : 'Shop'
      const pl = m.raw_payload as { guest_media?: { kind?: string; url?: string } } | null
      const img = pl?.guest_media?.kind === 'image' && pl.guest_media.url ? pl.guest_media.url : null
      const cap = m.body.replace(/^📷\s*/u, '').trim()
      if (img) {
        const line = [cap || '(ảnh)', img].filter(Boolean).join(' — ')
        return `${label}: ${line}`
      }
      return `${label}: ${m.body}`
    })
    .join('\n')

  const policy = settings.shop_policy?.trim() || '(Shop chưa nhập chính sách.)'
  const tone = settings.tone_instructions?.trim() || 'Lịch sự, ngắn gọn, rõ ràng.'

  const system = `Bạn là trợ lý chat của một cửa hàng trên nền tảng NanoAI. Trả lời bằng tiếng Việt trừ khi khách dùng ngôn ngữ khác thì theo ngôn ngữ khách.
Giọng điệu: ${tone}
Tuân thủ nghiêm các quy tắc / chính sách sau (không bịa điều không có trong dữ liệu):
${policy}
Toàn bộ mặt hàng trong danh sách kho dưới đây đều dùng để tư vấn khách. Chỉ tư vấn sản phẩm/tồn kho dựa trên danh sách đó. Nếu không có trong danh sách, nói rõ bạn không có thông tin và gợi ý khách liên hệ shop.
Nếu mục có dòng "Ảnh (URL)", bạn có thể gửi kèm link ảnh đó trong tin nhắn để khách xem (bạn chỉ thấy URL dạng chữ, không xem được pixel ảnh). Nếu có "Trang sản phẩm (URL)", có thể gửi link đó để khách mở trang chi tiết trên web shop.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trả lời súc tích, có thể dùng gạch đầu dòng.`

  const user = `Danh sách kho (do shop khai báo; có thể không đầy đủ so với toàn bộ hàng thực tế). Các dòng đầu là mặt hàng được ưu tiên theo mã/tên/từ khóa gần với tin nhắn khách (nếu có), sau đó là các mặt hàng còn lại theo thứ tự shop sắp xếp — tất cả đều có thể dùng để tư vấn:
${formatInventoryLines(inv)}

Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}

Hãy soạn một tin nhắn trả lời duy nhất (plain text, không markdown phức tạp).`

  return { system, user }
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

export async function deepseekPartnerChat(system: string, user: string): Promise<DeepseekPartnerChatResult> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'DEEPSEEK_API_KEY not configured.' }
  const model = process.env.DEEPSEEK_MODEL?.trim() || 'deepseek-chat'
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
        max_tokens: 900,
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

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/types/database.types'
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

function visionCatalogNoHitsFromTrigger(raw: Json | null | undefined): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  return (raw as { vision_catalog_no_hits?: unknown }).vision_catalog_no_hits === true
}

export async function buildPartnerAiContext(
  db: Db,
  partnerId: string,
  conversationId: string,
  settings: SettingsRow,
  latestCustomerMessage: string,
  triggerRawPayload?: Json | null
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
Khi giới thiệu mặt hàng có "Ảnh (URL)" và/hoặc "Trang sản phẩm (URL)" trong kho, đưa ảnh và link trang vào mảng products trong JSON đầu ra (khách sẽ thấy thẻ sản phẩm có ảnh và giá). Không dán URL ảnh hay URL trang sản phẩm dạng chữ trong trường message nếu đã khai báo đủ trong products.
Định dạng đầu ra: một đối tượng JSON đúng schema ở cuối prompt user — không bọc markdown, không giải thích ngoài JSON.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trả lời súc tích trong trường message, có thể dùng gạch đầu dòng.`

  const user = `Danh sách kho (do shop khai báo; có thể không đầy đủ so với toàn bộ hàng thực tế). Các dòng đầu là mặt hàng được ưu tiên theo mã/tên/từ khóa gần với tin nhắn khách (nếu có), sau đó là các mặt hàng còn lại theo thứ tự shop sắp xếp — tất cả đều có thể dùng để tư vấn:
${formatInventoryLines(inv)}

Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}
${
  visionCatalogNoHitsFromTrigger(triggerRawPayload)
    ? `

Tình huống bổ sung (bắt buộc xử lý đúng): Tin kích hoạt này kèm ảnh từ khách và shop đã bật tìm sản phẩm theo ảnh, nhưng hệ thống không tìm được mặt hàng tương ứng trong kho (không có ứng viên). Hãy soạn một tin trả lời ngắn, lịch sự:
- Chào hỏi (có thể xưng hô phù hợp giọng shop).
- Cảm ơn khách đã gửi ảnh.
- Nói rõ shop hiện không có thông tin khớp với mẫu trong ảnh trong dữ liệu kho (không nói “lỗi kỹ thuật” trừ khi có lý do rõ).
- Đề nghị khách mô tả thêm (tên sản phẩm, mã hàng/SKU) hoặc liên hệ trực tiếp shop để được hỗ trợ.
- Không bịa tên hay giá sản phẩm; không hứa chắc còn hàng nếu không có trong danh sách kho.`
    : ''
}

Trả lời BẮT BUỘC là một JSON hợp lệ duy nhất (không bọc markdown, không text ngoài JSON), đúng schema:
{"message":"nội dung gửi khách (plain text, có thể xuống dòng; không nhét URL ảnh/trang sản phẩm nếu đã có trong products)","products":[]}
products là mảng, tối đa 4 phần tử. Khi giới thiệu mặt hàng từ danh sách kho có ảnh hoặc trang sản phẩm, mỗi phần tử:
{"name":"tên ngắn (có thể gồm mã/SKU)","image_url":"https://...","product_url":"https://...","price_hint":"199.000đ (tuỳ chọn, copy từ cột Giá trong kho nếu có)"}
Chỉ dùng URL http(s) đúng như trong dữ liệu kho; không bịa link. image_url và product_url bắt buộc là chuỗi URL hợp lệ. Khi không giới thiệu hàng kèm ảnh/trang, để products là [].`

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
        max_tokens: 1100,
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

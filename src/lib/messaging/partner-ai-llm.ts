import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

type Db = SupabaseClient<Database>
type SettingsRow = Database['public']['Tables']['messaging_partner_ai_settings']['Row']

function formatInventoryLines(
  rows: Database['public']['Tables']['messaging_partner_inventory']['Row'][]
): string {
  if (!rows.length) return '(Chưa có mục kho nào.)'
  return rows
    .map((r, i) => {
      const sku = r.sku?.trim() ? ` [SKU: ${r.sku.trim()}]` : ''
      const stock = r.stock_note?.trim() ? ` | Tồn/kho: ${r.stock_note.trim()}` : ''
      const price = r.price_hint?.trim() ? ` | Giá: ${r.price_hint.trim()}` : ''
      const desc = r.description?.trim() ? ` — ${r.description.trim()}` : ''
      return `${i + 1}. ${r.name.trim()}${sku}${desc}${stock}${price}`
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
  const { data: inv } = await db
    .from('messaging_partner_inventory')
    .select('*')
    .eq('partner_id', partnerId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(50)

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
Chỉ tư vấn sản phẩm/tồn kho dựa trên danh sách "Kho gợi ý" dưới đây. Nếu không có trong danh sách, nói rõ bạn không có thông tin và gợi ý khách liên hệ shop.
Không hứa giảm giá hay thay đổi chính sách ngoài nội dung đã cho. Trả lời súc tích, có thể dùng gạch đầu dòng.`

  const user = `Danh sách kho gợi ý (có thể không đầy đủ):
${formatInventoryLines(inv ?? [])}

Lịch sử hội thoại gần đây:
${transcript}

Tin nhắn mới nhất của khách:
${latestCustomerMessage}

Hãy soạn một tin nhắn trả lời duy nhất (plain text, không markdown phức tạp).`

  return { system, user }
}

export async function deepseekPartnerChat(system: string, user: string): Promise<{ text?: string; error?: string }> {
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
      error?: { message?: string }
    }
    if (!res.ok) {
      return { error: json?.error?.message || res.statusText || 'DeepSeek error' }
    }
    const text = json.choices?.[0]?.message?.content?.trim()
    if (!text) return { error: 'Empty model output' }
    return { text }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'DeepSeek fetch failed' }
  }
}

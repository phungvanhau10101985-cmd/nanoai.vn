import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'

export const WEDDING_POLISH_FIELDS = [
  'coupleIntro',
  'loveQuote',
  'eventTimeline',
  'dressCode',
  'storyText',
  'thankYouText',
] as const

export type WeddingPolishField = (typeof WEDDING_POLISH_FIELDS)[number]

export function isWeddingPolishField(value: string): value is WeddingPolishField {
  return (WEDDING_POLISH_FIELDS as readonly string[]).includes(value)
}

const SYSTEM_PROMPT = `Bạn là biên tập viên thiệp cưới tiếng Việt chuyên nghiệp.
Nhiệm vụ: viết lại bản nháp của khách cho hay, mượt, trang trọng và ấm áp.
Quy tắc bắt buộc:
- Giữ nguyên ý chính và mọi chi tiết quan trọng khách đã nêu (tên, giờ, địa điểm, yêu cầu trang phục…).
- Không bịa thêm thông tin.
- Không giải thích, không markdown, không dấu ngoặc kép bọc ngoài — chỉ trả văn bản đã chỉnh.
- Dùng tiếng Việt tự nhiên, phù hợp thiệp mời cưới.`

function fieldInstruction(field: WeddingPolishField): string {
  switch (field) {
    case 'coupleIntro':
      return 'Loại: đoạn mở đầu giới thiệu cặp đôi / gia đình. 2–4 câu, cảm xúc chân thành, không sáo rỗng.'
    case 'loveQuote':
      return 'Loại: quote tình yêu ngắn (1–2 câu). Có thể giữ dấu ngoặc kép quanh câu quote nếu phù hợp.'
    case 'eventTimeline':
      return 'Loại: lịch trình tiệc cưới. Mỗi mốc một dòng, giữ dạng: HH:MM | Tiêu đề - Ghi chú. Chỉnh từ ngữ cho rõ ràng, không đổi giờ hoặc thứ tự mốc.'
    case 'dressCode':
      return 'Loại: dress code / lưu ý khách mời. Ngắn gọn, lịch sự, dễ làm theo.'
    case 'storyText':
      return 'Loại: câu chuyện tình yêu hoặc đoạn album ngắn. 2–5 câu, mạch lạc, có cảm xúc.'
    case 'thankYouText':
      return 'Loại: lời cảm ơn cuối thiệp. 1–3 câu, tri ân chân thành.'
  }
}

function buildUserPrompt(input: {
  field: WeddingPolishField
  draft: string
  groomName?: string
  brideName?: string
  weddingDate?: string
  venue?: string
}): string {
  const contextLines: string[] = []
  if (input.groomName?.trim() || input.brideName?.trim()) {
    contextLines.push(`Cặp đôi: ${input.groomName?.trim() || '…'} & ${input.brideName?.trim() || '…'}`)
  }
  if (input.weddingDate?.trim()) contextLines.push(`Ngày cưới: ${input.weddingDate.trim()}`)
  if (input.venue?.trim()) contextLines.push(`Địa điểm: ${input.venue.trim()}`)

  return [
    fieldInstruction(input.field),
    contextLines.length ? `Bối cảnh (tham khảo, không bịa thêm):\n${contextLines.join('\n')}` : '',
    'Bản nháp của khách:',
    input.draft.trim(),
  ]
    .filter(Boolean)
    .join('\n\n')
}

function stripModelWrapping(text: string): string {
  let out = text.trim()
  if (out.startsWith('```')) {
    out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim()
  }
  if (
    (out.startsWith('"') && out.endsWith('"')) ||
    (out.startsWith('「') && out.endsWith('」'))
  ) {
    out = out.slice(1, -1).trim()
  }
  return out
}

export async function polishWeddingTextWithDeepseek(input: {
  field: WeddingPolishField
  draft: string
  groomName?: string
  brideName?: string
  weddingDate?: string
  venue?: string
  userId?: string | null
}): Promise<{ text: string } | { error: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'Chưa cấu hình DEEPSEEK_API_KEY trên server.' }

  const draft = input.draft.trim()
  if (!draft) return { error: 'Nội dung trống.' }

  const model = resolveDeepSeekChatModel()
  const userPrompt = buildUserPrompt(input)

  try {
    const res = await fetch(DEEPSEEK_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        buildDeepSeekCompletionBody('chat', {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 1200,
          temperature: 0.45,
        })
      ),
    })

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      error?: { message?: string }
    }

    if (!res.ok) {
      return { error: json?.error?.message || res.statusText || 'DeepSeek lỗi' }
    }

    const raw = json.choices?.[0]?.message?.content?.trim()
    if (!raw) return { error: 'AI không trả về nội dung.' }

    const text = stripModelWrapping(raw)
    if (!text) return { error: 'AI không trả về nội dung.' }

    trackOpenAiStyleCompletionUsage({
      userId: input.userId ?? null,
      model,
      feature: `wedding-card-text-polish-${input.field}`,
      usage: json.usage,
      fallbackPromptChars: SYSTEM_PROMPT.length + userPrompt.length,
      fallbackOutputChars: text.length,
    })

    return { text }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Không gọi được DeepSeek.' }
  }
}

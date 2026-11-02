import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import { invitationComposeBrief } from '@/lib/wedding/invitation-compose'
import { invitationEditorCopy, normalizeInvitationOccasion } from '@/lib/wedding/invitation-occasion'

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

const SYSTEM_PROMPT = `Bạn là nhà văn, biên tập viên thiệp tiếng Việt. Trau chuốt bản nháp đúng loại thiệp khách đang làm — không viết sang loại khác.
Quy tắc bắt buộc:
- Giữ tên, ngày và quy định trang phục nếu bản nháp đã có.
- Không viết địa chỉ, tên đường, tên nhà hàng, thôn xã, quận huyện hay cụm «tại …». Nếu bản nháp có địa chỉ thì bỏ và viết lại cho câu vẫn trọn ý.
- Không khẩu hiệu, không sáo rỗng. Không giải thích, không markdown, không bọc dấu ngoặc kép ở hai đầu — chỉ trả về đoạn đã hoàn thiện.`

const NO_SHARED_ADDRESS =
  'Không viết địa chỉ, tên đường, tên nhà hàng hay cụm «tại …». Nếu bản nháp có địa chỉ thì bỏ. Giữ ngày nếu bản nháp đã có.'

function fieldInstruction(field: WeddingPolishField, occasionKey: unknown): string {
  const brief = invitationComposeBrief(occasionKey)
  const editor = invitationEditorCopy(occasionKey)
  switch (field) {
    case 'coupleIntro':
      return `Loại thiệp: ${editor.label}. ${brief.introBrief} ${brief.toneBrief} ${NO_SHARED_ADDRESS}`
    case 'loveQuote':
      return `Loại thiệp: ${editor.label}. ${brief.quoteBrief} Đúng MỘT câu, đọc một hơi là hết. CẤM nối nhiều vế, CẤM đoạn văn. Nếu bản nháp dài thì rút còn một câu ngắn. Không đặt dấu ngoặc kép ở hai đầu. ${NO_SHARED_ADDRESS}`
    case 'eventTimeline':
      return `Loại thiệp: ${editor.label}. Lịch trình buổi này. Mỗi mốc một dòng: HH:MM | Tiêu đề - Ghi chú. Giữ mốc thời gian và thứ tự. Không ghi địa chỉ hay «tại …».`
    case 'dressCode':
      return `Loại thiệp: ${editor.label}. Lưu ý trang phục / điều khách cần biết cho đúng buổi này. Nhã, rõ. ${NO_SHARED_ADDRESS}`
    case 'storyText':
      return `Loại thiệp: ${editor.label}. ${brief.storyBrief} ${brief.toneBrief} ${NO_SHARED_ADDRESS}`
    case 'thankYouText':
      return `Loại thiệp: ${editor.label}. ${brief.thanksBrief} ${NO_SHARED_ADDRESS}`
  }
}

export function buildWeddingPolishUserPrompt(input: {
  field: WeddingPolishField
  draft: string
  groomName?: string
  brideName?: string
  weddingDate?: string
  occasionKey?: string | null
}): string {
  const brief = invitationComposeBrief(input.occasionKey)
  const contextLines: string[] = []
  if (input.groomName?.trim() || input.brideName?.trim()) {
    const names = [input.groomName?.trim(), input.brideName?.trim()].filter(Boolean).join(' & ')
    contextLines.push(`${brief.namesLine}: ${names}`)
  }
  if (input.weddingDate?.trim()) contextLines.push(`${brief.dateLabel}: ${input.weddingDate.trim()}`)

  return [
    fieldInstruction(input.field, input.occasionKey),
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
    (out.startsWith('“') && out.endsWith('”')) ||
    (out.startsWith('”') && out.endsWith('”')) ||
    (out.startsWith('\'') && out.endsWith('\'')) ||
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
  occasionKey?: string | null
  userId?: string | null
}): Promise<{ text: string } | { error: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'Chưa cấu hình DEEPSEEK_API_KEY trên server.' }

  const draft = input.draft.trim()
  if (!draft) return { error: 'Nội dung trống.' }

  const model = resolveDeepSeekChatModel()
  const userPrompt = buildWeddingPolishUserPrompt(input)
  const temperature =
    input.field === 'loveQuote'
      ? 0.85
      : input.field === 'coupleIntro' || input.field === 'storyText'
        ? 0.75
        : input.field === 'eventTimeline'
          ? 0.2
          : 0.5

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
          max_tokens: input.field === 'loveQuote' ? 120 : 1200,
          temperature,
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

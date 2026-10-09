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

const SYSTEM_PROMPT = `Bạn là nhà văn, biên tập viên thiệp cưới tiếng Việt cao cấp, có văn phong thi vị, lãng mạn, sâu lắng và giàu chất thơ.
Nhiệm vụ: trau chuốt, nâng tầm bản nháp của cô dâu chú rể thành những câu chữ đong đầy xúc cảm, thi vị, tinh tế và rung động lòng người.
Quy tắc bắt buộc:
- Thổi hồn chất thơ, sự lãng mạn, thi vị và ngọt ngào vào câu từ. Tránh tuyệt đối giọng văn khẩu hiệu, lý thuyết khô khan, giáo điều hay sáo rỗng.
- Giữ trọn thông điệp cốt lõi và các dữ kiện thực tế nếu có (tên cặp đôi, ngày giờ, địa điểm, quy định trang phục...).
- Ngôn từ trong sáng, giàu nhạc điệu, gợi cảm giác bình yên, ấm áp và gắn kết trăm năm.
- Không giải thích, không dẫn dắt rườm rà, không markdown, không bọc dấu ngoặc kép ở hai đầu văn bản — chỉ trả về chính xác đoạn văn bản đã hoàn thiện.`

function fieldInstruction(field: WeddingPolishField): string {
  switch (field) {
    case 'coupleIntro':
      return 'Loại: Đoạn mở đầu thiệp cưới giới thiệu cặp đôi / duyên hạnh ngộ. 2–4 câu ngắn gọn nhưng giàu chất thơ, tinh tế, đong đầy niềm hạnh phúc và sự trân trọng khi hai người tìm thấy nhau giữa biển người mênh mông.'
    case 'loveQuote':
      return 'Loại: Quote tình yêu in trang trọng trên thiệp cưới (1–2 câu). Yêu cầu đặc biệt: Phải thật THI VỊ, lãng mạn, ngọt ngào, giàu hình ảnh gợi cảm và đong đầy xúc cảm lứa đôi (như bến đỗ bình yên, duyên lành nhân gian, ánh mắt tìm thấy tương lai, cùng nhau đi qua năm tháng bình yên...). CẤM văn phong khô cứng, giáo điều, triết lý nhạt nhòa (như "tình yêu là khởi đầu cuộc sống..."). Không đặt dấu ngoặc kép ở hai đầu.'
    case 'eventTimeline':
      return 'Loại: Lịch trình tiệc cưới. Giữ chuẩn cấu trúc mỗi mốc một dòng: HH:MM | Tiêu đề - Ghi chú. Chỉnh câu chữ cho trang trọng, rõ ràng. TUYỆT ĐỐI không thay đổi mốc thời gian hoặc thứ tự sự kiện.'
    case 'dressCode':
      return 'Loại: Dress code / lưu ý trang phục cho khách mời. Lời nhắn nhã nhặn, thanh lịch, tinh tế, khéo léo để khách cảm thấy thoải mái và vui vẻ hưởng ứng.'
    case 'storyText':
      return 'Loại: Câu chuyện tình yêu / kỷ niệm album cưới. 2–4 câu mang phong vị lãng mạn, êm đềm như một thước phim thanh xuân, diễn tả hành trình từ những rung động đầu tiên cho đến ngày chung đôi bền chặt.'
    case 'thankYouText':
      return 'Loại: Lời cảm ơn cuối thiệp cưới. 1–2 câu trang nhã, ấm áp, bày tỏ lòng tri ân chân thành tới những người thân thương đã đến chung vui và chúc phúc cho tình yêu đôi lứa.'
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
  venue?: string
  userId?: string | null
}): Promise<{ text: string } | { error: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'Chưa cấu hình DEEPSEEK_API_KEY trên server.' }

  const draft = input.draft.trim()
  if (!draft) return { error: 'Nội dung trống.' }

  const model = resolveDeepSeekChatModel()
  const userPrompt = buildUserPrompt(input)
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
          max_tokens: 1200,
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

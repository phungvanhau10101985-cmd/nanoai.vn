import { trackOpenAiStyleCompletionUsage } from '@/lib/track-ai-usage'
import {
  buildDeepSeekCompletionBody,
  DEEPSEEK_CHAT_COMPLETIONS_URL,
  resolveDeepSeekChatModel,
} from '@/lib/deepseek-api'
import {
  buildWeddingSampleComposePrompt,
  parseWeddingSampleComposeCopy,
  type WeddingSampleComposeCopy,
} from '@/lib/wedding/wedding-sample-compose'

const SYSTEM_PROMPT = `Bạn soạn lời thiệp tiếng Việt. Chỉ trả về JSON hợp lệ, không giải thích, không markdown.`

export async function composeWeddingSampleCopyWithDeepseek(input: {
  groomName: string
  brideName: string
  storyNotes: string
  weddingDate?: string
  occasionKey?: string | null
  userId?: string | null
}): Promise<{ copy: WeddingSampleComposeCopy } | { error: string }> {
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (!key) return { error: 'Chưa cấu hình DEEPSEEK_API_KEY trên server.' }

  const model = resolveDeepSeekChatModel()
  const userPrompt = buildWeddingSampleComposePrompt(input)

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
          max_tokens: 1400,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
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
    const copy = parseWeddingSampleComposeCopy(raw)
    if (!copy) return { error: 'AI không trả về đủ các đoạn văn.' }

    trackOpenAiStyleCompletionUsage({
      userId: input.userId ?? null,
      model,
      feature: 'wedding-card-sample-compose',
      usage: json.usage,
      fallbackPromptChars: SYSTEM_PROMPT.length + userPrompt.length,
      fallbackOutputChars: raw.length,
    })

    return { copy }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Không gọi được DeepSeek.' }
  }
}

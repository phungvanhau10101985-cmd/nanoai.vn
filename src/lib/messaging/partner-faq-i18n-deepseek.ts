import type { Json } from '@/types/database.types'
import { DEFAULT_WEB_LOCALE, WEB_LOCALES, type WebLocale } from '@/lib/i18n/config'
import { deepseekPartnerChat } from '@/lib/messaging/partner-ai-llm'

function stripJsonFence(raw: string): string {
  let s = raw.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  return s.trim()
}

/**
 * Dịch nội dung FAQ shop nhập sang đủ 5 ngôn ngữ giao diện khách (DeepSeek).
 * Trả về JSON lưu cột `answer_i18n`; lỗi API → `{}` (caller dùng `answer` khi resolve).
 */
export async function translateFaqAnswerToAllLocales(sourceAnswer: string): Promise<Json> {
  const src = sourceAnswer.trim()
  if (!src) return {}

  const system = `You are a professional translator for e-commerce / retail customer-care chat replies.
Output ONLY one valid JSON object (no markdown, no code fences, no commentary). Keys must be exactly: vi, en, zh, ja, ko.
Each value is the full FAQ reply text for customers in that language — natural, polite, suitable for chat.
Preserve line breaks as \\n where appropriate. Do not add JSON inside values.
The shop may write the source in any language; produce accurate equivalents for all five languages.`

  const user = `Translate this shop FAQ / auto-reply text into Vietnamese, English, Simplified Chinese, Japanese, and Korean.

Source text:
---
${src}
---

Return exactly:
{"vi":"...","en":"...","zh":"...","ja":"...","ko":"..."}`

  const r = await deepseekPartnerChat(system, user, {
    feature: 'messaging-faq-i18n-deepseek',
    userId: null,
  })
  if (r.error || !r.text) {
    console.warn('[translateFaqAnswerToAllLocales]', r.error || 'empty')
    return {}
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonFence(r.text))
  } catch {
    console.warn('[translateFaqAnswerToAllLocales] JSON parse failed')
    return {}
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

  const out: Record<string, string> = {}
  for (const loc of WEB_LOCALES) {
    const v = (parsed as Record<string, unknown>)[loc]
    if (typeof v === 'string' && v.trim()) out[loc] = v.trim()
  }
  return out as unknown as Json
}

/** Chọn câu trả lời gửi khách theo locale; fallback về `answer` gốc. */
export function resolveFaqAnswerForLocale(
  answer: string,
  answerI18n: Json | null | undefined,
  locale: WebLocale | null | undefined
): string {
  const loc = locale && WEB_LOCALES.includes(locale) ? locale : DEFAULT_WEB_LOCALE
  if (answerI18n && typeof answerI18n === 'object' && !Array.isArray(answerI18n)) {
    const raw = (answerI18n as Record<string, unknown>)[loc]
    if (typeof raw === 'string' && raw.trim()) return raw.trim()
    const fallbackVi = (answerI18n as Record<string, unknown>).vi
    if (typeof fallbackVi === 'string' && fallbackVi.trim()) return fallbackVi.trim()
  }
  return answer.trim()
}

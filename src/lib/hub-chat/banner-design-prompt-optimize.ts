import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { SALE_BANNER_DISCOVERY_BRIEF_KEYS } from '@/lib/hub-chat/hub-studio-preset-flows'

function outputLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function buildBriefContext(briefNotes: Record<string, string>): string {
  const lines: string[] = []
  for (const key of SALE_BANNER_DISCOVERY_BRIEF_KEYS) {
    const value = briefNotes[key]?.trim()
    if (value) lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

export async function optimizeBannerDesignPrompt(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  draft: string
  briefNotes: Record<string, string>
  aspectRatio?: string
  adChannelLabel?: string
  platformHint?: string
}): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const draft = input.draft.trim()
  if (!draft) {
    return { ok: false, error: 'EMPTY_DRAFT' }
  }

  const brief = buildBriefContext(input.briefNotes)
  const lang = outputLanguage(input.locale)

  const sys = `You are a senior performance marketing art director.
Rewrite the user's banner draft into ONE concise prompt for AI banner generation.

Output language: ${lang}.

Include in a single paragraph (use " · " to separate clauses when helpful):
1) Exact headline / offer / CTA text to print on the banner (keep user's language; improve wording if needed).
2) Clear layout direction: product placement, logo position, text hierarchy, CTA button style, background mood.
3) Match the ad channel and aspect ratio constraints.

Rules:
- Keep all factual details from the draft and campaign brief (discount %, product name, event) — do not invent new offers.
- Short, scannable copy suitable for ads; headline bold, CTA action-oriented.
- Max ~280 characters unless the draft is longer and needs preserving.
- Plain text only — no markdown, no quotes wrapping the whole answer, no explanation.`

  const userBlock = [
    input.adChannelLabel ? `Ad channel: ${input.adChannelLabel}` : '',
    input.aspectRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    input.platformHint ? `Channel hint: ${input.platformHint}` : '',
    brief ? `Campaign brief:\n${brief}` : '',
    `User draft:\n${draft}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const genAI = new GoogleGenerativeAI(input.apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.45, maxOutputTokens: 512 },
    })
    const r = await model.generateContent([{ text: `${sys}\n\n${userBlock}` }])
    await trackFromUsageMetadata(
      r.response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'hub-banner-design-prompt-optimize',
      input.userId
    )
    const text = r.response.text()?.trim().replace(/^["']|["']$/g, '') ?? ''
    if (!text) return { ok: false, error: 'EMPTY_RESPONSE' }
    return { ok: true, text }
  } catch {
    return { ok: false, error: 'API_ERROR' }
  }
}

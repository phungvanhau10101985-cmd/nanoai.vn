import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { SALE_BANNER_DISCOVERY_BRIEF_KEYS } from '@/lib/hub-chat/hub-studio-preset-flows'

function buildBriefContext(briefNotes: Record<string, string>): string {
  const lines: string[] = []
  for (const key of SALE_BANNER_DISCOVERY_BRIEF_KEYS) {
    const value = briefNotes[key]?.trim()
    if (value) lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

/** AI viết prompt tiếng Anh riêng cho từng tỷ lệ/kênh — đưa vào mô hình tạo ảnh. */
export async function buildBannerImageGenerationPrompt(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  briefNotes: Record<string, string>
  designBrief: string
  aspectRatio: string
  adChannelLabel: string
  platformHint: string
  hasReferenceImages: boolean
}): Promise<{ ok: true; prompt: string } | { ok: false; error: string }> {
  const brief = buildBriefContext(input.briefNotes)
  const designBrief = input.designBrief.trim()
  if (!designBrief && !brief) {
    return { ok: false, error: 'EMPTY_BRIEF' }
  }

  const sys = `You are a senior performance marketing art director writing prompts for an AI image generator (Gemini).

Write ONE detailed English image-generation prompt for a single finished ad banner image.

Must include:
- Exact headline / offer / CTA text to render on the banner (keep user's language for on-image text if provided in the brief).
- Layout tuned to aspect ratio ${input.aspectRatio} and channel: ${input.adChannelLabel}.
- ${input.platformHint}
- Color palette, typography style, background mood from the campaign brief.
- Product/logo placement if mentioned; if no reference photos, invent a cohesive product-forward or brand-forward visual (no placeholder boxes).
- Professional ad quality: readable hierarchy, safe margins, high contrast CTA.

Rules:
- Output English prompt only — no markdown, no quotes wrapping the whole answer, no explanation.
- Do NOT invent discount numbers or offers not in the brief.
- 120–350 words.
- End intent: one polished banner image only, no mockup frame, no watermark.`

  const userBlock = [
    `Aspect ratio: ${input.aspectRatio}`,
    `Ad channel: ${input.adChannelLabel}`,
    input.hasReferenceImages
      ? 'Reference product/logo images will be attached — composite them naturally on the banner.'
      : 'No reference images — generate the full banner from text brief only.',
    brief ? `Campaign brief:\n${brief}` : '',
    `Design copy & layout direction:\n${designBrief}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const genAI = new GoogleGenerativeAI(input.apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.55, maxOutputTokens: 900 },
    })
    const r = await model.generateContent([{ text: `${sys}\n\n${userBlock}` }])
    await trackFromUsageMetadata(
      r.response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'hub-banner-image-prompt-build',
      input.userId
    )
    const prompt = r.response.text()?.trim().replace(/^["']|["']$/g, '') ?? ''
    if (!prompt) return { ok: false, error: 'EMPTY_RESPONSE' }
    return { ok: true, prompt }
  } catch {
    return { ok: false, error: 'API_ERROR' }
  }
}

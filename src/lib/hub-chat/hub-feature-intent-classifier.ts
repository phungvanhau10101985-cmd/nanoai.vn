import { GoogleGenerativeAI } from '@google/generative-ai'

import { buildFullFeatureCatalogForBrain } from '@/lib/hub-chat/hub-feature-catalog'
import { getHubFeatureCatalogEntry } from '@/lib/hub-chat/hub-feature-catalog'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import type { WebLocale } from '@/lib/i18n/config'

export type FeatureIntentClassification = {
  featureKey: string | null
  confidence: number
}

function langName(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

export function parseFeatureIntentClassifierJson(text: string): FeatureIntentClassification {
  const fallback: FeatureIntentClassification = { featureKey: null, confidence: 0 }
  const raw = text.trim()
  if (!raw) return fallback

  try {
    const row = JSON.parse(raw) as Record<string, unknown>
    const confidenceRaw = Number(row.confidence)
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0
    const featureKey = String(row.featureKey ?? '').trim()
    if (!featureKey) return { featureKey: null, confidence: 0 }
    return { featureKey, confidence }
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    try {
      return parseFeatureIntentClassifierJson(match[0])
    } catch {
      return fallback
    }
  }
}

export async function classifyFeatureIntentWithAi(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  message: string
  currentPresetId?: string | null
}): Promise<FeatureIntentClassification> {
  const trimmed = input.message.trim()
  if (!trimmed) return { featureKey: null, confidence: 0 }

  const catalog = buildFullFeatureCatalogForBrain(input.locale)
  const currentLine = input.currentPresetId
    ? `Current inline flow preset: ${input.currentPresetId} (${presetTitle(input.locale, input.currentPresetId)}).`
    : 'No inline flow is active.'

  const sys = `You classify which NanoAI feature the user wants from the FULL catalog.

Reply in ${langName(input.locale)} internally, but output JSON only.

${currentLine}

FULL FEATURE CATALOG (featureKey is authoritative — server routes programmatically):
${catalog}

Rules:
- featureKey MUST be empty string when the user continues the CURRENT inline step (brief, packaging face text, approvals, regenerate current step, dimensions, colors) OR message is unrelated to starting/using another feature.
- featureKey MUST be set when user clearly wants a DIFFERENT feature: standalone tool (tool:...) OR another inline studio flow (studio:...).
- Examples: "tôi cần làm nét ảnh" → tool:/lam-net-anh; "tạo giáo trình" → tool:/tao-giao-trinh; "tạo web" / "tạo giao diện web" / "thiết kế web app" → studio:mobile_shop; ONLY "tạo landing page" / "tạo ladipage" → studio:landing_page.
- When ambiguous or unsure: featureKey empty, confidence below 0.5.
- Never invent featureKey values not in the catalog.

Respond with ONLY valid JSON:
{"featureKey":"","confidence":0.0}`

  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 140,
      responseMimeType: 'application/json',
    },
  })

  try {
    const r = await model.generateContent([{ text: `${sys}\n\nUser message:\n${trimmed}` }])
    await trackFromUsageMetadata(
      r.response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'hub-chat-feature-intent',
      input.userId
    )
    const parsed = parseFeatureIntentClassifierJson(r.response.text()?.trim() ?? '')
    if (!parsed.featureKey || !getHubFeatureCatalogEntry(input.locale, parsed.featureKey)) {
      return { featureKey: null, confidence: 0 }
    }
    return parsed
  } catch {
    return { featureKey: null, confidence: 0 }
  }
}

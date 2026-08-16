import { GoogleGenerativeAI } from '@google/generative-ai'

import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  FLOW_SWITCH_AI_MIN_CONFIDENCE,
  shouldSkipFlowSwitchAiClassification,
} from '@/lib/hub-chat/hub-studio-flow-guard'
import { buildPresetCatalogForBrain, isValidStudioPresetId } from '@/lib/hub-chat/hub-studio-preset-intent'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import type { WebLocale } from '@/lib/i18n/config'

export { FLOW_SWITCH_AI_MIN_CONFIDENCE, shouldSkipFlowSwitchAiClassification }

export type StudioFlowSwitchClassification = {
  switchPresetId: string | null
  confidence: number
}

function langName(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

export function parseFlowSwitchClassifierJson(text: string): StudioFlowSwitchClassification {
  const fallback: StudioFlowSwitchClassification = { switchPresetId: null, confidence: 0 }
  const raw = text.trim()
  if (!raw) return fallback

  try {
    const row = JSON.parse(raw) as Record<string, unknown>
    const confidenceRaw = Number(row.confidence)
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0
    const switchPresetId = String(row.switchPresetId ?? '').trim()
    if (!switchPresetId || !isValidStudioPresetId(switchPresetId)) {
      return { switchPresetId: null, confidence: 0 }
    }
    return { switchPresetId, confidence }
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return fallback
    try {
      return parseFlowSwitchClassifierJson(match[0])
    } catch {
      return fallback
    }
  }
}

export function isHighConfidenceFlowSwitch(
  result: StudioFlowSwitchClassification,
  currentPresetId: string | null | undefined
): boolean {
  if (!result.switchPresetId || result.confidence < FLOW_SWITCH_AI_MIN_CONFIDENCE) return false
  if (!currentPresetId || result.switchPresetId === currentPresetId) return false
  return true
}

export async function classifyStudioFlowSwitchWithAi(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  message: string
  currentPresetId: string
}): Promise<StudioFlowSwitchClassification> {
  const trimmed = input.message.trim()
  if (!trimmed || shouldSkipFlowSwitchAiClassification(trimmed)) {
    return { switchPresetId: null, confidence: 0 }
  }

  const currentTitle = presetTitle(input.locale, input.currentPresetId)
  const catalog = buildPresetCatalogForBrain(input.locale)
  const sys = `You classify whether a user wants to STOP the current inline design project and START a DIFFERENT Studio preset.

Reply in ${langName(input.locale)} internally, but output JSON only.

Current active preset: ${input.currentPresetId} (${currentTitle})

Available preset ids (pick switchPresetId ONLY from this list):
${catalog}

Rules:
- switchPresetId MUST be empty string when the user continues the current project: step brief, design feedback, colors, logo notes, approvals ("ok", "tiếp theo"), regenerate requests, packaging face content, dimensions, or general questions about the current step.
- switchPresetId MUST be a different preset id ONLY when the user clearly asks to start/switch to another project type (new app, wedding invite, landing page, interior, etc.) in ANY natural wording or language.
- "tạo web" / "tạo giao diện web" / "thiết kế web app" → mobile_shop. ONLY explicit "landing page" / "ladipage" → landing_page.
- When ambiguous or unsure: switchPresetId empty, confidence below 0.5.
- Never invent preset ids.

Respond with ONLY valid JSON:
{"switchPresetId":"","confidence":0.0}`

  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 120,
      responseMimeType: 'application/json',
    },
  })

  try {
    const r = await model.generateContent([{ text: `${sys}\n\nUser message:\n${trimmed}` }])
    await trackFromUsageMetadata(
      r.response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'hub-chat-flow-switch',
      input.userId
    )
    return parseFlowSwitchClassifierJson(r.response.text()?.trim() ?? '')
  } catch {
    return { switchPresetId: null, confidence: 0 }
  }
}

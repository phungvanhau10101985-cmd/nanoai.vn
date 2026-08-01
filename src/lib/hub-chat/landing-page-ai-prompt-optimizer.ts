import { GoogleGenerativeAI } from '@google/generative-ai'

import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import {
  buildLandingStructuredImagePrompt,
  formatLandingBriefBlock,
} from '@/lib/hub-chat/landing-page-prompt-builder'
import { presetTitle } from '@/lib/hub-chat/hub-studio-presets'
import type { HubStudioSession } from '@/lib/hub-chat/hub-studio-types'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'

const MAX_IMAGE_PROMPT_CHARS = 4500
const AI_OPTIMIZE_TIMEOUT_MS = 12000

function outputLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

export function formatLandingCustomerBrief(input: {
  locale: WebLocale
  session: HubStudioSession
  sectionCopy?: string
}): string {
  return formatLandingBriefBlock(input)
}

function buildOptimizerSystemPrompt(locale: WebLocale): string {
  const lang = outputLanguage(locale)
  return `You are a direct-response copywriter. Write ONE image-generation prompt (plain text, no markdown fences) for a single tall landing-page mockup (1:4 portrait).

Structure (keep concise — MAX 3500 characters total):
- Line 1: instruct ONE vertical landing mockup, 1:4, all sections in one scroll image
- PRODUCT & BRAND block from brief
- 10 sections with short headline/copy hints: Hero, Pain, Solution, 4 Features, Pricing, 3 Reviews, Form fields, Trust badges, FAQ, CTA
- Style/colors from brief
- Rules: on-page UI text in ${lang}; composite attached logo in header; no code/HTML

Use brief facts only; infer missing details plausibly. Output ONLY the prompt.`
}

function capPrompt(text: string): string {
  if (text.length <= MAX_IMAGE_PROMPT_CHARS) return text
  return `${text.slice(0, MAX_IMAGE_PROMPT_CHARS)}\n\n[Continue remaining FAQ + bottom CTA visually.]`
}

export type LandingPromptOptimizeResult = {
  prompt: string
  optimizedByAi: boolean
}

async function callLandingPromptAi(input: {
  userId: string
  apiKey: string
  locale: WebLocale
  projectTitle: string
  stepLabel: string
  customerBrief: string
}): Promise<string | null> {
  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({
    ...GEMINI_25_FLASH_NO_THINKING,
    generationConfig: { temperature: 0.5, maxOutputTokens: 2048 },
  })

  const userMessage = `Project: ${input.projectTitle}
Step: ${input.stepLabel}

BRIEF:
${input.customerBrief}`

  const aiPromise = model.generateContent([
    { text: `${buildOptimizerSystemPrompt(input.locale)}\n\n${userMessage}` },
  ])

  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), AI_OPTIMIZE_TIMEOUT_MS)
  })

  const raced = await Promise.race([
    aiPromise.then((response) => ({ timedOut: false as const, response })),
    timeoutPromise.then(() => ({ timedOut: true as const, response: null })),
  ])
  if (raced.timedOut || !raced.response) return null

  const r = raced.response

  await trackFromUsageMetadata(
    r.response.usageMetadata,
    GEMINI_25_FLASH_NO_THINKING.model,
    'hub-chat-landing-prompt',
    input.userId
  )

  const optimized = r.response.text()?.trim() ?? ''
  if (optimized.length < 200) return null
  return capPrompt(optimized)
}

export async function optimizeLandingImagePromptWithAi(input: {
  userId: string
  apiKey: string
  locale: WebLocale
  session: HubStudioSession
  sectionCopy: string
  stepLabel: string
}): Promise<LandingPromptOptimizeResult> {
  const structured = buildLandingStructuredImagePrompt({
    locale: input.locale,
    session: input.session,
    sectionCopy: input.sectionCopy,
    stepLabel: input.stepLabel,
  })

  const customerBrief = formatLandingBriefBlock({
    locale: input.locale,
    session: input.session,
    sectionCopy: input.sectionCopy,
  })
  if (!customerBrief.trim()) {
    return { prompt: structured, optimizedByAi: false }
  }

  const productName = input.session.briefNotes.product_name?.trim()
  const projectTitle =
    input.session.projectTitle?.trim() || productName || presetTitle(input.locale, 'landing_page')

  try {
    const optimized = await callLandingPromptAi({
      userId: input.userId,
      apiKey: input.apiKey,
      locale: input.locale,
      projectTitle,
      stepLabel: input.stepLabel,
      customerBrief,
    })
    if (optimized) {
      return { prompt: optimized, optimizedByAi: true }
    }
  } catch {
    // fall through to structured
  }

  return { prompt: capPrompt(structured), optimizedByAi: false }
}

export async function resolveLandingImageGenerationPrompt(input: {
  userId: string
  apiKey: string
  locale: WebLocale
  session: HubStudioSession
  sectionCopy: string
  stepLabel: string
}): Promise<LandingPromptOptimizeResult> {
  return optimizeLandingImagePromptWithAi(input)
}

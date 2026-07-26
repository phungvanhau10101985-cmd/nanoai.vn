import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import { FOOD_MENU_DISCOVERY_BRIEF_KEYS } from '@/lib/hub-chat/hub-studio-preset-flows'
import { formatMenuDishesForPrompt, type MenuDishItem } from '@/lib/hub-chat/menu-dish-items'
import {
  getMenuFormatPresetById,
  getMenuFormatPresetLabel,
  type MenuFormatPresetId,
} from '@/lib/hub-chat/menu-format-presets'

const PROMPT_SECTION_MARKER = '---IMAGE_PROMPT---'

function outputLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function buildBriefSection(briefNotes: Record<string, string>, keys: readonly string[]): string {
  const lines: string[] = []
  for (const key of keys) {
    const value = briefNotes[key]?.trim()
    if (value) lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

function wantsFoodIllustration(briefNotes: Record<string, string>): boolean {
  const raw = briefNotes.food_illustration?.trim().toLowerCase() ?? ''
  if (!raw) return true
  if (/không|khong|no\b|none| không | không$|^không|^no |without|无|没有|なし|없/i.test(raw)) {
    return false
  }
  return true
}

/**
 * Gemini: write English image-generation prompt for a restaurant/cafe menu design.
 */
export async function buildMenuImageGenerationPrompt(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  briefNotes: Record<string, string>
  dishes: MenuDishItem[]
  formatPresetId: MenuFormatPresetId
  aspectRatio: string
  formatLabel: string
  venueName?: string
  hasLogo?: boolean
}): Promise<{ ok: true; prompt: string } | { ok: false; error: string }> {
  const discoveryBrief = buildBriefSection(input.briefNotes, FOOD_MENU_DISCOVERY_BRIEF_KEYS)
  const dishBlock = formatMenuDishesForPrompt(input.dishes)
  if (!dishBlock.trim()) {
    return { ok: false, error: 'EMPTY_DISHES' }
  }

  const includeIllustrations = wantsFoodIllustration(input.briefNotes)
  const lang = outputLanguage(input.locale)
  const formatHint = getMenuFormatPresetLabel(getMenuFormatPresetById(input.formatPresetId), input.locale)
  const venueHeader = input.venueName?.trim()

  const sys = `You are a senior graphic designer specializing in restaurant and café menu design.

Output EXACTLY one section:

${PROMPT_SECTION_MARKER}
(one detailed English image-generation prompt, 200–450 words, flowing prose)

Rules:
- English only — no markdown, no quotes wrapping the whole section.
- Goal: one finished, print-ready menu design — not a mockup frame or photo of a menu on a table unless brief asks for context.
- Target format: ${input.aspectRatio} (${formatHint}).
- Venue/menu text language on the design: ${lang}.
- Menu items below MUST appear on the design with order number, dish name, unit, and price in VND exactly as provided — do not invent items or prices.
${includeIllustrations ? '- Include appetizing food illustration photos or stylized dish icons beside relevant items — cohesive style, not cluttered.' : '- Text-only menu layout — NO food photos or dish illustrations; use typography, dividers, and decorative graphic elements only.'}
- Reflect menu_type, menu_style, and color_tone from the brief in layout, typography, and decoration.
- Professional restaurant menu typography: clear hierarchy (venue name/header, categories if implied, item rows with aligned prices).
${venueHeader ? `- Print this venue/brand name prominently in the menu header: ${venueHeader}` : '- Include a prominent venue/brand name header from the brief.'}
${input.hasLogo ? '- A brand LOGO image will be attached — embed the exact logo pixels in the header; do NOT redraw or replace with typed text.' : ''}
- High contrast readable prices; Vietnamese đ suffix or VND label as appropriate.
- Safe margins for print; no watermark; no lorem ipsum.`

  const userBlock = [
    discoveryBrief ? `Discovery brief:\n${discoveryBrief}` : '',
    venueHeader ? `Venue / brand name on menu: ${venueHeader}` : '',
    `Menu format: ${formatHint} (${input.aspectRatio})`,
    `Include food illustrations: ${includeIllustrations ? 'yes' : 'no'}`,
    input.hasLogo ? 'Brand LOGO image will be attached for header placement.' : '',
    `Menu items (print verbatim):\n${dishBlock}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const genAI = new GoogleGenerativeAI(input.apiKey)
  const model = genAI.getGenerativeModel({ model: GEMINI_25_FLASH_NO_THINKING })
  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: `${sys}\n\n${userBlock}` }] }],
  })
  await trackFromUsageMetadata(input.userId, 'hub_studio_menu_prompt', result.response.usageMetadata)

  const raw = result.response.text().trim()
  const markerIdx = raw.indexOf(PROMPT_SECTION_MARKER)
  const imagePrompt =
    markerIdx >= 0
      ? raw.slice(markerIdx + PROMPT_SECTION_MARKER.length).trim()
      : raw
  if (!imagePrompt) {
    return { ok: false, error: 'EMPTY_PROMPT' }
  }
  return { ok: true, prompt: imagePrompt }
}

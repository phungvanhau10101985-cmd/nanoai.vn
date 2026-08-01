import type { WebLocale } from '@/lib/i18n/config'
import { FOOD_MENU_DISCOVERY_BRIEF_KEYS } from '@/lib/hub-chat/hub-studio-preset-flows'
import { formatMenuInputForPrompt, type MenuDishItem } from '@/lib/hub-chat/menu-dish-items'
import type { MenuFormatPresetId } from '@/lib/hub-chat/menu-format-presets'

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

export type MenuImagePromptBuildInput = {
  locale: WebLocale
  briefNotes: Record<string, string>
  dishes: MenuDishItem[]
  dishesBulkText?: string
  formatPresetId: MenuFormatPresetId
  aspectRatio: string
  formatLabel: string
  venueName?: string
  hasLogo?: boolean
}

export type MenuImagePromptBuildResult =
  | { ok: true; prompt: string }
  | { ok: false; error: 'EMPTY_DISHES' }

/**
 * Ghép prompt tạo ảnh menu trực tiếp từ brief + nội dung người dùng — không qua AI tối ưu.
 */
export function buildMenuImageGenerationPrompt(
  input: MenuImagePromptBuildInput
): MenuImagePromptBuildResult {
  const discoveryBrief = buildBriefSection(input.briefNotes, FOOD_MENU_DISCOVERY_BRIEF_KEYS)
  const dishBlock = formatMenuInputForPrompt(input.dishes, input.dishesBulkText)
  if (!dishBlock.trim()) {
    return { ok: false, error: 'EMPTY_DISHES' }
  }

  const includeIllustrations = wantsFoodIllustration(input.briefNotes)
  const lang = outputLanguage(input.locale)
  const venueHeader = input.venueName?.trim()

  const illustrationRule = includeIllustrations
    ? 'Include small appetizing food illustration photos or stylized dish icons beside relevant items (not drinks) — cohesive style, not cluttered.'
    : 'Text-only menu layout — NO food photos or dish illustrations; use typography, dividers, and decorative graphic elements only.'

  const parts = [
    `Design one finished, print-ready restaurant/café menu — not a mockup frame or photo of a menu on a table.`,
    `Target format: ${input.aspectRatio} (${input.formatLabel}).`,
    `All menu text on the design must be in ${lang}.`,
    illustrationRule,
    `Reflect menu_type, menu_style, and color_tone from the brief in layout, typography, and decoration.`,
    `Professional menu typography: clear hierarchy (venue header, category titles, item rows with aligned prices in VND).`,
    `Print EVERY menu item below verbatim — all categories, names, units, and prices; do not omit, summarize, or invent items.`,
    `High-contrast readable prices; use VNĐ suffix where appropriate.`,
    `Safe margins for print; no watermark; no lorem ipsum.`,
  ]

  if (venueHeader) {
    parts.push(`Venue / brand name to print prominently in the menu header: ${venueHeader}`)
  }
  if (input.hasLogo) {
    parts.push(
      `A brand LOGO image will be attached — embed the exact logo pixels in the header; do NOT redraw or replace with typed text.`
    )
  }

  const prompt = [
    parts.join('\n'),
    discoveryBrief ? `\nDiscovery brief:\n${discoveryBrief}` : '',
    `\nMENU CONTENT (print verbatim):\n${dishBlock}`,
  ]
    .filter(Boolean)
    .join('\n')

  return { ok: true, prompt }
}

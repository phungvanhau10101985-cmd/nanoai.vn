import { isLandingDesignStepKey } from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  getStepGenerator,
  type StudioGeneratorKind,
} from '@/lib/hub-chat/hub-studio-presets'

export type ImagePromptPolishTarget =
  | 'composer'
  | 'banner_overlay'
  | 'menu_bulk'
  | 'landing_section'
  | 'landing_logo'

const IMAGE_PROMPT_POLISH_TARGETS = new Set<ImagePromptPolishTarget>([
  'composer',
  'banner_overlay',
  'menu_bulk',
  'landing_section',
  'landing_logo',
])

const NON_IMAGE_GENERATORS = new Set<StudioGeneratorKind>([
  'lyria_music',
  'dieline_pdf',
  'box_net',
  'barcode',
  'bag_dieline_pdf',
])

export const IMAGE_PROMPT_POLISH_SYSTEM = `You rewrite a shopper's rough note into one clear brief for the image they are about to generate. They will read and edit your text before any image is created.

Rules:
- Reply in the same language as the draft.
- Organize subject, layout, and what should be visible, using only ideas already in the draft.
- Any name, slogan, price, ingredient, instruction, warning, address, number, or other wording meant to appear in the image must be copied character-for-character. Never translate, transliterate, spell-correct, summarize, or drop those strings.
- Do not invent product claims, prices, ingredients, slogans, or brand names that are not in the draft.
- No markdown, no preamble, no explanation. Return only the rewritten brief.`

export const LOGO_PROMPT_POLISH_SYSTEM = `You rewrite a shopper's rough note into one clear logo brief. They will read and edit your text before any image is generated.

Rules:
- Reply in the same language as the draft.
- Describe wordmark, icon, colors, and style using only ideas already in the draft.
- Any brand name or lettering meant to appear in the logo must be copied character-for-character. Never translate, transliterate, spell-correct, summarize, or drop those strings.
- Do not invent brand names, slogans, or colors that are not in the draft.
- No markdown, no preamble. Return only the rewritten brief.`

export const MENU_LIST_POLISH_SYSTEM = `You tidy a shopper's pasted menu into a clear list for a menu image. They will read and edit your text before any image is generated.

Rules:
- Reply in the same language as the draft.
- Keep every dish or drink name, unit, and price character-for-character. Never translate, spell-correct, drop, or invent items.
- Keep prices and numbers exactly, including separators.
- One item per line when the draft is a list. You may add a blank line between groups that already exist.
- No markdown, no preamble. Return only the tidied list.`

export function parseImagePromptPolishTarget(value: unknown): ImagePromptPolishTarget | undefined {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (IMAGE_PROMPT_POLISH_TARGETS.has(raw as ImagePromptPolishTarget)) {
    return raw as ImagePromptPolishTarget
  }
  return undefined
}

export function isImagePromptPolishGenerator(
  generator: StudioGeneratorKind | null | undefined
): boolean {
  if (!generator) return false
  return !NON_IMAGE_GENERATORS.has(generator)
}

export function isImagePromptPolishStep(
  presetId: string | null | undefined,
  stepKey: string | null | undefined
): boolean {
  if (!presetId || !stepKey) return false
  return isImagePromptPolishGenerator(getStepGenerator(presetId, stepKey))
}

export function imagePromptPolishAllowed(input: {
  presetId: string | null | undefined
  stepKey: string | null | undefined
  discoveryComplete: boolean
  pendingPreview: boolean
  target: ImagePromptPolishTarget
}): boolean {
  if (!input.discoveryComplete || input.pendingPreview) return false
  if (input.target === 'landing_logo') return input.presetId === 'landing_page'
  if (input.target === 'banner_overlay') {
    return (
      input.presetId === 'sale_banner' &&
      (input.stepKey === 'banner_design' || input.stepKey === 'banner_ad_format')
    )
  }
  if (input.target === 'menu_bulk') {
    return input.presetId === 'food_menu' && input.stepKey === 'menu_design'
  }
  if (input.target === 'landing_section') {
    return input.presetId === 'landing_page' && isLandingDesignStepKey(input.stepKey)
  }
  return isImagePromptPolishStep(input.presetId, input.stepKey)
}

/** Số có từ 2 chữ số — giá, dung tích, năm — phải còn nguyên sau khi viết lại. */
export function missingNumericTokens(draft: string, polished: string): string[] {
  const tokens = draft.match(/\d[\d.,]*/g) ?? []
  const unique = [
    ...new Set(tokens.filter((token) => token.replace(/\D/g, '').length >= 2)),
  ]
  return unique.filter((token) => !polished.includes(token))
}

import type { WebLocale } from '@/lib/i18n/config'
import {
  SALE_BANNER_COPY_BRIEF_KEYS,
  SALE_BANNER_VISUAL_BRIEF_KEYS,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import { getBannerPresetLayoutGuidance, MULTI_RATIO_BANNER_LAYOUT_GUIDANCE } from '@/lib/hub-chat/banner-preset-layout-guidance'

export type BannerAdChannelContext = {
  presetId: string
  aspectRatio: string
  adChannelLabel: string
  platformHint: string
}

export type BannerImagePromptBuildInput = {
  locale: WebLocale
  briefNotes: Record<string, string>
  /** Nội dung người dùng nhập ở bước thiết kế banner (overlay / layout). */
  overlayText?: string
  presetId: string
  aspectRatio: string
  adChannelLabel: string
  platformHint: string
  hasReferenceImages: boolean
  hasLogo?: boolean
  allAdChannels?: BannerAdChannelContext[]
}

export type BannerImagePromptBuildResult =
  | { ok: true; prompt: string; structuredCopy: string; imageCopy: string }
  | { ok: false; error: 'EMPTY_BRIEF' }

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

function hasBannerInput(briefNotes: Record<string, string>, overlayText?: string): boolean {
  if (overlayText?.trim()) return true
  return (
    SALE_BANNER_COPY_BRIEF_KEYS.some((k) => Boolean(briefNotes[k]?.trim())) ||
    SALE_BANNER_VISUAL_BRIEF_KEYS.some((k) => Boolean(briefNotes[k]?.trim()))
  )
}

/**
 * Ghép prompt tạo ảnh banner trực tiếp từ brief + nội dung người dùng — không qua AI tối ưu.
 */
export function buildBannerImageGenerationPrompt(
  input: BannerImagePromptBuildInput
): BannerImagePromptBuildResult {
  const overlay = input.overlayText?.trim() ?? ''
  const copyBrief = buildBriefSection(input.briefNotes, SALE_BANNER_COPY_BRIEF_KEYS)
  const visualBrief = buildBriefSection(input.briefNotes, SALE_BANNER_VISUAL_BRIEF_KEYS)
  if (!hasBannerInput(input.briefNotes, overlay)) {
    return { ok: false, error: 'EMPTY_BRIEF' }
  }

  const multiRatio = (input.allAdChannels?.length ?? 0) > 1
  const layoutGuidance = multiRatio
    ? MULTI_RATIO_BANNER_LAYOUT_GUIDANCE
    : getBannerPresetLayoutGuidance(input.presetId)
  const lang = outputLanguage(input.locale)

  const channelSummary = multiRatio
    ? input.allAdChannels!
        .map((c, i) => `${i + 1}. ${c.adChannelLabel} — aspect ${c.aspectRatio}. ${c.platformHint}`)
        .join('\n')
    : `${input.adChannelLabel} — aspect ${input.aspectRatio}. ${input.platformHint}`

  const parts = [
    `Design one finished, production-ready display ad banner — not a mockup frame or photo of a banner on a desk.`,
    multiRatio
      ? `This creative will be adapted to multiple aspect ratios — keep a cohesive layout system.\nTarget formats:\n${channelSummary}`
      : `Target: aspect ratio ${input.aspectRatio}, channel "${input.adChannelLabel}".\n${input.platformHint}`,
    `On-banner text language: ${lang}.`,
    `Follow layout guidance:\n${layoutGuidance}`,
    `Use campaign copy and user instructions below exactly — do not invent discounts, prices, or offers not provided.`,
    `Visual brief fields (brand_style, color_tone, banner_style, banner_model) guide scene/colors/model only — do NOT print those field labels on the banner.`,
    `Professional ad photography or graphic design, readable hierarchy, safe margins, high-contrast CTA, no watermark.`,
  ]

  if (input.hasLogo) {
    parts.push(
      `A brand LOGO image will be attached — embed the exact logo pixels; do NOT redraw or replace with typed domain text.`
    )
  } else if (input.hasReferenceImages) {
    parts.push(`Reference product photos will be attached — match products shown.`)
  }

  const contentBlocks: string[] = []
  if (copyBrief) {
    contentBlocks.push(`Campaign copy brief (use for on-banner text where applicable):\n${copyBrief}`)
  }
  if (visualBrief) {
    contentBlocks.push(`Visual direction (image/scene only — NOT banner text):\n${visualBrief}`)
  }
  if (overlay) {
    contentBlocks.push(`User banner copy & layout (print / follow as provided):\n${overlay}`)
  }

  const prompt = [parts.join('\n'), ...contentBlocks].filter(Boolean).join('\n\n')

  const structuredCopy = overlay || copyBrief
  const imageCopy = overlay || copyBrief

  return { ok: true, prompt, structuredCopy, imageCopy }
}

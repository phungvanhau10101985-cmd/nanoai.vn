import { GoogleGenerativeAI } from '@google/generative-ai'
import type { WebLocale } from '@/lib/i18n/config'
import { GEMINI_25_FLASH_NO_THINKING } from '@/lib/gemini-config'
import { trackFromUsageMetadata } from '@/lib/track-ai-usage'
import {
  SALE_BANNER_COPY_BRIEF_KEYS,
  SALE_BANNER_VISUAL_BRIEF_KEYS,
} from '@/lib/hub-chat/hub-studio-preset-flows'
import {
  formatBannerOnImageCopyForGeneration,
  parseBannerOnImageCopy,
} from '@/lib/hub-chat/banner-on-image-copy'
import { getBannerPresetLayoutGuidance, MULTI_RATIO_BANNER_LAYOUT_GUIDANCE } from '@/lib/hub-chat/banner-preset-layout-guidance'

export type BannerAdChannelContext = {
  presetId: string
  aspectRatio: string
  adChannelLabel: string
  platformHint: string
}

const COPY_SECTION_MARKER = '---ON_BANNER_COPY---'
const PROMPT_SECTION_MARKER = '---IMAGE_PROMPT---'

function outputLanguage(locale: WebLocale): string {
  if (locale === 'vi') return 'Vietnamese'
  if (locale === 'zh') return 'Chinese (Simplified)'
  if (locale === 'ja') return 'Japanese'
  if (locale === 'ko') return 'Korean'
  return 'English'
}

function buildBriefSection(
  briefNotes: Record<string, string>,
  keys: readonly string[]
): string {
  const lines: string[] = []
  for (const key of keys) {
    const value = briefNotes[key]?.trim()
    if (value) lines.push(`${key}: ${value}`)
  }
  return lines.join('\n')
}

function parseMergedBannerResponse(raw: string): { structuredCopy: string; imagePrompt: string } | null {
  const text = raw.trim()
  const promptIdx = text.indexOf(PROMPT_SECTION_MARKER)
  if (promptIdx < 0) return null

  const copyPart = text
    .slice(0, promptIdx)
    .replace(new RegExp(`^${COPY_SECTION_MARKER}\\s*`, 'i'), '')
    .trim()
  const imagePrompt = text.slice(promptIdx + PROMPT_SECTION_MARKER.length).trim()
  if (!copyPart || !imagePrompt) return null

  return { structuredCopy: copyPart, imagePrompt }
}

/**
 * One Gemini call: extract on-banner copy (HEADLINE/CTA/…) + write English image-generation prompt.
 */
export async function buildBannerImageGenerationPrompt(input: {
  apiKey: string
  userId: string
  locale: WebLocale
  briefNotes: Record<string, string>
  draft: string
  presetId: string
  aspectRatio: string
  adChannelLabel: string
  platformHint: string
  hasReferenceImages: boolean
  hasLogo?: boolean
  allAdChannels?: BannerAdChannelContext[]
}): Promise<
  | { ok: true; prompt: string; structuredCopy: string; imageCopy: string }
  | { ok: false; error: string }
> {
  const draft = input.draft.trim()
  const copyBrief = buildBriefSection(input.briefNotes, SALE_BANNER_COPY_BRIEF_KEYS)
  const visualBrief = buildBriefSection(input.briefNotes, SALE_BANNER_VISUAL_BRIEF_KEYS)
  if (!draft && !copyBrief && !visualBrief) {
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

  const sys = `You are a senior performance marketing art director for display ads.

You must output EXACTLY two sections in this order (include the marker lines verbatim):

${COPY_SECTION_MARKER}
HEADLINE: ...
SUBHEAD: ... (optional line — omit if not needed)
CTA: ...
DOMAIN: ... (optional — omit entire line if a logo image will be composited)

${PROMPT_SECTION_MARKER}
(one detailed English image-generation prompt, 200–450 words, flowing prose)

Section 1 — on-banner copy rules:
- Output language for copy values: ${lang}.
- Use factual offers from the brief only — do not invent discount % or promotions.
- Visual brief fields (brand_style, color_tone, banner_style, banner_model) are NOT banner text.
- Headline ≤ 12 words; CTA action-oriented.
- Do NOT wrap copy values in quotation marks — output plain text only after each colon.
- Field labels (HEADLINE, SUBHEAD, CTA, DOMAIN) are for parsing only — never appear on the banner image.
${input.hasLogo ? '- A brand LOGO image will be attached — omit the DOMAIN line entirely.' : ''}

Section 2 — image prompt rules:
- English only — no markdown, no quotes wrapping the whole section.
- Goal: one finished, production-ready ad banner — not a mockup frame.
${multiRatio ? '- This ONE prompt will be reused for multiple aspect ratios — describe layout zones that adapt (wide, square, tall).' : `- Target: aspect ratio ${input.aspectRatio}, channel "${input.adChannelLabel}".`}
- Follow layout guidance; describe text block vs hero visual, CTA button, colors, model/scene from visual brief.
- Use ONLY the copy values from section 1 as on-image text — never print field labels or meta notes ("Asian male model", etc.).
- Render headline and CTA as plain text — never wrap them in quotation marks on the banner.
${input.hasLogo ? '- First attached image is brand logo — embed exact logo pixels; do NOT redraw or replace with typed domain.' : '- Small domain text allowed only if DOMAIN line exists in section 1.'}
- Professional ad photography, readable hierarchy, safe margins, high-contrast CTA, no watermark.`

  const userBlock = [
    `Preset layout guidance:\n${layoutGuidance}`,
    multiRatio ? `All target ad formats:\n${channelSummary}` : '',
    !multiRatio ? `Aspect ratio: ${input.aspectRatio}` : '',
    !multiRatio ? `Ad channel: ${input.adChannelLabel}` : '',
    !multiRatio ? `Platform hint: ${input.platformHint}` : '',
    input.hasLogo
      ? 'Brand LOGO image + optional product photos will be attached.'
      : input.hasReferenceImages
        ? 'Reference product photos will be attached.'
        : 'No reference images — generate from text brief only.',
    copyBrief ? `Campaign copy brief:\n${copyBrief}` : '',
    visualBrief
      ? `Visual direction (scene/model/colors — image only, NOT banner text):\n${visualBrief}`
      : '',
    draft ? `User draft / overlay hint:\n${draft}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  try {
    const genAI = new GoogleGenerativeAI(input.apiKey)
    const model = genAI.getGenerativeModel({
      ...GEMINI_25_FLASH_NO_THINKING,
      generationConfig: { temperature: 0.55, maxOutputTokens: 8192 },
    })
    const r = await model.generateContent([{ text: `${sys}\n\n${userBlock}` }])
    await trackFromUsageMetadata(
      r.response.usageMetadata,
      GEMINI_25_FLASH_NO_THINKING.model,
      'hub-banner-image-prompt-build',
      input.userId
    )
    const raw = r.response.text()?.trim() ?? ''
    const parsed = parseMergedBannerResponse(raw)
    if (!parsed) return { ok: false, error: 'EMPTY_RESPONSE' }

    const copyParsed = parseBannerOnImageCopy(parsed.structuredCopy)
    const imageCopy = formatBannerOnImageCopyForGeneration(copyParsed, {
      omitDomain: Boolean(input.hasLogo),
    })

    return {
      ok: true,
      prompt: parsed.imagePrompt.replace(/^["']|["']$/g, ''),
      structuredCopy: parsed.structuredCopy,
      imageCopy,
    }
  } catch {
    return { ok: false, error: 'API_ERROR' }
  }
}

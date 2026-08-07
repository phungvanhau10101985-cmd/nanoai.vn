import {
  DEFAULT_PRODUCT_LABEL_ASPECT_RATIO,
  DEFAULT_SEAL_STICKER_ASPECT_RATIO,
  getClosestGeminiAspectRatio,
  isValidGeminiAspectRatio,
  type GeminiAspectRatio,
} from '@/lib/label-size-presets'
import { getPrimaryLogoStepKey } from '@/lib/hub-chat/hub-studio-preset-flows'
import type { HubPackagingState, HubStudioSession } from '@/lib/hub-chat/hub-studio-types'

export type LogoCompositeReference = {
  screenKey: string
  screenLabel: string
  url: string
}

/** Approved logo image to composite onto flat label / seal artwork (not box face panels). */
export function resolveLogoCompositeReference(
  session: Pick<HubStudioSession, 'referenceImages'>,
  presetId: string | null | undefined
): LogoCompositeReference | null {
  const logoKey = presetId ? getPrimaryLogoStepKey(presetId) : 'logo'
  if (!logoKey) return null
  const ref = session.referenceImages.find((r) => r.screenKey === logoKey && r.url?.trim())
  if (!ref?.url?.trim()) return null
  return {
    screenKey: ref.screenKey,
    screenLabel: ref.screenLabel,
    url: ref.url.trim(),
  }
}

export function resolveLogoCompositeReferenceUrls(
  session: Pick<HubStudioSession, 'referenceImages'>,
  presetId: string | null | undefined
): string[] {
  const logoRef = resolveLogoCompositeReference(session, presetId)
  return logoRef ? [logoRef.url] : []
}

export function isProductLabelStepKey(stepKey: string | null | undefined): boolean {
  return stepKey === 'product_label'
}

export function isSealStickerStepKey(stepKey: string | null | undefined): boolean {
  return stepKey === 'seal_sticker'
}

export function isLogoOnlyReferenceStepKey(stepKey: string | null | undefined): boolean {
  return isProductLabelStepKey(stepKey) || isSealStickerStepKey(stepKey)
}

/** Approve with "Continue" only — do not store output as a generation reference. */
export function isPackagingContinueOnlyApproveStep(stepKey: string | null | undefined): boolean {
  return (
    stepKey === 'box_mockup_3d' ||
    stepKey === 'box_dieline_pdf' ||
    stepKey === 'bag_mockup_3d' ||
    stepKey === 'bag_dieline_pdf' ||
    isLogoOnlyReferenceStepKey(stepKey) ||
    stepKey === 'barcode_label'
  )
}

/** After 3D mockup: no reference-image picker for new generations. */
export function isPackagingPostMockupStepKey(stepKey: string | null | undefined): boolean {
  return (
    stepKey === 'box_dieline_pdf' ||
    stepKey === 'bag_dieline_pdf' ||
    isLogoOnlyReferenceStepKey(stepKey) ||
    stepKey === 'barcode_label'
  )
}

/** Parse label size from user text, e.g. "50x80 mm", "50×80". */
export function parseLabelSizeMm(message: string): { widthMm: number; heightMm: number } | null {
  const m = message.match(/(\d{2,4})\s*[x×X]\s*(\d{2,4})(?:\s*mm)?/i)
  if (!m) return null
  const widthMm = Number(m[1])
  const heightMm = Number(m[2])
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null
  if (widthMm < 20 || widthMm > 800 || heightMm < 20 || heightMm > 800) return null
  return { widthMm, heightMm }
}

export function labelAspectRatioFromSize(size: { widthMm: number; heightMm: number }): string {
  return getClosestGeminiAspectRatio(size.widthMm, size.heightMm)
}

/** Parse Gemini ratio from free text, e.g. "tỷ lệ 3:4". */
export function parseGeminiAspectRatioFromText(message: string): GeminiAspectRatio | null {
  const match = message.match(/\b(1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9|9:21|21:9)\b/)
  if (!match?.[1] || !isValidGeminiAspectRatio(match[1])) return null
  return match[1]
}

export function resolveProductLabelAspectRatio(
  packaging: HubPackagingState | undefined,
  generationPrompt?: string
): GeminiAspectRatio {
  const stored = packaging?.productLabelAspectRatio?.trim()
  if (stored && isValidGeminiAspectRatio(stored)) return stored
  const legacySize = packaging?.productLabelSizeMm
  if (legacySize) return getClosestGeminiAspectRatio(legacySize.widthMm, legacySize.heightMm)
  const parsed = generationPrompt ? parseGeminiAspectRatioFromText(generationPrompt) : null
  return parsed ?? DEFAULT_PRODUCT_LABEL_ASPECT_RATIO
}

export function resolveSealStickerAspectRatio(
  packaging: Partial<HubPackagingState> | undefined,
  generationPrompt?: string
): GeminiAspectRatio {
  const stored = packaging?.sealStickerAspectRatio?.trim()
  if (stored && isValidGeminiAspectRatio(stored)) return stored
  const legacySize = packaging?.sealStickerSizeMm
  if (legacySize) return getClosestGeminiAspectRatio(legacySize.widthMm, legacySize.heightMm)
  const parsed = generationPrompt ? parseGeminiAspectRatioFromText(generationPrompt) : null
  return parsed ?? DEFAULT_SEAL_STICKER_ASPECT_RATIO
}

export const FLAT_STICKER_SHAPES = ['round', 'square', 'rectangle', 'ellipse'] as const

export type FlatStickerShape = (typeof FLAT_STICKER_SHAPES)[number]

export const DEFAULT_PRODUCT_LABEL_SHAPE: FlatStickerShape = 'rectangle'

export const DEFAULT_SEAL_STICKER_SHAPE: FlatStickerShape = 'round'

export function isValidFlatStickerShape(value: string): value is FlatStickerShape {
  return (FLAT_STICKER_SHAPES as readonly string[]).includes(value)
}

export function resolveProductLabelShape(packaging: Partial<HubPackagingState> | undefined): FlatStickerShape {
  const stored = packaging?.productLabelShape
  if (stored && isValidFlatStickerShape(stored)) return stored
  return DEFAULT_PRODUCT_LABEL_SHAPE
}

export function resolveSealStickerShape(packaging: Partial<HubPackagingState> | undefined): FlatStickerShape {
  const stored = packaging?.sealStickerShape
  if (stored && isValidFlatStickerShape(stored)) return stored
  return DEFAULT_SEAL_STICKER_SHAPE
}

function flatStickerShapePromptLine(shape: FlatStickerShape, artworkWord: 'label' | 'sticker'): string {
  switch (shape) {
    case 'round':
      return `DIE-CUT SHAPE: perfect circle — all artwork inside one circular ${artworkWord} silhouette; readable content centered with safe inset from the circular edge.`
    case 'square':
      return `DIE-CUT SHAPE: square — ${artworkWord} artwork fills a square silhouette edge-to-edge on the canvas.`
    case 'rectangle':
      return `DIE-CUT SHAPE: rectangle — standard rectangular ${artworkWord} using the full canvas proportions.`
    case 'ellipse':
      return `DIE-CUT SHAPE: ellipse/oval — artwork contained in an oval ${artworkWord} silhouette; balanced horizontal oval proportions.`
  }
}

export const PRODUCT_LABEL_ARTWORK_RULES = `PRODUCT LABEL RULES (critical):
- Output ONE flat product LABEL / sticker artwork only, viewed straight-on like an exported PNG artboard.
- The artwork must fill 100% of the canvas edge-to-edge. No surrounding background, presentation board, frame, padding, or mockup scene.
- Design the label to peel and stick ON the product (jar, bottle, tube, pouch) — do not show the physical product or shipping box.
- This is NOT a box dieline, NOT an unfolded carton net, NOT a 3D box mockup, NOT box face panels.
- Print-ready black-and-white or minimal 2-color layout unless the user explicitly asks for full color.
- Typography must be razor-sharp with high contrast — crisp vector-like edges, no blur, no glow, no soft shadows on text.
- Clear readable typography hierarchy: product name, ingredients, usage, warnings, volume, registration codes as provided.
- LANGUAGE LOCK: render all supplied print copy verbatim in its original language. Never translate, transliterate, rewrite, spell-correct, or summarize brand names, product names, slogans, ingredients, instructions, or warnings.
- Keep readable content in a safe zone, but extend background colors and decorative artwork to every canvas edge.
- NEVER draw dimensions, size numbers, mm/cm labels, measurement arrows, rulers, red boxes, cut/fold lines, crop marks, bleed guides, or safe-zone guides.
- Composite ONLY the attached brand LOGO — never paste box-face artwork or dieline panels.`

export const SEAL_STICKER_ARTWORK_RULES = `SEAL / TAMPER-EVIDENT STICKER RULES (critical):
- Output ONE flat seal sticker artwork only, viewed straight-on like an exported PNG artboard.
- The artwork must fill the canvas. No surrounding background, presentation board, frame, padding, physical package, or mockup scene.
- Design a die-cut tamper-evident seal sticker to close packaging — NOT a box dieline, NOT carton net, NOT 3D mockup.
- Composite ONLY the attached brand LOGO centered or prominently — never paste box-face panels.
- Print-ready, minimal colors, bold readable slogan/text per user brief. Die-cut friendly silhouette with safe margins.
- Typography must be razor-sharp with high contrast — crisp vector-like edges, no blur, no glow, no soft shadows on text.
- LANGUAGE LOCK: render all supplied print copy verbatim in its original language. Never translate, transliterate, rewrite, spell-correct, or summarize it.
- NEVER draw dimensions, size numbers, mm/cm labels, measurement arrows, rulers, red boxes, cut/fold lines, crop marks, bleed guides, or safe-zone guides.`

/**
 * Removes physical export settings from the visual brief after they have been
 * parsed into aspect-ratio/print-size metadata. This prevents the image model
 * from treating measurements as artwork.
 */
export function stripLabelTechnicalMeasurementsFromVisualPrompt(prompt: string): string {
  return prompt
    .replace(
      /\b(?:exact\s+)?(?:label\s+)?(?:size|dimensions?)?\s*:?\s*\d{1,4}(?:[.,]\d+)?\s*[x×]\s*\d{1,4}(?:[.,]\d+)?(?:\s*[x×]\s*\d{1,4}(?:[.,]\d+)?)?\s*(?:mm|cm)?\b/gi,
      ''
    )
    .replace(/\b(?:bleed|tràn lề)\s*:?\s*\d{1,3}(?:[.,]\d+)?\s*(?:mm|cm)\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

export function buildProductLabelPromptBlock(
  stepKey: string,
  options?: {
    aspectRatio?: string | null
    shape?: FlatStickerShape | null
    /** @deprecated Legacy seal sessions may still pass mm size — converted to closest Gemini ratio. */
    sizeMm?: { widthMm: number; heightMm: number } | null
  }
): string {
  const rules = isProductLabelStepKey(stepKey) ? PRODUCT_LABEL_ARTWORK_RULES : SEAL_STICKER_ARTWORK_RULES
  const defaultRatio = isProductLabelStepKey(stepKey)
    ? DEFAULT_PRODUCT_LABEL_ASPECT_RATIO
    : DEFAULT_SEAL_STICKER_ASPECT_RATIO
  const defaultShape = isProductLabelStepKey(stepKey)
    ? DEFAULT_PRODUCT_LABEL_SHAPE
    : DEFAULT_SEAL_STICKER_SHAPE
  const ratio =
    options?.aspectRatio && isValidGeminiAspectRatio(options.aspectRatio)
      ? options.aspectRatio
      : options?.sizeMm
        ? getClosestGeminiAspectRatio(options.sizeMm.widthMm, options.sizeMm.heightMm)
        : defaultRatio
  const shape = options?.shape && isValidFlatStickerShape(options.shape) ? options.shape : defaultShape
  const artworkWord = isProductLabelStepKey(stepKey) ? 'label' : 'sticker'
  return `${rules}\n\n${flatStickerShapePromptLine(shape, artworkWord)}\n\nTECHNICAL SETTINGS: Canvas aspect ratio ${ratio} (set via API). Follow this canvas shape; never print or visualize ratio numbers on the ${artworkWord}.`
}

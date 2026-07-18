import { getClosestGeminiAspectRatio } from '@/lib/label-size-presets'

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
    isLogoOnlyReferenceStepKey(stepKey) ||
    stepKey === 'barcode_label'
  )
}

/** After 3D mockup: no reference-image picker for new generations. */
export function isPackagingPostMockupStepKey(stepKey: string | null | undefined): boolean {
  return (
    stepKey === 'box_dieline_pdf' ||
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

export const PRODUCT_LABEL_ARTWORK_RULES = `PRODUCT LABEL RULES (critical):
- Output ONE flat rectangular product LABEL / sticker artwork only, viewed straight-on like an exported PNG artboard.
- The artwork must fill 100% of the canvas edge-to-edge. No surrounding background, presentation board, frame, padding, or mockup scene.
- Design the label to peel and stick ON the product (jar, bottle, tube, pouch) — do not show the physical product or shipping box.
- This is NOT a box dieline, NOT an unfolded carton net, NOT a 3D box mockup, NOT box face panels.
- Print-ready black-and-white or minimal 2-color layout unless the user explicitly asks for full color.
- Clear readable typography hierarchy: product name, ingredients, usage, warnings, volume, registration codes as provided.
- LANGUAGE LOCK: render all supplied print copy verbatim in its original language. Never translate, transliterate, rewrite, spell-correct, or summarize brand names, product names, slogans, ingredients, instructions, or warnings.
- Keep readable content in a safe zone, but extend background colors and decorative artwork to every canvas edge.
- NEVER draw dimensions, size numbers, mm/cm labels, measurement arrows, rulers, red boxes, cut/fold lines, crop marks, bleed guides, or safe-zone guides.
- Composite ONLY the attached brand LOGO — never paste box-face artwork or dieline panels.`

export const SEAL_STICKER_ARTWORK_RULES = `SEAL / TAMPER-EVIDENT STICKER RULES (critical):
- Output ONE flat seal sticker artwork only, viewed straight-on like an exported PNG artboard.
- The artwork must fill the canvas. No surrounding background, presentation board, frame, padding, physical package, or mockup scene.
- Design a round, square, or oval sticker to seal closed packaging — NOT a box dieline, NOT carton net, NOT 3D mockup.
- Composite ONLY the attached brand LOGO centered or prominently — never paste box-face panels.
- Print-ready, minimal colors, bold readable slogan/text per user brief. Die-cut friendly silhouette with safe margins.
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
  size: { widthMm: number; heightMm: number } | null | undefined,
  stepKey: string
): string {
  const rules = isProductLabelStepKey(stepKey) ? PRODUCT_LABEL_ARTWORK_RULES : SEAL_STICKER_ARTWORK_RULES
  if (!size) {
    return `${rules}\n\nTECHNICAL SETTINGS: If no size metadata is available, use a typical cosmetics back-label proportion (portrait). These settings must never appear as visible artwork.`
  }
  return `${rules}\n\nTECHNICAL SETTINGS: The API supplies the exact aspect ratio and print dimensions separately. Follow the API canvas shape; never print or visualize those measurements on the label.`
}

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
- Design ONE flat rectangular product LABEL / sticker artwork to peel and stick ON the product (jar, bottle, tube, pouch) — NOT on the shipping box.
- This is NOT a box dieline, NOT an unfolded carton net, NOT a 3D box mockup, NOT box face panels.
- Print-ready black-and-white or minimal 2-color layout unless the user explicitly asks for full color.
- Clear readable typography hierarchy: product name, ingredients, usage, warnings, volume, registration codes as provided.
- Safe margins for die-cut; single label only on plain background.
- Composite ONLY the attached brand LOGO — never paste box-face artwork or dieline panels.`

export const SEAL_STICKER_ARTWORK_RULES = `SEAL / TAMPER-EVIDENT STICKER RULES (critical):
- Design ONE flat seal sticker artwork (round, square, or oval) to seal closed packaging — NOT a box dieline, NOT carton net, NOT 3D mockup.
- Composite ONLY the attached brand LOGO centered or prominently — never paste box-face panels.
- Print-ready, minimal colors, bold readable slogan/text per user brief. Die-cut friendly silhouette with safe margins.
- One seal artwork only on plain background.`

export function buildProductLabelPromptBlock(
  size: { widthMm: number; heightMm: number } | null | undefined,
  stepKey: string
): string {
  const rules = isProductLabelStepKey(stepKey) ? PRODUCT_LABEL_ARTWORK_RULES : SEAL_STICKER_ARTWORK_RULES
  if (!size) {
    return `${rules}\n\nIf label size was not given, use a typical cosmetics back label proportion (~2:3 portrait).`
  }
  return `${rules}\n\nEXACT LABEL SIZE: ${size.widthMm} × ${size.heightMm} mm (width × height). Match this aspect ratio precisely.`
}

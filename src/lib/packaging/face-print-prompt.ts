import { stripLabelTechnicalMeasurementsFromVisualPrompt } from '@/lib/packaging/product-label-step'

/** Lead line — must appear first so the image model prioritizes flat print output. */
export const PACKAGING_FACE_FLAT_ARTWORK_LEAD = `OUTPUT = ONE FLAT 2D PRINT PANEL ONLY — orthographic head-on view, like a print-ready PNG artboard (Illustrator/InDesign export), NOT a product photograph.`

/** Minimum inset for readable content from panel trim edges (mm). Used server-side only — never in visual prompts. */
export const PACKAGING_FACE_SAFE_ZONE_MM = 10

export const PACKAGING_FACE_SAFE_ZONE_RULES = `CONTENT LAYOUT (invisible to viewer — never draw guides or boxes):
- Keep readable text, logos, barcodes, icons, and important product info comfortably inset from every edge — not flush against borders
- Background colors, textures, gradients, and decorative graphics MUST extend full bleed to all four edges with no empty margin
- Do NOT draw safe-zone boxes, inset guides, fold lines, trim marks, or measurement overlays — layout intent only`

/** Shared rules so packaging_face steps output flat pre-press artwork, not dieline/mockup. */
export const PACKAGING_FACE_FLAT_ARTWORK_RULES = `${PACKAGING_FACE_FLAT_ARTWORK_LEAD}

${PACKAGING_FACE_SAFE_ZONE_RULES}

FORBIDDEN — never output these (they belong ONLY to the separate box_mockup_3d step later):
- A 3D cardboard box standing on a table, floor, or studio surface
- Grey/neutral studio backdrop with a small box centered and empty margins on all sides
- Drop shadow, contact shadow, or cast shadow beneath a physical box
- Perspective, depth, angled view, or “product mockup” product photography framing
- White or coloured padding/frame around the design — the artwork must touch all four image edges

REQUIRED — flat print file before die-cutting:
- ONE rectangular panel for this face only — straight-on orthographic view (like opening a flat PDF in Illustrator)
- FULL BLEED (full viền): background, colour and artwork extend to all four edges with ZERO margin, frame, padding, or letterboxing
- The entire image canvas is 100% filled with printable design — edge to edge, corner to corner
- LANGUAGE LOCK: render every brand name, product name, slogan, ingredient, instruction, and other supplied print copy verbatim in its original language — never translate, transliterate, rewrite, spell-correct, or summarize it
- NO dieline / net / unfolded template: no multiple connected panels, glue tabs, tuck flaps, or sheet layout
- NO cut lines, fold/crease lines, registration marks, crop marks, or bleed guides drawn on the image
- NEVER draw dimension lines, arrows, rulers, or size text (mm, cm, L×W labels) on the artwork
- Product photos attached as reference must be flattened into 2D printed graphics on this panel — NOT a separate 3D bottle/box object on kraft paper
- Kraft or cardboard texture as a flat design background filling the entire rectangle edge-to-edge is OK (texture only — still flat print, not a photo of real cardboard with a box on it)
- 3D mockup and technical dieline PDF are separate later steps — generate flat full-bleed artwork only`

export type PackagingFacePromptBlockInput = {
  faceKey?: string | null
  faceSlot?: string | null
  isBodyStrip?: boolean
  isSquare?: boolean
}

const PACKAGING_FACE_TECHNICAL_SETTINGS = `TECHNICAL SETTINGS (API metadata only — never visualize on the artwork):
- The API supplies the exact aspect ratio and print trim dimensions separately
- Fill the entire API canvas edge-to-edge with printable design
- Never print, label, or visualize measurements, aspect ratios, guides, or safe-zone boxes`

/** Visual prompt block for packaging_face — no mm/cm numbers (those stay in API config only). */
export function buildPackagingFacePromptBlock(input: PackagingFacePromptBlockInput): string {
  if (input.isBodyStrip) {
    return `${PACKAGING_FACE_FLAT_ARTWORK_RULES}

BODY STRIP LAYOUT:
- One continuous horizontal strip: FRONT | RIGHT | BACK | LEFT in that order
- Seamless edge-to-edge artwork across the entire strip; background fills every pixel
- Keep readable text/logos inward from strip edges and internal fold boundaries
- Do NOT draw fold lines, panel borders, dielines, glue tabs, or box flaps on the artwork
${PACKAGING_FACE_TECHNICAL_SETTINGS}`
  }

  const roleLabel =
    input.faceKey && input.faceSlot
      ? `${input.faceKey} (${input.faceSlot.toUpperCase()})`
      : input.faceKey ?? 'packaging face'
  const squareNote = input.isSquare
    ? '\n- OUTPUT SHAPE: square 1:1 panel — artwork fills the entire square canvas edge-to-edge.'
    : ''

  return `${PACKAGING_FACE_FLAT_ARTWORK_RULES}

FACE ROLE: ${roleLabel} print panel only.${squareNote}
${PACKAGING_FACE_TECHNICAL_SETTINGS}`
}

/**
 * Removes physical export settings from the visual brief after they are parsed into
 * aspect-ratio / print-size API metadata. Prevents the image model from drawing
 * dimension annotations or centered layouts with guide margins.
 */
export function stripPackagingFaceTechnicalMeasurementsFromVisualPrompt(prompt: string): string {
  return stripLabelTechnicalMeasurementsFromVisualPrompt(prompt)
    .replace(/\b(?:gemini\s+)?aspect\s+(?:ratio\s+)?\d+\s*:\s*\d+\b/gi, '')
    .replace(/\bTECHNICAL\s+FACE\s*:[^\n]*/gi, '')
    .replace(/\b(?:continuous\s+)?body\s+strip\s*:[^\n]*/gi, '')
    .replace(/\b(?:exact\s+)?print\s+(?:size|dimensions?)\s*:[^\n]*/gi, '')
    .replace(/\bfold\s+guides?\s+(?:are\s+)?at\s+[^\n.]*/gi, '')
    .replace(/\b(?:≥|>=)\s*\d+(?:[.,]\d+)?\s*(?:mm|cm)\b/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:mm|cm)\s+from\b/gi, 'inward from')
    .replace(/\bL\s*[×xX*]\s*[HW]\b/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

/** When an approved logo reference is attached, forbid duplicate logotype / brand-name typography. */
export const PACKAGING_FACE_APPROVED_LOGO_RULES = `APPROVED LOGO REFERENCE (critical — avoids double branding):
- Composite ONLY the attached approved LOGO image for brand identity on this panel
- Do NOT draw, re-typeset, recreate, or duplicate the brand logo, logotype, wordmark, emblem, or brand name as separate new typography or graphics
- Ignore any brief lines about "logo", "brand name", or "thương hiệu" — the attached logo replaces them
- Still render other supplied print copy verbatim (product name, ingredients, volume, warnings, barcode text, etc.)`

const PACKAGING_FACE_LOGO_BRAND_LINE =
  /(?:^|\b)(?:logo|logotype|wordmark|brand(?:\s+name|\s+mark)?|th(?:ư|u)ong\s*hi(?:ệ|e)u|nhãn\s*hi(?:ệ|e)u|biểu\s*tượng|emblem|icon\s*th(?:ư|u)ong\s*hi(?:ệ|e)u)(?:\s|:|：|$)/i

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Brand strings already captured in discovery — strip from face visual brief when logo ref is attached. */
export function collectPackagingBrandIdentifiers(
  briefNotes: Record<string, string>,
  projectTitle?: string | null
): string[] {
  const names = new Set<string>()
  const brand = briefNotes.brand_name?.trim()
  if (brand && brand.length >= 2) names.add(brand)
  const project = projectTitle?.trim()
  if (project && project.length >= 2) names.add(project)
  return [...names]
}

function isLogoOrBrandOnlyLine(line: string, brandNames: string[]): boolean {
  const trimmed = line.trim()
  if (!trimmed) return true
  if (PACKAGING_FACE_LOGO_BRAND_LINE.test(trimmed)) return true
  for (const brand of brandNames) {
    const escaped = escapeRegExp(brand)
    if (new RegExp(`^${escaped}$`, 'i').test(trimmed)) return true
    if (
      new RegExp(
        `^(?:th(?:ư|u)ong\\s*hi(?:ệ|e)u|brand(?:\\s+name)?|logo)\\s*[:：\\-–—]?\\s*${escaped}$`,
        'i'
      ).test(trimmed)
    ) {
      return true
    }
  }
  return false
}

/**
 * Removes logo / brand-name instructions from the visual brief when an approved logo
 * reference is already attached — prevents AI from drawing duplicate branding.
 */
export function stripBrandLogoFromPackagingFaceVisualPrompt(
  prompt: string,
  brandNames: string[]
): string {
  const lines = prompt.split('\n')
  const filtered = lines.filter((line) => !isLogoOrBrandOnlyLine(line, brandNames))
  let out = filtered.join('\n')

  out = out.replace(/^Project:\s*.+$/gim, '')
  out = out.replace(/^Collected brand brief:\s*$/gim, '')
  out = out.replace(/^-\s*brand_name:\s*.+$/gim, '')
  out = out.replace(/^-\s*logo:\s*.+$/gim, '')

  for (const brand of brandNames) {
    const escaped = escapeRegExp(brand)
    out = out.replace(
      new RegExp(`\\b(?:logo|logotype|wordmark|brand(?:\\s+name)?|th(?:ư|u)ong\\s*hi(?:ệ|e)u)\\s*[:：\\-–—]?\\s*${escaped}\\b`, 'gi'),
      ''
    )
  }

  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n[ \t]+/g, '\n')
    .trim()
}

import type { WeddingImageType } from '@/lib/db/wedding-cards-pg'

/**
 * Ảnh nền thiệp trên Gemini: tỷ lệ đứng cao nhất gemini-3-pro-image nhận ổn định.
 * 9:16 cao hơn 2:3 và 3:4. 1:4 / 1:8 runtime reject; 9:21 không nằm trong tỷ lệ model chấp nhận.
 */
export const WEDDING_BACKGROUND_ASPECT_RATIO = '9:16' as const

/**
 * Ảnh nền thiệp trên GPT Image 2. Mọi tỷ lệ đứng thường bị gộp thành 1024×1536 (2:3).
 * gpt-image-2 nhận size tùy ý: cạnh chia hết cho 16, tỷ lệ dài/ngắn ≤ 3:1,
 * tổng pixel từ 655360 đến dưới mốc thí nghiệm 3686400 (2560×1440).
 * 1104×3312 là chiều cao lớn nhất trong vùng đó, đúng tỷ lệ 1:3.
 */
export const WEDDING_GPT_BACKGROUND_SIZE = '1104x3312' as const

/** Hướng nghệ thuật riêng từng mặt (tiếng Anh cho model ảnh). */
const FACE_ART_DIRECTION: Record<WeddingImageType, string> = {
  master: `PRIMARY HERO MASTER visual — richest side florals of the set, premium paper, romantic but calm. Dense pattern only on the left and right margins, fading to a faint wash in the center column. This is the anchor artwork every other face should feel related to, but not copy.`,
  cover: `PUBLIC OPENING + HERO face — ceremonial first impression and luminous aisle feeling. The center vertical column stays bright with only faint pattern for couple names, guest line and open button overlays.`,
  invitation: `FAMILY + INVITATION face — refined stationery for parents, couple intro and long invitation copy. Calm center column with faint pattern only; denser ornament on the left and right edges.`,
  event: `EVENT + TIMELINE face — airy architecture and timeline-friendly rhythm. Clear center for calendar, time, venue and schedule; detail on the side margins, faint in the middle.`,
  rsvp: `RSVP + WISHES face — orderly premium guest-response section. Generous form-safe center with only faint pattern; soft celebration accents on the side margins; no dense texture behind input areas.`,
  album: `ALBUM + STORY face — romantic editorial mood with soft side florals. The center stays a faint wash so story and gallery overlays stay readable.`,
  gift_qr: `GIFT QR face — restrained ceremonial gift section. The center stays a calm faint field where a QR can sit; ornament only on the left and right margins; NEVER busy texture in the QR core.`,
  thanks: `THANK YOU CLOSING face — elegant closing with airy light and delicate botanical trails from the two sides. Faint pattern in the center; quieter than the hero but still premium.`,
}

/**
 * Nền thiệp: không viền khung. Hoa văn đậm chỉ từ hai mép trái phải,
 * cột giữa chỉ họa tiết mờ để chữ nằm lên đọc được.
 */
const PLATE_COMPOSITION = [
  'COMPOSITION (must, overrides any centerpiece, frame, vignette, or top-bottom border above): open full-bleed paper, not a framed picture.',
  'NO FRAME LINES: do not draw a border, ruled line, double-line rectangle, engraved frame, corner brackets, closed wreath, gate, or any stroke that boxes the canvas. Artwork bleeds off the left and right edges with no outline around the plate.',
  'SIDE PATTERN ONLY: dense floral and ornamental pattern grows inward from the LEFT edge and the RIGHT edge only. Do not lay a heavy ornamental band across the top or the bottom.',
  'FAINT CENTER: the center vertical column (about the middle 42% of the width) is a calm reading field. Pattern there must be faint, washed, low-contrast, and ghosted — never dark, thick, sharp, or dense. No medallion, bouquet, dragon, phoenix, or focal cluster in the middle.',
].join(' ')

/** Thanh tao: vài nét, không hoa văn dày. */
const ETHEREAL_COMPOSITION = [
  'COMPOSITION (must, overrides any centerpiece, frame, vignette, dense pattern, or top-bottom border above): open full-bleed paper, not a framed picture.',
  'NO FRAME LINES: do not draw a border, ruled line, double-line rectangle, engraved frame, corner brackets, closed wreath, gate, or any stroke that boxes the canvas.',
  'FEW STROKES ONLY: a handful of artistic botanical strokes, mostly touching the LEFT edge and the RIGHT edge. Large fields of untouched paper. No dense fill, no repeating pattern, no bouquet cluster, no filigree carpet.',
  'EMPTY CENTER: the center vertical column (about the middle 55% of the width) stays nearly blank paper. No medallion, bouquet, dragon, phoenix, or focal cluster in the middle.',
].join(' ')

const STYLE_ART_DIRECTION: Record<string, string> = {
  luxury:
    'High-end Vietnamese wedding stationery, ivory paper texture, champagne metallic foil, blush warmth, layered embossing, refined depth, premium hotel ballroom mood.',
  minimal:
    'Minimal editorial wedding design, warm white paper, sage hints, charcoal contrast, spacious composition, precise typography-safe geometry, understated luxury.',
  traditional_vietnamese:
    'Vietnamese traditional wedding elegance, red and gold harmony, lotus and silk-inspired ornament, subtle Đông Sơn / lacquer cues, ceremonial warmth, not cartoonish.',
  floral:
    'Refined complex floral wedding stationery, heirloom invitation plate. Intricate but graceful side ornament: layered peony, lotus, cherry blossom, garden rose, and fine champagne-gold linework, with soft watercolor washes. Motifs are dense along the two sides yet airy between stems — elegant, polite, luminous, never gaudy, never cartoon, never plastic, never a repeating wallpaper. The center stays a calm cream field.',
  ethereal:
    'Ethereal fine-art wedding plate with very few strokes. One or two flowering branches, a handful of leaves, and a single quiet ink or pale-watercolor gesture. Large untouched ivory paper. Artistic, sparse, calligraphic, breathing room everywhere. Not a pattern, not a bouquet, not filigree, not a frame.',
  vintage:
    'Vintage heirloom invitation, sepia warmth, dusty rose, antique gold, old paper grain, nostalgic but polished. No engraved border and no ruled frame.',
  modern:
    'Modern luxury wedding editorial, black/white contrast, metallic gold accents, clean geometry, spotlight gradients, gallery-like premium atmosphere.',
}

function plateComposition(style: string): string {
  return style === 'ethereal' ? ETHEREAL_COMPOSITION : PLATE_COMPOSITION
}

function lockLine(style: string): string {
  if (style === 'ethereal') {
    return 'LOCK: no frame lines; only a few artistic strokes from the side edges; the center stays almost blank paper. Ignore any earlier request for dense or richest florals.'
  }
  if (style === 'floral') {
    return 'LOCK: no frame lines anywhere on this background; intricate refined florals (peony, lotus, cherry blossom, rose, fine gold line) grow inward from the left edge and the right edge only, dense yet airy and elegant; the center column keeps a faint cream wash.'
  }
  return 'LOCK: no frame lines anywhere on this background; dense pattern grows inward from the left edge and the right edge only; the center column keeps faint, washed pattern only.'
}

function sharedStyleConsistencyBlock(type: WeddingImageType): string[] {
  if (type === 'master') return []
  return [
    '',
    'BRAND MATCH (must): Keep the SAME wedding design language as the hero — palette family, metallics (gold/champagne/bronze hints), motif vocabulary (organic florals, geometry, Vietnamese luxury cues implied), lighting warmth, premium paper/card texture cues.',
    'NOVELTY (must): Output must be VISUALLY DISTINCT from the attachment reference hero — NEVER mirror layout, centerpiece shape, crop symmetry, vignette gradient pattern, ornament placement, focal arc, horizon line.',
    'Invent alternate side-cluster placement and alternate width of the faint center — while preserving brand coherence. Still no frame lines, and the center stays a faint wash.',
    'If IMAGE 1 (attachment) is supplied: strictly style/color/mood lineage — NEVER duplicate composition from IMAGE 1.',
    '',
  ]
}

export function buildWeddingPrompt(input: {
  type: WeddingImageType
  style: string
  palette: string
  groomName: string
  brideName: string
  venue: string
  extraPrompt: string
  /** true khi có master URL hoặc ảnh tham chiếu tùy chỉnh để căn chỉnh tông/khối ảnh */
  hasReference: boolean
  /** Ảnh tham khảo phong cách do người dùng chọn trong mục tạo ảnh nền */
  hasCustomReference?: boolean
  /** Nhãn khung xuất. Gemini dùng 9:16; GPT dùng size 1104x3312. */
  canvasLabel?: string
  /** false khi đã có ảnh tham khảo: style preset nhường cho ảnh. */
  applyStyle?: boolean
}): string {
  const faceWord = input.type === 'master' ? 'PRIMARY master hero invitation visual' : `secondary "${input.type}" invitation face background`
  const ref = input.hasReference
    ? input.type === 'master'
      ? 'Optional custom reference upload (if supplied): color harmony ornament mood lighting only — NEVER render readable glyphs or copy exact layout from references.'
      : 'REFERENCE (master/custom uploads when supplied): color harmony ornament lineage lighting mood ONLY — forbid copying composition from references.'
    : ''

  const customRef = input.hasCustomReference
    ? 'CUSTOM STYLE REFERENCE (attached, often a wedding frame): match its palette, metal, floral species, and line mood only. Invent a NEW full-page background. Do NOT paste the wreath, center hole, border, or readable text onto the plate.'
    : ''

  const parts = [
    'Create a premium Vietnamese wedding invitation VISUAL BACKGROUND plate (digital print-ready illustration / artwork).',
    `OUTPUT CANVAS: portrait ${input.canvasLabel || WEDDING_BACKGROUND_ASPECT_RATIO}, the tallest vertical plate. Artwork continues from the top edge through the bottom edge so a long invitation scrolls down the full height of this background.`,
    `Target plate: ${faceWord}.`,
    FACE_ART_DIRECTION[input.type],
    plateComposition(input.applyStyle === false ? '' : input.style),
    ...(input.applyStyle === false
      ? []
      : [
          `Global style preset (keep consistent tone): ${input.style || 'luxury'}.`,
          STYLE_ART_DIRECTION[input.style] ?? STYLE_ART_DIRECTION.luxury,
          input.style === 'ethereal'
            ? 'STROKE COUNT (overrides “dense” and “richest” above): this plate uses only a few artistic strokes and large blank paper.'
            : '',
          `Color palette direction (harmonious family across all faces): ${input.palette || 'elegant warm cream, champagne gold, soft blush'}.`,
        ]),
    `Couple story hint (ambient only, no spelled names rendered): ${input.groomName || 'groom'} & ${input.brideName || 'bride'}.`,
    input.venue ? `Venue mood ambience only: ${input.venue}.` : '',
    'ABSOLUTE: Do not render readable Latin/Vietnamese/Chinese letters, digits, logos, stamps, seals with text — leave negative space.',
    'Leave generous safe zones suited for system-rendered typography.',
    'Single full-bleed background plate output; absolutely no watermark or UI chrome.',
    sharedStyleConsistencyBlock(input.type).join('\n'),
    input.extraPrompt ? `\nAdditional user refinement: ${input.extraPrompt}` : '',
    ref,
    customRef,
    lockLine(input.applyStyle === false ? '' : input.style),
  ]

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function weddingStyleIdFromPrompt(prompt: string): string | null {
  const match = /Global style preset \(keep consistent tone\): ([a-z0-9_]+)\./.exec(prompt)
  const id = match?.[1] || ''
  return id && id in STYLE_ART_DIRECTION ? id : null
}

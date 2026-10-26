export const WEDDING_COVER_FRAME_OPENINGS = ['circle', 'ellipse', 'heart', 'arch', 'diamond', 'rounded'] as const

export type WeddingCoverFrameOpening = (typeof WEDDING_COVER_FRAME_OPENINGS)[number]

const OPENING_PROMPT: Record<WeddingCoverFrameOpening, string> = {
  circle: 'The empty center opening must be a large circle, centered in the portrait canvas. The wreath follows that circle.',
  ellipse: 'The empty center opening must be a large vertical ellipse (oval), taller than it is wide, centered. The wreath follows that ellipse.',
  heart: 'The empty center opening must be a large classic heart, point at the bottom, centered. The wreath follows the heart outline. The heart is only the empty window, not a filled heart.',
  arch: 'The empty center opening must be a tall doorway arch: straight vertical sides and a semicircular top, centered. The wreath follows that arch.',
  diamond: 'The empty center opening must be a large diamond (rhombus) with points at top, bottom, left, and right, centered. The wreath follows that diamond.',
  rounded: 'The empty center opening must be a large vertical rounded rectangle with soft corners, centered. The wreath follows that rectangle.',
}

function frameOrnamentLine(styleLabel: string, hasReference: boolean): string {
  if (hasReference) return ''
  const label = styleLabel.trim().toLowerCase()
  if (label === 'ethereal') {
    return 'The ring uses only a few artistic strokes: one flowering branch and a few leaves that still close the opening. Not a dense filigree wreath.'
  }
  if (label === 'floral') {
    return 'The ring is an intricate but graceful wreath of peony, lotus, cherry blossom, rose, and fine gold line. Dense yet airy, elegant, never cartoon.'
  }
  return ''
}

export function readWeddingCoverFrameOpening(value: unknown): WeddingCoverFrameOpening {
  const id = String(value ?? '').trim()
  return (WEDDING_COVER_FRAME_OPENINGS as readonly string[]).includes(id) ? (id as WeddingCoverFrameOpening) : 'ellipse'
}

/** Khung = mark logo. Nền và lỗ giữa cùng một màu phẳng để mask logo khoét đúng lỗ chữ. */
export function buildWeddingCoverFramePrompt(input: {
  styleLabel: string
  palette: string
  extraPrompt: string
  openingShape?: WeddingCoverFrameOpening
  hasReference?: boolean
}): string {
  const extra = input.extraPrompt.trim()
  const opening = readWeddingCoverFrameOpening(input.openingShape)
  return [
    'Create a single wedding invitation logo mark: a closed ornamental wreath frame, portrait 3:4.',
    input.hasReference || !input.styleLabel.trim()
      ? ''
      : `Style: ${input.styleLabel}. Palette accents: ${input.palette || 'ivory, gold, rose'}.`,
    'The logo mark is only the decorative ring — flowers, leaves, and fine linework forming one closed wreath.',
    frameOrnamentLine(input.styleLabel, Boolean(input.hasReference)),
    OPENING_PROMPT[opening],
    input.hasReference
      ? 'REFERENCE IMAGE (attached, often the invitation background): match its palette, floral species, metal, and lighting so this wreath belongs on that background. Invent a NEW wreath. Keep the flat #F4F1EA canvas and the opening shape requested above. Do not copy the background layout or any readable text.'
      : '',
    'The entire canvas behind the mark, including the large center opening and the outer margins, must be one flat solid color #F4F1EA. No texture, no gradient, no paper grain, no shadow, no photo, no people, no letters, no numbers.',
    'The center opening must stay empty so the same #F4F1EA canvas shows through, like the counter inside the letter O. Do not draw a card, plate, or filled shape in the center.',
    'Keep the ring visually closed so the center opening is fully enclosed.',
    extra ? `Extra direction: ${extra}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

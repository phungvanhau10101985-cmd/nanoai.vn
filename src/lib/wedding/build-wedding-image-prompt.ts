import type { WeddingImageType } from '@/lib/db/wedding-cards-pg'

/** Hướng nghệ thuật riêng từng mặt (tiếng Anh cho model ảnh). */
const FACE_ART_DIRECTION: Record<WeddingImageType, string> = {
  master: `PRIMARY HERO MASTER visual for the invitation — the boldest, richest composition; strong focal romance; premium centerpiece energy. This is the anchor artwork every other face should feel related to, but not copy.`,
  cover: `PUBLIC OPENING + HERO face — ceremonial first impression, luxury outer frame, dramatic gate-fold or luminous aisle feeling; leave a bright centered vertical safe zone for couple names, guest line and open button overlays.`,
  invitation: `FAMILY + INVITATION face — refined stationery plate for parents, couple intro and long invitation copy; elegant negative space in the middle, ornament weighted to top/bottom edges, calm readable overlay areas.`,
  event: `EVENT + TIMELINE face — airy architecture and timeline-friendly rhythm; clear zones for calendar, time blocks, venue, map, dress code and schedule cards; detail toward corners, not center.`,
  rsvp: `RSVP + WISHES face — orderly premium guest-response section; subtle card panels, generous form-safe center, soft celebration accents; no dense texture behind input areas.`,
  album: `ALBUM + STORY face — romantic editorial mood, photo-gallery cues, soft vignette, layered paper/photo-corner details and dreamy edge bokeh; leave horizontal resting zones for story and gallery overlays.`,
  gift_qr: `GIFT QR face — restrained ceremonial gift section: preserve a visibly CALM unobstructed circular or rounded square halo (roughly 40–52% panel height) where a QR lives; ornament only toward corners/rims; NEVER busy texture in QR core.`,
  thanks: `THANK YOU CLOSING face — elegant closing card with airy light, final blessing mood, delicate laurel/ribbon/botanical tail; refined and quieter than the hero but still premium.`,
}

const STYLE_ART_DIRECTION: Record<string, string> = {
  luxury:
    'High-end Vietnamese wedding stationery, ivory paper texture, champagne metallic foil, blush warmth, layered embossing, refined depth, premium hotel ballroom mood.',
  minimal:
    'Minimal editorial wedding design, warm white paper, sage hints, charcoal contrast, spacious composition, precise typography-safe geometry, understated luxury.',
  traditional_vietnamese:
    'Vietnamese traditional wedding elegance, red and gold harmony, lotus and silk-inspired ornament, subtle Đông Sơn / lacquer cues, ceremonial warmth, not cartoonish.',
  floral:
    'Romantic floral wedding design, rose and cream tones, eucalyptus greenery, delicate botanical trails, soft watercolor/paper texture, graceful feminine detail.',
  vintage:
    'Vintage heirloom invitation, sepia warmth, dusty rose, antique gold, old paper grain, engraved border feeling, nostalgic but polished.',
  modern:
    'Modern luxury wedding editorial, black/white contrast, metallic gold accents, clean geometry, spotlight gradients, gallery-like premium atmosphere.',
}

function sharedStyleConsistencyBlock(type: WeddingImageType): string[] {
  if (type === 'master') return []
  return [
    '',
    'BRAND MATCH (must): Keep the SAME wedding design language as the hero — palette family, metallics (gold/champagne/bronze hints), motif vocabulary (organic florals, geometry, Vietnamese luxury cues implied), lighting warmth, premium paper/card texture cues.',
    'NOVELTY (must): Output must be VISUALLY DISTINCT from the attachment reference hero — NEVER mirror layout, centerpiece shape, crop symmetry, vignette gradient pattern, ornament placement, focal arc, horizon line.',
    'Invent alternate focal geometry (e.g. shift emphasis top vs bottom vs corners), alternate negative-space silhouette, alternate floral cluster placement, alternate frame thickness — while preserving brand coherence.',
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
  /** true khi có master URL hoặc ảnh tham chiếu cặp đôi / ảnh tùy chỉnh để căn chỉnh tông/khối ảnh */
  hasReference: boolean
  /** Ảnh tham khảo phong cách do người dùng chọn trong mục tạo ảnh nền */
  hasCustomReference?: boolean
}): string {
  const faceWord = input.type === 'master' ? 'PRIMARY master hero invitation visual' : `secondary "${input.type}" invitation face background`
  const ref = input.hasReference
    ? input.type === 'master'
      ? 'Optional couple/custom reference uploads (if supplied): color harmony ornament mood lighting only — NEVER render readable glyphs or copy exact layout from references.'
      : 'REFERENCE (master/couple/custom uploads when supplied): color harmony ornament lineage lighting mood ONLY — forbid copying composition from references.'
    : ''

  const customRef = input.hasCustomReference
    ? 'CUSTOM STYLE REFERENCE (last attached image when present): adopt palette family, ornament vocabulary, material texture, lighting warmth — invent a NEW composition; do NOT duplicate layout, focal crop, or readable text from that image.'
    : ''

  const parts = [
    'Create a premium Vietnamese wedding invitation VISUAL BACKGROUND plate (digital print-ready illustration / artwork).',
    `Target plate: ${faceWord}.`,
    FACE_ART_DIRECTION[input.type],
    `Global style preset (keep consistent tone): ${input.style || 'luxury'}.`,
    STYLE_ART_DIRECTION[input.style] ?? STYLE_ART_DIRECTION.luxury,
    `Color palette direction (harmonious family across all faces): ${input.palette || 'elegant warm cream, champagne gold, soft blush'}.`,
    `Couple story hint (ambient only, no spelled names rendered): ${input.groomName || 'groom'} & ${input.brideName || 'bride'}.`,
    input.venue ? `Venue mood ambience only: ${input.venue}.` : '',
    'ABSOLUTE: Do not render readable Latin/Vietnamese/Chinese letters, digits, logos, stamps, seals with text — leave negative space.',
    'Leave generous safe zones suited for system-rendered typography.',
    'Single full-bleed background plate output; absolutely no watermark or UI chrome.',
    sharedStyleConsistencyBlock(input.type).join('\n'),
    input.extraPrompt ? `\nAdditional user refinement: ${input.extraPrompt}` : '',
    ref,
    customRef,
  ]

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

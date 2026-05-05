import type { WeddingImageType } from '@/lib/db/wedding-cards-pg'

/** Hướng nghệ thuật riêng từng mặt (tiếng Anh cho model ảnh). */
const FACE_ART_DIRECTION: Record<WeddingImageType, string> = {
  master: `PRIMARY HERO MASTER visual for the invitation — the boldest, richest composition; strong focal romance; premium centerpiece energy. This is the anchor artwork every other face should feel related to, but not copy.`,
  cover: `COVER face — ornate outer frame emphasis, dramatic corner flourishes or gate-fold feeling; vignette inward; leave generous central luminosity for names/title overlays. Composition and focal mass must DIFFER from the master hero.`,
  invitation: `INVITATION TYPOGRAPHY face — calmer symmetrical balance, parchment or soft layered paper illusion; restrained ornament concentrating on top/bottom bands; widest clean negative space in the middle third for long invitation text.`,
  event: `EVENT INFO face — airy, slightly architectural or timeline-friendly rhythm; directional softness toward lower-center where date/venue/maps sit; lighter ornament density than master; infographic-friendly negative space.`,
  rsvp: `RSVP / RESPONSE face — orderly, calm stationery structure; faint column or card-panel suggestion (no grids with readable text); clear central soft zone for a form block; understated borders.`,
  album: `ALBUM / STORY face — romantic narrative mood, soft vignette, photo-album cues (floating corners, floral trails, dreamy bokeh at edges); more horizontal resting areas for captions; dreamy not chaotic.`,
  gift_qr: `GIFT QR face — restrained minimal center: preserve a visibly CALM unobstructed circular or rounded square halo (roughly 40–52% panel height) where a QR lives; ornament only toward corners/rims; NEVER busy texture in QR core.`,
  thanks: `THANK YOU closing face — gentle asymmetric closing motif; laurel ribbon or simple botanical tail; uplifted airy light at top; lighter detail than master; intimate send-off emotion.`,
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
  /** true khi có master URL hoặc ảnh tham chiếu cặp đôi để căn chỉnh tông/khối ảnh */
  hasReference: boolean
}): string {
  const faceWord = input.type === 'master' ? 'PRIMARY master hero invitation visual' : `secondary "${input.type}" invitation face background`
  const ref = input.hasReference
    ? input.type === 'master'
      ? 'Optional couple reference uploads (if supplied): color harmony likeness mood only — NEVER render readable glyphs from them.'
      : 'REFERENCE (master/couple uploads when supplied): color harmony ornament lineage lighting mood ONLY — forbid copying composition from master.'
    : ''

  const parts = [
    'Create a premium Vietnamese wedding invitation VISUAL BACKGROUND plate (digital print-ready illustration / artwork).',
    `Target plate: ${faceWord}.`,
    FACE_ART_DIRECTION[input.type],
    `Global style preset (keep consistent tone): ${input.style || 'luxury'}.`,
    `Color palette direction (harmonious family across all faces): ${input.palette || 'elegant warm cream, champagne gold, soft blush'}.`,
    `Couple story hint (ambient only, no spelled names rendered): ${input.groomName || 'groom'} & ${input.brideName || 'bride'}.`,
    input.venue ? `Venue mood ambience only: ${input.venue}.` : '',
    'ABSOLUTE: Do not render readable Latin/Vietnamese/Chinese letters, digits, logos, stamps, seals with text — leave negative space.',
    'Leave generous safe zones suited for system-rendered typography.',
    'Single full-bleed background plate output; absolutely no watermark or UI chrome.',
    sharedStyleConsistencyBlock(input.type).join('\n'),
    input.extraPrompt ? `\nAdditional user refinement: ${input.extraPrompt}` : '',
    ref,
  ]

  return parts.filter(Boolean).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

import { GPT_IMAGE_CREDITS } from '@/lib/ai/image-engine'
import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'
import { parseWeddingSectionConfig, resolveCoverPhotoUrl } from '@/lib/wedding/wedding-section-config'

/** Khóa GPT Image 2 ở medium. 1 credit một ảnh. */
export const WEDDING_COUPLE_PHOTO_RESTYLE_QUALITY = 'medium' as const
export const WEDDING_COUPLE_PHOTO_RESTYLE_CREDIT = GPT_IMAGE_CREDITS.medium

export type WeddingCouplePhotoRestyleKind = 'cover' | 'groom' | 'bride' | 'album'

export type WeddingCouplePhotoRestyleSlot =
  | { kind: 'cover' | 'groom' | 'bride'; index: 0 }
  | { kind: 'album'; index: number }

export type WeddingCouplePhotoRestyleId = 'cover' | 'groom' | 'bride' | `album:${number}`

const ALBUM_SLOT = /^album:(\d{1,2})$/

export function parseWeddingCouplePhotoRestyleSlot(raw: string): WeddingCouplePhotoRestyleSlot | null {
  const value = raw.trim()
  if (value === 'cover' || value === 'groom' || value === 'bride') return { kind: value, index: 0 }
  const album = ALBUM_SLOT.exec(value)
  if (!album) return null
  const index = Number(album[1])
  if (!Number.isInteger(index) || index < 0 || index > 29) return null
  return { kind: 'album', index }
}

export function weddingCouplePhotoRestyleId(slot: WeddingCouplePhotoRestyleSlot): WeddingCouplePhotoRestyleId {
  return slot.kind === 'album' ? `album:${slot.index}` : slot.kind
}

/** Ảnh giấy mời local. Bỏ SVG và đường thoát khỏi thư mục nền. */
export function safeWeddingBackgroundPublicPath(raw: string | null | undefined): string | null {
  const plate = (raw || '').trim()
  if (!plate.startsWith('/wedding/backgrounds/')) return null
  if (plate.includes('..') || plate.includes('\\') || plate.includes('?')) return null
  if (!/\.(jpe?g|png|webp)$/i.test(plate)) return null
  return plate
}

export function weddingThemePlatePublicPath(backgroundPresetId: string | null | undefined): string | null {
  const preset = findWeddingBackgroundPreset(backgroundPresetId)
  if (!preset) return null
  for (const plate of preset.plates) {
    const safe = safeWeddingBackgroundPublicPath(plate)
    if (safe) return safe
  }
  return null
}

export function weddingCouplePhotoSourceUrl(
  card: {
    sectionConfig: string
    groomImageUrl: string
    brideImageUrl: string
    albumImageUrls: readonly string[]
  },
  slot: WeddingCouplePhotoRestyleSlot,
): string {
  if (slot.kind === 'cover') return resolveCoverPhotoUrl(parseWeddingSectionConfig(card.sectionConfig))
  if (slot.kind === 'groom') return card.groomImageUrl.trim()
  if (slot.kind === 'bride') return card.brideImageUrl.trim()
  const url = card.albumImageUrls[slot.index]
  return typeof url === 'string' ? url.trim() : ''
}

/**
 * Sửa ảnh đã tải cho hợp chủ đề thiệp.
 * Ảnh 1 là ảnh người. Ảnh 2, nếu có, chỉ là giấy mời để lấy màu và hoa.
 */
export function buildWeddingCouplePhotoRestylePrompt(input: {
  slot: WeddingCouplePhotoRestyleKind
  styleLabel: string
  palette: string
  themeLabel: string
  venue?: string
  hasThemePlate: boolean
}): string {
  const who =
    input.slot === 'bride'
      ? 'The first attached image is a real photograph of the bride.'
      : input.slot === 'groom'
        ? 'The first attached image is a real photograph of the groom.'
        : 'The first attached image is a real photograph of the bride, the groom, or both.'

  const face =
    input.slot === 'bride'
      ? 'FACE LOCK: keep the bride the same woman. Keep her eyes, eyebrows, nose, lips, jaw, ears, face shape, bone structure, age, expression, and moles. Do not replace her with a lookalike.'
      : input.slot === 'groom'
        ? 'FACE LOCK: keep the groom the same man. Keep his eyes, eyebrows, nose, lips, jaw, ears, face shape, bone structure, age, expression, facial hair, and moles. Do not replace him with a lookalike.'
        : 'FACE LOCK: keep every person the same person. If the bride is in the photo, her face stays the same woman — same eyes, nose, lips, jaw, and face shape. If the groom is in the photo, his face stays the same man. Do not add, remove, or swap people. Do not replace anyone with a lookalike.'

  const hair =
    input.slot === 'bride'
      ? 'HAIR: change her hairstyle into a bridal wedding style that suits a bride-and-groom portrait, such as a soft updo or loose waves pinned for a wedding. Keep her hair color.'
      : input.slot === 'groom'
        ? 'HAIR: change his hairstyle into a neat groom wedding style that suits a bride-and-groom portrait. Keep his hair color and facial hair.'
        : 'HAIR: if the bride is in the photo, restyle her hair into a bridal wedding hairstyle. If the groom is in the photo, restyle his hair into a neat groom wedding hairstyle. Keep each person\'s hair color.'

  const venue = input.venue?.trim()
  return [
    'Edit the first attached photograph so it belongs on this wedding invitation. This is a photo edit of the same people, not a newly invented face.',
    who,
    face,
    hair,
    'SKIN: gently smooth the facial skin so the wedding portrait looks even. Keep the same face shape and identity. Skin stays a real photograph, with faint pores, not plastic or waxy.',
    'You may change clothing, background, light, and color grade so the photograph matches the invitation. Keep the same pose, framing, and number of people.',
    `Invitation style: ${input.styleLabel}. Palette: ${input.palette}. Theme: ${input.themeLabel}.`,
    venue ? `Venue mood only. Do not write the venue as text: ${venue}.` : '',
    input.hasThemePlate
      ? 'The second attached image is the invitation paper. Match its color family, floral species, metal, and light. Do not paste that pattern over the faces. Do not copy any letters from it.'
      : '',
    'OUTPUT: one real photograph with natural light. Facial skin is lightly smoothed and still shows faint pores. Cloth shows weave, and any flower shows petal texture and leaf veins.',
    'Forbidden: cartoon, illustration, anime, sticker, watercolor, pencil, vector, flat icon, plastic skin, magenta or pink cutout fringe, readable text, watermark, logo, frame, border.',
  ]
    .filter(Boolean)
    .join('\n')
}

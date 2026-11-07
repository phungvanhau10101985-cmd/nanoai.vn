import { GPT_IMAGE_CREDITS } from '@/lib/ai/image-engine'
import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'
import { isWeddingSamplePhotoUrl } from '@/lib/wedding/wedding-sample-cards'
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

/** Ảnh vừa lưu của đúng một ô. Album lấy theo chỉ số gốc, không theo danh sách đã lọc. */
export function weddingRestyledSlotUrl(
  id: WeddingCouplePhotoRestyleId,
  saved: {
    coverPhotoUrl: string
    groomImageUrl: string
    brideImageUrl: string
    albumImageUrls: readonly string[]
  },
): string {
  if (id === 'cover') return saved.coverPhotoUrl.trim()
  if (id === 'groom') return saved.groomImageUrl.trim()
  if (id === 'bride') return saved.brideImageUrl.trim()
  const slot = parseWeddingCouplePhotoRestyleSlot(id)
  if (!slot || slot.kind !== 'album') return ''
  const url = saved.albumImageUrls[slot.index]
  return typeof url === 'string' ? url.trim() : ''
}

export type WeddingRestylePhotoChoice = {
  id: WeddingCouplePhotoRestyleId
  url: string
}

/** Ảnh khách đã tải. Bỏ ảnh mẫu. Chỉ số album giữ đúng vị trí trong danh sách. */
export function listWeddingRestylePhotoChoices(input: {
  coverPhotoUrl: string
  groomImageUrl: string
  brideImageUrl: string
  albumImageUrls: readonly string[]
}): WeddingRestylePhotoChoice[] {
  const out: WeddingRestylePhotoChoice[] = []
  const push = (id: WeddingCouplePhotoRestyleId, url: string) => {
    const value = url.trim()
    if (!value || isWeddingSamplePhotoUrl(value)) return
    out.push({ id, url: value })
  }
  push('cover', input.coverPhotoUrl)
  push('groom', input.groomImageUrl)
  push('bride', input.brideImageUrl)
  input.albumImageUrls.forEach((url, index) => {
    if (index > 29) return
    push(`album:${index}`, typeof url === 'string' ? url : '')
  })
  return out
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
 * Ảnh 1 là ảnh người.
 * Ảnh 2, khi có trang phục, là váy và áo chú rể, không có người.
 * Ảnh giấy mời đứng sau ảnh trang phục.
 */
export function buildWeddingCouplePhotoRestylePrompt(input: {
  slot: WeddingCouplePhotoRestyleKind
  styleLabel: string
  palette: string
  themeLabel: string
  venue?: string
  placeScene?: string
  hasOutfit: boolean
  /** Ảnh khách tải. Mặt đã cắt từ cổ lên, chỉ còn trang phục. */
  uploadedOutfit?: boolean
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
    input.hasOutfit
      ? input.uploadedOutfit
        ? 'CLOTHES: the second attached image is a photo of the clothes the couple chose to wear. Any face was cut off above the neck, so only clothing remains. Copy the visible garments: color, pattern, neckline, sleeves, and cut. If a bridal gown is visible, dress the bride in that gown. If a groom suit is visible, dress the groom in that suit. Do not add a person who is not already in the first photograph. Do not copy a face, a neck, or the cut edge. Do not turn a bridal gown black, charcoal, or near-black.'
        : input.slot === 'bride'
          ? 'CLOTHES: the outfit photograph shows one bridal gown and one groom outfit, with no person. Dress the bride in that exact gown. Copy its color, pattern, neckline, and cut. Ignore the groom outfit. Do not add the groom. Do not turn the bridal gown black, charcoal, or near-black. Do not copy a face from that photograph.'
          : input.slot === 'groom'
            ? 'CLOTHES: the outfit photograph shows one bridal gown and one groom outfit, with no person. Dress the groom in that exact outfit. Copy its color, pattern, and cut. Ignore the bridal gown. Do not add the bride. Do not copy a face from that photograph.'
            : 'CLOTHES: the outfit photograph shows one bridal gown and one groom outfit, with no person. If the bride is in the photograph, dress her in that exact gown. If the groom is in the photograph, dress him in that exact outfit. Copy the color, pattern, neckline, and cut. Do not add a person who is not already there. Do not turn the bridal gown black, charcoal, or near-black. Do not copy a face from that photograph.'
      : '',
    `Invitation style: ${input.styleLabel}. Palette: ${input.palette}. Theme: ${input.themeLabel}.`,
    input.placeScene
      ? `PLACE: set the photograph in this real place. Keep the same people, pose, framing, and number of people. The place is the setting behind them. ${input.placeScene}`
      : '',
    input.placeScene
      ? `COLOR: grade the light, sky, stone, water, and air into the invitation palette so the picture stays tone-on-tone with the card. Palette: ${input.palette}. Do not copy invitation paper, letters, or a flat pattern into the scene.`
      : venue
        ? `Venue mood only. Do not write the venue as text: ${venue}.`
        : '',
    input.hasOutfit
      ? 'The second attached image is the wedding clothes only.'
      : '',
    input.hasThemePlate
      ? input.hasOutfit
        ? 'The third attached image is the invitation paper. Match its color family, floral species, metal, and light in the scene behind the people. Do not paste that pattern over the faces. Do not copy any letters from it.'
        : 'The second attached image is the invitation paper. Match its color family, floral species, metal, and light. Do not paste that pattern over the faces. Do not copy any letters from it.'
      : '',
    'OUTPUT: one real photograph with natural light. Facial skin is lightly smoothed and still shows faint pores. Cloth shows weave, and any flower shows petal texture and leaf veins.',
    'Forbidden: cartoon, illustration, anime, sticker, watercolor, pencil, vector, flat icon, plastic skin, magenta or pink cutout fringe, readable text, watermark, logo, frame, border.',
  ]
    .filter(Boolean)
    .join('\n')
}

import weddingOutfitBriefs from '@/lib/wedding/wedding-outfit-briefs.json'
import { findWeddingBackgroundPreset } from '@/lib/wedding/wedding-background-presets'
import { safeWeddingBackgroundPublicPath } from '@/lib/wedding/restyle-wedding-couple-photo'

/** Một ảnh là một bộ: váy cô dâu và trang phục chú rể. */
export const WEDDING_OUTFIT_SET_COUNT = 6
/** Váy dài trắng kim sa và vest đen hoặc xám. Mọi chủ đề dùng chung. */
export const WEDDING_SHARED_OUTFIT_COUNT = 4
export const WEDDING_SHARED_OUTFIT_ID = 'shared'

const FAMILY_ID = /^[a-z0-9-]{1,80}$/
const BRIEFS: Record<string, { plate?: string }> = weddingOutfitBriefs

/** Chủ đề phong cách AI không có giấy riêng. Mỗi mã một bộ trang phục. */
const AI_STYLE_FAMILY: Record<string, string> = {
  luxury: 'ai-luxury',
  minimal: 'ai-minimal',
  traditional_vietnamese: 'ai-truyen-thong',
  floral: 'ai-floral',
  ethereal: 'ai-ethereal',
  vintage: 'ai-vintage',
  modern: 'ai-modern',
}

export function weddingOutfitFamilyIds(): string[] {
  return Object.keys(BRIEFS)
}

/** Chủ đề giấy. Các bố cục dùng cùng ảnh nền thì dùng chung 6 bộ. */
export function weddingOutfitFamilyId(presetId: string | null | undefined): string | null {
  const preset = findWeddingBackgroundPreset(presetId)
  if (!preset) return null
  for (const plate of preset.plates) {
    const safe = safeWeddingBackgroundPublicPath(plate)
    if (!safe) continue
    const file = safe.split('/').pop() || ''
    const id = file.replace(/\.(jpe?g|png|webp)$/i, '')
    if (FAMILY_ID.test(id) && BRIEFS[id]) return id
  }
  if (preset.plates.some((plate) => plate.endsWith('/song-hy-do.svg')) && BRIEFS['song-hy-do']) return 'song-hy-do'
  return null
}

function familyFromPlateUrl(raw: string | null | undefined): string | null {
  const url = raw?.trim().split('?')[0] || ''
  if (!url) return null
  for (const [id, brief] of Object.entries(BRIEFS)) {
    const plate = brief.plate?.trim() || ''
    if (!plate) continue
    if (url === plate || (plate.startsWith('/') && url.endsWith(plate))) return id
  }
  return null
}

/** Giấy có sẵn, rồi ảnh kho, rồi phong cách AI. */
export function weddingOutfitFamilyForCard(input: {
  backgroundPresetId?: string | null
  backgroundKitStyleId?: string | null
  masterImageUrl?: string | null
}): string | null {
  const fromPreset = weddingOutfitFamilyId(input.backgroundPresetId)
  if (fromPreset) return fromPreset
  const fromPlate = familyFromPlateUrl(input.masterImageUrl)
  if (fromPlate) return fromPlate
  const ai = AI_STYLE_FAMILY[input.backgroundKitStyleId?.trim() || '']
  if (ai && BRIEFS[ai]) return ai
  return null
}

export function weddingOutfitPublicPath(familyId: string | null | undefined, index: number): string | null {
  if (!Number.isInteger(index)) return null
  if (index >= 1 && index <= WEDDING_OUTFIT_SET_COUNT) {
    if (!familyId || !FAMILY_ID.test(familyId) || !BRIEFS[familyId]) return null
    return `/wedding/outfits/${familyId}/${index}.webp`
  }
  const shared = index - WEDDING_OUTFIT_SET_COUNT
  if (shared < 1 || shared > WEDDING_SHARED_OUTFIT_COUNT) return null
  return `/wedding/outfits/${WEDDING_SHARED_OUTFIT_ID}/${shared}.webp`
}

export type WeddingOutfitChoice = { index: number; src: string; shared: boolean }

/** Bộ của chủ đề, rồi bốn bộ trắng dùng chung. Chỉ số 7–10 là bộ chung. */
export function weddingOutfitChoices(familyId: string | null | undefined): WeddingOutfitChoice[] {
  const out: WeddingOutfitChoice[] = []
  if (familyId) {
    for (let index = 1; index <= WEDDING_OUTFIT_SET_COUNT; index += 1) {
      const src = weddingOutfitPublicPath(familyId, index)
      if (src) out.push({ index, src, shared: false })
    }
  }
  for (let index = 1; index <= WEDDING_SHARED_OUTFIT_COUNT; index += 1) {
    const src = weddingOutfitPublicPath(null, WEDDING_OUTFIT_SET_COUNT + index)
    if (src) out.push({ index: WEDDING_OUTFIT_SET_COUNT + index, src, shared: true })
  }
  return out
}

export function weddingOutfitImagePaths(familyId: string | null | undefined): string[] {
  if (!familyId) return []
  const paths: string[] = []
  for (let index = 1; index <= WEDDING_OUTFIT_SET_COUNT; index += 1) {
    const path = weddingOutfitPublicPath(familyId, index)
    if (path) paths.push(path)
  }
  return paths
}

export function parseWeddingOutfitIndex(raw: string): number | null {
  if (!/^\d{1,2}$/.test(raw.trim())) return null
  const index = Number(raw)
  const max = WEDDING_OUTFIT_SET_COUNT + WEDDING_SHARED_OUTFIT_COUNT
  if (!Number.isInteger(index) || index < 1 || index > max) return null
  return index
}

/** Ảnh giấy của đúng chủ đề đang mở. */
export function weddingRestyleBackgroundChoices(presetId: string | null | undefined): string[] {
  const preset = findWeddingBackgroundPreset(presetId)
  if (!preset) return []
  const out: string[] = []
  for (const plate of preset.plates) {
    const safe = safeWeddingBackgroundPublicPath(plate)
    if (safe && !out.includes(safe)) out.push(safe)
  }
  return out
}

import type { PackagingFaceKey } from './dimensions'

/** 6 mặt hộp theo thứ tự wizard: trên → trước → phải → dưới → sau → trái */
export type BoxFaceSlot = 'top' | 'front' | 'right' | 'bottom' | 'back' | 'left'

export type FaceSourceMode = 'generate' | 'copy' | 'empty'

export const BOX_FACE_SLOT_ORDER: BoxFaceSlot[] = ['top', 'front', 'right', 'bottom', 'back', 'left']

export type BoxCreatedFace = {
  id: string
  slot: BoxFaceSlot
  sizeKey: PackagingFaceKey
  sourceMode: FaceSourceMode
  /** null khi sourceMode === 'empty' */
  url: string | null
}

const SLOT_SIZE_KEY: Record<BoxFaceSlot, PackagingFaceKey> = {
  top: 'LxW',
  bottom: 'LxW',
  front: 'LxH',
  back: 'LxH',
  right: 'WxH',
  left: 'WxH',
}

/** Mặt phụ có thể copy từ mặt chính tương ứng */
export const BOX_FACE_COPY_SOURCE: Partial<Record<BoxFaceSlot, BoxFaceSlot>> = {
  bottom: 'top',
  back: 'front',
  left: 'right',
}

const SLOT_LABEL_VI: Record<BoxFaceSlot, string> = {
  top: 'Mặt trên',
  front: 'Mặt trước',
  right: 'Mặt bên phải',
  bottom: 'Mặt dưới',
  back: 'Mặt sau',
  left: 'Mặt bên trái',
}

const SLOT_LABEL_EN: Record<BoxFaceSlot, string> = {
  top: 'Top',
  front: 'Front',
  right: 'Right side',
  bottom: 'Bottom',
  back: 'Back',
  left: 'Left side',
}

const SLOT_LABEL_ZH: Record<BoxFaceSlot, string> = {
  top: '顶面',
  front: '正面',
  right: '右侧面',
  bottom: '底面',
  back: '背面',
  left: '左侧面',
}

const SLOT_LABEL_JA: Record<BoxFaceSlot, string> = {
  top: '上面',
  front: '前面',
  right: '右側面',
  bottom: '底面',
  back: '背面',
  left: '左側面',
}

const SLOT_LABEL_KO: Record<BoxFaceSlot, string> = {
  top: '윗면',
  front: '앞면',
  right: '오른쪽 면',
  bottom: '아랫면',
  back: '뒷면',
  left: '왼쪽 면',
}

export function getSizeKeyForSlot(slot: BoxFaceSlot): PackagingFaceKey {
  return SLOT_SIZE_KEY[slot]
}

export function getFaceIndexFromSlot(slot: BoxFaceSlot): number {
  const sk = SLOT_SIZE_KEY[slot]
  if (sk === 'LxW') return 1
  if (sk === 'LxH') return 2
  return 3
}

export function isSecondaryBoxFaceSlot(slot: BoxFaceSlot): boolean {
  return slot === 'bottom' || slot === 'back' || slot === 'left'
}

export function getBoxFaceSlotLabel(
  slot: BoxFaceSlot,
  locale: 'vi' | 'en' | 'zh' | 'ja' | 'ko' = 'vi'
): string {
  if (locale === 'en') return SLOT_LABEL_EN[slot]
  if (locale === 'zh') return SLOT_LABEL_ZH[slot]
  if (locale === 'ja') return SLOT_LABEL_JA[slot]
  if (locale === 'ko') return SLOT_LABEL_KO[slot]
  return SLOT_LABEL_VI[slot]
}

/** URL cho mockup — chỉ ảnh của đúng slot, không copy từ mặt khác, không logo. */
export function resolveMockupSlotUrl(
  slot: BoxFaceSlot,
  faceSlots: Partial<Record<BoxFaceSlot, { sourceMode: FaceSourceMode; url?: string }>>
): string | null {
  const entry = faceSlots[slot]
  if (!entry || entry.sourceMode === 'empty') return null
  return entry.url ?? null
}

/** URL thực tế dùng cho dieline (resolve copy chain khi cần). */
export function resolveBoxFaceUrl(slot: BoxFaceSlot, faces: BoxCreatedFace[]): string | null {
  const face = faces.find((f) => f.slot === slot)
  if (!face) return null
  if (face.sourceMode === 'empty') return null
  if (face.url) return face.url
  const copyFrom = BOX_FACE_COPY_SOURCE[slot]
  if (copyFrom && face.sourceMode === 'copy') return resolveBoxFaceUrl(copyFrom, faces)
  return null
}

/** Ảnh tham chiếu style khi tạo mới mặt phụ / mặt bên */
export function getStyleReferenceSlotForGenerate(slot: BoxFaceSlot): BoxFaceSlot | null {
  if (slot === 'top') return null
  if (slot === 'front' || slot === 'right') return 'top'
  if (slot === 'bottom') return 'top'
  if (slot === 'back') return 'front'
  if (slot === 'left') return 'right'
  return null
}

export function migrateLegacyBoxFaces(
  raw: { id: string; sizeKey: PackagingFaceKey; url: string | null; slot?: BoxFaceSlot; sourceMode?: FaceSourceMode }[]
): BoxCreatedFace[] {
  if (!raw.length) return []
  if (raw.every((f) => f.slot)) {
    return raw.map((f) => ({
      id: f.id,
      slot: f.slot!,
      sizeKey: f.sizeKey,
      sourceMode: f.sourceMode ?? (f.url ? 'generate' : 'empty'),
      url: f.url ?? null,
    }))
  }

  const bySize: Record<PackagingFaceKey, typeof raw> = { LxW: [], LxH: [], WxH: [] }
  for (const f of raw) bySize[f.sizeKey].push(f)

  const pairs: [BoxFaceSlot, BoxFaceSlot][] = [
    ['top', 'bottom'],
    ['front', 'back'],
    ['right', 'left'],
  ]
  const sizeKeys: PackagingFaceKey[] = ['LxW', 'LxH', 'WxH']
  const out: BoxCreatedFace[] = []

  pairs.forEach(([primary, secondary], i) => {
    const list = bySize[sizeKeys[i]]
    if (list[0]) {
      out.push({
        id: list[0].id,
        slot: primary,
        sizeKey: sizeKeys[i],
        sourceMode: 'generate',
        url: list[0].url ?? null,
      })
    }
    if (list[1]) {
      out.push({
        id: list[1].id,
        slot: secondary,
        sizeKey: sizeKeys[i],
        sourceMode: 'generate',
        url: list[1].url ?? null,
      })
    }
  })

  return out.sort((a, b) => BOX_FACE_SLOT_ORDER.indexOf(a.slot) - BOX_FACE_SLOT_ORDER.indexOf(b.slot))
}

export function allBoxFaceSlotsFilled(faces: BoxCreatedFace[]): boolean {
  return BOX_FACE_SLOT_ORDER.every((slot) => faces.some((f) => f.slot === slot))
}

export function getNextBoxFaceSlot(faces: BoxCreatedFace[]): BoxFaceSlot | null {
  return BOX_FACE_SLOT_ORDER.find((slot) => !faces.some((f) => f.slot === slot)) ?? null
}

export function resolveDielineFaceUrls(faces: BoxCreatedFace[]): {
  LxW: string | null
  LxH: string | null
  WxH: string | null
} {
  const top = resolveBoxFaceUrl('top', faces)
  const bottom = resolveBoxFaceUrl('bottom', faces)
  const front = resolveBoxFaceUrl('front', faces)
  const back = resolveBoxFaceUrl('back', faces)
  const right = resolveBoxFaceUrl('right', faces)
  const left = resolveBoxFaceUrl('left', faces)
  return {
    LxW: top ?? bottom,
    LxH: front ?? back,
    WxH: right ?? left,
  }
}

/** Per-slot artwork for dieline PDF — empty/copy resolved per face, no cross-slot fallback. */
export function resolveDielineSlotUrls(faces: BoxCreatedFace[]): Partial<Record<BoxFaceSlot, string>> {
  const out: Partial<Record<BoxFaceSlot, string>> = {}
  for (const slot of BOX_FACE_SLOT_ORDER) {
    const url = resolveBoxFaceUrl(slot, faces)
    if (url) out[slot] = url
  }
  return out
}

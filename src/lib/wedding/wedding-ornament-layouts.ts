/**
 * Bố cục thiệp = một tấm giấy + ảnh khung (vòng, vòm, viền) + ảnh hoa văn đặt lại.
 * Cùng một họa tiết được lật, xoay, giảm đục. Chữ nằm ở khoảng giữa, hoa bám mép.
 */

export type OrnamentPieceId =
  | 'butterfly'
  | 'garland'
  | 'sprig'
  | 'peony'
  | 'vine'
  | 'seal'
  | 'wreath'
  | 'arch'
  | 'plate'
  | 'polaroid'
  | 'tape'
  | 'driedStem'
  | 'mocBloom'
  | 'mocLeaf'
  | 'mocSprig'
  | 'callaStem'
  | 'callaBloom'
  | 'mistSprig'

export type OrnamentLayer = {
  piece: OrnamentPieceId
  /** Góc trái, phần trăm bề ngang tấm thiệp. */
  x: number
  /** Góc trên, phần trăm bề cao tấm thiệp. */
  y: number
  /** Bề ngang, phần trăm bề ngang tấm thiệp. */
  w: number
  rotate?: number
  flipX?: boolean
  flipY?: boolean
  opacity?: number
  z?: number
  /** bottom = bám đáy tấm thiệp, không trôi khi chữ dài thêm. */
  anchor?: 'top' | 'bottom'
}

export type OrnamentLayoutId = 'meadow' | 'corners' | 'sides' | 'seal' | 'wreath' | 'arch' | 'polaroid' | 'mat'

export type OrnamentLayout = {
  id: OrnamentLayoutId
  /** Chừa mép cho hoa. Phần trăm bề ngang tấm thiệp. */
  pad: { top: number; right: number; bottom: number; left: number }
  /** Ô ảnh khi thiệp chỉ hiện khung, không hiện tên. */
  photo: { x: number; y: number; w: number; h: number; radius: number }
  /** mat = viền kép mỏng quanh ảnh cưới. */
  photoChrome?: 'mat'
  layers: OrnamentLayer[]
}

export type OrnamentKitId = 'dried' | 'blush' | 'sage' | 'ceremonial' | 'linen' | 'wood' | 'calla'

export type OrnamentKit = {
  id: OrnamentKitId
  panel: string
  petal: string
  petalDeep: string
  leaf: string
  stem: string
  metal: string
  dot: string
}

export type OrnamentComposition = {
  id: string
  kit: OrnamentKit
  layout: OrnamentLayout
}

/** Tỉ lệ ngang/dọc của từng ảnh họa tiết. */
export const ORNAMENT_PIECE_RATIO: Record<OrnamentPieceId, string> = {
  butterfly: '220 / 150',
  garland: '640 / 190',
  sprig: '180 / 280',
  peony: '220 / 220',
  vine: '120 / 640',
  seal: '160 / 160',
  wreath: '400 / 520',
  arch: '400 / 560',
  plate: '400 / 520',
  polaroid: '400 / 520',
  tape: '220 / 64',
  driedStem: '180 / 280',
  mocBloom: '909 / 850',
  mocLeaf: '778 / 917',
  mocSprig: '541 / 649',
  callaStem: '559 / 950',
  callaBloom: '498 / 724',
  mistSprig: '378 / 491',
}

export const ORNAMENT_FRAME_PIECES = new Set<OrnamentPieceId>(['wreath', 'arch', 'plate', 'polaroid'])

/**
 * Lỗ ảnh trong khung polaroid, phần trăm của chính khung (viewBox 400×520).
 * Khung đặt full bề ngang một ô 3/4. Đổi số này thì đổi cả nét trong PolaroidFrame.
 */
export const LINEN_POLAROID_HOLE = { x: 8, y: 7, w: 84, h: 82 }
const POLAROID_STAGE_HEIGHT = (100 * (520 / 400)) / (4 / 3)

export const ORNAMENT_KITS: Record<OrnamentKitId, OrnamentKit> = {
  dried: {
    id: 'dried',
    panel: '#f6f0e4',
    petal: '#f3e6d0',
    petalDeep: '#c9ae8c',
    leaf: '#8ea4b4',
    stem: '#8b7058',
    metal: '#6d5844',
    dot: '#d7c4a4',
  },
  blush: {
    id: 'blush',
    panel: '#fff7f5',
    petal: '#f6c9d4',
    petalDeep: '#d9899c',
    leaf: '#87a884',
    stem: '#6d8a66',
    metal: '#9a5364',
    dot: '#f3ddd4',
  },
  sage: {
    id: 'sage',
    panel: '#f3f6f1',
    petal: '#e4eee2',
    petalDeep: '#b5c9ae',
    leaf: '#4f7a55',
    stem: '#3d5c40',
    metal: '#2f4a34',
    dot: '#d5e2d2',
  },
  ceremonial: {
    id: 'ceremonial',
    panel: '#fff6ea',
    petal: '#f0d2a4',
    petalDeep: '#c45348',
    leaf: '#2f6b4f',
    stem: '#8a5a32',
    metal: '#a67c3d',
    dot: '#f6e7c8',
  },
  linen: {
    id: 'linen',
    panel: '#f7f2ea',
    petal: '#f3e6d0',
    petalDeep: '#c4a882',
    leaf: '#b7a890',
    stem: '#8d735c',
    metal: '#c6a15b',
    dot: '#e7d7c3',
  },
  wood: {
    id: 'wood',
    panel: '#fbf8f3',
    petal: '#f4f0e8',
    petalDeep: '#d7e0d4',
    leaf: '#3e5a44',
    stem: '#1f3d2b',
    metal: '#1f3d2b',
    dot: '#e7efe4',
  },
  calla: {
    id: 'calla',
    panel: '#fffcf8',
    petal: '#f4f7ef',
    petalDeep: '#d5e0c4',
    leaf: '#6d8a5c',
    stem: '#4f6844',
    metal: '#3e4f34',
    dot: '#e7efe0',
  },
}

export const ORNAMENT_LAYOUTS: Record<OrnamentLayoutId, OrnamentLayout> = {
  meadow: {
    id: 'meadow',
    pad: { top: 8, right: 14, bottom: 18, left: 14 },
    photo: { x: 27, y: 16, w: 46, h: 34, radius: 18 },
    layers: [
      { piece: 'butterfly', x: -12, y: -2, w: 30, rotate: -18, z: 4 },
      { piece: 'butterfly', x: 82, y: 2, w: 30, rotate: 16, flipX: true, z: 4 },
      { piece: 'butterfly', x: 2, y: 34, w: 14, rotate: 24, opacity: 0.16, z: 1 },
      { piece: 'garland', x: -8, y: 76, w: 116, z: 4 },
    ],
  },
  corners: {
    id: 'corners',
    pad: { top: 14, right: 14, bottom: 14, left: 14 },
    photo: { x: 22, y: 18, w: 56, h: 40, radius: 16 },
    layers: [
      { piece: 'peony', x: -10, y: -6, w: 40, z: 3 },
      { piece: 'peony', x: 70, y: -6, w: 40, flipX: true, z: 3 },
      { piece: 'peony', x: -10, y: -8, w: 38, flipY: true, anchor: 'bottom', z: 3 },
      { piece: 'peony', x: 72, y: -8, w: 38, flipX: true, flipY: true, anchor: 'bottom', z: 3 },
    ],
  },
  sides: {
    id: 'sides',
    pad: { top: 8, right: 16, bottom: 10, left: 16 },
    photo: { x: 22, y: 12, w: 56, h: 52, radius: 14 },
    layers: [
      { piece: 'vine', x: -4, y: 2, w: 20, z: 3 },
      { piece: 'vine', x: 84, y: 2, w: 20, flipX: true, z: 3 },
      { piece: 'sprig', x: 36, y: -2, w: 28, anchor: 'bottom', z: 4 },
    ],
  },
  seal: {
    id: 'seal',
    pad: { top: 26, right: 14, bottom: 16, left: 14 },
    photo: { x: 26, y: 24, w: 48, h: 36, radius: 12 },
    layers: [
      { piece: 'plate', x: 5, y: 3, w: 90, z: 1 },
      { piece: 'seal', x: 39, y: -1, w: 22, z: 4 },
      { piece: 'sprig', x: -6, y: -6, w: 36, anchor: 'bottom', z: 3 },
      { piece: 'sprig', x: 70, y: -4, w: 34, flipX: true, flipY: true, z: 3 },
    ],
  },
  wreath: {
    id: 'wreath',
    pad: { top: 20, right: 18, bottom: 18, left: 18 },
    photo: { x: 28, y: 18, w: 44, h: 36, radius: 999 },
    layers: [
      { piece: 'wreath', x: -2, y: -8, w: 104, z: 2 },
      { piece: 'butterfly', x: 68, y: 4, w: 28, rotate: 18, flipX: true, z: 4 },
      { piece: 'garland', x: -6, y: -6, w: 112, anchor: 'bottom', z: 3 },
    ],
  },
  arch: {
    id: 'arch',
    pad: { top: 20, right: 16, bottom: 14, left: 16 },
    photo: { x: 20, y: 14, w: 60, h: 44, radius: 20 },
    layers: [
      { piece: 'arch', x: 2, y: -6, w: 96, z: 2 },
      { piece: 'peony', x: -8, y: -2, w: 34, z: 4 },
      { piece: 'peony', x: 74, y: -2, w: 34, flipX: true, z: 4 },
      { piece: 'sprig', x: 36, y: -2, w: 28, anchor: 'bottom', z: 4 },
    ],
  },
  mat: {
    id: 'mat',
    pad: { top: 8, right: 12, bottom: 8, left: 12 },
    photo: { x: 14, y: 13, w: 72, h: 74, radius: 6 },
    photoChrome: 'mat',
    layers: [
      { piece: 'mocBloom', x: -1, y: -1, w: 26, rotate: -8, z: 4 },
      { piece: 'mocSprig', x: 78, y: -1, w: 20, rotate: 10, z: 4 },
      { piece: 'mocLeaf', x: -2, y: -2, w: 22, rotate: -16, anchor: 'bottom', z: 4, opacity: 0.92 },
      { piece: 'mocSprig', x: 76, y: -1, w: 16, rotate: 12, flipX: true, anchor: 'bottom', z: 4, opacity: 0.85 },
    ],
  },
  polaroid: {
    id: 'polaroid',
    pad: { top: 4, right: 8, bottom: 6, left: 8 },
    photo: {
      x: LINEN_POLAROID_HOLE.x,
      y: (LINEN_POLAROID_HOLE.y / 100) * POLAROID_STAGE_HEIGHT,
      w: LINEN_POLAROID_HOLE.w,
      h: (LINEN_POLAROID_HOLE.h / 100) * POLAROID_STAGE_HEIGHT,
      radius: 0,
    },
    layers: [
      { piece: 'polaroid', x: 0, y: 0, w: 100, z: 2 },
      { piece: 'tape', x: 36, y: 0.4, w: 28, rotate: -7, z: 5 },
      { piece: 'driedStem', x: -2, y: 0, w: 24, rotate: -16, anchor: 'bottom', z: 6 },
      { piece: 'seal', x: 74, y: 1, w: 20, anchor: 'bottom', z: 6 },
    ],
  },
}

const COMPOSITION_PARTS: Record<string, { kit: OrnamentKitId; layout: OrnamentLayoutId }> = {
  dried_meadow: { kit: 'dried', layout: 'meadow' },
  blush_meadow: { kit: 'blush', layout: 'meadow' },
  blush_corners: { kit: 'blush', layout: 'corners' },
  sage_sides: { kit: 'sage', layout: 'sides' },
  dried_seal: { kit: 'dried', layout: 'seal' },
  blush_wreath: { kit: 'blush', layout: 'wreath' },
  ceremonial_arch: { kit: 'ceremonial', layout: 'arch' },
  sage_corners: { kit: 'sage', layout: 'corners' },
  moc_portrait: { kit: 'wood', layout: 'mat' },
  linen_polaroid: { kit: 'linen', layout: 'polaroid' },
}

export function getOrnamentComposition(id: string | null | undefined): OrnamentComposition | undefined {
  const parts = COMPOSITION_PARTS[String(id || '').trim()]
  if (!parts) return undefined
  return {
    id: String(id).trim(),
    kit: ORNAMENT_KITS[parts.kit],
    layout: ORNAMENT_LAYOUTS[parts.layout],
  }
}

export function listOrnamentCompositionIds(): string[] {
  return Object.keys(COMPOSITION_PARTS)
}

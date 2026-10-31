/** Hộp mừng đi theo bộ nền. Nền đỏ giữ hộp son. Nền khác đổi màu, dấu niêm và hạt trang trí. */
import { WEDDING_SAMPLE_CARDS } from '@/lib/wedding/wedding-sample-cards'

export type WeddingGiftBoxMark = 'double-happiness' | 'lotus' | 'leaf' | 'rose' | 'ring'
export type WeddingGiftBoxScatter = 'coin' | 'pearl' | 'none'

export type WeddingGiftBoxLook = {
  id: string
  title: string
  band: string
  box: string
  edge: string
  corner: string
  glow: string
  shadow: string
  sealPlate: string
  sealEdge: string
  sealInk: string
  mark: WeddingGiftBoxMark
  scatter: WeddingGiftBoxScatter
  coinFrom: string
  coinTo: string
  coinEdge: string
  /** Ảnh hộp chụp, nền trong. */
  photo: string
}

const LACQUER: WeddingGiftBoxLook = {
  id: 'lacquer',
  title: '#5c4033',
  band: 'rgba(251, 191, 36, 0.45)',
  box: 'linear-gradient(to bottom, #b91c1c, #991b1b, #450a0a)',
  edge: 'rgba(245, 158, 11, 0.9)',
  corner: 'rgba(251, 191, 36, 0.8)',
  glow: 'radial-gradient(ellipse at center, rgba(250,204,21,0.55) 0%, rgba(254,243,199,0.25) 45%, transparent 70%)',
  shadow: '0 12px 40px rgba(185, 28, 28, 0.35), inset 0 1px 0 rgba(254, 249, 231, 0.12)',
  sealPlate: 'linear-gradient(to bottom right, #fde68a, #fef3c7, #facc15)',
  sealEdge: '#fbbf24',
  sealInk: '#991b1b',
  mark: 'double-happiness',
  scatter: 'coin',
  coinFrom: '#fcd34d',
  coinTo: '#f59e0b',
  coinEdge: '#d97706',
  photo: '/wedding/gifts/lacquer.webp',
}

const LOTUS: WeddingGiftBoxLook = {
  id: 'lotus',
  title: '#3b2618',
  band: 'rgba(138, 90, 18, 0.28)',
  box: 'linear-gradient(to bottom, #fff6ea, #e8c98a, #8a5a12)',
  edge: '#6b4310',
  corner: 'rgba(138, 90, 18, 0.7)',
  glow: 'radial-gradient(ellipse at center, rgba(232,201,138,0.55) 0%, rgba(255,246,234,0.3) 45%, transparent 70%)',
  shadow: '0 12px 36px rgba(107, 67, 16, 0.28), inset 0 1px 0 rgba(255, 250, 240, 0.4)',
  sealPlate: 'linear-gradient(to bottom right, #fffaf0, #f6e7c8)',
  sealEdge: '#8a5a12',
  sealInk: '#6b4310',
  mark: 'lotus',
  scatter: 'coin',
  coinFrom: '#f6e7c8',
  coinTo: '#c6a15b',
  coinEdge: '#8a5a12',
  photo: '/wedding/gifts/lotus.webp',
}

const WOOD: WeddingGiftBoxLook = {
  id: 'wood',
  title: '#1f3d2b',
  band: 'rgba(31, 61, 43, 0.18)',
  box: 'linear-gradient(to bottom, #3e5a44, #1f3d2b, #14281c)',
  edge: '#c5d5c4',
  corner: 'rgba(231, 239, 228, 0.75)',
  glow: 'radial-gradient(ellipse at center, rgba(62,90,68,0.35) 0%, rgba(251,248,243,0.2) 48%, transparent 72%)',
  shadow: '0 12px 36px rgba(31, 61, 43, 0.28), inset 0 1px 0 rgba(231, 239, 228, 0.2)',
  sealPlate: 'linear-gradient(to bottom right, #fffdf8, #e7efe4)',
  sealEdge: '#d5e2d4',
  sealInk: '#1f3d2b',
  mark: 'leaf',
  scatter: 'none',
  coinFrom: '#e7efe4',
  coinTo: '#3e5a44',
  coinEdge: '#1f3d2b',
  photo: '/wedding/gifts/wood.webp',
}

const SAGE: WeddingGiftBoxLook = {
  id: 'sage',
  title: '#3e4f34',
  band: 'rgba(92, 107, 64, 0.22)',
  box: 'linear-gradient(to bottom, #f7faf4, #d5e0c4, #5c6b40)',
  edge: '#8fa57a',
  corner: 'rgba(232, 239, 224, 0.8)',
  glow: 'radial-gradient(ellipse at center, rgba(143,165,122,0.4) 0%, rgba(247,250,244,0.28) 48%, transparent 72%)',
  shadow: '0 12px 36px rgba(62, 79, 52, 0.22), inset 0 1px 0 rgba(255, 252, 248, 0.4)',
  sealPlate: 'linear-gradient(to bottom right, #fffcf8, #e4edd6)',
  sealEdge: '#8fa57a',
  sealInk: '#3e4f34',
  mark: 'leaf',
  scatter: 'none',
  coinFrom: '#e4edd6',
  coinTo: '#8fa57a',
  coinEdge: '#5c6b40',
  photo: '/wedding/gifts/sage.webp',
}

const LINEN: WeddingGiftBoxLook = {
  id: 'linen',
  title: '#4a433c',
  band: 'rgba(141, 115, 85, 0.28)',
  box: 'linear-gradient(to bottom, #f7f2ea, #e4d0ae, #8d735c)',
  edge: '#6e5b45',
  corner: 'rgba(110, 91, 69, 0.65)',
  glow: 'radial-gradient(ellipse at center, rgba(228,208,174,0.5) 0%, rgba(247,242,234,0.3) 46%, transparent 72%)',
  shadow: '0 12px 36px rgba(74, 67, 60, 0.22), inset 0 1px 0 rgba(255, 252, 248, 0.4)',
  sealPlate: 'linear-gradient(to bottom right, #fffdf8, #e7d7c3)',
  sealEdge: '#8d735c',
  sealInk: '#6e5b45',
  mark: 'ring',
  scatter: 'none',
  coinFrom: '#e7d7c3',
  coinTo: '#c4a882',
  coinEdge: '#8d735c',
  photo: '/wedding/gifts/linen.webp',
}

const BLUSH: WeddingGiftBoxLook = {
  id: 'blush',
  title: '#3a2a2e',
  band: 'rgba(157, 78, 99, 0.22)',
  box: 'linear-gradient(to bottom, #fff7f8, #f0b8c6, #9d4e63)',
  edge: '#7a3b4e',
  corner: 'rgba(157, 78, 99, 0.55)',
  glow: 'radial-gradient(ellipse at center, rgba(240,184,198,0.55) 0%, rgba(255,247,248,0.3) 46%, transparent 72%)',
  shadow: '0 12px 36px rgba(122, 59, 78, 0.22), inset 0 1px 0 rgba(255, 248, 250, 0.45)',
  sealPlate: 'linear-gradient(to bottom right, #fffdfb, #f6c9d4)',
  sealEdge: '#9d4e63',
  sealInk: '#7a3b4e',
  mark: 'rose',
  scatter: 'pearl',
  coinFrom: '#fffdfb',
  coinTo: '#f3ddd4',
  coinEdge: '#d7b8c4',
  photo: '/wedding/gifts/blush.webp',
}

const PEARL: WeddingGiftBoxLook = {
  id: 'pearl',
  title: '#4a2c38',
  band: 'rgba(176, 90, 120, 0.22)',
  box: 'linear-gradient(to bottom, #fff8fa, #f3ddd4, #b05a78)',
  edge: '#8d4560',
  corner: 'rgba(176, 90, 120, 0.5)',
  glow: 'radial-gradient(ellipse at center, rgba(243,221,212,0.7) 0%, rgba(255,248,250,0.3) 46%, transparent 72%)',
  shadow: '0 12px 36px rgba(141, 69, 96, 0.2), inset 0 1px 0 rgba(255, 252, 253, 0.5)',
  sealPlate: 'linear-gradient(to bottom right, #ffffff, #f6eee8)',
  sealEdge: '#c4a4b0',
  sealInk: '#8d4560',
  mark: 'rose',
  scatter: 'pearl',
  coinFrom: '#ffffff',
  coinTo: '#f3e6ea',
  coinEdge: '#e7d3da',
  photo: '/wedding/gifts/pearl.webp',
}

const SKY: WeddingGiftBoxLook = {
  id: 'sky',
  title: '#2f3d4c',
  band: 'rgba(93, 109, 124, 0.28)',
  box: 'linear-gradient(to bottom, #f7fbff, #e7c5d0, #8d4560)',
  edge: '#5d6d7c',
  corner: 'rgba(93, 109, 124, 0.55)',
  glow: 'radial-gradient(ellipse at center, rgba(178,91,116,0.28) 0%, rgba(247,251,255,0.35) 48%, transparent 72%)',
  shadow: '0 12px 36px rgba(47, 61, 76, 0.18), inset 0 1px 0 rgba(255, 252, 253, 0.45)',
  sealPlate: 'linear-gradient(to bottom right, #fffdfb, #f0d5de)',
  sealEdge: '#8d4560',
  sealInk: '#8d4560',
  mark: 'rose',
  scatter: 'pearl',
  coinFrom: '#ffffff',
  coinTo: '#e7eef4',
  coinEdge: '#b7c6d4',
  photo: '/wedding/gifts/sky.webp',
}

const BURGUNDY: WeddingGiftBoxLook = {
  id: 'burgundy',
  title: '#4a1e2c',
  band: 'rgba(92, 26, 40, 0.22)',
  box: 'linear-gradient(to bottom, #8a3048, #5c1a28, #3a1018)',
  edge: '#e7d3c4',
  corner: 'rgba(247, 241, 234, 0.75)',
  glow: 'radial-gradient(ellipse at center, rgba(138,48,72,0.4) 0%, rgba(255,248,244,0.25) 48%, transparent 72%)',
  shadow: '0 12px 36px rgba(74, 30, 44, 0.28), inset 0 1px 0 rgba(255, 248, 244, 0.25)',
  sealPlate: 'linear-gradient(to bottom right, #fffdfb, #f3e4dc)',
  sealEdge: '#c4a4a8',
  sealInk: '#5c1a28',
  mark: 'rose',
  scatter: 'none',
  coinFrom: '#fffdfb',
  coinTo: '#e7d3c4',
  coinEdge: '#8a3048',
  photo: '/wedding/gifts/burgundy.webp',
}

const ENVELOPE_GIFT: WeddingGiftBoxLook = { ...BURGUNDY, id: 'envelope' }

const CHARCOAL: WeddingGiftBoxLook = {
  id: 'charcoal',
  title: '#f6efe2',
  band: 'rgba(212, 168, 75, 0.35)',
  box: 'linear-gradient(to bottom, #3a3a3a, #1c1c1c, #0c0c0c)',
  edge: 'rgba(212, 168, 75, 0.9)',
  corner: 'rgba(246, 226, 176, 0.7)',
  glow: 'radial-gradient(ellipse at center, rgba(212,168,75,0.4) 0%, rgba(28,28,28,0.2) 48%, transparent 72%)',
  shadow: '0 12px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(246, 239, 226, 0.12)',
  sealPlate: 'linear-gradient(to bottom right, #f6e2b0, #d4a84b)',
  sealEdge: '#e8c87a',
  sealInk: '#1c1c1c',
  mark: 'ring',
  scatter: 'none',
  coinFrom: '#f6e2b0',
  coinTo: '#d4a84b',
  coinEdge: '#a16207',
  photo: '/wedding/gifts/charcoal.webp',
}

const SONG_HY: WeddingGiftBoxLook = {
  id: 'song-hy',
  title: '#7a1c28',
  band: 'rgba(243, 210, 122, 0.55)',
  box: 'linear-gradient(to bottom, #9b1c24, #6e1218, #3a0a10)',
  edge: 'rgba(243, 210, 122, 0.9)',
  corner: 'rgba(246, 226, 176, 0.8)',
  glow: 'radial-gradient(ellipse at center, rgba(243,210,122,0.45) 0%, rgba(155,28,36,0.2) 48%, transparent 72%)',
  shadow: '0 12px 40px rgba(78, 16, 24, 0.4), inset 0 1px 0 rgba(246, 226, 176, 0.16)',
  sealPlate: 'linear-gradient(to bottom right, #f6e2b0, #f3d27a)',
  sealEdge: '#e8c87a',
  sealInk: '#7a1c28',
  mark: 'double-happiness',
  scatter: 'coin',
  coinFrom: '#f6e2b0',
  coinTo: '#d4a24c',
  coinEdge: '#a16207',
  photo: '/wedding/gifts/lacquer.webp',
}

const BY_PRESET: Record<string, WeddingGiftBoxLook> = {
  'long-phung-do': LACQUER,
  'do-son': LACQUER,
  'song-hy-do': SONG_HY,
  'sen-vang': LOTUS,
  'hoa-moc-xanh': WOOD,
  'to-duyen-xanh': SAGE,
  'toi-gian-nau': LINEN,
  'vuon-kinh-hong': BLUSH,
  'hong-ngoc-trai': PEARL,
  'vuon-hong-troi': SKY,
  'do-dam': BURGUNDY,
  'phong-bi-thu': ENVELOPE_GIFT,
}

const BY_STYLE: Record<string, WeddingGiftBoxLook> = {
  floral: BLUSH,
  ethereal: PEARL,
  traditional_vietnamese: LACQUER,
  luxury: LOTUS,
  vintage: LINEN,
  modern: CHARCOAL,
  minimal: LINEN,
}

const BY_LIBRARY_SAMPLE: Record<string, WeddingGiftBoxLook> = {
  'kho-hong-buom': BLUSH,
  'kho-sen-hong': LOTUS,
  'kho-hac-sen': LACQUER,
  'kho-hac-do': LACQUER,
  'kho-phung-do': LACQUER,
  'kho-mau-don': BURGUNDY,
  'kho-do-phap': LACQUER,
}

function lookForLibraryImage(masterImageUrl: string | null | undefined): WeddingGiftBoxLook | undefined {
  const url = masterImageUrl?.trim() || ''
  if (!url) return undefined
  const sample = WEDDING_SAMPLE_CARDS.find((item) => item.libraryImageUrl === url)
  return sample ? BY_LIBRARY_SAMPLE[sample.id] : undefined
}

export function weddingGiftBoxLook(presetId: string | null | undefined, masterImageUrl?: string | null): WeddingGiftBoxLook {
  const key = presetId?.trim() || ''
  if (BY_PRESET[key]) return BY_PRESET[key]
  const fromLibrary = lookForLibraryImage(masterImageUrl)
  if (fromLibrary) return fromLibrary
  const style = key.replace(/^ai-/, '')
  return BY_STYLE[style] ?? LACQUER
}

import type { WebLocale } from '@/lib/i18n/config'

export const WEDDING_BUTTON_COLOR_IDS = [
  'black',
  'charcoal',
  'slate',
  'white',
  'ivory',
  'cream',
  'champagne',
  'bronze',
  'chocolate',
  'rust',
  'terracotta',
  'gold',
  'burgundy',
  'red',
  'wine',
  'rose',
  'pink',
  'blush',
  'coral',
  'peach',
  'plum',
  'magenta',
  'lilac',
  'navy',
  'royal',
  'sky',
  'forest',
  'emerald',
  'teal',
  'olive',
  'mint',
] as const

export type WeddingButtonColorId = (typeof WEDDING_BUTTON_COLOR_IDS)[number]

export type WeddingButtonColor = {
  id: WeddingButtonColorId
  bg: string
  hoverBg: string
  text: string
  border: string
  swatch: string
}

type ColorName = Record<WebLocale, string>

const SWATCHES: { id: WeddingButtonColorId; bg: string; names: ColorName }[] = [
  { id: 'black', bg: '#1c1917', names: { vi: 'Đen', en: 'Black', zh: '黑色', ja: '黒', ko: '검정' } },
  { id: 'charcoal', bg: '#44403c', names: { vi: 'Than', en: 'Charcoal', zh: '炭灰', ja: 'チャコール', ko: '차콜' } },
  { id: 'slate', bg: '#334155', names: { vi: 'Xám', en: 'Slate', zh: '灰蓝', ja: 'スレート', ko: '슬레이트' } },
  { id: 'white', bg: '#ffffff', names: { vi: 'Trắng', en: 'White', zh: '白色', ja: '白', ko: '흰색' } },
  { id: 'ivory', bg: '#f7f1e8', names: { vi: 'Ngà', en: 'Ivory', zh: '象牙色', ja: 'アイボリー', ko: '아이보리' } },
  { id: 'cream', bg: '#f3e0b5', names: { vi: 'Vàng kem', en: 'Cream', zh: '奶油金', ja: 'クリーム', ko: '크림' } },
  { id: 'champagne', bg: '#e6d3b3', names: { vi: 'Sâm panh', en: 'Champagne', zh: '香槟', ja: 'シャンパン', ko: '샴페인' } },
  { id: 'bronze', bg: '#8a5727', names: { vi: 'Nâu đồng', en: 'Bronze', zh: '铜棕', ja: 'ブロンズ', ko: '브론즈' } },
  { id: 'chocolate', bg: '#78350f', names: { vi: 'Nâu', en: 'Brown', zh: '棕色', ja: '茶色', ko: '갈색' } },
  { id: 'rust', bg: '#9a3412', names: { vi: 'Gỉ đồng', en: 'Rust', zh: '锈红', ja: '錆色', ko: '녹빛' } },
  { id: 'terracotta', bg: '#c2410c', names: { vi: 'Đất nung', en: 'Terracotta', zh: '赤陶', ja: 'テラコッタ', ko: '테라코타' } },
  { id: 'gold', bg: '#a16207', names: { vi: 'Vàng', en: 'Gold', zh: '金色', ja: 'ゴールド', ko: '골드' } },
  { id: 'burgundy', bg: '#6b2136', names: { vi: 'Đỏ rượu', en: 'Burgundy', zh: '酒红', ja: 'バーガンディ', ko: '버건디' } },
  { id: 'red', bg: '#991b1b', names: { vi: 'Đỏ son', en: 'Vermilion', zh: '朱红', ja: '深紅', ko: '선홍색' } },
  { id: 'wine', bg: '#881337', names: { vi: 'Đỏ mận', en: 'Wine', zh: '酒红', ja: 'ワイン', ko: '와인' } },
  { id: 'rose', bg: '#be123c', names: { vi: 'Hồng đậm', en: 'Rose', zh: '玫红', ja: 'ローズ', ko: '로즈' } },
  { id: 'pink', bg: '#be185d', names: { vi: 'Hồng', en: 'Pink', zh: '粉色', ja: 'ピンク', ko: '핑크' } },
  { id: 'blush', bg: '#f9a8d4', names: { vi: 'Hồng phấn', en: 'Blush', zh: '粉霞', ja: 'ブラッシュ', ko: '블러시' } },
  { id: 'coral', bg: '#e07a5f', names: { vi: 'San hô', en: 'Coral', zh: '珊瑚', ja: 'コーラル', ko: '코랄' } },
  { id: 'peach', bg: '#fb923c', names: { vi: 'Đào', en: 'Peach', zh: '桃色', ja: 'ピーチ', ko: '피치' } },
  { id: 'plum', bg: '#6b21a8', names: { vi: 'Tím mận', en: 'Plum', zh: '梅紫', ja: 'プラム', ko: '자두' } },
  { id: 'magenta', bg: '#a21caf', names: { vi: 'Đỏ tía', en: 'Magenta', zh: '洋红', ja: 'マゼンタ', ko: '마젠타' } },
  { id: 'lilac', bg: '#ddd6fe', names: { vi: 'Tím nhạt', en: 'Lilac', zh: '淡紫', ja: 'ライラック', ko: '라일락' } },
  { id: 'navy', bg: '#1e3a8a', names: { vi: 'Xanh navy', en: 'Navy', zh: '藏青', ja: 'ネイビー', ko: '네이비' } },
  { id: 'royal', bg: '#1d4ed8', names: { vi: 'Xanh hoàng gia', en: 'Royal blue', zh: '宝蓝', ja: 'ロイヤルブルー', ko: '로열 블루' } },
  { id: 'sky', bg: '#0369a1', names: { vi: 'Xanh da trời', en: 'Sky', zh: '天蓝', ja: '空色', ko: '하늘색' } },
  { id: 'forest', bg: '#14532d', names: { vi: 'Xanh rêu', en: 'Forest', zh: '森绿', ja: 'フォレスト', ko: '포레스트' } },
  { id: 'emerald', bg: '#047857', names: { vi: 'Xanh lục', en: 'Emerald', zh: '翠绿', ja: 'エメラルド', ko: '에메랄드' } },
  { id: 'teal', bg: '#0f766e', names: { vi: 'Xanh ngọc', en: 'Teal', zh: '青绿', ja: 'ティール', ko: '틸' } },
  { id: 'olive', bg: '#3f6212', names: { vi: 'Xanh ô liu', en: 'Olive', zh: '橄榄绿', ja: 'オリーブ', ko: '올리브' } },
  { id: 'mint', bg: '#a7f3d0', names: { vi: 'Bạc hà', en: 'Mint', zh: '薄荷', ja: 'ミント', ko: '민트' } },
]

function channel(hex: string, shift: number) {
  const n = Number.parseInt(hex.slice(1), 16)
  const mix = (value: number) => Math.max(0, Math.min(255, Math.round(value * (1 - shift))))
  const r = mix((n >> 16) & 255)
  const g = mix((n >> 8) & 255)
  const b = mix(n & 255)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function isLight(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72
}

function buildColor(swatch: (typeof SWATCHES)[number]): WeddingButtonColor {
  const light = isLight(swatch.bg)
  return {
    id: swatch.id,
    bg: swatch.bg,
    hoverBg: channel(swatch.bg, light ? 0.08 : 0.14),
    text: light ? '#3b2618' : '#ffffff',
    border: light ? channel(swatch.bg, 0.22) : channel(swatch.bg, 0.35),
    swatch: swatch.bg,
  }
}

const COLORS: Record<WeddingButtonColorId, WeddingButtonColor> = Object.fromEntries(
  SWATCHES.map((swatch) => [swatch.id, buildColor(swatch)]),
) as Record<WeddingButtonColorId, WeddingButtonColor>

const NAMES: Record<WeddingButtonColorId, ColorName> = Object.fromEntries(
  SWATCHES.map((swatch) => [swatch.id, swatch.names]),
) as Record<WeddingButtonColorId, ColorName>

const STYLE_FALLBACK: Record<string, WeddingButtonColorId> = {
  luxury: 'bronze',
  vintage: 'bronze',
  traditional_vietnamese: 'red',
  floral: 'pink',
  minimal: 'black',
  modern: 'cream',
}

export function isWeddingButtonColorId(value: unknown): value is WeddingButtonColorId {
  return typeof value === 'string' && (WEDDING_BUTTON_COLOR_IDS as readonly string[]).includes(value)
}

export function resolveWeddingButtonColorId(savedId: unknown, styleId?: string | null): WeddingButtonColorId {
  if (isWeddingButtonColorId(savedId)) return savedId
  return STYLE_FALLBACK[styleId || ''] ?? 'bronze'
}

export function resolveWeddingButtonColor(savedId: unknown, styleId?: string | null): WeddingButtonColor {
  return COLORS[resolveWeddingButtonColorId(savedId, styleId)]
}

/** Màu Có đi. Chưa chọn riêng thì giữ màu nút đang có, để thiệp cũ không đổi cho đến khi tách màu. */
export function resolveCoverRsvpButtonColor(coverRsvpColorId: unknown, buttonColorId: unknown, styleId?: string | null): WeddingButtonColor {
  return resolveWeddingButtonColor(isWeddingButtonColorId(coverRsvpColorId) ? coverRsvpColorId : buttonColorId, styleId)
}

export function listWeddingButtonColors(): WeddingButtonColor[] {
  return WEDDING_BUTTON_COLOR_IDS.map((id) => COLORS[id])
}

export function weddingButtonColorName(id: WeddingButtonColorId, locale: WebLocale): string {
  return NAMES[id][locale] || NAMES[id].vi
}

export function weddingButtonFillStyle(color: WeddingButtonColor) {
  return {
    backgroundColor: color.bg,
    color: color.text,
    borderColor: color.border,
    textShadow: color.text === '#ffffff' ? '0 1px 3px rgba(0,0,0,0.45)' : 'none',
  }
}

export function bindWeddingButtonFill(color: WeddingButtonColor) {
  return {
    style: weddingButtonFillStyle(color),
    onMouseEnter: (event: { currentTarget: HTMLElement }) => {
      event.currentTarget.style.backgroundColor = color.hoverBg
    },
    onMouseLeave: (event: { currentTarget: HTMLElement }) => {
      event.currentTarget.style.backgroundColor = color.bg
    },
  }
}

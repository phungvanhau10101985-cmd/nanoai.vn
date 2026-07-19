import type { WebLocale } from '@/lib/i18n/config'

export type PackagingDiscoveryChoice = {
  key: string
  labels: Record<WebLocale, string>
  brief: Record<WebLocale, string>
}

export const PACKAGING_STYLE_MOOD_CHOICES: PackagingDiscoveryChoice[] = [
  {
    key: 'organic',
    labels: {
      vi: 'Organic / tự nhiên',
      en: 'Organic / natural',
      zh: '有机 / 自然',
      ja: 'オーガニック / ナチュラル',
      ko: '오가닉 / 자연',
    },
    brief: {
      vi: 'Phong cách organic, tự nhiên, mềm mại',
      en: 'Organic, natural, soft style',
      zh: '有机自然、柔和风格',
      ja: 'オーガニックで自然な柔らかいスタイル',
      ko: '오가닉하고 자연스러운 부드러운 스타일',
    },
  },
  {
    key: 'luxury',
    labels: {
      vi: 'Luxury / sang trọng',
      en: 'Luxury / premium',
      zh: '奢华 / 高端',
      ja: 'ラグジュアリー / 高級',
      ko: '럭셔리 / 고급',
    },
    brief: {
      vi: 'Phong cách luxury, sang trọng, cao cấp',
      en: 'Luxury, premium, high-end style',
      zh: '奢华高端风格',
      ja: '高級感のあるラグジュアリースタイル',
      ko: '고급스러운 럭셔리 스타일',
    },
  },
  {
    key: 'minimal',
    labels: {
      vi: 'Minimal / tối giản',
      en: 'Minimal / clean',
      zh: '极简 / 干净',
      ja: 'ミニマル / シンプル',
      ko: '미니멀 / 깔끔',
    },
    brief: {
      vi: 'Phong cách minimal, tối giản, sạch',
      en: 'Minimal, clean, simple style',
      zh: '极简干净风格',
      ja: 'ミニマルでクリーンなスタイル',
      ko: '미니멀하고 깔끔한 스타일',
    },
  },
  {
    key: 'playful',
    labels: {
      vi: 'Playful / trẻ trung',
      en: 'Playful / youthful',
      zh: '活泼 / 年轻',
      ja: 'ポップ / 若々しい',
      ko: '경쾌 / 젊은',
    },
    brief: {
      vi: 'Phong cách playful, trẻ trung, năng động',
      en: 'Playful, youthful, energetic style',
      zh: '活泼年轻、有活力',
      ja: 'ポップで若々しくエネルギッシュなスタイル',
      ko: '경쾌하고 젊은 에너지 넘치는 스타일',
    },
  },
]

export type PackagingPrintColor = {
  key: string
  hex: string
  labels: Record<WebLocale, string>
  brief: Record<WebLocale, string>
}

/** Individual print colors — user toggles multiple, then confirms. */
export const PACKAGING_PRINT_COLORS: PackagingPrintColor[] = [
  {
    key: 'white',
    hex: '#FFFFFF',
    labels: { vi: 'Trắng', en: 'White', zh: '白', ja: '白', ko: '화이트' },
    brief: { vi: 'trắng', en: 'white', zh: '白色', ja: '白', ko: '화이트' },
  },
  {
    key: 'black',
    hex: '#1A1A1A',
    labels: { vi: 'Đen', en: 'Black', zh: '黑', ja: '黒', ko: '블랙' },
    brief: { vi: 'đen', en: 'black', zh: '黑色', ja: '黒', ko: '블랙' },
  },
  {
    key: 'gold',
    hex: '#C9A227',
    labels: { vi: 'Vàng gold', en: 'Gold', zh: '金', ja: 'ゴールド', ko: '골드' },
    brief: { vi: 'vàng gold', en: 'gold', zh: '金色', ja: 'ゴールド', ko: '골드' },
  },
  {
    key: 'pastel_pink',
    hex: '#F4C2C2',
    labels: { vi: 'Hồng pastel', en: 'Pastel pink', zh: '粉 pastel', ja: 'パステルピンク', ko: '파스텔 핑크' },
    brief: { vi: 'hồng pastel', en: 'pastel pink', zh: '粉 pastel', ja: 'パステルピンク', ko: '파스텔 핑크' },
  },
  {
    key: 'blue',
    hex: '#2563EB',
    labels: { vi: 'Xanh dương', en: 'Blue', zh: '蓝', ja: 'ブルー', ko: '블루' },
    brief: { vi: 'xanh dương', en: 'blue', zh: '蓝色', ja: 'ブルー', ko: '블루' },
  },
  {
    key: 'green',
    hex: '#22C55E',
    labels: { vi: 'Xanh lá', en: 'Green', zh: '绿', ja: 'グリーン', ko: '그린' },
    brief: { vi: 'xanh lá', en: 'green', zh: '绿色', ja: 'グリーン', ko: '그린' },
  },
  {
    key: 'cream',
    hex: '#FFF8E7',
    labels: { vi: 'Kem', en: 'Cream', zh: '奶油色', ja: 'クリーム', ko: '크림' },
    brief: { vi: 'kem', en: 'cream', zh: '奶油色', ja: 'クリーム', ko: '크림' },
  },
  {
    key: 'earth_brown',
    hex: '#8B6914',
    labels: { vi: 'Nâu đất', en: 'Earth brown', zh: '土棕', ja: 'アースブラウン', ko: '어스 브라운' },
    brief: { vi: 'nâu đất', en: 'earth brown', zh: '土棕色', ja: 'アースブラウン', ko: '어스 브라운' },
  },
  {
    key: 'kraft',
    hex: '#C4A574',
    labels: { vi: 'Carton / kraft', en: 'Kraft / carton', zh: '牛皮纸', ja: 'クラフト', ko: '크래프트' },
    brief: { vi: 'carton kraft', en: 'kraft carton', zh: '牛皮纸', ja: 'クラフト', ko: '크래프트' },
  },
  {
    key: 'gray',
    hex: '#9CA3AF',
    labels: { vi: 'Xám', en: 'Gray', zh: '灰', ja: 'グレー', ko: '그레이' },
    brief: { vi: 'xám', en: 'gray', zh: '灰色', ja: 'グレー', ko: '그레이' },
  },
  {
    key: 'red',
    hex: '#DC2626',
    labels: { vi: 'Đỏ', en: 'Red', zh: '红', ja: 'レッド', ko: '레드' },
    brief: { vi: 'đỏ', en: 'red', zh: '红色', ja: 'レッド', ko: '레드' },
  },
  {
    key: 'orange',
    hex: '#EA580C',
    labels: { vi: 'Cam', en: 'Orange', zh: '橙', ja: 'オレンジ', ko: '오렌지' },
    brief: { vi: 'cam', en: 'orange', zh: '橙色', ja: 'オレンジ', ko: '오렌지' },
  },
  {
    key: 'purple',
    hex: '#9333EA',
    labels: { vi: 'Tím', en: 'Purple', zh: '紫', ja: 'パープル', ko: '퍼플' },
    brief: { vi: 'tím', en: 'purple', zh: '紫色', ja: 'パープル', ko: '퍼플' },
  },
  {
    key: 'yellow',
    hex: '#FACC15',
    labels: { vi: 'Vàng', en: 'Yellow', zh: '黄', ja: 'イエロー', ko: '옐로우' },
    brief: { vi: 'vàng', en: 'yellow', zh: '黄色', ja: 'イエロー', ko: '옐로우' },
  },
]

export const PACKAGING_COLOR_PALETTE_CHOICES: PackagingDiscoveryChoice[] = [
  {
    key: 'pastel_pink_white',
    labels: {
      vi: 'Hồng pastel + trắng',
      en: 'Pastel pink + white',
      zh: '粉 pastel + 白',
      ja: 'パステルピンク + 白',
      ko: '파스텔 핑크 + 화이트',
    },
    brief: {
      vi: 'Hồng pastel và trắng',
      en: 'Pastel pink and white',
      zh: '粉 pastel 与白色',
      ja: 'パステルピンクと白',
      ko: '파스텔 핑크와 화이트',
    },
  },
  {
    key: 'black_gold',
    labels: {
      vi: 'Đen + vàng gold',
      en: 'Black + gold',
      zh: '黑 + 金',
      ja: '黒 + ゴールド',
      ko: '블랙 + 골드',
    },
    brief: {
      vi: 'Đen và vàng gold',
      en: 'Black and gold',
      zh: '黑色与金色',
      ja: '黒とゴールド',
      ko: '블랙과 골드',
    },
  },
  {
    key: 'earth_tones',
    labels: {
      vi: 'Tông đất / carton',
      en: 'Earth tones / kraft',
      zh: '大地色 / 牛皮纸',
      ja: 'アースカラー / クラフト',
      ko: '어스 톤 / 크래프트',
    },
    brief: {
      vi: 'Tông màu đất, carton, nâu be',
      en: 'Earth tones, kraft, beige brown',
      zh: '大地色、牛皮纸、米棕',
      ja: 'アースカラー、クラフト、ベージュブラウン',
      ko: '어스 톤, 크래프트, 베이지 브라운',
    },
  },
  {
    key: 'blue_white',
    labels: {
      vi: 'Xanh dương + trắng',
      en: 'Blue + white',
      zh: '蓝 + 白',
      ja: 'ブルー + 白',
      ko: '블루 + 화이트',
    },
    brief: {
      vi: 'Xanh dương và trắng',
      en: 'Blue and white',
      zh: '蓝色与白色',
      ja: 'ブルーと白',
      ko: '블루와 화이트',
    },
  },
  {
    key: 'green_natural',
    labels: {
      vi: 'Xanh lá + kem',
      en: 'Green + cream',
      zh: '绿 + 奶油色',
      ja: 'グリーン + クリーム',
      ko: '그린 + 크림',
    },
    brief: {
      vi: 'Xanh lá tự nhiên và kem',
      en: 'Natural green and cream',
      zh: '自然绿与奶油色',
      ja: 'ナチュラルグリーンとクリーム',
      ko: '자연 그린과 크림',
    },
  },
]

export function packagingDiscoveryChoiceLabel(
  choice: PackagingDiscoveryChoice,
  locale: WebLocale
): string {
  return choice.labels[locale] ?? choice.labels.en
}

export function packagingDiscoveryChoiceBrief(
  choice: PackagingDiscoveryChoice,
  locale: WebLocale
): string {
  return choice.brief[locale] ?? choice.brief.en
}

export function findPackagingStyleMoodChoice(key: string): PackagingDiscoveryChoice | undefined {
  return PACKAGING_STYLE_MOOD_CHOICES.find((c) => c.key === key)
}

export function findPackagingColorPaletteChoice(key: string): PackagingDiscoveryChoice | undefined {
  return PACKAGING_COLOR_PALETTE_CHOICES.find((c) => c.key === key)
}

export function findPackagingPrintColor(key: string): PackagingPrintColor | undefined {
  return PACKAGING_PRINT_COLORS.find((c) => c.key === key)
}

export function packagingPrintColorLabel(color: PackagingPrintColor, locale: WebLocale): string {
  return color.labels[locale] ?? color.labels.en
}

export function packagingPrintColorBrief(color: PackagingPrintColor, locale: WebLocale): string {
  return color.brief[locale] ?? color.brief.en
}

export function resolvePackagingPrintColors(keys: string[]): PackagingPrintColor[] {
  const seen = new Set<string>()
  const out: PackagingPrintColor[] = []
  for (const key of keys) {
    const trimmed = key.trim()
    if (!trimmed || seen.has(trimmed)) continue
    const color = findPackagingPrintColor(trimmed)
    if (!color) continue
    seen.add(trimmed)
    out.push(color)
  }
  return out
}

export type PackagingDiscoveryInputKind =
  | 'chat'
  | 'print_language_picker'
  | 'box_dimensions'
  | 'box_face_confirm'
  | 'style_mood_picker'
  | 'color_palette_picker'
  | 'face_print_style_picker'

const BOX_SIZE_STEP_KEYS = new Set([
  'box_size',
  'box_size_length',
  'box_size_width',
  'box_size_height',
])

/** Which bottom input to show for packaging_kit discovery steps. */
export function getPackagingDiscoveryInputKind(
  stepKey: string | null | undefined,
  options?: { reenteringBoxSize?: boolean }
): PackagingDiscoveryInputKind {
  if (!stepKey) return 'chat'
  if (stepKey === 'product_type') return 'print_language_picker'
  if (options?.reenteringBoxSize && stepKey === 'box_face_confirm') return 'box_dimensions'
  if (BOX_SIZE_STEP_KEYS.has(stepKey)) return 'box_dimensions'
  if (stepKey === 'box_face_confirm') return 'box_face_confirm'
  if (stepKey === 'style_mood') return 'style_mood_picker'
  if (stepKey === 'color_palette') return 'color_palette_picker'
  if (stepKey === 'face_print_style') return 'face_print_style_picker'
  return 'chat'
}

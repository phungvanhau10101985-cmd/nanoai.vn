import type { WebLocale } from '@/lib/i18n/config'
import type { WeddingCoverFrameAsset } from '@/lib/wedding/wedding-cover-frame-assets'

export type WeddingCoverPresetTag = 'new' | 'hot'
export type WeddingCoverLayout = 'glass' | 'red_arch' | 'frame' | 'composed'

export type WeddingCoverPreset = {
  id: string
  layout: WeddingCoverLayout
  /** Phong cách AI khi khách chọn vỏ này. */
  styleId: string
  /** Ảnh chia sẻ. Thiếu thì dùng styleId. */
  shareStyleId?: string
  tags?: WeddingCoverPresetTag[]
  ornament: string
  thumbnail: {
    topBg: string
    bottomBg: string
    accent: string
    textClass: string
  }
  label: Record<WebLocale, string>
  /** Khung WebP trong suốt. Lỗ giữa là chỗ ảnh. */
  frame?: WeddingCoverFrameAsset
  /** Bố cục ghép khung + hoa văn. Khớp getOrnamentComposition. */
  compositionId?: string
}

export const WEDDING_COVER_PRESETS: WeddingCoverPreset[] = [
  {
    id: 'dragon_phoenix',
    layout: 'glass',
    styleId: 'traditional_vietnamese',
    shareStyleId: 'luxury',
    tags: ['hot'],
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(135deg, #f3b8c8 0%, #f8e8dc 100%)',
      bottomBg: '#fff8f3',
      accent: '#c0392b',
      textClass: 'text-rose-900/80',
    },
    label: {
      vi: 'Kính mờ cổ điển',
      en: 'Classic glass',
      zh: '经典玻璃',
      ja: 'クラシックガラス',
      ko: '클래식 글래스',
    },
  },
  {
    id: 'dried_meadow',
    layout: 'composed',
    compositionId: 'dried_meadow',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#f6f0e4',
      bottomBg: '#f6f0e4',
      accent: '#6d5844',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Hoa khô bướm',
      en: 'Dried butterflies',
      zh: '干花蝴蝶',
      ja: 'ドライフラワーと蝶',
      ko: '드라이플라워 나비',
    },
  },
  {
    id: 'blush_meadow',
    layout: 'composed',
    compositionId: 'blush_meadow',
    styleId: 'floral',
    ornament: '❀',
    thumbnail: {
      topBg: '#fff7f5',
      bottomBg: '#fff7f5',
      accent: '#9a5364',
      textClass: 'text-rose-900',
    },
    label: {
      vi: 'Đồng hoa hồng',
      en: 'Blush meadow',
      zh: '粉花原野',
      ja: 'ブラッシュの野原',
      ko: '블러시 들판',
    },
  },
  {
    id: 'blush_corners',
    layout: 'composed',
    compositionId: 'blush_corners',
    styleId: 'floral',
    ornament: '❀',
    thumbnail: {
      topBg: '#fff7f5',
      bottomBg: '#fff7f5',
      accent: '#d9899c',
      textClass: 'text-rose-900',
    },
    label: {
      vi: 'Bốn góc mẫu đơn',
      en: 'Peony corners',
      zh: '四角牡丹',
      ja: '四隅の牡丹',
      ko: '모서리 모란',
    },
  },
  {
    id: 'sage_sides',
    layout: 'composed',
    compositionId: 'sage_sides',
    styleId: 'minimal',
    ornament: '—',
    thumbnail: {
      topBg: '#f3f6f1',
      bottomBg: '#f3f6f1',
      accent: '#3e5a44',
      textClass: 'text-emerald-950',
    },
    label: {
      vi: 'Lá hai bên',
      en: 'Side leaves',
      zh: '两侧叶片',
      ja: '両脇の葉',
      ko: '양쪽 잎',
    },
  },
  {
    id: 'dried_seal',
    layout: 'composed',
    compositionId: 'dried_seal',
    styleId: 'vintage',
    ornament: '❦',
    thumbnail: {
      topBg: '#f6f0e4',
      bottomBg: '#f6f0e4',
      accent: '#6d5844',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Dấu sáp hoa khô',
      en: 'Dried wax seal',
      zh: '干花火漆',
      ja: 'ドライフラワーの封蝋',
      ko: '드라이 실링',
    },
  },
  {
    id: 'blush_wreath',
    layout: 'composed',
    compositionId: 'blush_wreath',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fff7f5',
      bottomBg: '#fff7f5',
      accent: '#9a5364',
      textClass: 'text-rose-900',
    },
    label: {
      vi: 'Vòng hoa',
      en: 'Floral wreath',
      zh: '花环',
      ja: '花のリース',
      ko: '꽃 화환',
    },
  },
  {
    id: 'ceremonial_arch',
    layout: 'composed',
    compositionId: 'ceremonial_arch',
    styleId: 'traditional_vietnamese',
    ornament: '囍',
    thumbnail: {
      topBg: '#fff6ea',
      bottomBg: '#fff6ea',
      accent: '#c45348',
      textClass: 'text-red-950',
    },
    label: {
      vi: 'Vòm sen',
      en: 'Lotus arch',
      zh: '莲花拱门',
      ja: '蓮のアーチ',
      ko: '연꽃 아치',
    },
  },
  {
    id: 'sage_corners',
    layout: 'composed',
    compositionId: 'sage_corners',
    styleId: 'minimal',
    ornament: '—',
    thumbnail: {
      topBg: '#f3f6f1',
      bottomBg: '#f3f6f1',
      accent: '#3e5a44',
      textClass: 'text-emerald-950',
    },
    label: {
      vi: 'Góc vườn',
      en: 'Garden corners',
      zh: '园角',
      ja: '庭の四隅',
      ko: '정원 모서리',
    },
  },
  {
    id: 'moc_portrait',
    layout: 'composed',
    compositionId: 'moc_portrait',
    styleId: 'minimal',
    ornament: '—',
    thumbnail: {
      topBg: '#fbf8f3',
      bottomBg: '#fbf8f3',
      accent: '#1f3d2b',
      textClass: 'text-emerald-950',
    },
    label: {
      vi: 'Khung mộc',
      en: 'Wood-flower frame',
      zh: '木花相框',
      ja: '木の花の額',
      ko: '나무꽃 액자',
    },
  },
  {
    id: 'to_duyen_xanh',
    layout: 'frame',
    styleId: 'minimal',
    frame: {
      src: '/wedding/covers/to-duyen-xanh-frame.webp',
      hole: { x: 16.31, y: 13.15, w: 68.36, h: 73.31 },
      panel: '#f7f6f2',
      ink: 'dark',
    },
    ornament: '—',
    thumbnail: {
      topBg: '#f4f8f0',
      bottomBg: '#fffcf8',
      accent: '#5c6b40',
      textClass: 'text-emerald-950',
    },
    label: {
      vi: 'Tơ duyên xanh',
      en: 'Sage calla',
      zh: '青瓷马蹄莲',
      ja: '青磁のカラー',
      ko: '세이지 칼라',
    },
  },
  {
    id: 'do_dam',
    layout: 'frame',
    styleId: 'minimal',
    tags: ['new'],
    frame: {
      src: '/wedding/covers/do-dam-frame.webp',
      hole: { x: 12.11, y: 28.58, w: 75.78, h: 55.08 },
      panel: '#f7f1ea',
      ink: 'dark',
    },
    ornament: '❀',
    thumbnail: {
      topBg: '#f7f1ea',
      bottomBg: '#f7f1ea',
      accent: '#5c1a28',
      textClass: 'text-[#4a1e2c]',
    },
    label: {
      vi: 'Khung viền mỏng',
      en: 'Thin floral frame',
      zh: '细线花框',
      ja: '細い花枠',
      ko: '얇은 꽃 프레임',
    },
  },
  {
    id: 'red_photo_arch',
    layout: 'red_arch',
    styleId: 'traditional_vietnamese',
    tags: ['new'],
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(180deg, #8b1e1e 0%, #a83232 100%)',
      bottomBg: '#fff8f0',
      accent: '#f6c453',
      textClass: 'text-white',
    },
    label: {
      vi: 'Đỏ ảnh cặp đôi',
      en: 'Red couple photo',
      zh: '红色情侣照',
      ja: '赤・カップル写真',
      ko: '레드 커플 사진',
    },
  },
  {
    id: 'linen_polaroid',
    layout: 'composed',
    compositionId: 'linen_polaroid',
    styleId: 'ethereal',
    tags: ['new'],
    ornament: '&',
    thumbnail: {
      topBg: '#f7f2ea',
      bottomBg: '#f7f2ea',
      accent: '#8d7355',
      textClass: 'text-stone-700',
    },
    label: {
      vi: 'Polaroid dấu sáp',
      en: 'Wax polaroid',
      zh: '火漆拍立得',
      ja: '封蝋のポラロイド',
      ko: '실링 폴라로이드',
    },
  },
  {
    id: 'pearl_rose',
    layout: 'frame',
    styleId: 'floral',
    frame: {
      src: '/wedding/covers/pearl-rose-frame.webp',
      hole: { x: 18.75, y: 14.36, w: 66.89, h: 65.82 },
      panel: '#f7f4f2',
      ink: 'dark',
    },
    ornament: '❀',
    thumbnail: {
      topBg: 'linear-gradient(160deg, #f8d5df 0%, #fff8f6 100%)',
      bottomBg: '#fff8f6',
      accent: '#c45c7a',
      textClass: 'text-rose-800',
    },
    label: {
      vi: 'Khung hồng ngọc trai',
      en: 'Pearl rose frame',
      zh: '珍珠玫瑰框',
      ja: 'パールローズの枠',
      ko: '펄 로즈 프레임',
    },
  },
]

export const DEFAULT_WEDDING_COVER_PRESET_ID = WEDDING_COVER_PRESETS[0]?.id ?? 'dragon_phoenix'

export function findWeddingCoverPreset(id: string | null | undefined): WeddingCoverPreset | undefined {
  const key = String(id || '').trim()
  if (!key) return undefined
  return WEDDING_COVER_PRESETS.find((preset) => preset.id === key)
}

export function getWeddingCoverPreset(id: string | null | undefined): WeddingCoverPreset {
  return findWeddingCoverPreset(id) ?? WEDDING_COVER_PRESETS[0]
}

export function labelForWeddingCoverPreset(locale: WebLocale, preset: WeddingCoverPreset): string {
  return preset.label[locale] ?? preset.label.vi
}

/** Khung đi theo nền: ảnh khung, hoặc bố cục ghép như polaroid. */
export function weddingCoverPresetFollowsBackground(preset: WeddingCoverPreset | undefined): boolean {
  if (!preset) return false
  return Boolean(preset.frame) || preset.layout === 'composed'
}

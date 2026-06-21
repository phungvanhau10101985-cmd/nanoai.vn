import type { WebLocale } from '@/lib/i18n/config'

export type WeddingCoverPresetTag = 'new' | 'hot'
export type WeddingCoverLayout = 'glass' | 'red_arch'

export type WeddingCoverPreset = {
  id: string
  layout: WeddingCoverLayout
  tags?: WeddingCoverPresetTag[]
  ornament: string
  thumbnail: {
    topBg: string
    bottomBg: string
    accent: string
    textClass: string
  }
  label: Record<WebLocale, string>
}

export const WEDDING_COVER_PRESETS: WeddingCoverPreset[] = [
  {
    id: 'dragon_phoenix',
    layout: 'glass',
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
    id: 'red_photo_arch',
    layout: 'red_arch',
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
    id: 'classic_red',
    layout: 'glass',
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(145deg, #991b1b 0%, #dc2626 100%)',
      bottomBg: '#fff7ed',
      accent: '#fbbf24',
      textClass: 'text-white',
    },
    label: {
      vi: 'Đỏ truyền thống',
      en: 'Classic red',
      zh: '经典红色',
      ja: 'クラシック赤',
      ko: '클래식 레드',
    },
  },
  {
    id: 'blush_floral',
    layout: 'glass',
    ornament: '❀',
    thumbnail: {
      topBg: 'linear-gradient(160deg, #fecdd3 0%, #fff1f2 100%)',
      bottomBg: '#ffffff',
      accent: '#e11d48',
      textClass: 'text-rose-800',
    },
    label: {
      vi: 'Hoa hồng pastel',
      en: 'Blush floral',
      zh: '粉花浪漫',
      ja: 'ブラッシュフラワー',
      ko: '블러시 플로럴',
    },
  },
  {
    id: 'sage_garden',
    layout: 'glass',
    ornament: '—',
    thumbnail: {
      topBg: 'linear-gradient(160deg, #a7f3d0 0%, #ecfdf5 100%)',
      bottomBg: '#ffffff',
      accent: '#047857',
      textClass: 'text-emerald-900',
    },
    label: {
      vi: 'Xanh lá tối giản',
      en: 'Sage minimal',
      zh: '鼠尾草绿',
      ja: 'セージミニマル',
      ko: '세이지 미니멀',
    },
  },
  {
    id: 'gold_luxury',
    layout: 'glass',
    ornament: '✦',
    thumbnail: {
      topBg: 'linear-gradient(145deg, #fde68a 0%, #fff7ed 100%)',
      bottomBg: '#fffaf2',
      accent: '#92400e',
      textClass: 'text-amber-900',
    },
    label: {
      vi: 'Vàng sang trọng',
      en: 'Luxury gold',
      zh: '奢华金色',
      ja: 'ラグジュアリーゴールド',
      ko: '럭셔리 골드',
    },
  },
  {
    id: 'night_modern',
    layout: 'glass',
    ornament: '◇',
    thumbnail: {
      topBg: 'linear-gradient(160deg, #0f172a 0%, #475569 100%)',
      bottomBg: '#1e293b',
      accent: '#fcd34d',
      textClass: 'text-white',
    },
    label: {
      vi: 'Hiện đại tối',
      en: 'Modern dark',
      zh: '现代深色',
      ja: 'モダンダーク',
      ko: '모던 다크',
    },
  },
  {
    id: 'lotus_viet',
    layout: 'glass',
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(160deg, #fb7185 0%, #fff7ed 100%)',
      bottomBg: '#fff4de',
      accent: '#b91c1c',
      textClass: 'text-red-900',
    },
    label: {
      vi: 'Sen vàng Việt',
      en: 'Vietnamese lotus',
      zh: '越南莲花',
      ja: 'ベトナム蓮',
      ko: '베트남 연꽃',
    },
  },
]

export const DEFAULT_WEDDING_COVER_PRESET_ID = WEDDING_COVER_PRESETS[0]?.id ?? 'dragon_phoenix'

export function getWeddingCoverPreset(id: string | null | undefined): WeddingCoverPreset {
  return WEDDING_COVER_PRESETS.find((preset) => preset.id === id) ?? WEDDING_COVER_PRESETS[0]
}

export function labelForWeddingCoverPreset(locale: WebLocale, preset: WeddingCoverPreset): string {
  return preset.label[locale] ?? preset.label.vi
}

import type { WebLocale } from '@/lib/i18n/config'
import { WEDDING_COVER_FRAME_ASSETS, type WeddingCoverFrameAsset } from '@/lib/wedding/wedding-cover-frame-assets'

export type WeddingCoverPresetTag = 'new' | 'hot'
export type WeddingCoverLayout = 'glass' | 'red_arch' | 'frame'

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
    id: 'envelope_wax',
    layout: 'frame',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '❦',
    frame: WEDDING_COVER_FRAME_ASSETS.envelope_wax,
    thumbnail: {
      topBg: 'linear-gradient(180deg, #e7d7bc 0%, #f3ead7 100%)',
      bottomBg: '#f3ead7',
      accent: '#9f1239',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Phong bì dấu sáp',
      en: 'Wax-seal envelope',
      zh: '火漆信封',
      ja: '封蝋の封筒',
      ko: '실링 왁스 봉투',
    },
  },
  {
    id: 'polaroid',
    layout: 'frame',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '▢',
    frame: WEDDING_COVER_FRAME_ASSETS.polaroid,
    thumbnail: {
      topBg: '#ffffff',
      bottomBg: '#fafaf9',
      accent: '#44403c',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Ảnh polaroid',
      en: 'Polaroid',
      zh: '拍立得',
      ja: 'ポラロイド',
      ko: '폴라로이드',
    },
  },
  {
    id: 'phoenix_pair',
    layout: 'frame',
    styleId: 'traditional_vietnamese',
    tags: ['new'],
    ornament: '囍',
    frame: WEDDING_COVER_FRAME_ASSETS.phoenix_pair,
    thumbnail: {
      topBg: 'linear-gradient(180deg, #fff7f4 0%, #fecdd3 100%)',
      bottomBg: '#fff7f4',
      accent: '#9f1239',
      textClass: 'text-red-900',
    },
    label: {
      vi: 'Đôi phượng',
      en: 'Phoenix pair',
      zh: '双凤',
      ja: '双鳳',
      ko: '쌍봉',
    },
  },
  {
    id: 'calla',
    layout: 'frame',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    frame: WEDDING_COVER_FRAME_ASSETS.calla,
    thumbnail: {
      topBg: '#f7f7f5',
      bottomBg: '#ffffff',
      accent: '#65a30d',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Hoa loa kèn',
      en: 'Calla lily',
      zh: '马蹄莲',
      ja: 'カラー',
      ko: '카라 백합',
    },
  },
  {
    id: 'dried_flowers',
    layout: 'frame',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '—',
    frame: WEDDING_COVER_FRAME_ASSETS.dried_flowers,
    thumbnail: {
      topBg: 'linear-gradient(160deg, #f6efe6 0%, #e7d7bc 100%)',
      bottomBg: '#f6efe6',
      accent: '#92400e',
      textClass: 'text-stone-800',
    },
    label: {
      vi: 'Hoa khô',
      en: 'Dried flowers',
      zh: '干花',
      ja: 'ドライフラワー',
      ko: '드라이플라워',
    },
  },
  {
    id: 'crest_seal',
    layout: 'frame',
    styleId: 'luxury',
    tags: ['new'],
    ornament: '✦',
    frame: WEDDING_COVER_FRAME_ASSETS.crest_seal,
    thumbnail: {
      topBg: 'linear-gradient(160deg, #fffaf3 0%, #fde68a 100%)',
      bottomBg: '#fffaf3',
      accent: '#a16207',
      textClass: 'text-amber-950',
    },
    label: {
      vi: 'Huy hiệu',
      en: 'Crest seal',
      zh: '纹章',
      ja: 'クレスト',
      ko: '크레스트',
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
    id: 'classic_red',
    layout: 'frame',
    styleId: 'traditional_vietnamese',
    frame: WEDDING_COVER_FRAME_ASSETS.classic_red,
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
    layout: 'frame',
    styleId: 'floral',
    frame: WEDDING_COVER_FRAME_ASSETS.blush_floral,
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
    layout: 'frame',
    styleId: 'minimal',
    frame: WEDDING_COVER_FRAME_ASSETS.sage_garden,
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
    layout: 'frame',
    styleId: 'luxury',
    frame: WEDDING_COVER_FRAME_ASSETS.gold_luxury,
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
    layout: 'frame',
    styleId: 'modern',
    frame: WEDDING_COVER_FRAME_ASSETS.night_modern,
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
    layout: 'frame',
    styleId: 'traditional_vietnamese',
    frame: WEDDING_COVER_FRAME_ASSETS.lotus_viet,
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

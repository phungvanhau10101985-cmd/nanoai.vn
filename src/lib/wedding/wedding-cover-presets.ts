import type { WebLocale } from '@/lib/i18n/config'
import type { WeddingCoverFrameAsset } from '@/lib/wedding/wedding-cover-frame-assets'

export type WeddingCoverPresetTag = 'new' | 'hot'
export type WeddingCoverLayout = 'glass' | 'red_arch' | 'frame' | 'composed' | 'plain' | 'song_hy' | 'envelope' | 'pair'

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
  /** Hai ảnh trên đầu vỏ. `thin` là khung mảnh, `none` là không khung. */
  pairFrame?: 'thin' | 'none'
  /** Cách xếp hai ảnh. Thiếu thì đặt cạnh nhau. */
  pairArrange?: 'offset' | 'tilt' | 'locket' | 'print'
  /** Đầu khung ảnh trên vỏ song hỷ. Thiếu là vòm. */
  photoHead?: WeddingCoverPhotoHead
  /** Màu cổng vòm. Thiếu là đỏ song hỷ. */
  gateTone?: WeddingGateToneId
}

/** Vòm cửa, rẻ quạt, lá bầu dục nằm ngang, trăng tròn hoặc ngôi sao năm cánh. */
export type WeddingCoverPhotoHead = 'arch' | 'fan' | 'leaf' | 'moon' | 'star'

export type WeddingGateToneId = 'lacquer' | 'lotus' | 'pearl' | 'night' | 'sea'

export type WeddingGateTone = {
  card: string
  ink: string
  accent: string
  muted: string
  watermark: string
  watermarkSoft: string
  frame: string
  glow: string
  sealGlow: string
  mark: string
  pin: string
  emptyFill: string
  photoShadow: string
  archShadow: string
}

/** Cổng vòm: đỏ son, sen vàng, ngọc trai, đêm và biển. */
export const WEDDING_GATE_TONES: Record<WeddingGateToneId, WeddingGateTone> = {
  lacquer: {
    card: '#9b1c24',
    ink: '#f6e2b0',
    accent: '#f3d27a',
    muted: '#e4d0a0',
    watermark: 'rgba(122,18,24,0.55)',
    watermarkSoft: 'rgba(122,18,24,0.4)',
    frame: '#fff6ea',
    glow: '0 0 48px rgba(180,36,44,0.42), 0 22px 50px rgba(0,0,0,0.38), 0 0 0 1px rgba(243,210,122,0.35)',
    sealGlow: '0 0 18px rgba(243,210,122,0.35)',
    mark: '囍',
    pin: '#9b1c24',
    emptyFill: 'rgba(122,18,24,0.35)',
    photoShadow: '0 12px 28px rgba(20,0,6,0.38)',
    archShadow: '0 16px 36px rgba(40,0,10,0.28)',
  },
  lotus: {
    card: 'linear-gradient(180deg, #fff8ee 0%, #f6e7c4 100%)',
    ink: '#3b2618',
    accent: '#8a5a12',
    muted: '#6b5340',
    watermark: 'rgba(196,161,90,0.45)',
    watermarkSoft: 'rgba(196,161,90,0.28)',
    frame: '#fffaf3',
    glow: '0 18px 40px rgba(90,60,20,0.16), 0 0 0 1px rgba(196,161,90,0.45)',
    sealGlow: '0 0 16px rgba(196,161,90,0.35)',
    mark: '❀',
    pin: '#8a5a12',
    emptyFill: 'rgba(255,248,230,0.72)',
    photoShadow: '0 12px 28px rgba(90,60,20,0.22)',
    archShadow: '0 16px 36px rgba(90,60,20,0.2)',
  },
  pearl: {
    card: 'linear-gradient(180deg, #fff7f8 0%, #f8d5df 100%)',
    ink: '#4a2c38',
    accent: '#b05a78',
    muted: '#7a4e5c',
    watermark: 'rgba(196,92,122,0.28)',
    watermarkSoft: 'rgba(196,92,122,0.18)',
    frame: '#fffaf8',
    glow: '0 18px 40px rgba(141,69,96,0.16), 0 0 0 1px rgba(196,92,122,0.35)',
    sealGlow: '0 0 16px rgba(196,92,122,0.28)',
    mark: '❀',
    pin: '#b05a78',
    emptyFill: 'rgba(255,248,250,0.72)',
    photoShadow: '0 12px 28px rgba(120,50,70,0.2)',
    archShadow: '0 16px 36px rgba(120,50,70,0.18)',
  },
  night: {
    card: 'linear-gradient(180deg, #1a2d52 0%, #0c1830 100%)',
    ink: '#f3e6c8',
    accent: '#e6d3b3',
    muted: '#d9c7a2',
    watermark: 'rgba(230,211,179,0.16)',
    watermarkSoft: 'rgba(230,211,179,0.1)',
    frame: '#e6d3b3',
    glow: '0 0 42px rgba(230,211,179,0.22), 0 22px 48px rgba(0,0,0,0.45), 0 0 0 1px rgba(230,211,179,0.4)',
    sealGlow: '0 0 18px rgba(230,211,179,0.35)',
    mark: '✦',
    pin: '#0c1830',
    emptyFill: 'rgba(12,24,48,0.45)',
    photoShadow: '0 12px 28px rgba(0,0,0,0.45)',
    archShadow: '0 16px 36px rgba(0,0,0,0.4)',
  },
  sea: {
    card: 'linear-gradient(180deg, #f7fbfa 0%, #d5ebe6 100%)',
    ink: '#1a3c48',
    accent: '#0f766e',
    muted: '#4d6a74',
    watermark: 'rgba(15,118,110,0.22)',
    watermarkSoft: 'rgba(15,118,110,0.14)',
    frame: '#f7f1e6',
    glow: '0 18px 40px rgba(26,60,72,0.16), 0 0 0 1px rgba(15,118,110,0.28)',
    sealGlow: '0 0 16px rgba(15,118,110,0.22)',
    mark: '◇',
    pin: '#0f766e',
    emptyFill: 'rgba(247,251,250,0.72)',
    photoShadow: '0 12px 28px rgba(26,60,72,0.2)',
    archShadow: '0 16px 36px rgba(26,60,72,0.18)',
  },
}

/** Nan rẻ quạt, chốt dưới giữa. Cùng số điểm để xòe từ khép sang mở. */
const WEDDING_FAN_ARC: ReadonlyArray<readonly [number, number]> = [
  [50, 100],
  [97.1, 74.1],
  [95, 62.7],
  [92.1, 51.9],
  [88.5, 41.9],
  [84.3, 32.8],
  [79.5, 24.9],
  [74.2, 18.3],
  [68.5, 13],
  [62.5, 9.1],
  [56.3, 6.8],
  [50, 6],
  [43.7, 6.8],
  [37.5, 9.1],
  [31.5, 13],
  [25.8, 18.3],
  [20.5, 24.9],
  [15.7, 32.8],
  [11.5, 41.9],
  [7.9, 51.9],
  [5, 62.7],
  [2.9, 74.1],
]

function weddingFanClip(spread: number): string {
  const open = Math.min(1, Math.max(0, spread))
  const points = WEDDING_FAN_ARC.map(([x, y]) => {
    const sx = 50 + (x - 50) * open
    const xText = Number.isInteger(sx) ? String(sx) : sx.toFixed(1)
    const yText = Number.isInteger(y) ? String(y) : String(y)
    return `${xText}% ${yText}%`
  })
  return `polygon(${points.join(', ')})`
}

/** Rẻ quạt mở hết: miệng rộng phía trên, nan gom về chốt dưới. */
export const WEDDING_FAN_PHOTO_CLIP = weddingFanClip(1)

/** Rẻ quạt vừa khép, trước khi xòe ra hai bên. */
export const WEDDING_FAN_CLOSED_CLIP = weddingFanClip(0.22)

/** Ô ảnh rẻ quạt nằm ngang để miệng quạt ăn ra hai bên. */
export const WEDDING_FAN_PHOTO_RATIO = '200 / 108'

/** Trăng tròn. Ô ảnh phải vuông thì vòng này khít mép. */
export const WEDDING_MOON_PHOTO_CLIP = 'circle(50% at 50% 50%)'

/** Ngôi sao năm cánh, lòng rộng để mặt và vai không bị cánh cắt. Ô ảnh phải vuông. */
export const WEDDING_STAR_PHOTO_CLIP =
  'polygon(50.00% 2.00%, 71.16% 20.88%, 95.65% 35.17%, 84.24% 61.12%, 78.21% 88.83%, 50.00% 86.00%, 21.79% 88.83%, 15.76% 61.12%, 4.35% 35.17%, 28.84% 20.88%)'

export type WeddingLeafFrameAsset = {
  src: string
  mask: string
  hole: { x: number; y: number; w: number; h: number }
  aspect: string
}

/** Lá phong chụp thật, đục lỗ theo năm thùy. Sinh bởi scripts/build-maple-leaf-frame.mjs. */
const MAPLE_LEAF_FRAME: WeddingLeafFrameAsset = {
  src: '/wedding/covers/la-phong-frame.webp',
  mask: '/wedding/covers/la-phong-mask.webp',
  hole: { x: 7.17, y: 7.66, w: 87.37, h: 79.68 },
  aspect: '1576 / 1540',
}

export const WEDDING_LEAF_FRAMES: Record<string, WeddingLeafFrameAsset> = {
  'la-phong': MAPLE_LEAF_FRAME,
  'la-bau-duc': MAPLE_LEAF_FRAME,
  'la-bau-duc-sen': MAPLE_LEAF_FRAME,
  'la-bau-duc-ngoc': MAPLE_LEAF_FRAME,
  'la-bau-duc-xanh': MAPLE_LEAF_FRAME,
}

export const WEDDING_LEAF_FRAME = WEDDING_LEAF_FRAMES['la-phong']

export function weddingLeafFrameFor(presetId: string | null | undefined): WeddingLeafFrameAsset {
  const key = String(presetId || '').trim().replace(/_/g, '-')
  return WEDDING_LEAF_FRAMES[key] ?? WEDDING_LEAF_FRAME
}

export type WeddingMoonShape = 'moon' | 'star'

export type WeddingMoonCard = {
  backgroundId: string
  coverId: string
  shape: WeddingMoonShape
  paper: WeddingGateToneId
  label: Record<WebLocale, string>
}

const MOON_SHAPE_NAME: Record<WeddingMoonShape, Record<WebLocale, string>> = {
  moon: { vi: 'Trăng tròn', en: 'full moon', zh: '圆月', ja: '満月', ko: '보름달' },
  star: { vi: 'Ngôi sao', en: 'star', zh: '星', ja: '星', ko: '별' },
}

const MOON_PAPER_NAME: Record<WeddingGateToneId, Record<WebLocale, string>> = {
  lacquer: { vi: 'đỏ', en: 'red', zh: '正红', ja: '赤', ko: '빨강' },
  lotus: { vi: 'sen vàng', en: 'gold lotus', zh: '金莲', ja: '金の蓮', ko: '금련' },
  pearl: { vi: 'ngọc trai', en: 'pearl', zh: '珍珠', ja: '真珠', ko: '진주' },
  night: { vi: 'đêm vàng', en: 'gold night', zh: '夜金', ja: '金の夜', ko: '금빛 밤' },
  sea: { vi: 'biển', en: 'seaside', zh: '海边', ja: '海辺', ko: '해변' },
}

const MOON_SHAPE_SLUG: Record<WeddingMoonShape, string> = {
  moon: 'trang-tron',
  star: 'ngoi-sao',
}

const MOON_PAPER_SLUG: Record<WeddingGateToneId, string> = {
  lacquer: '',
  lotus: '-sen',
  pearl: '-ngoc',
  night: '-dem',
  sea: '-bien',
}

const MOON_PAPERS: readonly WeddingGateToneId[] = ['lacquer', 'lotus', 'pearl', 'night', 'sea']

/** Bốn nền khách hay chọn. Khung ảnh là lá phong chụp thật, đục lỗ theo mép lá. */
const LEAF_PAPERS = ['lacquer', 'lotus', 'pearl', 'sea'] as const

const LEAF_SLUG: Record<(typeof LEAF_PAPERS)[number], string> = {
  lacquer: 'la-bau-duc',
  lotus: 'la-bau-duc-sen',
  pearl: 'la-bau-duc-ngoc',
  sea: 'la-bau-duc-xanh',
}

const LEAF_LABEL: Record<(typeof LEAF_PAPERS)[number], Record<WebLocale, string>> = {
  lacquer: { vi: 'Lá phong đỏ', en: 'Red maple leaf', zh: '红枫叶', ja: '赤いカエデ', ko: '빨간 단풍잎' },
  lotus: { vi: 'Lá phong vàng', en: 'Gold maple leaf', zh: '金枫叶', ja: '金のカエデ', ko: '금빛 단풍잎' },
  pearl: { vi: 'Lá phong hồng', en: 'Blush maple leaf', zh: '粉枫叶', ja: '淡いカエデ', ko: '분홍 단풍잎' },
  sea: { vi: 'Lá phong xanh', en: 'Sea maple leaf', zh: '海枫叶', ja: '海辺のカエデ', ko: '푸른 단풍잎' },
}

export type WeddingLeafCard = {
  backgroundId: string
  coverId: string
  paper: WeddingGateToneId
  label: Record<WebLocale, string>
}

export const WEDDING_LEAF_CARDS: readonly WeddingLeafCard[] = LEAF_PAPERS.map((paper) => {
  const backgroundId = LEAF_SLUG[paper]
  return {
    backgroundId,
    coverId: backgroundId.replace(/-/g, '_'),
    paper,
    label: LEAF_LABEL[paper],
  }
})

function moonCardLabel(shape: WeddingMoonShape, paper: WeddingGateToneId): Record<WebLocale, string> {
  const shapeName = MOON_SHAPE_NAME[shape]
  const paperName = MOON_PAPER_NAME[paper]
  const en = `${paperName.en} ${shapeName.en}`
  return {
    vi: `${shapeName.vi} ${paperName.vi}`,
    en: en.charAt(0).toUpperCase() + en.slice(1),
    zh: `${paperName.zh}${shapeName.zh}`,
    ja: `${paperName.ja}の${shapeName.ja}`,
    ko: `${paperName.ko} ${shapeName.ko}`,
  }
}

/** Trăng tròn và ngôi sao, mỗi hình trên năm nền khách đang dùng. */
export const WEDDING_MOON_CARDS: readonly WeddingMoonCard[] = (['moon', 'star'] as const).flatMap((shape) =>
  MOON_PAPERS.map((paper) => {
    const backgroundId = `${MOON_SHAPE_SLUG[shape]}${MOON_PAPER_SLUG[paper]}`
    return {
      backgroundId,
      coverId: backgroundId.replace(/-/g, '_'),
      shape,
      paper,
      label: moonCardLabel(shape, paper),
    }
  }),
)

const MOON_GATE_FACE: Record<WeddingGateToneId, { styleId: string; ornament: string; paper: string; accent: string; textClass: string }> = {
  lacquer: { styleId: 'traditional_vietnamese', ornament: '囍', paper: '#9b1c24', accent: '#f3d27a', textClass: 'text-[#f6e2b0]' },
  lotus: { styleId: 'luxury', ornament: '❀', paper: '#fff8ee', accent: '#8a5a12', textClass: 'text-[#3b2618]' },
  pearl: { styleId: 'floral', ornament: '❀', paper: '#fff7f8', accent: '#b05a78', textClass: 'text-[#4a2c38]' },
  night: { styleId: 'modern', ornament: '✦', paper: '#0c1830', accent: '#e6d3b3', textClass: 'text-[#f3e6c8]' },
  sea: { styleId: 'minimal', ornament: '◇', paper: '#f4faf8', accent: '#0f766e', textClass: 'text-[#1a3c48]' },
}

function gateCover(
  id: string,
  gateTone: WeddingGateToneId,
  styleId: string,
  ornament: string,
  paper: string,
  accent: string,
  textClass: string,
  label: WeddingCoverPreset['label'],
  photoHead?: 'fan' | 'leaf' | WeddingMoonShape,
): WeddingCoverPreset {
  return {
    id,
    layout: 'song_hy',
    ...(photoHead ? { photoHead } : {}),
    gateTone,
    styleId,
    tags: ['new'],
    ornament,
    thumbnail: { topBg: paper, bottomBg: paper, accent, textClass },
    label,
  }
}

function pairCover(
  id: string,
  pairFrame: 'thin' | 'none',
  styleId: string,
  ornament: string,
  paper: string,
  accent: string,
  textClass: string,
  label: WeddingCoverPreset['label'],
  pairArrange?: WeddingCoverPreset['pairArrange'],
): WeddingCoverPreset {
  return {
    id,
    layout: 'pair',
    pairFrame,
    pairArrange,
    styleId,
    ornament,
    thumbnail: { topBg: paper, bottomBg: paper, accent, textClass },
    label,
  }
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
    layout: 'plain',
    styleId: 'minimal',
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
    id: 'phong_bi',
    layout: 'envelope',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#f6f0e6',
      bottomBg: '#f6f0e6',
      accent: '#6b2136',
      textClass: 'text-[#5c1a28]',
    },
    label: {
      vi: 'Phong bì đỏ đô',
      en: 'Burgundy envelope',
      zh: '酒红信封',
      ja: 'バーガンディの封筒',
      ko: '버건디 봉투',
    },
  },
  {
    id: 'phong_bi_hong',
    layout: 'envelope',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fff4f6',
      bottomBg: '#fff4f6',
      accent: '#a34762',
      textClass: 'text-[#5c2a38]',
    },
    label: {
      vi: 'Phong bì hồng',
      en: 'Blush envelope',
      zh: '粉信封',
      ja: '淡いピンクの封筒',
      ko: '블러시 봉투',
    },
  },
  {
    id: 'phong_bi_reu',
    layout: 'envelope',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#f4f8f0',
      bottomBg: '#f4f8f0',
      accent: '#5c6b40',
      textClass: 'text-[#3e4f34]',
    },
    label: {
      vi: 'Phong bì rêu',
      en: 'Sage envelope',
      zh: '苔绿信封',
      ja: 'セージの封筒',
      ko: '세이지 봉투',
    },
  },
  {
    id: 'phong_bi_dem',
    layout: 'envelope',
    styleId: 'modern',
    tags: ['new'],
    ornament: '✦',
    thumbnail: {
      topBg: '#0c1830',
      bottomBg: '#0c1830',
      accent: '#e6d3b3',
      textClass: 'text-[#f3e6c8]',
    },
    label: {
      vi: 'Phong bì đêm',
      en: 'Navy envelope',
      zh: '夜蓝信封',
      ja: '紺の封筒',
      ko: '네이비 봉투',
    },
  },
  {
    id: 'phong_bi_nga',
    layout: 'envelope',
    styleId: 'ethereal',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fffaf3',
      bottomBg: '#fffaf3',
      accent: '#8a5727',
      textClass: 'text-[#3b2a22]',
    },
    label: {
      vi: 'Phong bì ngà',
      en: 'Ivory envelope',
      zh: '象牙信封',
      ja: '象牙色の封筒',
      ko: '아이보리 봉투',
    },
  },
  {
    id: 'hoa_dao',
    layout: 'plain',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fff6f4',
      bottomBg: '#fff6f4',
      accent: '#a34762',
      textClass: 'text-[#5c2a38]',
    },
    label: {
      vi: 'Hoa đào',
      en: 'Peach blossom',
      zh: '桃花',
      ja: '桃の花',
      ko: '복숭아꽃',
    },
  },
  {
    id: 'bien',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '—',
    thumbnail: {
      topBg: '#f7f1e6',
      bottomBg: '#f7f1e6',
      accent: '#0f766e',
      textClass: 'text-[#1a3c48]',
    },
    label: {
      vi: 'Biển',
      en: 'Seaside',
      zh: '海边',
      ja: '海辺',
      ko: '해변',
    },
  },
  {
    id: 'dem_vang',
    layout: 'plain',
    styleId: 'modern',
    tags: ['new'],
    ornament: '✦',
    thumbnail: {
      topBg: '#0c1830',
      bottomBg: '#0c1830',
      accent: '#e6d3b3',
      textClass: 'text-[#f3e6c8]',
    },
    label: {
      vi: 'Đêm vàng',
      en: 'Gold night',
      zh: '夜金',
      ja: '金の夜',
      ko: '금빛 밤',
    },
  },
  {
    id: 'lua_ao_dai',
    layout: 'plain',
    styleId: 'ethereal',
    tags: ['new'],
    ornament: '—',
    thumbnail: {
      topBg: '#f7f3ec',
      bottomBg: '#f7f3ec',
      accent: '#8a5727',
      textClass: 'text-[#3b2a22]',
    },
    label: {
      vi: 'Lụa áo dài',
      en: 'Ao dai silk',
      zh: '奥黛丝绸',
      ja: 'アオザイの絹',
      ko: '아오자이 실크',
    },
  },
  {
    id: 'hoa_dao_van',
    layout: 'plain',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fff6f4',
      bottomBg: '#fff6f4',
      accent: '#a34762',
      textClass: 'text-[#5c2a38]',
    },
    label: {
      vi: 'Hoa đào hoa văn',
      en: 'Patterned peach blossom',
      zh: '桃花纹',
      ja: '桃の花模様',
      ko: '복숭아꽃 무늬',
    },
  },
  {
    id: 'bien_van',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '—',
    thumbnail: {
      topBg: '#f7f1e6',
      bottomBg: '#f7f1e6',
      accent: '#0f766e',
      textClass: 'text-[#1a3c48]',
    },
    label: {
      vi: 'Biển hoa văn',
      en: 'Patterned seaside',
      zh: '海边纹',
      ja: '海辺の模様',
      ko: '해변 무늬',
    },
  },
  {
    id: 'dem_vang_van',
    layout: 'plain',
    styleId: 'modern',
    tags: ['new'],
    ornament: '✦',
    thumbnail: {
      topBg: '#0c1830',
      bottomBg: '#0c1830',
      accent: '#e6d3b3',
      textClass: 'text-[#f3e6c8]',
    },
    label: {
      vi: 'Đêm vàng hoa văn',
      en: 'Patterned gold night',
      zh: '夜金纹',
      ja: '金の夜の模様',
      ko: '금빛 밤 무늬',
    },
  },
  {
    id: 'lua_van',
    layout: 'plain',
    styleId: 'ethereal',
    tags: ['new'],
    ornament: '—',
    thumbnail: {
      topBg: '#f7f3ec',
      bottomBg: '#f7f3ec',
      accent: '#8a5727',
      textClass: 'text-[#3b2a22]',
    },
    label: {
      vi: 'Lụa hoa văn',
      en: 'Patterned silk',
      zh: '丝绸纹',
      ja: '絹の模様',
      ko: '실크 무늬',
    },
  },
  {
    id: 'tre_viet',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '竹',
    thumbnail: {
      topBg: '#f4f7f1',
      bottomBg: '#f7faf4',
      accent: '#2f6b45',
      textClass: 'text-[#1a3324]',
    },
    label: {
      vi: 'Tre Việt Nam',
      en: 'Vietnamese bamboo',
      zh: '越南竹',
      ja: 'ベトナムの竹',
      ko: '베트남 대나무',
    },
  },
  {
    id: 'do_dam',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#f7f1ea',
      bottomBg: '#f7f1ea',
      accent: '#5c1a28',
      textClass: 'text-[#4a1e2c]',
    },
    label: {
      vi: 'Ảnh đỏ đậm',
      en: 'Burgundy photo',
      zh: '深酒红照片',
      ja: '深いバーガンディの写真',
      ko: '딥 버건디 사진',
    },
  },
  {
    id: 'chua_mot_cot',
    layout: 'plain',
    styleId: 'luxury',
    tags: ['new'],
    ornament: '蓮',
    thumbnail: {
      topBg: '#fff8ec',
      bottomBg: '#fff6e4',
      accent: '#8a5a12',
      textClass: 'text-[#3b2618]',
    },
    label: {
      vi: 'Sen mái ngói',
      en: 'Lotus and roof tiles',
      zh: '莲与瓦檐',
      ja: '蓮と瓦屋根',
      ko: '연꽃과 기와',
    },
  },
  {
    id: 'van_mieu',
    layout: 'plain',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '梅',
    thumbnail: {
      topBg: '#fffaf0',
      bottomBg: '#f7f1e4',
      accent: '#6b4a28',
      textClass: 'text-[#2c2416]',
    },
    label: {
      vi: 'Hoa đào gạch',
      en: 'Blossom on brick',
      zh: '砖墙桃花',
      ja: '煉瓦と桃の花',
      ko: '벽돌과 복숭아꽃',
    },
  },
  {
    id: 'cho_ben_thanh',
    layout: 'plain',
    styleId: 'floral',
    tags: ['new'],
    ornament: '❀',
    thumbnail: {
      topBg: '#fff8f0',
      bottomBg: '#f8efe4',
      accent: '#c2410c',
      textClass: 'text-[#5c2e1a]',
    },
    label: {
      vi: 'Hoa sứ giấy',
      en: 'Plumeria and bougainvillea',
      zh: '鸡蛋花与三角梅',
      ja: 'プルメリアとブーゲンビリア',
      ko: '플루메리아와 부겐빌레아',
    },
  },
  {
    id: 'vinh_ha_long',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '石',
    thumbnail: {
      topBg: '#f8fcfa',
      bottomBg: '#eef6f4',
      accent: '#0369a1',
      textClass: 'text-[#12343a]',
    },
    label: {
      vi: 'Vịnh đá sương',
      en: 'Misty limestone bay',
      zh: '雾中石湾',
      ja: '霧の岩の湾',
      ko: '안개 낀 바위 만',
    },
  },
  {
    id: 'lang_bac',
    layout: 'plain',
    styleId: 'minimal',
    tags: ['new'],
    ornament: '蓮',
    thumbnail: {
      topBg: '#fffdfb',
      bottomBg: '#f4f6f5',
      accent: '#3d5c4a',
      textClass: 'text-[#243038]',
    },
    label: {
      vi: 'Cúc trắng',
      en: 'White chrysanthemums',
      zh: '白菊',
      ja: '白い菊',
      ko: '흰 국화',
    },
  },
  {
    id: 'que_nghe_an',
    layout: 'plain',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '稻',
    thumbnail: {
      topBg: '#fff8e8',
      bottomBg: '#f6efd8',
      accent: '#6b5a28',
      textClass: 'text-[#3a3320]',
    },
    label: {
      vi: 'Lúa lá cau',
      en: 'Rice and areca leaves',
      zh: '稻穗与槟榔叶',
      ja: '稲穂とビンロウの葉',
      ko: '벼 이삭과 빈랑 잎',
    },
  },
  {
    id: 'duong_lam',
    layout: 'plain',
    styleId: 'vintage',
    tags: ['new'],
    ornament: '葉',
    thumbnail: {
      topBg: '#fff6ee',
      bottomBg: '#f3e6d8',
      accent: '#8a5727',
      textClass: 'text-[#3b2a22]',
    },
    label: {
      vi: 'Đá ong lá đa',
      en: 'Laterite and bodhi leaves',
      zh: '红砖与菩提叶',
      ja: 'ラテライトと菩提の葉',
      ko: '라테라이트와 보리수 잎',
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
    id: 'song_hy',
    layout: 'song_hy',
    styleId: 'traditional_vietnamese',
    tags: ['new'],
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(180deg, #9b1c24 0%, #7a1520 100%)',
      bottomBg: '#4e1018',
      accent: '#f3d27a',
      textClass: 'text-[#f6e2b0]',
    },
    label: {
      vi: 'Song hỷ đỏ',
      en: 'Double happiness red',
      zh: '双喜正红',
      ja: '双喜・赤',
      ko: '쌍희 빨강',
    },
  },
  gateCover('vom_sen', 'lotus', 'luxury', '❀', '#fff8ee', '#8a5a12', 'text-[#3b2618]', {
    vi: 'Vòm sen vàng', en: 'Gold lotus arch', zh: '金莲拱门', ja: '金蓮のアーチ', ko: '금련 아치',
  }),
  gateCover('vom_ngoc', 'pearl', 'floral', '❀', '#fff7f8', '#b05a78', 'text-[#4a2c38]', {
    vi: 'Vòm ngọc trai', en: 'Pearl arch', zh: '珍珠拱门', ja: '真珠のアーチ', ko: '진주 아치',
  }),
  gateCover('vom_dem', 'night', 'modern', '✦', '#0c1830', '#e6d3b3', 'text-[#f3e6c8]', {
    vi: 'Vòm đêm vàng', en: 'Gold night arch', zh: '夜金拱门', ja: '金の夜のアーチ', ko: '금빛 밤 아치',
  }),
  gateCover('vom_bien', 'sea', 'minimal', '◇', '#f4faf8', '#0f766e', 'text-[#1a3c48]', {
    vi: 'Vòm biển', en: 'Seaside arch', zh: '海边拱门', ja: '海辺のアーチ', ko: '해변 아치',
  }),
  ...WEDDING_MOON_CARDS.map((card) => {
    const face = MOON_GATE_FACE[card.paper]
    return gateCover(card.coverId, card.paper, face.styleId, face.ornament, face.paper, face.accent, face.textClass, card.label, card.shape)
  }),
  ...WEDDING_LEAF_CARDS.map((card) => {
    const face = MOON_GATE_FACE[card.paper]
    return gateCover(card.coverId, card.paper, face.styleId, face.ornament, face.paper, face.accent, face.textClass, card.label, 'leaf')
  }),
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
    id: 'plain_photo',
    layout: 'plain',
    styleId: 'traditional_vietnamese',
    ornament: '囍',
    thumbnail: {
      topBg: '#5c1018',
      bottomBg: '#5c1018',
      accent: '#f3d27a',
      textClass: 'text-[#f6e4b8]',
    },
    label: {
      vi: 'Ảnh không khung',
      en: 'Photo without a frame',
      zh: '无框照片',
      ja: '枠なしの写真',
      ko: '프레임 없는 사진',
    },
  },
  {
    id: 'do_son',
    layout: 'frame',
    styleId: 'traditional_vietnamese',
    frame: {
      src: '/wedding/covers/do-son-frame.webp',
      hole: { x: 14.65, y: 27.93, w: 70.7, h: 47.75 },
      panel: '#fff4ee',
      ink: 'dark',
    },
    ornament: '囍',
    thumbnail: {
      topBg: '#8d1c24',
      bottomBg: '#fff4ee',
      accent: '#c4a15a',
      textClass: 'text-[#2a1210]',
    },
    label: {
      vi: 'Khung đỏ son',
      en: 'Scarlet frame',
      zh: '正红金框',
      ja: '朱色の額',
      ko: '진홍 프레임',
    },
  },
  {
    id: 'sen_vang',
    layout: 'plain',
    styleId: 'luxury',
    ornament: '❀',
    thumbnail: {
      topBg: '#fff8ee',
      bottomBg: '#fff8ee',
      accent: '#c4a15a',
      textClass: 'text-[#3b2618]',
    },
    label: {
      vi: 'Ảnh sen vàng',
      en: 'Gold lotus photo',
      zh: '金莲照片',
      ja: '金の蓮の写真',
      ko: '금련 사진',
    },
  },
  {
    id: 'vuon_hong_troi',
    layout: 'frame',
    styleId: 'floral',
    frame: {
      src: '/wedding/covers/vuon-hong-troi-frame.webp',
      hole: { x: 12.79, y: 13.09, w: 74.12, h: 73.05 },
      panel: '#f7fbff',
      ink: 'dark',
    },
    ornament: '❀',
    thumbnail: {
      topBg: '#e8f3fb',
      bottomBg: '#fffafc',
      accent: '#7eb0d4',
      textClass: 'text-[#1a2836]',
    },
    label: {
      vi: 'Khung vườn trời',
      en: 'Sky garden frame',
      zh: '蓝天花园框',
      ja: '青空の庭の額',
      ko: '하늘 정원 프레임',
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
  {
    id: 'net_sen',
    layout: 'frame',
    styleId: 'floral',
    frame: {
      src: '/wedding/covers/net-sen-frame.webp',
      hole: { x: 5.78, y: 4.33, w: 88.44, h: 91.33 },
      panel: '#fff8f2',
      ink: 'dark',
    },
    ornament: '❀',
    thumbnail: {
      topBg: '#fff6ee',
      bottomBg: '#fff6ee',
      accent: '#b8893e',
      textClass: 'text-[#6b4310]',
    },
    label: {
      vi: 'Khung nét sen',
      en: 'Thin lotus line',
      zh: '细莲线框',
      ja: '細い蓮の線',
      ko: '얇은 연꽃 선',
    },
  },
  {
    id: 'net_mong',
    layout: 'frame',
    styleId: 'ethereal',
    frame: {
      src: '/wedding/covers/net-mong-frame.webp',
      hole: { x: 5.78, y: 4.33, w: 88.44, h: 91.33 },
      panel: '#f7f6f4',
      ink: 'dark',
    },
    ornament: '&',
    thumbnail: {
      topBg: '#f7f6f4',
      bottomBg: '#f7f6f4',
      accent: '#8d98a3',
      textClass: 'text-stone-700',
    },
    label: {
      vi: 'Khung nét mỏng',
      en: 'Thin mist line',
      zh: '细雾线框',
      ja: '細い霧の線',
      ko: '얇은 안개 선',
    },
  },
  pairCover('pair_nau', 'thin', 'ethereal', '&', '#f7f2ea', '#8d7355', 'text-stone-700', {
    vi: 'Đôi ảnh nâu', en: 'Two warm photos', zh: '暖色双照', ja: 'あたたかい写真二つ', ko: '따뜻한 사진 둘',
  }),
  pairCover('pair_hong', 'none', 'floral', '❀', '#fff7f5', '#c45c7a', 'text-rose-800', {
    vi: 'Đôi ảnh hồng', en: 'Two pink photos', zh: '粉色双照', ja: 'ピンクの写真二つ', ko: '분홍 사진 둘',
  }),
  pairCover('pair_long_phung', 'thin', 'traditional_vietnamese', '囍', '#5c1018', '#f3d27a', 'text-[#f6e4b8]', {
    vi: 'Đôi ảnh long phụng', en: 'Two dragon photos', zh: '龙凤双照', ja: '龍鳳の写真二つ', ko: '용봉 사진 둘',
  }),
  pairCover('pair_do_son', 'none', 'traditional_vietnamese', '囍', '#8d1c24', '#c4a15a', 'text-[#f6e4b8]', {
    vi: 'Đôi ảnh đỏ son', en: 'Two scarlet photos', zh: '正红双照', ja: '朱色の写真二つ', ko: '진홍 사진 둘',
  }),
  pairCover('pair_song_hy', 'thin', 'traditional_vietnamese', '囍', '#4e1018', '#f3d27a', 'text-[#f6e2b0]', {
    vi: 'Đôi ảnh song hỷ', en: 'Two happiness photos', zh: '双喜双照', ja: '双喜の写真二つ', ko: '쌍희 사진 둘',
  }),
  pairCover('pair_sen', 'none', 'luxury', '❀', '#fff8ee', '#c4a15a', 'text-[#3b2618]', {
    vi: 'Đôi ảnh sen', en: 'Two lotus photos', zh: '金莲双照', ja: '蓮の写真二つ', ko: '연꽃 사진 둘',
  }),
  pairCover('pair_ngoc', 'thin', 'floral', '❀', '#fff8f6', '#c45c7a', 'text-rose-800', {
    vi: 'Đôi ảnh ngọc', en: 'Two pearl photos', zh: '珍珠双照', ja: 'パールの写真二つ', ko: '펄 사진 둘',
  }),
  pairCover('pair_lech', 'thin', 'ethereal', '&', '#f7f2ea', '#8d7355', 'text-stone-700', {
    vi: 'Đôi ảnh lệch', en: 'Offset photos', zh: '错落双照', ja: 'ずらし写真', ko: '어긋난 사진',
  }, 'offset'),
  pairCover('pair_nghieng', 'none', 'floral', '❀', '#fff7f5', '#c45c7a', 'text-rose-800', {
    vi: 'Đôi ảnh nghiêng', en: 'Tilted photos', zh: '倾斜双照', ja: '傾けた写真', ko: '기울인 사진',
  }, 'tilt'),
  pairCover('pair_vong', 'thin', 'traditional_vietnamese', '囍', '#4e1018', '#f3d27a', 'text-[#f6e2b0]', {
    vi: 'Đôi ảnh vòng', en: 'Two round photos', zh: '双圆照', ja: '丸い写真二つ', ko: '둥근 사진 둘',
  }, 'locket'),
  pairCover('pair_the', 'none', 'traditional_vietnamese', '囍', '#5c1018', '#f3d27a', 'text-[#f6e4b8]', {
    vi: 'Đôi ảnh thẻ', en: 'Photo cards', zh: '拍立得双照', ja: 'プリント写真', ko: '인화 사진',
  }, 'print'),
]

/** Đã dỡ khỏi kho chọn. Thiệp đã lưu vẫn cắt ảnh rẻ quạt. */
const WEDDING_RETIRED_FAN_COVERS: WeddingCoverPreset[] = [
  {
    id: 're_quat',
    layout: 'song_hy',
    photoHead: 'fan',
    styleId: 'traditional_vietnamese',
    tags: ['new'],
    ornament: '囍',
    thumbnail: {
      topBg: 'linear-gradient(180deg, #9b1c24 0%, #7a1520 100%)',
      bottomBg: '#4e1018',
      accent: '#f3d27a',
      textClass: 'text-[#f6e2b0]',
    },
    label: {
      vi: 'Rẻ quạt đỏ',
      en: 'Red folding fan',
      zh: '红折扇',
      ja: '赤の扇',
      ko: '붉은 부채',
    },
  },
  gateCover('re_quat_sen', 'lotus', 'luxury', '❀', '#fff8ee', '#8a5a12', 'text-[#3b2618]', {
    vi: 'Rẻ quạt sen vàng', en: 'Gold lotus fan', zh: '金莲折扇', ja: '金蓮の扇', ko: '금련 부채',
  }, 'fan'),
  gateCover('re_quat_ngoc', 'pearl', 'floral', '❀', '#fff7f8', '#b05a78', 'text-[#4a2c38]', {
    vi: 'Rẻ quạt ngọc trai', en: 'Pearl fan', zh: '珍珠折扇', ja: '真珠の扇', ko: '진주 부채',
  }, 'fan'),
  gateCover('re_quat_dem', 'night', 'modern', '✦', '#0c1830', '#e6d3b3', 'text-[#f3e6c8]', {
    vi: 'Rẻ quạt đêm vàng', en: 'Gold night fan', zh: '夜金折扇', ja: '金の夜の扇', ko: '금빛 밤 부채',
  }, 'fan'),
  gateCover('re_quat_bien', 'sea', 'minimal', '◇', '#f4faf8', '#0f766e', 'text-[#1a3c48]', {
    vi: 'Rẻ quạt biển', en: 'Seaside fan', zh: '海边折扇', ja: '海辺の扇', ko: '해변 부채',
  }, 'fan'),
]

const COVER_BY_ID = new Map(
  [...WEDDING_COVER_PRESETS, ...WEDDING_RETIRED_FAN_COVERS].map((preset) => [preset.id, preset]),
)

export const DEFAULT_WEDDING_COVER_PRESET_ID = WEDDING_COVER_PRESETS[0]?.id ?? 'dragon_phoenix'

export function findWeddingCoverPreset(id: string | null | undefined): WeddingCoverPreset | undefined {
  const key = String(id || '').trim()
  if (!key) return undefined
  return COVER_BY_ID.get(key)
}

export function getWeddingCoverPreset(id: string | null | undefined): WeddingCoverPreset {
  return findWeddingCoverPreset(id) ?? WEDDING_COVER_PRESETS[0]
}

/** Đầu khung ảnh. Vỏ song hỷ không ghi thì là vòm. */
export function weddingCoverPhotoHead(id: string | null | undefined): WeddingCoverPhotoHead {
  const head = findWeddingCoverPreset(id)?.photoHead
  return head && head !== 'arch' ? head : 'arch'
}

/** Đường cắt ảnh của rẻ quạt, trăng tròn và ngôi sao. Lá dùng ảnh lá đục lỗ, không clip. Vòm không dùng clip. */
export function weddingCoverPhotoClip(head: WeddingCoverPhotoHead | null | undefined): string | undefined {
  if (head === 'fan') return WEDDING_FAN_PHOTO_CLIP
  if (head === 'moon') return WEDDING_MOON_PHOTO_CLIP
  if (head === 'star') return WEDDING_STAR_PHOTO_CLIP
  return undefined
}

/** Màu cổng vòm. Vỏ không ghi thì là đỏ song hỷ. */
export function weddingCoverGateTone(id: string | null | undefined): WeddingGateTone {
  const key = findWeddingCoverPreset(id)?.gateTone
  return WEDDING_GATE_TONES[key && key in WEDDING_GATE_TONES ? key : 'lacquer']
}

/** Vỏ đỏ song hỷ và rẻ quạt đứng giữa sân, không dồn lên đầu. */
export function weddingCoverCentersOnStage(id: string | null | undefined): boolean {
  return findWeddingCoverPreset(id)?.layout === 'song_hy'
}

export function labelForWeddingCoverPreset(locale: WebLocale, preset: WeddingCoverPreset): string {
  return preset.label[locale] ?? preset.label.vi
}

/** Khung đi theo nền: ảnh khung, bố cục ghép, hoặc ảnh trần không khung. */
export function weddingCoverPresetFollowsBackground(preset: WeddingCoverPreset | undefined): boolean {
  if (!preset) return false
  return Boolean(preset.frame) || preset.layout === 'composed' || preset.layout === 'plain' || preset.layout === 'envelope' || preset.layout === 'pair'
}

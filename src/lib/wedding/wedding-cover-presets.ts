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
      vi: 'Phong bì thư',
      en: 'Letter envelope',
      zh: '信封',
      ja: '封筒',
      ko: '편지 봉투',
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

/** Khung đi theo nền: ảnh khung, bố cục ghép, hoặc ảnh trần không khung. */
export function weddingCoverPresetFollowsBackground(preset: WeddingCoverPreset | undefined): boolean {
  if (!preset) return false
  return Boolean(preset.frame) || preset.layout === 'composed' || preset.layout === 'plain' || preset.layout === 'envelope' || preset.layout === 'pair'
}

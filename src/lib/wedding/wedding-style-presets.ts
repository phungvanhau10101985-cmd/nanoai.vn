import type { WebLocale } from '@/lib/i18n/config'

export type WeddingStylePreset = {
  id: string
  palette: string
  ornament: string
  thumbnail: {
    bg: string
    accent: string
    textClass: string
    panelClass: string
    /** Decorative motif rendered in the mini preview */
    motif: 'gold_foil' | 'clean_lines' | 'double_happiness' | 'floral_corners' | 'ink_strokes' | 'ornate_frame' | 'dark_gold'
  }
  label: Record<WebLocale, string>
  description: Record<WebLocale, string>
}

export const WEDDING_STYLE_PRESETS: WeddingStylePreset[] = [
  {
    id: 'luxury',
    palette: 'champagne gold, ivory, blush pink',
    ornament: '✦',
    thumbnail: {
      bg: 'linear-gradient(145deg, #fde68a 0%, #fff7ed 48%, #fecdd3 100%)',
      accent: '#92400e',
      textClass: 'text-amber-950/85',
      panelClass: 'bg-white/55 border-amber-200/60',
      motif: 'gold_foil',
    },
    label: {
      vi: 'Sang trọng',
      en: 'Luxury',
      zh: '奢华',
      ja: 'ラグジュアリー',
      ko: '럭셔리',
    },
    description: {
      vi: 'Vàng kem, hoa văn tinh tế — tiệc khách sạn, phong cách cao cấp',
      en: 'Champagne gold, refined motifs — hotel banquet, upscale feel',
      zh: '香槟金、精致纹样——酒店宴会、高端格调',
      ja: 'シャンパンゴールド、上品な装飾——ホテル披露宴向け',
      ko: '샴페인 골드, 정교한 장식 — 호텔 연회, 고급스러운 분위기',
    },
  },
  {
    id: 'minimal',
    palette: 'warm white, sage, charcoal',
    ornament: '—',
    thumbnail: {
      bg: 'linear-gradient(160deg, #fafaf9 0%, #ffffff 55%, #d1fae5 100%)',
      accent: '#047857',
      textClass: 'text-stone-800',
      panelClass: 'bg-white/70 border-stone-200/70',
      motif: 'clean_lines',
    },
    label: {
      vi: 'Tối giản',
      en: 'Minimal',
      zh: '极简',
      ja: 'ミニマル',
      ko: '미니멀',
    },
    description: {
      vi: 'Trắng ấm, xanh sage — gọn gàng, nhiều khoảng trống',
      en: 'Warm white, sage green — clean layout with breathing room',
      zh: '暖白、鼠尾草绿——简洁留白',
      ja: '温かみの白、セージグリーン——すっきりした余白',
      ko: '따뜻한 화이트, 세이지 그린 — 깔끔한 여백',
    },
  },
  {
    id: 'traditional_vietnamese',
    palette: 'red, gold, lotus pink',
    ornament: '囍',
    thumbnail: {
      bg: 'linear-gradient(180deg, #991b1b 0%, #dc2626 55%, #fbbf24 100%)',
      accent: '#fbbf24',
      textClass: 'text-white',
      panelClass: 'bg-[#fff7ed]/80 border-amber-300/50',
      motif: 'double_happiness',
    },
    label: {
      vi: 'Truyền thống Việt Nam',
      en: 'Traditional Vietnamese',
      zh: '越南传统',
      ja: 'ベトナム伝統',
      ko: '베트남 전통',
    },
    description: {
      vi: 'Đỏ son, vàng kim, chữ hỷ — lễ cưới truyền thống, hoa sen',
      en: 'Scarlet red, gold, double happiness — classic Vietnamese wedding',
      zh: '正红、金色、双喜——越南传统婚礼',
      ja: '朱色、金、喜字——ベトナム伝統結婚式',
      ko: '진홍, 금색, 희字 — 베트남 전통 결혼식',
    },
  },
  {
    id: 'floral',
    palette: 'ivory, blush, peony rose, soft lotus pink, eucalyptus, champagne gold',
    ornament: '❀',
    thumbnail: {
      bg: 'linear-gradient(160deg, #fecdd3 0%, #fff1f2 45%, #d1fae5 100%)',
      accent: '#be185d',
      textClass: 'text-rose-900/85',
      panelClass: 'bg-white/65 border-rose-200/55',
      motif: 'floral_corners',
    },
    label: {
      vi: 'Hoa lá',
      en: 'Floral',
      zh: '花卉',
      ja: 'フローラル',
      ko: '플로럴',
    },
    description: {
      vi: 'Hoa văn dày mà thanh thoát — mẫu đơn, sen, anh đào, nét vàng mảnh, cột giữa thoáng',
      en: 'Dense yet airy florals — peony, lotus, cherry blossom, fine gold line, calm center',
      zh: '繁而清雅的花卉——牡丹、莲、樱、细金线，中间留白',
      ja: '密でありながら軽やかな花——牡丹、蓮、桜、細い金線、中央は余白',
      ko: '빽빽하지만 맑은 꽃무늬 — 모란, 연꽃, 벚꽃, 가는 금선, 가운데는 여백',
    },
  },
  {
    id: 'ethereal',
    palette: 'ivory paper, pale blush, soft ink brown, a whisper of champagne gold',
    ornament: '∿',
    thumbnail: {
      bg: 'linear-gradient(165deg, #fbf8f4 0%, #fffdfb 62%, #f6e7ee 100%)',
      accent: '#8d6e63',
      textClass: 'text-stone-800',
      panelClass: 'bg-white/75 border-stone-200/70',
      motif: 'ink_strokes',
    },
    label: {
      vi: 'Thanh tao',
      en: 'Ethereal',
      zh: '清雅',
      ja: '清雅',
      ko: '청아',
    },
    description: {
      vi: 'Ít nét, nhiều khoảng trống — cành hoa mực, nghệ thuật, không hoa văn dày',
      en: 'Few strokes, lots of open paper — an ink branch, artistic, not a dense pattern',
      zh: '笔触很少、留白很大——一枝墨花，写意，不是密纹',
      ja: '筆は少なく余白は大きく——墨の一枝、芸術的、密な模様ではない',
      ko: '획은 적고 여백은 크게 — 먹 가지 하나, 예술적, 빽빽한 무늬 아님',
    },
  },
  {
    id: 'vintage',
    palette: 'sepia, dusty rose, antique gold',
    ornament: '❦',
    thumbnail: {
      bg: 'linear-gradient(145deg, #d6b08a 0%, #f5e6d3 50%, #e8b4a0 100%)',
      accent: '#78350f',
      textClass: 'text-amber-950/80',
      panelClass: 'bg-[#fff8ec]/72 border-orange-300/45',
      motif: 'ornate_frame',
    },
    label: {
      vi: 'Hoài cổ',
      en: 'Vintage',
      zh: '复古',
      ja: 'ヴィンテージ',
      ko: '빈티지',
    },
    description: {
      vi: 'Sepia, hồng phấn cổ — giấy cũ, khung trang trí',
      en: 'Sepia, dusty rose — aged paper, ornate frames',
      zh: '复古棕、 dusty rose——旧纸质感、装饰边框',
      ja: 'セピア、ダスティローズ——古びた紙、装飾枠',
      ko: '세피아, 더스티 로즈 — 빈티지 종이, 장식 테두리',
    },
  },
  {
    id: 'modern',
    palette: 'white, black, metallic gold',
    ornament: '◇',
    thumbnail: {
      bg: 'linear-gradient(160deg, #020617 0%, #334155 55%, #b45309 100%)',
      accent: '#fbbf24',
      textClass: 'text-white/90',
      panelClass: 'bg-slate-900/55 border-amber-400/35',
      motif: 'dark_gold',
    },
    label: {
      vi: 'Hiện đại',
      en: 'Modern',
      zh: '现代',
      ja: 'モダン',
      ko: '모던',
    },
    description: {
      vi: 'Đen trắng, vàng kim — tối giản đương đại, nền tối',
      en: 'Black & white, gold accent — contemporary dark theme',
      zh: '黑白、金色点缀——当代暗色主题',
      ja: '白黒、ゴールドアクセント——現代的ダークテーマ',
      ko: '흑백, 골드 포인트 — 현대적 다크 테마',
    },
  },
]

export function getWeddingStylePreset(id: string | null | undefined): WeddingStylePreset {
  return WEDDING_STYLE_PRESETS.find((p) => p.id === id) ?? WEDDING_STYLE_PRESETS[0]
}

export function labelForWeddingStylePreset(locale: WebLocale, preset: WeddingStylePreset): string {
  return preset.label[locale] ?? preset.label.en
}

export function descriptionForWeddingStylePreset(locale: WebLocale, preset: WeddingStylePreset): string {
  return preset.description[locale] ?? preset.description.en
}

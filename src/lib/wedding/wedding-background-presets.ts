import type { CSSProperties } from 'react'
import type { WebLocale } from '@/lib/i18n/config'
import type { WeddingButtonColorId } from '@/lib/wedding/wedding-button-colors'
import type { WeddingTheme } from '@/lib/wedding/wedding-theme'

/** Cành hoa và tiểu tiết nổi trên ảnh cô dâu chú rể, tên và thông tin. */
export type WeddingBackgroundOrnament = {
  src: string
  /** Mé trái, phần trăm bề ngang trang. */
  x: number
  /** Mé trên, hoặc mé đáy khi anchor là bottom. Phần trăm bề cao trang. */
  y: number
  /** Bề ngang, phần trăm bề ngang trang. */
  w: number
  rotate?: number
  flipX?: boolean
  opacity?: number
  /** Độ mờ, pixel. 0 là nét. */
  blur?: number
  /** 0 là đủ màu, 1 là mất màu. */
  fade?: number
  anchor?: 'top' | 'bottom'
}

export function weddingOrnamentBlurPx(value: number | undefined) {
  const blur = Number(value)
  if (!Number.isFinite(blur) || blur <= 0) return 0
  return Math.min(12, Math.round(blur))
}

export function weddingOrnamentFadeAmount(value: number | undefined) {
  const fade = Number(value)
  if (!Number.isFinite(fade) || fade <= 0) return 0
  return Math.min(1, Math.round(fade * 100) / 100)
}

/** Làm mờ và làm nhạt màu của một ảnh thêm vào. */
export function weddingOrnamentFilter(item: Pick<WeddingBackgroundOrnament, 'blur' | 'fade'>) {
  const blur = weddingOrnamentBlurPx(item.blur)
  const fade = weddingOrnamentFadeAmount(item.fade)
  const parts: string[] = []
  if (blur > 0) parts.push(`blur(${blur}px)`)
  if (fade > 0) parts.push(`saturate(${Math.round((1 - fade) * 100) / 100})`)
  return parts.join(' ') || undefined
}

/** Màu nút, màu chữ, nền chữ và kiểu chữ đi cùng một bộ nền. */
export type WeddingKitLook = {
  styleId: string
  buttonColorId: WeddingButtonColorId
  coverRsvpColorId: WeddingButtonColorId
  ink: string
  muted: string
  accent: string
  textClass: string
  mutedClass: string
  accentClass: string
  accentTextClass: string
  textPlate: string
  fontClass: 'wedding-font-soft' | 'wedding-font-formal' | 'wedding-font-lotus'
  shareFont: string
}

const LEAF = '/wedding/backgrounds/ornaments/garden-leaves.png'
const BLOOM = '/wedding/backgrounds/ornaments/garden-bloom.png'
const PETAL = '/wedding/backgrounds/ornaments/garden-petal.png'
const PEONY = '/wedding/backgrounds/ornaments/peony-bloom.png'
const PEONY_LEAF = '/wedding/backgrounds/ornaments/peony-leaf.png'
const SPRIG = '/wedding/backgrounds/ornaments/scarlet-sprig.png'
const LOTUS = '/wedding/backgrounds/ornaments/lotus-bloom.png'
const LOTUS_LEAF = '/wedding/backgrounds/ornaments/lotus-leaf.png'
const PEARL_ROSE = '/wedding/backgrounds/ornaments/pearl-rose.png'
const PEARL_BUTTERFLY = '/wedding/backgrounds/ornaments/pearl-butterfly.png'
const PEARL_STRAND = '/wedding/backgrounds/ornaments/pearl-strand.png'

const SOFT_FONT = 'Palatino Linotype, Palatino, Georgia, serif'
const FORMAL_FONT = 'Georgia, Times New Roman, serif'

/** Hoa màu nước trong suốt, bám mép và nằm trên chữ. */
const GARDEN_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: LEAF, x: -14, y: 3, w: 50, rotate: -8 },
  { src: PETAL, x: 58, y: -1, w: 48, opacity: 0.72 },
  { src: BLOOM, x: -26, y: 24, w: 72, opacity: 0.55 },
  { src: LEAF, x: 62, y: 0, w: 44, rotate: 14, flipX: true, anchor: 'bottom', opacity: 0.8 },
  { src: BLOOM, x: -20, y: -6, w: 66, opacity: 0.42, anchor: 'bottom' },
]

const PEONY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: PEONY, x: -18, y: 1, w: 56, opacity: 0.9 },
  { src: PEONY_LEAF, x: 58, y: 6, w: 42, rotate: 8 },
  { src: PEONY, x: -12, y: -8, w: 50, opacity: 0.5, anchor: 'bottom' },
  { src: PEONY_LEAF, x: 60, y: 0, w: 38, flipX: true, anchor: 'bottom', opacity: 0.8 },
]

const SCARLET_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: SPRIG, x: -6, y: 4, w: 34, rotate: -8 },
  { src: SPRIG, x: 70, y: -2, w: 32, rotate: 10, flipX: true, anchor: 'bottom', opacity: 0.85 },
]

const LOTUS_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: LOTUS, x: -16, y: 0, w: 52, opacity: 0.9 },
  { src: LOTUS_LEAF, x: 58, y: 4, w: 40 },
  { src: LOTUS, x: 46, y: -8, w: 46, opacity: 0.48, anchor: 'bottom' },
  { src: LOTUS_LEAF, x: -6, y: 0, w: 36, flipX: true, anchor: 'bottom', opacity: 0.75 },
]

const PEARL_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: PEARL_ROSE, x: 56, y: -2, w: 48, opacity: 0.92 },
  { src: PEARL_BUTTERFLY, x: -2, y: 4, w: 24, rotate: -10 },
  { src: PEARL_STRAND, x: -24, y: 10, w: 36, opacity: 0.72 },
  { src: PEARL_ROSE, x: -14, y: -6, w: 44, flipX: true, opacity: 0.5, anchor: 'bottom' },
  { src: PEARL_BUTTERFLY, x: 72, y: 1, w: 20, rotate: 14, anchor: 'bottom', opacity: 0.85 },
]

const GARDEN_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#3a2a2e',
  muted: '#6b4a52',
  accent: '#9d4e63',
  textClass: 'text-[#3a2a2e]',
  mutedClass: 'text-[#6b4a52]',
  accentClass: 'text-[#9d4e63]',
  accentTextClass: 'text-[#7a3b4e]',
  textPlate: 'rgba(255,247,248,0.78)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const RED_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'red',
  coverRsvpColorId: 'gold',
  ink: '#2a1210',
  muted: '#5c2a22',
  accent: '#8a5a12',
  textClass: 'text-[#2a1210]',
  mutedClass: 'text-[#5c2a22]',
  accentClass: 'text-[#8a5a12]',
  accentTextClass: 'text-[#7a4a10]',
  textPlate: 'rgba(255,247,237,0.82)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
}

const SCARLET_LOOK: WeddingKitLook = {
  styleId: 'traditional_vietnamese',
  buttonColorId: 'wine',
  coverRsvpColorId: 'gold',
  ink: '#2a1210',
  muted: '#5c2a22',
  accent: '#9a3412',
  textClass: 'text-[#2a1210]',
  mutedClass: 'text-[#5c2a22]',
  accentClass: 'text-[#9a3412]',
  accentTextClass: 'text-[#7c2d0a]',
  textPlate: 'rgba(255,244,240,0.8)',
  fontClass: 'wedding-font-formal',
  shareFont: FORMAL_FONT,
}

const SKY_ORNAMENTS: readonly WeddingBackgroundOrnament[] = [
  { src: PEARL_BUTTERFLY, x: -4, y: 2, w: 22, rotate: -12, opacity: 0.9 },
  { src: PEARL_ROSE, x: 62, y: -4, w: 40, opacity: 0.85 },
  { src: PEARL_STRAND, x: -18, y: 8, w: 32, opacity: 0.7 },
  { src: PEARL_ROSE, x: -16, y: -4, w: 42, flipX: true, opacity: 0.55, anchor: 'bottom' },
  { src: PEARL_BUTTERFLY, x: 74, y: 2, w: 18, rotate: 16, anchor: 'bottom', opacity: 0.85 },
]

const SKY_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#2f3d4c',
  muted: '#5d6d7c',
  accent: '#b25b74',
  textClass: 'text-[#2f3d4c]',
  mutedClass: 'text-[#5d6d7c]',
  accentClass: 'text-[#b25b74]',
  accentTextClass: 'text-[#8d4560]',
  textPlate: 'rgba(255,248,252,0.8)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const PEARL_LOOK: WeddingKitLook = {
  styleId: 'floral',
  buttonColorId: 'rose',
  coverRsvpColorId: 'blush',
  ink: '#4a2c38',
  muted: '#7a4e5c',
  accent: '#b05a78',
  textClass: 'text-[#4a2c38]',
  mutedClass: 'text-[#7a4e5c]',
  accentClass: 'text-[#b05a78]',
  accentTextClass: 'text-[#8d4560]',
  textPlate: 'rgba(255,248,250,0.8)',
  fontClass: 'wedding-font-soft',
  shareFont: SOFT_FONT,
}

const LOTUS_LOOK: WeddingKitLook = {
  styleId: 'luxury',
  buttonColorId: 'gold',
  coverRsvpColorId: 'champagne',
  ink: '#3b2618',
  muted: '#5c4632',
  accent: '#8a5a12',
  textClass: 'text-[#3b2618]',
  mutedClass: 'text-[#5c4632]',
  accentClass: 'text-[#8a5a12]',
  accentTextClass: 'text-[#6b4310]',
  textPlate: 'rgba(255,248,230,0.82)',
  fontClass: 'wedding-font-lotus',
  shareFont: SOFT_FONT,
}

/**
 * Bộ nền có sẵn. Chọn một bộ là đổi nền, khung, hoa nổi, màu nút, màu chữ, nền chữ và kiểu chữ.
 * plates nằm dưới ảnh và chữ. ornaments là PNG màu nước nổi trên chữ.
 */
export type WeddingBackgroundPreset = {
  id: string
  plates: readonly string[]
  ornaments: readonly WeddingBackgroundOrnament[]
  /** Khung vỏ đi cùng bộ nền. */
  coverPresetId: string
  look: WeddingKitLook
  label: Record<WebLocale, string>
}

export const WEDDING_BACKGROUND_PRESETS: WeddingBackgroundPreset[] = [
  {
    id: 'vuon-kinh-hong',
    plates: ['/wedding/backgrounds/vuon-kinh-hong-wash.jpg'],
    ornaments: GARDEN_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: GARDEN_LOOK,
    label: {
      vi: 'Vườn kính hồng',
      en: 'Pink glass garden',
      zh: '粉玻璃花园',
      ja: 'ピンクのガラスガーデン',
      ko: '핑크 글라스 가든',
    },
  },
  {
    id: 'long-phung-do',
    plates: ['/wedding/backgrounds/long-phung-do-1.jpg', '/wedding/backgrounds/long-phung-do-2.jpg'],
    ornaments: PEONY_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: RED_LOOK,
    label: {
      vi: 'Long phụng đỏ',
      en: 'Red dragon and phoenix',
      zh: '龙凤正红',
      ja: '龍鳳・赤',
      ko: '용봉 빨강',
    },
  },
  {
    id: 'do-son',
    plates: ['/wedding/backgrounds/do-son.jpg'],
    ornaments: SCARLET_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: SCARLET_LOOK,
    label: {
      vi: 'Đỏ son',
      en: 'Scarlet',
      zh: '正红',
      ja: '朱色',
      ko: '진홍',
    },
  },
  {
    id: 'sen-vang',
    plates: ['/wedding/backgrounds/sen-vang.jpg'],
    ornaments: LOTUS_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: LOTUS_LOOK,
    label: {
      vi: 'Sen vàng',
      en: 'Gold lotus',
      zh: '金莲',
      ja: '金の蓮',
      ko: '금색 연꽃',
    },
  },
  {
    id: 'hong-ngoc-trai',
    plates: [
      '/wedding/backgrounds/hong-ngoc-trai-1.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-wash.jpg',
      '/wedding/backgrounds/hong-ngoc-trai-2.jpg',
    ],
    ornaments: PEARL_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: PEARL_LOOK,
    label: {
      vi: 'Hồng ngọc trai',
      en: 'Pearl blush',
      zh: '珍珠粉霞',
      ja: 'パールブラッシュ',
      ko: '펄 블러시',
    },
  },
  {
    id: 'vuon-hong-troi',
    plates: ['/wedding/backgrounds/vuon-hong-troi.jpg'],
    ornaments: SKY_ORNAMENTS,
    coverPresetId: 'pearl_rose',
    look: SKY_LOOK,
    label: {
      vi: 'Vườn hồng trời',
      en: 'Rose garden sky',
      zh: '玫瑰蓝天',
      ja: '薔薇の青空',
      ko: '장미 하늘',
    },
  },
]

const PRESET_BY_ID = new Map(WEDDING_BACKGROUND_PRESETS.map((preset) => [preset.id, preset]))

export function findWeddingBackgroundPreset(id: string | null | undefined): WeddingBackgroundPreset | undefined {
  const key = id?.trim() || ''
  return key ? PRESET_BY_ID.get(key) : undefined
}

export function labelForWeddingBackgroundPreset(locale: WebLocale, preset: WeddingBackgroundPreset): string {
  return preset.label[locale] ?? preset.label.en
}

const STYLE_COVER_FRAME: Record<string, { frame: string; buttonColorId: WeddingButtonColorId; coverRsvpColorId: WeddingButtonColorId }> = {
  floral: { frame: 'pearl_rose', buttonColorId: 'rose', coverRsvpColorId: 'blush' },
  traditional_vietnamese: { frame: 'pearl_rose', buttonColorId: 'red', coverRsvpColorId: 'gold' },
  luxury: { frame: 'pearl_rose', buttonColorId: 'gold', coverRsvpColorId: 'champagne' },
  vintage: { frame: 'pearl_rose', buttonColorId: 'bronze', coverRsvpColorId: 'cream' },
  ethereal: { frame: 'pearl_rose', buttonColorId: 'chocolate', coverRsvpColorId: 'ivory' },
  minimal: { frame: 'pearl_rose', buttonColorId: 'black', coverRsvpColorId: 'ivory' },
  modern: { frame: 'pearl_rose', buttonColorId: 'cream', coverRsvpColorId: 'gold' },
}

export function weddingFramePatchForStyle(styleId: string | null | undefined) {
  const match = STYLE_COVER_FRAME[styleId?.trim() || ''] ?? STYLE_COVER_FRAME.floral
  return {
    coverPresetId: match.frame,
    coverFrameMode: 'preset' as const,
    groomPortraitShellMode: 'preset' as const,
    groomPortraitShellPresetId: match.frame,
    bridePortraitShellMode: 'preset' as const,
    bridePortraitShellPresetId: match.frame,
    buttonColorId: match.buttonColorId,
    coverRsvpColorId: match.coverRsvpColorId,
  }
}

const STYLE_KIT_ID: Record<string, string> = {
  floral: 'vuon-kinh-hong',
  ethereal: 'vuon-kinh-hong',
  traditional_vietnamese: 'long-phung-do',
  luxury: 'sen-vang',
  vintage: 'sen-vang',
  modern: 'sen-vang',
  minimal: 'vuon-kinh-hong',
}

export function weddingAiBackgroundKit(styleId: string | null | undefined): WeddingBackgroundPreset {
  const style = styleId?.trim() || 'luxury'
  const source = findWeddingBackgroundPreset(STYLE_KIT_ID[style] || 'vuon-kinh-hong') ?? WEDDING_BACKGROUND_PRESETS[0]
  return { ...source, id: `ai-${style}`, plates: [] }
}

export function resolveWeddingChromeKit(input: {
  backgroundPresetId?: string
  backgroundKitStyleId?: string
}): WeddingBackgroundPreset | undefined {
  return findWeddingBackgroundPreset(input.backgroundPresetId) ?? (
    input.backgroundKitStyleId ? weddingAiBackgroundKit(input.backgroundKitStyleId) : undefined
  )
}

export function weddingAiKitSectionPatch(styleId: string | null | undefined) {
  const kit = weddingAiBackgroundKit(styleId)
  return {
    backgroundPresetId: '',
    backgroundKitStyleId: styleId?.trim() || 'luxury',
    ...weddingKitFramePatch(kit),
    buttonColorId: kit.look.buttonColorId,
    coverRsvpColorId: kit.look.coverRsvpColorId,
  }
}

export type WeddingLinkedFrame = {
  imageUrl: string
  hole: { x: number; y: number; w: number; h: number }
  panel: string
  ink: 'dark' | 'light'
  referenceImageUrl?: string
}

/** Khung AI vẽ cho đúng tấm nền, hoặc khung được dùng làm mẫu khi tạo tấm nền đó. */
export function findWeddingFrameForBackground(
  backgroundUrl: string | null | undefined,
  backgrounds: { imageUrl: string; referenceImageUrl?: string }[],
  frames: WeddingLinkedFrame[],
): WeddingLinkedFrame | undefined {
  const url = backgroundUrl?.trim() || ''
  if (!url) return undefined
  const designed = frames.find((frame) => frame.referenceImageUrl?.trim() === url)
  if (designed) return designed
  const reference = backgrounds.find((item) => item.imageUrl === url)?.referenceImageUrl?.trim() || ''
  if (!reference) return undefined
  return frames.find((frame) => frame.imageUrl === reference)
}

export function weddingPairedFrameSectionPatch(frame: WeddingLinkedFrame) {
  return {
    coverFrameMode: 'library' as const,
    coverAiFrameUrl: frame.imageUrl,
    coverAiFrameHole: frame.hole,
    coverAiFramePanel: frame.panel,
    coverAiFrameInk: frame.ink,
    groomPortraitShellMode: 'library' as const,
    groomPortraitShellUrl: frame.imageUrl,
    groomPortraitShellHole: frame.hole,
    groomPortraitShellPanel: frame.panel,
    bridePortraitShellMode: 'library' as const,
    bridePortraitShellUrl: frame.imageUrl,
    bridePortraitShellHole: frame.hole,
    bridePortraitShellPanel: frame.panel,
  }
}

export function weddingUsesPairedAiFrame(section: {
  backgroundPresetId?: string
  coverFrameMode?: string
  coverAiFrameUrl?: string
}): boolean {
  if (section.backgroundPresetId) return false
  const mode = section.coverFrameMode
  return (mode === 'library' || mode === 'ai') && Boolean(section.coverAiFrameUrl?.trim())
}

export function weddingKitFramePatch(preset: WeddingBackgroundPreset) {
  return {
    coverPresetId: preset.coverPresetId,
    coverFrameMode: 'preset' as const,
    groomPortraitShellMode: 'preset' as const,
    groomPortraitShellPresetId: preset.coverPresetId,
    bridePortraitShellMode: 'preset' as const,
    bridePortraitShellPresetId: preset.coverPresetId,
  }
}

export function applyWeddingKitTheme(theme: WeddingTheme, preset: WeddingBackgroundPreset | null | undefined): WeddingTheme {
  if (!preset) return theme
  return {
    ...theme,
    text: preset.look.textClass,
    mutedText: preset.look.mutedClass,
    accent: preset.look.accentClass,
    accentText: preset.look.accentTextClass,
  }
}

export function weddingKitSurface(preset: WeddingBackgroundPreset | null | undefined): {
  className: string
  style?: CSSProperties
} {
  if (!preset) return { className: '' }
  return {
    className: preset.look.fontClass,
    style: { '--wedding-text-plate': preset.look.textPlate } as CSSProperties,
  }
}

/**
 * Nhịp icon gốc (seed / reset) — cỡ + khoảng cách theo máy.
 * Sửa nhanh vẫn ghi đè bằng data-pw-chrome-size / data-pw-kit-gap / data-pw-float-*.
 */
import type { VisualDeviceVariant } from '@/lib/partner-website/visual-editor/visual-editor-pages'

export type ChromeRhythmDevice = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export function chromeRhythmDevice(device?: VisualDeviceVariant | null): ChromeRhythmDevice {
  if (device === 'laptop' || device === 'tablet' || device === 'mobile') return device
  return 'desktop'
}

/** Glyph cụm phải head (px). */
export const PW_HEAD_ICON_SIZE = {
  desktop: 20,
  laptop: 18,
  tablet: 20,
  mobile: 22,
} as const

/** Gap flex giữa icon cụm phải head (px). */
export const PW_HEAD_KIT_GAP = {
  desktop: 8,
  laptop: 6,
  tablet: 6,
  mobile: 4,
} as const

/** Ô tìm: kính / camera (px). */
export const PW_SEARCH_ICON_SIZE = {
  desktop: 18,
  laptop: 16,
  tablet: 18,
  mobile: 18,
} as const

export const PW_SEARCH_FORM_HEIGHT = {
  desktop: 36,
  laptop: 36,
  tablet: 40,
  mobile: 40,
} as const

/** Glyph thanh đáy shop (px). */
export const PW_DOCK_ICON_SIZE = {
  desktop: 22,
  laptop: 22,
  tablet: 22,
  mobile: 24,
} as const

export const PW_DOCK_BAR_MIN_H = {
  tablet: 56,
  mobile: 60,
} as const

/** Glyph 3 icon trái PDP (px). Cột 44 giữ. */
export const PW_PDP_DOCK_GLYPH = {
  tablet: 17,
  mobile: 18,
} as const

export type ChromeFloatRhythm = {
  size: number
  gap: number
  right: number
  bottom: number
}

export const PW_FLOAT_RHYTHM: Record<ChromeRhythmDevice, ChromeFloatRhythm> = {
  desktop: { size: 44, gap: 56, right: 16, bottom: 88 },
  laptop: { size: 40, gap: 52, right: 16, bottom: 80 },
  tablet: { size: 44, gap: 56, right: 16, bottom: 88 },
  mobile: { size: 48, gap: 64, right: 12, bottom: 72 },
}

export function chromeHeadIconSizeForDevice(device?: VisualDeviceVariant | null): number {
  return PW_HEAD_ICON_SIZE[chromeRhythmDevice(device)]
}

export function chromeHeadKitGapForDevice(device?: VisualDeviceVariant | null): number {
  return PW_HEAD_KIT_GAP[chromeRhythmDevice(device)]
}

export function chromeDockIconSizeForDevice(device?: VisualDeviceVariant | null): number {
  return PW_DOCK_ICON_SIZE[chromeRhythmDevice(device)]
}

export function chromeFloatRhythmForDevice(device?: VisualDeviceVariant | null): ChromeFloatRhythm {
  return PW_FLOAT_RHYTHM[chromeRhythmDevice(device)]
}

export function chromeSearchIconSizeForDevice(device?: VisualDeviceVariant | null): number {
  return PW_SEARCH_ICON_SIZE[chromeRhythmDevice(device)]
}

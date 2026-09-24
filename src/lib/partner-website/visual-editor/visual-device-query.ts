import { PW_SCENE_WIDTH, pwSceneWidth } from '@/lib/partner-website/visual-editor/pw-coordinate-space'

/** Device stamp for Sửa nhanh / live. Kept in this file so client islands do not import page HTML factories. */
export type VisualDeviceVariant = 'desktop' | 'laptop' | 'tablet' | 'mobile'

export const VISUAL_DEVICE_VARIANTS: VisualDeviceVariant[] = ['desktop', 'laptop', 'tablet', 'mobile']

/** Same width as Sửa nhanh Mobile iframe — public ?pw-device=mobile must match. */
export const VISUAL_MOBILE_PREVIEW_PX = PW_SCENE_WIDTH.mobile
/** Same width as Sửa nhanh Tablet iframe — public ?pw-device=tablet must match. */
export const VISUAL_TABLET_PREVIEW_PX = PW_SCENE_WIDTH.tablet
/** Same width as Sửa nhanh Laptop iframe — public ?pw-device=laptop must match. */
export const VISUAL_LAPTOP_PREVIEW_PX = PW_SCENE_WIDTH.laptop
/** Public tablet band ends just below. Wide desktop starts here when a laptop HTML exists. */
export const VISUAL_DESKTOP_MIN_PX = PW_SCENE_WIDTH.laptop
/** Wide desktop canvas (Sửa nhanh Desktop / composed split when laptop HTML exists). */
export const VISUAL_WIDE_DESKTOP_MIN_PX = PW_SCENE_WIDTH.desktop

/** Canvas width for Sửa nhanh / `?pw-device=` — centered on the screen midpoint. */
export function visualDeviceCanvasWidth(device: VisualDeviceVariant): number {
  return pwSceneWidth(device)
}

export function visualDevicePreviewFrameStyle(
  device: VisualDeviceVariant | null
): { width?: number; minWidth?: number } {
  if (!device) return {}
  const width = visualDeviceCanvasWidth(device)
  return { width, minWidth: width }
}

/**
 * Docked DevTools shrinks `innerWidth` (CSS viewport) but not `outerWidth` (browser window).
 * Use this so F12 does not switch the composed shop from desktop to tablet.
 * Device-mode F12 spoofs a phone UA — do not lock that to desktop.
 * Real phones/tablets keep outerWidth below 1280.
 */
export function isDesktopBrowserWindow(
  win?: { outerWidth?: number; navigator?: { userAgent?: string } } | null
): boolean {
  const ua =
    win?.navigator?.userAgent ??
    (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  if (/ipad|tablet|kindle|silk/i.test(ua)) return false
  if (/mobile|iphone|ipod|android/i.test(ua)) return false
  const outer =
    win?.outerWidth ?? (typeof window !== 'undefined' ? window.outerWidth : 0)
  return (outer || 0) >= VISUAL_DESKTOP_MIN_PX
}

export function parseVisualDeviceVariant(raw: unknown): VisualDeviceVariant {
  return raw === 'mobile' || raw === 'tablet' || raw === 'laptop' ? raw : 'desktop'
}

/** Query `?pw-device=` from Sửa nhanh → Xem. Null = responsive composed page. */
export function parseVisualDeviceQuery(raw: unknown): VisualDeviceVariant | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return v === 'mobile' || v === 'tablet' || v === 'laptop' || v === 'desktop' ? v : null
}

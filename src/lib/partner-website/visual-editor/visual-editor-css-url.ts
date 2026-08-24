import { logoAspectFromSize } from './build-logo-slot-prompt'

/** First `url(...)` in a CSS background-image value (skips gradients). */
export function extractFirstCssUrl(cssValue: string): string {
  const m = cssValue.match(/url\(\s*(['"]?)([^"')]+)\1\s*\)/i)
  return m?.[2]?.trim() ?? ''
}

/** Replace every `url(...)` in a background-image, keeping gradients. */
export function replaceCssBackgroundUrl(cssValue: string, nextUrl: string): string {
  const safe = nextUrl.replace(/['")]/g, '').trim()
  const wrapped = `url('${safe}')`
  if (!cssValue.trim() || !/url\(/i.test(cssValue)) return wrapped
  return cssValue.replace(/url\(\s*(['"]?)([^"')]+)\1\s*\)/gi, wrapped)
}

export function clampOverlayPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(80, Math.round(n)))
}

export function clampPaddingPx(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(160, Math.round(n)))
}

/** Tick «Dùng ảnh hiện tại làm tham khảo» when the selection actually has a photo. */
export function shouldUseCurrentImageAsRef(sel: {
  src?: string
  isLogo?: boolean
  logoFace?: string
  isImage?: boolean
  isBgImage?: boolean
  isBannerPhoto?: boolean
}): boolean {
  const src = String(sel.src || '').trim()
  if (!src) return false
  if (/^data:/i.test(src)) return false
  if (sel.isLogo) return sel.logoFace === 'image'
  return Boolean(sel.isImage || sel.isBgImage || sel.isBannerPhoto)
}

export function inferVisualEditImageKind(sel: {
  isLogo?: boolean
  isBgImage?: boolean
  isBannerPhoto?: boolean
  width?: number
  height?: number
}): { kind: 'logo' | 'banner' | 'product_photo'; aspectRatio: string } {
  const w = Number(sel.width) || 0
  const h = Number(sel.height) || 0
  const aspect = w > 0 && h > 0 ? logoAspectFromSize(w, h) : '1:1'
  if (sel.isLogo) {
    return { kind: 'logo', aspectRatio: aspect }
  }
  if (sel.isBannerPhoto) return { kind: 'banner', aspectRatio: w > 0 && h > 0 ? aspect : '16:9' }
  if (sel.isBgImage) return { kind: 'banner', aspectRatio: w > 0 && h > 0 ? aspect : '16:9' }
  if (w > 0 && h > 0) {
    const r = w / h
    if (r >= 1.4) return { kind: 'banner', aspectRatio: aspect }
    if (r <= 0.75) return { kind: 'product_photo', aspectRatio: aspect }
    return { kind: 'product_photo', aspectRatio: aspect }
  }
  return { kind: 'product_photo', aspectRatio: '1:1' }
}
